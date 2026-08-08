#!/usr/bin/env python3
"""Validate site-wide identity, canonical, and social metadata."""

from __future__ import annotations

import json
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PERSON_ID = "https://sergey.kanzhelev.com/#person"
IMAGE_URL = "https://sergey.kanzhelev.com/assets/avatar.jpg"
STATIC_PAGES = {
    "index.html": ("https://sergey.kanzhelev.com/", "Sergey Kanzhelev", "profile"),
    "bio/index.html": ("https://sergey.kanzhelev.com/bio/", "Bio - Sergey Kanzhelev", "website"),
    "conferences/index.html": (
        "https://sergey.kanzhelev.com/conferences/",
        "Conferences - Sergey Kanzhelev",
        "website",
    ),
    "notes/index.html": (
        "https://sergey.kanzhelev.com/notes/",
        "Notes for Self - Sergey Kanzhelev",
        "website",
    ),
    "til/index.html": ("https://sergey.kanzhelev.com/til/", "TIL - Sergey Kanzhelev", "website"),
    "til/post.html": ("https://sergey.kanzhelev.com/til/", "TIL - Sergey Kanzhelev", "website"),
}
POSTS = json.loads((ROOT / "til/posts.json").read_text(encoding="utf-8"))
POST_PAGES = {
    f"til/posts/{post['slug']}/index.html": (
        f"https://sergey.kanzhelev.com/til/posts/{post['slug']}/",
        post["title"],
        post["date"],
    )
    for post in POSTS
}
ALL_PAGES = [*STATIC_PAGES, *POST_PAGES]


class HeadMetadataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_head = False
        self.in_json_ld = False
        self.links: list[dict[str, str]] = []
        self.metas: list[dict[str, str]] = []
        self.json_ld_chunks: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key: value or "" for key, value in attrs}
        if tag == "head":
            self.in_head = True
        elif self.in_head and tag == "link":
            self.links.append(values)
        elif self.in_head and tag == "meta":
            self.metas.append(values)
        elif self.in_head and tag == "script" and values.get("type") == "application/ld+json":
            self.in_json_ld = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "head":
            self.in_head = False
        elif tag == "script" and self.in_json_ld:
            self.in_json_ld = False

    def handle_data(self, data: str) -> None:
        if self.in_json_ld:
            self.json_ld_chunks.append(data)


def value_for(items: list[dict[str, str]], key: str, value: str) -> str | None:
    for item in items:
        if item.get(key) == value:
            return item.get("content") or item.get("href")
    return None


def validate_page(relative_path: str) -> list[str]:
    path = ROOT / relative_path
    if not path.is_file():
        return ["page is missing"]
    parser = HeadMetadataParser()
    source = path.read_text(encoding="utf-8")
    parser.feed(source)
    errors: list[str] = []

    if value_for(parser.metas, "name", "author") != "Sergey Kanzhelev":
        errors.append("missing author meta tag")
    description = value_for(parser.metas, "name", "description")
    if not description:
        errors.append("missing page description")
    if value_for(parser.metas, "property", "og:description") != description:
        errors.append("og:description should match the page description")
    if value_for(parser.metas, "property", "og:image") != IMAGE_URL:
        errors.append("missing canonical og:image")
    if value_for(parser.metas, "name", "twitter:card") != "summary":
        errors.append("missing Twitter summary card metadata")

    graph_nodes: list[dict[str, object]] = []
    for chunk in parser.json_ld_chunks:
        try:
            document = json.loads(chunk)
        except json.JSONDecodeError as exc:
            errors.append(f"invalid JSON-LD: {exc}")
            continue
        graph_nodes.extend(document.get("@graph", [document]))

    person = next((node for node in graph_nodes if node.get("@id") == PERSON_ID), None)
    if not person:
        errors.append("missing canonical Person JSON-LD node")
    else:
        if person.get("name") != "Sergey Kanzhelev":
            errors.append("Person node has an unexpected name")
        if person.get("image") != IMAGE_URL:
            errors.append("Person node has an unexpected image")
        expected_profiles = {
            "https://github.com/SergeyKanzhelev",
            "https://www.linkedin.com/in/sergeykanzhelev/",
        }
        if set(person.get("sameAs", [])) != expected_profiles:
            errors.append("Person node has unexpected sameAs profiles")

    if relative_path in STATIC_PAGES:
        canonical = value_for(parser.links, "rel", "canonical")
        expected_url, expected_title, expected_og_type = STATIC_PAGES[relative_path]
        if canonical != expected_url:
            errors.append(f"canonical URL should be {expected_url}")
        if value_for(parser.metas, "property", "og:url") != expected_url:
            errors.append(f"og:url should be {expected_url}")
        if value_for(parser.metas, "property", "og:title") != expected_title:
            errors.append(f"og:title should be {expected_title}")
        if value_for(parser.metas, "property", "og:type") != expected_og_type:
            errors.append(f"og:type should be {expected_og_type}")
        page = next(
            (
                node
                for node in graph_nodes
                if node.get("@type") in {"WebPage", "ProfilePage", "CollectionPage"}
            ),
            None,
        )
        if not page or page.get("url") != expected_url:
            errors.append("missing page JSON-LD node with canonical URL")
        elif page.get("name") != expected_title:
            errors.append(f"page JSON-LD name should be {expected_title}")
        elif page.get("author") != {"@id": PERSON_ID}:
            errors.append("page JSON-LD node does not reference the canonical Person")
        if relative_path == "til/index.html" and 'href="posts/${post.slug}/"' not in source:
            errors.append("TIL index does not link to crawlable post pages")
        if relative_path == "til/post.html":
            if value_for(parser.metas, "name", "robots") != "noindex,follow":
                errors.append("legacy post route should be noindex,follow")
            if "window.location.replace(`posts/${slug}/`);" not in source:
                errors.append("legacy post route does not redirect to the crawlable URL")
            if "if (slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {" not in source:
                errors.append("legacy post redirect does not reject a missing or invalid slug")
    elif relative_path in POST_PAGES:
        expected_url, expected_title, expected_date = POST_PAGES[relative_path]
        if value_for(parser.links, "rel", "canonical") != expected_url:
            errors.append(f"canonical URL should be {expected_url}")
        if value_for(parser.metas, "property", "og:url") != expected_url:
            errors.append(f"og:url should be {expected_url}")
        if value_for(parser.metas, "property", "og:title") != expected_title:
            errors.append(f"og:title should be {expected_title}")
        if value_for(parser.metas, "property", "og:type") != "article":
            errors.append("og:type should be article")
        post = next((node for node in graph_nodes if node.get("@type") == "BlogPosting"), None)
        if not post or post.get("url") != expected_url:
            errors.append("missing BlogPosting JSON-LD with canonical URL")
        elif post.get("headline") != expected_title:
            errors.append(f"BlogPosting headline should be {expected_title}")
        elif post.get("datePublished") != expected_date:
            errors.append(f"BlogPosting datePublished should be {expected_date}")
        elif post.get("author") != {"@id": PERSON_ID}:
            errors.append("BlogPosting does not reference the canonical Person")
    return errors


def main() -> int:
    failures = {
        page: errors for page in ALL_PAGES if (errors := validate_page(page))
    }
    expected_post_pages = {ROOT / page for page in POST_PAGES}
    actual_post_pages = set((ROOT / "til/posts").glob("*/index.html"))
    for page in sorted(actual_post_pages - expected_post_pages):
        failures[str(page.relative_to(ROOT))] = ["stale generated post page"]
    if failures:
        for page, errors in failures.items():
            for error in errors:
                print(f"ERROR: {page}: {error}")
        return 1
    print(f"Metadata checks passed for {len(ALL_PAGES)} pages.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
