#!/usr/bin/env python3
"""Generate til/posts.json from til/posts/*/post.md files."""
import os, re, json

posts_dir = os.path.join(os.path.dirname(__file__), "posts")
posts = []
for d in sorted(os.listdir(posts_dir), reverse=True):
    p = os.path.join(posts_dir, d, "post.md")
    if not os.path.isfile(p):
        continue
    text = open(p).read()

    # Parse YAML frontmatter (between --- delimiters)
    frontmatter = {}
    fm_match = re.match(r"^---\s*\n(.+?)\n---\s*\n", text, re.S)
    if fm_match:
        for line in fm_match.group(1).splitlines():
            key, _, value = line.partition(":")
            if value:
                frontmatter[key.strip()] = value.strip()

    title = re.search(r"^#\s+(.+)", text, re.M)
    entry = {"slug": d, "title": title.group(1) if title else d, "date": d[:10]}
    if "tags" in frontmatter:
        entry["tags"] = [t.strip() for t in frontmatter["tags"].split(",")]
    posts.append(entry)

print(json.dumps(posts, indent=4, ensure_ascii=False))
