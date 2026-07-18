#!/usr/bin/env node
// ─── BUILD-TIME AUDIO-ASSETS GUARD ──────────────────────────────────────────────────────────────────
// A silent-audio archive must be IMPOSSIBLE, not merely noisy. The runtime [audio-assets] check (app.js)
// warns in the console; this FAILS THE BUILD (exit 1) when any shippable track is absent from the bundle.
//
// The shippable set = PHASE1_TRACKS (app.js, preCook ambient) ∪ SOUNDTRACK_MANIFEST (soundtrack-manifest.js,
// the cook pool). Both are parsed from source, so adding/removing a track updates the guard automatically.
// It checks the iOS BUNDLE (ios/App/App/public/audio — what actually ships) by default; pass a dir arg to
// check another root (e.g. mvp for a pre-sync source check). Catches all three failure modes at once:
// (d) a committed-but-gitignored file absent on a clean checkout, (b) a skipped cap sync, (c) a path/case
// mismatch between the manifest and the files on disk.
//
// Usage:  node scripts/check-audio-assets.mjs [bundleRoot]
//   bundleRoot defaults to ios/App/App/public  (the dir whose /audio/* ships in the .app)
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bundleRoot = resolve(process.argv[2] || join(REPO, "ios/App/App/public"));

// Extract every `file: "audio/…"` path from a source blob (optionally scoped to a named array).
function filesIn(src, scopeMarker) {
  let text = src;
  if (scopeMarker) {
    const start = src.indexOf(scopeMarker);
    if (start < 0) return [];
    // from the marker to the first "];" that closes the array literal
    const end = src.indexOf("];", start);
    text = end < 0 ? src.slice(start) : src.slice(start, end);
  }
  const out = [];
  const re = /file:\s*"(audio\/[^"]+)"/g;
  let m;
  while ((m = re.exec(text))) out.push(m[1]);
  return out;
}

const appJs = readFileSync(join(REPO, "mvp/app.js"), "utf8");
const manifestJs = readFileSync(join(REPO, "mvp/audio/soundtrack-manifest.js"), "utf8");

const phase1 = filesIn(appJs, "const PHASE1_TRACKS = [");
const pool = filesIn(manifestJs); // the manifest file contains only the pool array
const wanted = [...new Set([...phase1, ...pool])];

if (!phase1.length) { console.error("[audio-guard] FAIL: could not parse PHASE1_TRACKS from mvp/app.js"); process.exit(2); }
if (!pool.length) { console.error("[audio-guard] FAIL: could not parse SOUNDTRACK_MANIFEST from mvp/audio/soundtrack-manifest.js"); process.exit(2); }

const missing = wanted.filter((rel) => !existsSync(join(bundleRoot, rel)));

if (missing.length) {
  console.error(`[audio-guard] FAIL — ${missing.length}/${wanted.length} shippable track(s) ABSENT from ${bundleRoot}:`);
  for (const m of missing) console.error("  ✗ " + m);
  console.error("A build/archive here would ship SILENCE. Fix: ensure the file is committed (whitelisted in");
  console.error(".gitignore) and re-run `npx cap sync ios`, or correct the manifest path.");
  process.exit(1);
}

console.log(`[audio-guard] OK — ${wanted.length}/${wanted.length} shippable tracks present in ${bundleRoot} (phase1=${phase1.length}, pool=${pool.length}).`);
