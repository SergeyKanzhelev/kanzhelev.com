#!/usr/bin/env python3
"""Generate crawlable TIL post pages with static social metadata."""

from __future__ import annotations

import argparse
import html
import json
import re
from pathlib import Path

TIL_DIR = Path(__file__).resolve().parent
SITE_URL = "https://sergey.kanzhelev.com"
SLUG_PATTERN = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="verify generated pages without modifying the working tree",
    )
    args = parser.parse_args()

    posts = json.loads((TIL_DIR / "posts.json").read_text(encoding="utf-8"))
    template = (TIL_DIR / "post-template.html").read_text(encoding="utf-8")
    expected_slugs: set[str] = set()
    outdated_pages: list[Path] = []

    for post in posts:
        slug = post["slug"]
        if not SLUG_PATTERN.fullmatch(slug):
            raise ValueError(f"Invalid post slug: {slug}")
        expected_slugs.add(slug)

        post_dir = TIL_DIR / "posts" / slug
        if not (post_dir / "post.md").is_file():
            raise FileNotFoundError(f"Missing post source for {slug}")

        url = f"{SITE_URL}/til/posts/{slug}/"
        replacements = {
            "{{TITLE_HTML}}": html.escape(post["title"], quote=True),
            "{{URL_HTML}}": html.escape(url, quote=True),
            "{{TITLE_JSON}}": json.dumps(post["title"]),
            "{{DATE_JSON}}": json.dumps(post["date"]),
            "{{URL_JSON}}": json.dumps(url),
            "{{ARTICLE_ID_JSON}}": json.dumps(f"{url}#article"),
        }
        output = template
        for placeholder, value in replacements.items():
            output = output.replace(placeholder, value)
        if "{{" in output:
            raise ValueError(f"Unresolved template placeholder for {slug}")
        page = post_dir / "index.html"
        if args.check:
            if not page.is_file() or page.read_text(encoding="utf-8") != output:
                outdated_pages.append(page)
        else:
            page.write_text(output, encoding="utf-8")

    stale_pages = sorted(
        page
        for page in (TIL_DIR / "posts").glob("*/index.html")
        if page.parent.name not in expected_slugs
    )
    if args.check:
        outdated_pages.extend(stale_pages)
        if outdated_pages:
            for page in outdated_pages:
                print(f"ERROR: generated page is missing, stale, or outdated: {page.relative_to(TIL_DIR)}")
            return 1
        print(f"Verified {len(posts)} generated TIL post pages.")
    else:
        for page in stale_pages:
            page.unlink()
        print(f"Generated {len(posts)} TIL post pages.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
