#!/usr/bin/env python3
"""Generate crawlable TIL post pages with static social metadata."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

TIL_DIR = Path(__file__).resolve().parent
SITE_URL = "https://sergey.kanzhelev.com"
SLUG_PATTERN = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


def main() -> int:
    posts = json.loads((TIL_DIR / "posts.json").read_text(encoding="utf-8"))
    template = (TIL_DIR / "post-template.html").read_text(encoding="utf-8")
    expected_slugs: set[str] = set()

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
        (post_dir / "index.html").write_text(output, encoding="utf-8")

    for page in (TIL_DIR / "posts").glob("*/index.html"):
        if page.parent.name not in expected_slugs:
            page.unlink()

    print(f"Generated {len(posts)} TIL post pages.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
