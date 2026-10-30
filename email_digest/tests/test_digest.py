import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from email_digest.collector import Article, canonical_url, fold, matches, parse_feed
from email_digest.delivery import load_state, record_delivered, render_message, save_state
from email_digest.main import load_config, run

NOW = datetime(2026, 10, 30, 12, tzinfo=timezone.utc)
SOURCE = {"name": "Sample", "url": "https://example.com/feed.xml", "include_keywords": []}
CONFIG = {"enabled": True, "sources": [SOURCE], "time_zone": "Europe/Istanbul",
          "lookback_hours": 36, "max_items": 10, "allow_undated": False,
          "include_keywords": [], "exclude_keywords": []}


class DigestTests(unittest.TestCase):
    def article(self, identifier="a"):
        return Article(identifier, "Yapay Zekâ LLM haberi", "https://example.com/story", "Sample",
                       "Bir yazılım haberi", NOW)

    def test_feed_rss(self):
        xml = b'<rss version="2.0"><channel><item><title>Test news</title><link>https://example.com/a?utm_source=x</link><description>Short description</description><pubDate>Fri, 30 Oct 2026 11:00:00 GMT</pubDate></item></channel></rss>'
        items = parse_feed(xml, SOURCE)
        self.assertEqual(items[0].url, "https://example.com/a")
        self.assertEqual(items[0].published.hour, 11)

    def test_atom(self):
        xml = b'<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Another story</title><link rel="alternate" href="https://example.com/a"/><updated>2026-10-30T11:00:00Z</updated></entry></feed>'
        self.assertEqual(len(parse_feed(xml, SOURCE)), 1)

    def test_invalid_feed(self):
        with self.assertRaises(ValueError):
            parse_feed(b'<html></html>', SOURCE)

    def test_url_security(self):
        self.assertIsNone(canonical_url("javascript:alert(1)", SOURCE["url"]))
        self.assertIsNone(canonical_url("https://user:pass@example.com/", SOURCE["url"]))
        self.assertEqual(canonical_url("/a?fbclid=x", "https://example.com/rss"), "https://example.com/a")

    def test_turkish_keywords(self):
        self.assertIn("istanbul", fold("İSTANBUL"))
        config = {**CONFIG, "include_keywords": ["yapay zeka"]}
        self.assertTrue(matches(self.article(), config, SOURCE, NOW))
        self.assertFalse(matches(self.article(), {**config, "exclude_keywords": ["LLM"]}, SOURCE, NOW))

    def test_unknown_dates_excluded(self):
        item = self.article()
        item = Article(item.identifier, item.title, item.url, item.source, item.summary, None)
        self.assertFalse(matches(item, CONFIG, SOURCE, NOW))

    def test_no_sources_never_sends(self):
        result = run({**CONFIG, "sources": []}, send=True)
        self.assertEqual(result["status"], "not_configured")

    def test_preview_does_not_send_or_persist(self):
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / "history.json"
            def fail_sender(*args):
                self.fail("Preview must never send")
            result = run(CONFIG, send=False, now=NOW, state_file=target,
                         fetcher=lambda source: [self.article()], sender=fail_sender)
            self.assertEqual(result["status"], "preview")
            self.assertFalse(target.exists())

    def test_failed_smtp_preserves_history(self):
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / "history.json"
            def fail_sender(*args):
                raise RuntimeError("Simulated SMTP outage")
            with self.assertRaisesRegex(RuntimeError, "SMTP outage"):
                run(CONFIG, send=True, now=NOW, state_file=target,
                    fetcher=lambda source: [self.article()], sender=fail_sender)
            self.assertFalse(target.exists())

    def test_successful_delivery_deduplicated(self):
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / "history.json"
            sent = []
            args = dict(send=True, now=NOW, state_file=target,
                        fetcher=lambda source: [self.article()],
                        sender=lambda articles, now, zone: sent.append(articles))
            self.assertTrue(run(CONFIG, **args)["sent"])
            self.assertEqual(run(CONFIG, **args)["status"], "no_matches")
            self.assertEqual(len(sent), 1)

    def test_feed_failure_prevents_partial_digest(self):
        config = {**CONFIG, "sources": [SOURCE, {"name": "Broken", "url": "https://invalid.example/feed"}]}
        with tempfile.TemporaryDirectory() as temp:
            def fetch(source):
                if source["name"] == "Broken":
                    raise OSError("Connection failed")
                return [self.article()]
            with self.assertRaisesRegex(RuntimeError, "email was not sent"):
                run(config, send=True, now=NOW, state_file=Path(temp) / "state.json",
                    fetcher=fetch, sender=lambda *args: self.fail("Should not send"))

    def test_escapes_html_message(self):
        item = Article("a", "<script>alert(1)</script>", "https://example.com/a", "Sample", "", NOW)
        _, _, html_body = render_message([item], NOW, "Europe/Istanbul")
        self.assertNotIn("<script>", html_body)
        self.assertIn("&lt;script&gt;", html_body)

    def test_config_validation(self):
        with tempfile.TemporaryDirectory() as temp:
            file = Path(temp) / "config.json"
            file.write_text(json.dumps({**CONFIG, "max_items": -1}))
            with self.assertRaises(ValueError):
                load_config(file)


if __name__ == "__main__":
    unittest.main()
