# imagegen MCP — Nano Banana (Gemini) image generation

One MCP tool, `generate_image`, used by `/generate-images` to run a
recipe's image-prompt batch. Model: `gemini-2.5-flash-image` (override
with the `IMAGE_MODEL` env var).

## One-time setup (the key)

The server reads `GEMINI_API_KEY` from (in order): the process
environment, `tools/imagegen-mcp/.env`, or the repo's existing
`server/.env` — so the easiest setup is one appended line in the file
you already have:

    echo "GEMINI_API_KEY=your-key-here" >> server/.env

(`>>` APPENDS — a single `>` would wipe the file's other keys.) Both
.env locations are gitignored; the key never commits. Alternative:
`export GEMINI_API_KEY=...` in `~/.zshenv`.

## Smoke test

1. Restart Claude Code in this repo → `/mcp` should list `imagegen`
   as connected (registration lives in the repo's `.mcp.json`).
2. Ask for one test image: generate_image with a trivial prompt to
   `/tmp/mcp-test.png` — a valid PNG should land in ~5–15s.
   (CLI twin, same code path: `node tools/imagegen-mcp/cli.js
   --prompt "a red apple on a white table" --out /tmp/mcp-test.png`)

## Behavior

- Refuses to overwrite existing files unless `overwrite:true` (--force)
  — audited/approved images are protected from accidental regeneration.
- Retries once on transient failures; a 429 returns the distinct
  `rate_limited` error so callers back off instead of hammering.
- 60s timeout per generation; missing key = clean `no_api_key` error.
- `npm test` runs the mocked unit suite (write / guard / 429 / retry /
  no-key paths).
