#!/usr/bin/env python3
"""Validate Markdown-sourced copy-ready biographies and their limits."""

from __future__ import annotations

import re
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BIO_PAGE = ROOT / "bio/index.html"
BIO_MARKDOWN = ROOT / "bio/content.md"
BIO_SCRIPT = ROOT / "bio/bio.js"
EXPECTED_LIMITS = [80, 160, 280, 500, 1000, 2000]
LIMIT_HEADING = re.compile(r"Up to ([\d,]+) characters$")


@dataclass
class Bio:
    limit: int | None
    heading: str
    text: str
    has_copy_action: bool


class BodyTextParser(HTMLParser):
    """Collect visible text authored directly in an HTML body."""

    def __init__(self) -> None:
        super().__init__()
        self.in_body = False
        self.ignored_depth = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "body":
            self.in_body = True
        elif self.in_body and tag in {"script", "style"}:
            self.ignored_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag == "body":
            self.in_body = False
        elif self.in_body and tag in {"script", "style"} and self.ignored_depth:
            self.ignored_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.in_body and not self.ignored_depth and data.strip():
            self.parts.append(data.strip())


def parse_bios(markdown: str) -> list[Bio]:
    sections = re.split(r"^## ", markdown, flags=re.MULTILINE)[1:]
    bios: list[Bio] = []
    for section in sections:
        heading, _, body = section.partition("\n")
        match = LIMIT_HEADING.fullmatch(heading.strip())
        is_kubecon = heading.strip() == "KubeCon profile — original wording"
        if not match and not is_kubecon:
            continue
        paragraphs = [
            " ".join(block.split())
            for block in re.split(r"\n\s*\n", body.strip())
            if block.strip() and not block.lstrip().startswith("[Copy](#copy)")
        ]
        bios.append(
            Bio(
                limit=int(match.group(1).replace(",", "")) if match else None,
                heading=heading.strip(),
                text=paragraphs[0] if paragraphs else "",
                has_copy_action="[Copy](#copy)" in body,
            )
        )
    return bios


def main() -> int:
    errors: list[str] = []
    if not BIO_MARKDOWN.is_file():
        errors.append("missing bio/content.md semantic content source")
        markdown = ""
    else:
        markdown = BIO_MARKDOWN.read_text(encoding="utf-8")

    bios = parse_bios(markdown)
    generated = [bio for bio in bios if bio.limit is not None]
    limits = [bio.limit for bio in generated]
    if limits != EXPECTED_LIMITS:
        errors.append(f"generated bio limits should be {EXPECTED_LIMITS}, got {limits}")
    kubecon_bios = [bio for bio in bios if bio.limit is None]
    if len(kubecon_bios) != 1:
        errors.append(f"expected exactly one KubeCon source biography, got {len(kubecon_bios)}")
    for bio in bios:
        if not bio.text:
            errors.append(f"found an empty biography under {bio.heading!r}")
            continue
        if not bio.has_copy_action:
            errors.append(f"{bio.heading!r} is missing its Markdown copy action")
        if bio.limit is not None and len(bio.text) > bio.limit:
            errors.append(f"{bio.limit}-character bio is {len(bio.text)} characters")
    lengths = [len(bio.text) for bio in bios]
    if lengths != sorted(lengths):
        errors.append(f"bios should be ordered shortest to longest, got {lengths}")

    html_source = BIO_PAGE.read_text(encoding="utf-8")
    body_parser = BodyTextParser()
    body_parser.feed(html_source)
    if body_parser.parts:
        errors.append(f"semantic body text must be in Markdown, found {body_parser.parts}")
    if '<script type="module" src="bio.js"></script>' not in html_source:
        errors.append("bio page must load its external behavior module")
    if 'type="text/markdown" href="https://sergey.kanzhelev.com/bio/content.md"' not in html_source:
        errors.append("bio page must advertise its Markdown semantic content")
    if re.search(r'<script[^>]+src=["\']https?://', html_source, re.IGNORECASE):
        errors.append("bio page must not load third-party runtime scripts")

    if not BIO_SCRIPT.is_file():
        errors.append("missing bio/bio.js behavior module")
    script_source = BIO_SCRIPT.read_text(encoding="utf-8") if BIO_SCRIPT.is_file() else ""
    for forbidden in ("marked.parse", "innerHTML"):
        if forbidden in script_source:
            errors.append(f"bio script must not use unsafe Markdown rendering behavior: {forbidden}")

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print(f"Bio checks passed for {len(bios)} Markdown versions: {lengths}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
