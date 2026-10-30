"""CLI: python -m email_digest [--send]. No credentials needed in preview."""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from .collector import matches
from .category import fetch_source
from .delivery import load_state, record_delivered, save_state, smtp_send

DEFAULT_CONFIG = Path(__file__).with_name("config.json")
DEFAULT_STATE = Path(__file__).parent / "data" / "sent.json"


def load_config(filename: Path) -> dict:
    config = json.loads(filename.read_text(encoding="utf-8"))
    if not isinstance(config, dict):
        raise ValueError("Config must be an object")
    if not isinstance(config.get("enabled"), bool):
        raise ValueError("enabled must be true or false")
    sources = config.get("sources")
    if not isinstance(sources, list) or len(sources) > 25:
        raise ValueError("sources must be an array with at most 25 entries")
    for source in sources:
        mode = source.get("mode", "rss") if isinstance(source, dict) else None
        if mode not in {"rss", "smithsonian_category"}:
            raise ValueError("Unsupported source mode: " + str(mode))
        if (not isinstance(source, dict) or not isinstance(source.get("name"), str)
                or not source["name"].strip() or not isinstance(source.get("url"), str)
                or not source["url"].startswith("https://")):
            raise ValueError("Each source needs a name and an HTTPS RSS/Atom URL")
        for key in ("include_keywords", "exclude_keywords"):
            if key in source and (not isinstance(source[key], list)
                                  or any(not isinstance(word, str) or not word.strip() for word in source[key])):
                raise ValueError(key + " must be a list of nonempty strings")
        if "lookback_hours" in source and (type(source["lookback_hours"]) is not int
                                           or not 1 <= source["lookback_hours"] <= 24 * 365):
            raise ValueError("Source lookback_hours must be between 1 and 8760")
        if "max_entries" in source and (type(source["max_entries"]) is not int
                                       or not 1 <= source["max_entries"] <= 30):
            raise ValueError("Source max_entries must be between 1 and 30")
    for key in ("include_keywords", "exclude_keywords"):
        if not isinstance(config.get(key, []), list) or any(
            not isinstance(word, str) or not word.strip() for word in config.get(key, [])
        ):
            raise ValueError(key + " must be a list of nonempty strings")
    for key, low, high in (("lookback_hours", 1, 168), ("max_items", 1, 100)):
        value = config.get(key)
        if type(value) is not int or not low <= value <= high:
            raise ValueError(f"{key} must be an integer between {low} and {high}")
    if not isinstance(config.get("time_zone"), str) or not config["time_zone"]:
        raise ValueError("time_zone must be configured")
    if not isinstance(config.get("allow_undated", False), bool):
        raise ValueError("allow_undated must be a boolean")
    return config


def run(config: dict, *, send: bool = False, now: datetime | None = None,
        state_file: Path = DEFAULT_STATE, fetcher=fetch_source, sender=smtp_send) -> dict:
    now = now or datetime.now(timezone.utc)
    if not config["enabled"] or not config["sources"]:
        print("Daily digest not configured; no email sent.")
        return {"status": "not_configured", "selected": 0, "sent": False}
    if now.tzinfo is None:
        raise ValueError("now must have timezone information")

    state = load_state(state_file)
    found = {}
    source_errors = []
    for source in config["sources"]:
        try:
            articles = fetcher(source)
            for article in articles:
                if (article.identifier not in found and article.identifier not in state["sent"]
                        and matches(article, config, source, now)):
                    found[article.identifier] = article
            print(f"Source processed: {source['name']} ({len(articles)} entries)")
        except Exception as error:
            print(f"Source failed: {source['name']} ({type(error).__name__})")
            source_errors.append(source["name"])
    # Never send an incomplete digest when a source fails.
    if source_errors:
        raise RuntimeError(f"{len(source_errors)} feed(s) unavailable; email was not sent")
    articles = sorted(found.values(), key=lambda item: item.published or now, reverse=True)
    selected = articles[:config["max_items"]]
    if not selected:
        print("No new matching articles; email skipped.")
        return {"status": "no_matches", "selected": 0, "sent": False}
    if not send:
        print(f"PREVIEW: {len(selected)} matching articles (email not sent, state not modified)")
        for item in selected:
            print(f"  [{item.source}] {item.title[:100]}")
        return {"status": "preview", "selected": len(selected), "sent": False}

    # SMTP acknowledgment precedes saving IDs. If state commit/push subsequently fails,
    # the next run may resend; exactly-once delivery cannot be guaranteed with SMTP.
    sender(selected, now, config["time_zone"])
    record_delivered(state, selected, now)
    save_state(state_file, state)
    print(f"Email accepted by SMTP provider; {len(selected)} articles recorded")
    return {"status": "delivered", "selected": len(selected), "sent": True}


def main() -> None:
    parser = argparse.ArgumentParser(description="Free personal daily RSS-to-email digest")
    parser.add_argument("--send", action="store_true", help="Actually send via SMTP; preview by default")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--state-file", type=Path, default=DEFAULT_STATE)
    args = parser.parse_args()
    run(load_config(args.config), send=args.send, state_file=args.state_file)


if __name__ == "__main__":
    main()
