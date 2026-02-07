.PHONY: install format lint check typecheck build test dev clean

install:
	bun install

format:
	bunx biome format --write .

lint:
	bunx biome check --fix .

check:
	bunx biome check --fix .
	bun run typecheck

typecheck:
	bunx tsc --noEmit

build:
	bun run build

test:
	bun run test

dev:
	bun run dev

clean:
	rm -rf dist node_modules *.tsbuildinfo
