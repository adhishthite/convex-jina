.PHONY: install format lint check typecheck build clean dev

# Install dependencies
install:
	bun install

# Format code with Biome
format:
	bunx @biomejs/biome format --write .

# Lint code with Biome
lint:
	bunx @biomejs/biome lint --write .

# Run format and lint together
check:
	bunx @biomejs/biome check --write .

# Type check
typecheck:
	bun run typecheck

# Build the package
build:
	bun run build

# Watch mode for development
dev:
	bun run dev

# Clean build artifacts
clean:
	rm -rf dist
	rm -rf node_modules
