.PHONY: verify run

verify:
	@echo "Checking required files..."
	@test -f index.html || (echo "ERROR: index.html not found" && exit 1)
	@test -f banner.json || (echo "ERROR: banner.json not found" && exit 1)
	@python3 -m json.tool banner.json > /dev/null || (echo "ERROR: banner.json is not valid JSON" && exit 1)
	@echo "All checks passed."

run:
	python3 -m http.server 8000
