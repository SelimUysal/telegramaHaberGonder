"""RSS/Atom ingestion, URL normalization, freshness checks and topic filters."""
from __future__ import annotations

import hashlib
import html
import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

MAX_FEED_BYTES = 2_000_000
MAX_ENTRIES_PER_FEED = 200
TRACKING_KEYS = {"fbclid", "gclid", "mc_cid", "mc_eid", "yclid"}


class _HTMLText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


def strip_html(value: str) -> str:
    parser = _HTMLText()
    parser.feed(value or "")
    return re.sub(r"\s+", " ", html.unescape(" ".join(parser.parts))).strip()


def fold(value: str) -> str:
    # Handle dotted/dotless i consistently for Turkish news searches.
    value = str(value).replace("ı", "i").replace("İ", "I")
    value = unicodedata.normalize("NFKD", value.casefold())
    return "".join(c for c in value if not unicodedata.combining(c))


def canonical_url(raw: str, base: str = "") -> str | None:
    if not isinstance(raw, str) or not raw.strip():
        return None
    try:
        url = urlsplit(urljoin(base, raw.strip()))
        if url.scheme.lower() not in {"http", "https"} or not url.hostname or url.username or url.password:
            return None
        query = urlencode(sorted(
            (k, v) for k, v in parse_qsl(url.query, keep_blank_values=True)
            if not k.lower().startswith("utm_") and k.lower() not in TRACKING_KEYS
        ))
        normalized = urlunsplit((url.scheme.lower(), url.netloc.lower(), url.path or "/", query, ""))
        return normalized if len(normalized) <= 2048 else None
    except ValueError:
        return None


@dataclass(frozen=True)
class Article:
    identifier: str
    title: str
    url: str
    source: str
    summary: str
    published: datetime | None


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].split(":")[-1].lower()


def _child(node, *names):
    targets = set(names)
    for item in node:
        if _local(item.tag) in targets:
            return item
    return None


def _txt(node) -> str:
    if node is None:
        return ""
    return " ".join(node.itertext()).strip()


def parse_date(raw: str) -> datetime | None:
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(raw.strip().replace("Z", "+00:00"))
    except ValueError:
        try:
            parsed = parsedate_to_datetime(raw.strip())
        except (TypeError, ValueError, IndexError, OverflowError):
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def parse_feed(data: bytes, source: dict) -> list[Article]:
    if len(data) > MAX_FEED_BYTES:
        raise ValueError("Feed exceeds size limit")
    root = ET.fromstring(data)
    root_type = _local(root.tag)
    if root_type == "rss":
        channel = _child(root, "channel")
        if channel is None:
            raise ValueError("RSS channel missing")
        entries = [node for node in channel if _local(node.tag) == "item"]
    elif root_type == "feed":  # Atom 1.0
        entries = [node for node in root if _local(node.tag) == "entry"]
    elif root_type == "rdf":  # RSS 1.0
        entries = [node for node in root if _local(node.tag) == "item"]
    else:
        raise ValueError("Expected RSS or Atom XML")
    if not entries:
        raise ValueError("Feed contains no entries")

    result: list[Article] = []
    seen: set[str] = set()
    for entry in entries[:MAX_ENTRIES_PER_FEED]:
        title = strip_html(_txt(_child(entry, "title")))[:300]
        if root_type == "feed":
            links = [node for node in entry if _local(node.tag) == "link"]
            selected = next((link for link in links if link.get("rel", "alternate") == "alternate"), None)
            href = selected.get("href", "") if selected is not None else ""
            when = _txt(_child(entry, "published", "updated"))
            summary = _txt(_child(entry, "summary", "content"))
        else:
            href = _txt(_child(entry, "link"))
            when = _txt(_child(entry, "pubdate", "date", "published"))
            summary = _txt(_child(entry, "description", "encoded", "summary"))
        url = canonical_url(href, source["url"])
        if not title or not url:
            continue
        identifier = hashlib.sha256(url.encode("utf-8")).hexdigest()
        if identifier in seen:
            continue
        seen.add(identifier)
        result.append(Article(identifier, title, url, source["name"],
                              strip_html(summary)[:700], parse_date(when)))
    return result


def fetch_feed(source: dict, timeout: float = 20.0) -> list[Article]:
    url = canonical_url(source["url"])
    if not url or not url.startswith("https://"):
        raise ValueError("RSS/Atom feed URL must be HTTPS")
    request = Request(url, headers={
        "User-Agent": "DailyPersonalDigest/1.0 (RSS reader)",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    })
    with urlopen(request, timeout=timeout) as response:
        data = response.read(MAX_FEED_BYTES + 1)
    return parse_feed(data, source)


def matches(article: Article, config: dict, source: dict, now: datetime) -> bool:
    lookback = timedelta(hours=config.get("lookback_hours", 36))
    if article.published is None:
        if not config.get("allow_undated", False):
            return False
    elif article.published > now + timedelta(minutes=10) or now - article.published > lookback:
        return False
    haystack = fold(article.title + " " + article.summary)
    for scope in (config, source):
        includes = scope.get("include_keywords", [])
        excludes = scope.get("exclude_keywords", [])
        if includes and not any(fold(word) in haystack for word in includes):
            return False
        if any(fold(word) in haystack for word in excludes):
            return False
    return True
