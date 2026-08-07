.PHONY: verify run til-posts

verify:
	@echo "Checking required files..."
	@test -f index.html || (echo "ERROR: index.html not found" && exit 1)
	@test -f banner.json || (echo "ERROR: banner.json not found" && exit 1)
	@test -f llms.txt || (echo "ERROR: llms.txt not found" && exit 1)
	@python3 -m json.tool banner.json > /dev/null || (echo "ERROR: banner.json is not valid JSON" && exit 1)
	@python3 -m json.tool til/posts.json > /dev/null || (echo "ERROR: til/posts.json is not valid JSON" && exit 1)
	@echo "All checks passed."

til/posts.json: til/posts/*/post.md til/gen-posts-json.py
	@python3 til/gen-posts-json.py > til/posts.json

til-posts: til/posts.json

run:
	python3 -m http.server 8000
