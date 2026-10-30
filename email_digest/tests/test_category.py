import unittest
from datetime import datetime, timezone
from unittest.mock import patch
from email_digest.category import parse_category_links, parse_article_metadata, fetch_smithsonian_category
from email_digest.collector import matches

SOURCE = {"name": "Smithsonian Mind & Body", "url": "https://www.smithsonianmag.com/category/mind-body/",
          "mode": "smithsonian_category", "lookback_hours": 1080, "max_entries": 12}
URL = "https://www.smithsonianmag.com/innovation/this-lollipop-could-help-blind-women-independently-detect-pregnancy-180989608/"


class SmithsonianTests(unittest.TestCase):
    def test_links_and_dedup(self):
        html = f'<main><a href="{URL}"><h2>This Lollipop Could Help Blind Women Independently Detect Pregnancy</h2></a><a href="{URL}">Repeat</a><a href="https://evil.example/bad-1234567/">Bad</a></main>'
        links = parse_category_links(html, SOURCE["url"])
        self.assertEqual(len(links), 1)
        self.assertEqual(links[0][0], URL)

    def test_structured_article_publication(self):
        html = '<meta property="article:published_time" content="2026-10-06T09:00:00Z"><meta name="description" content="An accessible test.">'
        details = parse_article_metadata(html)
        self.assertEqual(details.published.date().isoformat(), "2026-10-06")
        self.assertEqual(details.description, "An accessible test.")

    def test_article_json_ld_fallback(self):
        html = '<script type="application/ld+json">{"datePublished":"2026-10-06T09:00:00Z"}</script>'
        self.assertEqual(parse_article_metadata(html).published.day, 6)

    def test_safe_category_collection(self):
        listing = f'<a href="{URL}">This Lollipop Could Help Blind Women Independently Detect Pregnancy</a>'
        detail = '<meta property="article:published_time" content="2026-10-06T09:00:00Z"><meta property="og:title" content="This Lollipop Could Help Blind Women Independently Detect Pregnancy">'
        with patch("email_digest.category.download_html", side_effect=[listing, detail]):
            article, = fetch_smithsonian_category(SOURCE)
        self.assertTrue(matches(article, {"lookback_hours": 36, "allow_undated": False,
                                           "include_keywords": [], "exclude_keywords": []}, SOURCE,
                                datetime(2026, 10, 30, tzinfo=timezone.utc)))

    def test_reject_unapproved_domain(self):
        with self.assertRaises(ValueError):
            fetch_smithsonian_category({**SOURCE, "url": "https://example.org/category/mind-body/"})


if __name__ == "__main__":
    unittest.main()
