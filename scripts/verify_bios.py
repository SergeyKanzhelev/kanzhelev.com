#!/usr/bin/env python3
"""Validate the copy-ready biographies and their advertised limits."""

from __future__ import annotations

from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BIO_PAGE = ROOT / "bio/index.html"
EXPECTED_LIMITS = [80, 160, 280, 500, 1000, 2000]


@dataclass
class Bio:
    limit: int | None
    source: str
    parts: list[str] = field(default_factory=list)
    text: str = ""


class BioParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.current: Bio | None = None
        self.in_text = False
        self.bios: list[Bio] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key: value or "" for key, value in attrs}
        classes = set(values.get("class", "").split())
        if tag == "article" and "bio-card" in classes:
            limit = values.get("data-max-chars")
            self.current = Bio(
                limit=int(limit) if limit else None,
                source=values.get("data-source", "generated"),
            )
        elif self.current is not None and tag == "p" and "bio-text" in classes:
            self.in_text = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "p" and self.in_text:
            self.in_text = False
        elif tag == "article" and self.current is not None:
            self.current.text = " ".join("".join(self.current.parts).split())
            self.bios.append(self.current)
            self.current = None

    def handle_data(self, data: str) -> None:
        if self.current is not None and self.in_text:
            self.current.parts.append(data)


def main() -> int:
    parser = BioParser()
    parser.feed(BIO_PAGE.read_text(encoding="utf-8"))
    errors: list[str] = []
    generated = [bio for bio in parser.bios if bio.source == "generated"]
    limits = [bio.limit for bio in generated]
    if limits != EXPECTED_LIMITS:
        errors.append(f"generated bio limits should be {EXPECTED_LIMITS}, got {limits}")
    kubecon_bios = [bio for bio in parser.bios if bio.source == "kubecon"]
    if len(kubecon_bios) != 1:
        errors.append(f"expected exactly one KubeCon source biography, got {len(kubecon_bios)}")
    for bio in parser.bios:
        text = bio.text
        if not text:
            errors.append("found an empty biography")
            continue
        limit = bio.limit
        if limit is not None and len(text) > limit:
            errors.append(f"{limit}-character bio is {len(text)} characters")
    lengths = [len(bio.text) for bio in parser.bios]
    if lengths != sorted(lengths):
        errors.append(f"bios should be ordered shortest to longest, got {lengths}")
    source = BIO_PAGE.read_text(encoding="utf-8")
    if "Array.from(text).length" not in source:
        errors.append("browser character counts should use Unicode code points")
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print(f"Bio checks passed for {len(parser.bios)} versions: {lengths}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
