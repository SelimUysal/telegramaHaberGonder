"""Private SMTP delivery and compact, non-sensitive local message history."""
from __future__ import annotations

import hashlib
import json
import os
import re
import smtplib
import ssl
import tempfile
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from html import escape
from pathlib import Path
from zoneinfo import ZoneInfo

STATE_VERSION = 1


def load_state(filename: Path) -> dict:
    try:
        state = json.loads(filename.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {"version": STATE_VERSION, "sent": {}}
    if (not isinstance(state, dict) or state.get("version") != STATE_VERSION
            or not isinstance(state.get("sent"), dict)
            or any(not re.fullmatch(r"[a-f0-9]{64}", key) for key in state["sent"])):
        raise ValueError("Invalid state file; refusing to erase sent history")
    return state


def record_delivered(state: dict, articles: list, now: datetime, keep_days: int = 120) -> None:
    cutoff = now - timedelta(days=keep_days)
    state["sent"] = {key: value for key, value in state["sent"].items()
                     if _valid_recent_date(value, cutoff)}
    for item in articles:
        state["sent"][item.identifier] = now.isoformat(timespec="seconds")


def _valid_recent_date(raw: str, cutoff: datetime) -> bool:
    try:
        value = datetime.fromisoformat(raw)
        return value.tzinfo is not None and value >= cutoff
    except (TypeError, ValueError):
        return False


def save_state(filename: Path, state: dict) -> None:
    filename.parent.mkdir(parents=True, exist_ok=True)
    if filename.exists() and filename.is_symlink():
        raise ValueError("State path cannot be a symlink")
    descriptor, tmp = tempfile.mkstemp(prefix=".digest-", suffix=".tmp", dir=filename.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            os.chmod(tmp, 0o600)
            json.dump(state, stream, ensure_ascii=False, indent=2, sort_keys=True)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(tmp, filename)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def render_message(articles: list, now: datetime, zone: str) -> tuple[str, str, str]:
    local = now.astimezone(ZoneInfo(zone))
    day = local.strftime("%d.%m.%Y")
    subject = f"Günlük haber özeti | {day} | {len(articles)} haber"
    plaintext = [f"GÜNLÜK HABER ÖZETİ — {day}", "", f"{len(articles)} yeni haber", ""]
    cards = []
    for index, article in enumerate(articles, 1):
        summary = article.summary[:260].strip()
        plaintext.extend([f"{index}. {article.title}", f"Kaynak: {article.source}",
                          summary, article.url, ""])
        cards.append(
            '<article style="border-bottom:1px solid #ddd;padding:18px 0">'
            f'<p style="font-size:12px;color:#666">{escape(article.source)}</p>'
            f'<h2 style="font-size:18px;line-height:1.4">{escape(article.title)}</h2>'
            f'<p style="font-size:14px;line-height:1.5">{escape(summary)}</p>'
            f'<a href="{escape(article.url, quote=True)}">Haberi oku</a>'
            '</article>'
        )
    markup = ('<!doctype html><html lang="tr"><head><meta charset="utf-8"></head>'
              '<body style="margin:0;background:#f5f6f8;font-family:Arial,sans-serif">'
              '<main style="max-width:660px;margin:24px auto;padding:26px;background:#fff">'
              f'<h1>Günlük haber özetin</h1><p>{day} · {len(articles)} yeni haber</p>'
              + "".join(cards)
              + '<p style="font-size:12px;color:#666">Kaynak başlıkları ve özetleri '
                'yayıncıların RSS/Atom akışlarından alınmıştır.</p></main></body></html>')
    return subject, "\n".join(plaintext), markup


def _address(value: str, label: str) -> str:
    if not value or "\r" in value or "\n" in value or any(c in value for c in " ;,"):
        raise ValueError(f"Invalid or missing {label}")
    # Pragmatic validation: addresses are private configuration, not untrusted user submissions.
    if value.count("@") != 1 or value.startswith("@") or value.endswith("@"):
        raise ValueError(f"Invalid or missing {label}")
    return value


def smtp_send(articles: list, now: datetime, zone: str) -> None:
    username = _address(os.environ.get("SMTP_USER", ""), "SMTP_USER")
    recipient = _address(os.environ.get("EMAIL_TO", ""), "EMAIL_TO")
    password = os.environ.get("SMTP_PASSWORD", "")
    if not password:
        raise ValueError("SMTP_PASSWORD secret is missing")
    host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    if host != "smtp.gmail.com":
        raise ValueError("Only smtp.gmail.com is enabled in this initial Gmail configuration")
    subject, plaintext, markup = render_message(articles, now, zone)
    message = EmailMessage()
    message["From"] = username
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(plaintext)
    message.add_alternative(markup, subtype="html")
    with smtplib.SMTP_SSL(host, 465, timeout=30, context=ssl.create_default_context()) as smtp:
        smtp.login(username, password)
        smtp.send_message(message)
