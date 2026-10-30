"""Restricted public-category collection for sites without a category RSS feed.

This module supports Smithsonian Magazine's Mind & Body category using article
permalinks. It does not bypass login, CAPTCHA or access restrictions.
"""
from __future__ import annotations

import hashlib
import re
from html.parser import HTMLParser
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from .collector import Article, canonical_url, parse_date, strip_html

MAX_HTML_BYTES = 2_000_000
SMITHSONIAN_HOSTS = {"www.smithsonianmag.com", "smithsonianmag.com"}
ARTICLE_PATH = re.compile(r"^/[a-z0-9-]+/[a-z0-9-]+-\d{7,11}/?$", re.I)


def _safe_smithsonian(url: str) -> bool:
    parts = urlsplit(url)
    return parts.scheme == "https" and parts.hostname in SMITHSONIAN_HOSTS and (
        parts.port is None or parts.port == 443
    )


def download_html(url: str, timeout: float = 20) -> str:
    if not _safe_smithsonian(url):
        raise ValueError("Only HTTPS Smithsonian article/category URLs are allowed")
    request = Request(url, headers={
        "User-Agent": "Mozilla/5.0 (compatible; PersonalNewsDigest/1.0; +https://github.com/)",
        "Accept": "text/html,application/xhtml+xml",
    })
    with urlopen(request, timeout=timeout) as response:
        if not _safe_smithsonian(response.geturl()):
            raise ValueError("Site redirected outside approved Smithsonian hosts")
        data = response.read(MAX_HTML_BYTES + 1)
    if len(data) > MAX_HTML_BYTES:
        raise ValueError("HTML exceeds size limit")
    return data.decode("utf-8", errors="replace")


class CategoryLinks(HTMLParser):
    def __init__(self, base: str):
        super().__init__(convert_charrefs=True)
        self.base = base
        self.anchors = []
        self.current = None

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "a":
            href = canonical_url(values.get("href", ""), self.base)
            if href and _safe_smithsonian(href) and ARTICLE_PATH.fullmatch(urlsplit(href).path):
                self.current = {"url": href, "parts": [], "alt": values.get("aria-label", "") or values.get("title", "")}
            else:
                self.current = None
        elif tag == "img" and self.current is not None and not self.current["alt"]:
            self.current["alt"] = values.get("alt", "")

    def handle_data(self, data):
        if self.current is not None:
            self.current["parts"].append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self.current is not None:
            title = strip_html(" ".join(self.current["parts"])) or strip_html(self.current["alt"])
            if len(title) >= 8:
                self.anchors.append((self.current["url"], title))
            self.current = None


class ArticleMetadata(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.description = ""
        self.title = ""
        self.published = None
        self._in_h1 = False
        self._h1 = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "meta":
            name = (values.get("property") or values.get("name") or "").lower()
            content = values.get("content", "")
            if name in {"article:published_time", "datepublished", "date", "pubdate"}:
                self.published = self.published or parse_date(content)
            if name in {"description", "og:description"} and not self.description:
                self.description = strip_html(content)[:700]
            if name == "og:title" and not self.title:
                self.title = strip_html(content)
        elif tag == "time" and not self.published:
            self.published = parse_date(values.get("datetime", ""))
        elif tag == "h1":
            self._in_h1 = True

    def handle_data(self, data):
        if self._in_h1:
            self._h1.append(data)

    def handle_endtag(self, tag):
        if tag == "h1":
            self._in_h1 = False
            if not self.title:
                self.title = strip_html(" ".join(self._h1))


def parse_category_links(document: str, category_url: str):
    parser = CategoryLinks(category_url)
    parser.feed(document)
    found = {}
    for url, title in parser.anchors:
        found.setdefault(url, title)
    return list(found.items())


def parse_article_metadata(document: str) -> ArticleMetadata:
    parser = ArticleMetadata()
    parser.feed(document)
    if not parser.published:
        found = re.search(r'["\\\']datePublished["\\\']\s*:\s*["\\\']([^"\\\']+)', document, re.I)
        if found:
            parser.published = parse_date(found.group(1))
    return parser


def fetch_smithsonian_category(source: dict, timeout: float = 20) -> list[Article]:
    category_url = source["url"]
    if not _safe_smithsonian(category_url) or not urlsplit(category_url).path.startswith("/category/"):
        raise ValueError("This collector requires a Smithsonian category URL")
    document = download_html(category_url, timeout)
    links = parse_category_links(document, category_url)
    if not links:
        raise ValueError("No article links found; Smithsonian category HTML may have changed")
    max_entries = source.get("max_entries", 12)
    if type(max_entries) is not int or not 1 <= max_entries <= 30:
        raise ValueError("max_entries must be between 1 and 30")
    items = []
    for url, listed_title in links[:max_entries]:
        # Individual article pages supply canonical publication dates and excerpts.
        # Fail closed if metadata cannot be downloaded so the digest is not incomplete.
        details = parse_article_metadata(download_html(url, timeout))
        title = details.title or listed_title
        identifier = hashlib.sha256(url.encode("utf-8")).hexdigest()
        items.append(Article(identifier, title[:300], url, source["name"],
                             details.description, details.published))
    return items


def fetch_source(source: dict):
    mode = source.get("mode", "rss")
    if mode == "rss":
        from .collector import fetch_feed
        return fetch_feed(source)
    if mode == "smithsonian_category":
        return fetch_smithsonian_category(source)
    raise ValueError("Unsupported source mode")
