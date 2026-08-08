.PHONY: verify ci help run til-posts

verify:
	@echo "Checking required files..."
	@test -f index.html || (echo "ERROR: index.html not found" && exit 1)
	@test -f banner.json || (echo "ERROR: banner.json not found" && exit 1)
	@test -f llms.txt || (echo "ERROR: llms.txt not found" && exit 1)
	@python3 -m json.tool banner.json > /dev/null || (echo "ERROR: banner.json is not valid JSON" && exit 1)
	@python3 -m json.tool til/posts.json > /dev/null || (echo "ERROR: til/posts.json is not valid JSON" && exit 1)
	@python3 til/gen-posts-json.py | cmp -s til/posts.json - || (echo "ERROR: til/posts.json is out of date; run make til-posts" && exit 1)
	@python3 til/gen-post-pages.py --check
	@python3 scripts/verify_metadata.py
	@echo "All checks passed."

til-posts:
	@python3 til/gen-posts-json.py > til/posts.json
	@python3 til/gen-post-pages.py

run:
	python3 -m http.server 8000

ci: verify

help:
	@printf '%s\n' \
		'Available commands:' \
		'  make verify     Run all repository validation checks' \
		'  make ci         Run the same validation used by GitHub Actions' \
		'  make til-posts  Regenerate the TIL index and post pages' \
		'  make run        Serve the site locally on port 8000'
