#!/usr/bin/env python3
"""Validate the grounded, Markdown-sourced publications page contract."""

from __future__ import annotations

import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "publications/index.html"
MARKDOWN = ROOT / "publications/content.md"
SCRIPT = ROOT / "publications/publications.js"
SOURCES = ROOT / "publications/sources.tsv"

REQUIRED_HEADINGS = [
    "Selected authored articles",
    "Selected co-authored articles",
    "W3C editorial and specification work",
    "Academic papers",
    "Patents",
    "Interviews and contributed Q&As",
    "Book foreword",
]
REQUIRED_ROLE_NOTES = {
    "Selected authored articles": "These pages carry Sergey's sole-author byline.",
    "Selected co-authored articles": "These works explicitly credit multiple authors.",
    "W3C editorial and specification work": "Sergey is credited as an editor, not as the sole author of these group specifications.",
    "Patents": "Sergey is named as an inventor; each row represents one patent family, not every publication in that family.",
    "Interviews and contributed Q&As": "Sergey participated as the interview subject, interviewee, or Q&A contributor; he is not the formal page byline author.",
    "Book foreword": "Sergey wrote the foreword; Liudmila Molkova authored the book.",
}
REQUIRED_URLS = [
    "https://devblogs.microsoft.com/dotnet/improvements-in-net-core-3-0-for-troubleshooting-and-monitoring-distributed-apps/",
    "https://opensource.microsoft.com/blog/2019/05/23/announcing-opentelemetry-cncf-merged-opencensus-opentracing/",
    "https://kubernetes.io/blog/2021/11/12/are-you-ready-for-dockershim-removal/",
    "https://learn.microsoft.com/en-us/archive/msdn-magazine/2017/may/devops-optimize-telemetry-with-application-insights",
    "https://kubernetes.io/blog/2023/05/15/speed-up-pod-startup/",
    "https://www.w3.org/TR/trace-context/",
    "https://www.w3.org/TR/baggage/",
    "https://w3c.github.io/trace-context-binary/",
    "https://i-us.ru/index.php/ius/article/view/14568",
    "https://doi.org/10.1109/ECICE50847.2020.9301952",
    "https://doi.org/10.1109/ICKII51822.2021.9574757",
    "https://patents.google.com/patent/US20180373581A1/en",
    "https://patents.google.com/patent/US11188441B2/en",
    "https://www.infoq.com/news/2015/07/App-Insights-ASP-5/",
    "https://www.k8s.dev/blog/2024/06/20/sig-node-spotlight-2024/",
    "https://www.packtpub.com/en-us/product/modern-distributed-tracing-in-net-9781837636136",
    "https://apmtips.com/posts/",
    "../til/",
]


class BodyTextParser(HTMLParser):
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


def markdown_links(source: str) -> list[str]:
    return re.findall(r"\[[^\]]+\]\(([^)\s]+)\)", source)


def markdown_sections(source: str) -> dict[str, str]:
    matches = list(re.finditer(r"^## (.+)$", source, re.MULTILINE))
    sections = {
        match.group(1): source[match.end() : matches[index + 1].start() if index + 1 < len(matches) else None]
        for index, match in enumerate(matches)
    }
    sections["Introduction"] = source[: matches[0].start()] if matches else source
    return sections


def main() -> int:
    errors: list[str] = []
    for path in (PAGE, MARKDOWN, SCRIPT, SOURCES):
        if not path.is_file():
            errors.append(f"missing {path.relative_to(ROOT)}")

    markdown = MARKDOWN.read_text(encoding="utf-8") if MARKDOWN.is_file() else ""
    source_rows = []
    if SOURCES.is_file():
        for line_number, line in enumerate(SOURCES.read_text(encoding="utf-8").splitlines(), 1):
            if not line or line.startswith("#"):
                continue
            parts = line.split("\t")
            if len(parts) != 3:
                errors.append(f"invalid publications/sources.tsv row {line_number}")
                continue
            source_rows.append((parts[0], parts[1], parts[2]))

    headings = re.findall(r"^## (.+)$", markdown, re.MULTILINE)
    if headings != REQUIRED_HEADINGS:
        errors.append(f"publication role sections should be {REQUIRED_HEADINGS}, got {headings}")
    sections = markdown_sections(markdown)
    for section, note in REQUIRED_ROLE_NOTES.items():
        if note not in sections.get(section, ""):
            errors.append(f"missing precise role note in {section!r}: {note}")
    for url in REQUIRED_URLS:
        if url not in markdown:
            errors.append(f"missing representative authoritative URL: {url}")

    links = markdown_links(markdown)
    if len(links) < 30:
        errors.append(f"expected a defensible curated bibliography with at least 30 links, got {len(links)}")
    for url in links:
        parsed = urlsplit(url)
        if parsed.scheme and parsed.scheme != "https":
            errors.append(f"publication link must use HTTPS: {url}")
    section_order = ["Introduction", *REQUIRED_HEADINGS]
    expected_by_section: dict[str, list[str]] = {heading: [] for heading in section_order}
    expected_entries: dict[str, list[str]] = {heading: [] for heading in REQUIRED_HEADINGS}
    for section, url, entry in source_rows:
        if section not in expected_by_section:
            errors.append(f"source manifest uses unknown role section: {section}")
            continue
        if not url.startswith("https://"):
            errors.append(f"source manifest URL must use HTTPS: {url}")
        if section != "Introduction":
            if url not in entry:
                errors.append(f"source manifest entry must contain its URL in {section!r}: {entry}")
            expected_entries[section].append(entry)
        expected_by_section[section].append(url)
    for section in section_order:
        actual = [url for url in markdown_links(sections.get(section, "")) if url.startswith("https://")]
        expected = expected_by_section[section]
        if actual != expected:
            errors.append(f"grounded links or ordering changed in {section!r}: expected {expected}, got {actual}")
    for section in REQUIRED_HEADINGS:
        actual_entries = re.findall(r"^- (.+)$", sections.get(section, ""), re.MULTILINE)
        if actual_entries != expected_entries[section]:
            errors.append(f"titles or item-level role claims changed in {section!r}")
    manifested = [url for _, url, _ in source_rows]
    actual_https = [url for url in links if url.startswith("https://")]
    if actual_https != manifested:
        errors.append("Markdown HTTPS links must exactly match the portable grounded source manifest")

    if PAGE.is_file():
        html_source = PAGE.read_text(encoding="utf-8")
        parser = BodyTextParser()
        parser.feed(html_source)
        if parser.parts:
            errors.append(f"semantic body text must be Markdown-sourced, found {parser.parts}")
        if '<script type="module" src="publications.js"></script>' not in html_source:
            errors.append("publications page must load its external behavior module")
        if 'type="text/markdown" href="https://sergey.kanzhelev.com/publications/content.md"' not in html_source:
            errors.append("publications page must advertise its Markdown source")
        if re.search(r'<script[^>]+src=["\']https?://', html_source, re.IGNORECASE):
            errors.append("publications page must not load third-party runtime scripts")

    if SCRIPT.is_file():
        script = SCRIPT.read_text(encoding="utf-8")
        for forbidden in ("innerHTML", "outerHTML", "insertAdjacentHTML", "document.write"):
            if forbidden in script:
                errors.append(f"publications renderer must not use unsafe HTML injection: {forbidden}")
        if "textContent" not in script or "createElement" not in script:
            errors.append("publications renderer must construct text with safe DOM APIs")

    homepage = (ROOT / "index.html").read_text(encoding="utf-8")
    if '<a href="publications/">Publications</a>' not in homepage:
        errors.append("homepage hidden navigation must link to publications")
    llms = (ROOT / "llms.txt").read_text(encoding="utf-8")
    if "https://sergey.kanzhelev.com/publications/" not in llms:
        errors.append("llms.txt must link to the publications page")

    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        return 1
    print(f"Publication checks passed: {len(headings)} role sections, {len(links)} grounded links")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
