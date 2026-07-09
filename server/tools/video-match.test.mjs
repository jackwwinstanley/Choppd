#!/usr/bin/env node
// Unit tests for the video-match pipeline pure functions + the §7 hard-line grep
// invariant. Run: node --test tools/video-match.test.mjs   (needs dist/db.js built)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseIsoDuration, ytIdFromUrl, candidatePassesFilters, parseJsonLoose, routeSteps, stepsFingerprint,
} from "./video-match.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

test("parseIsoDuration", () => {
  assert.equal(parseIsoDuration("PT10M5S"), 605);
  assert.equal(parseIsoDuration("PT1H2M3S"), 3723);
  assert.equal(parseIsoDuration("PT45S"), 45);
  assert.equal(parseIsoDuration("garbage"), null);
});

test("ytIdFromUrl — all official URL shapes", () => {
  assert.equal(ytIdFromUrl("https://www.youtube.com/watch?v=abcdEFGH123"), "abcdEFGH123");
  assert.equal(ytIdFromUrl("https://youtu.be/abcdEFGH123"), "abcdEFGH123");
  assert.equal(ytIdFromUrl("https://www.youtube.com/embed/abcdEFGH123"), "abcdEFGH123");
  assert.equal(ytIdFromUrl(""), null);
});

test("candidatePassesFilters — EMBEDDABLE_ONLY + duration window", () => {
  assert.equal(candidatePassesFilters({ embeddable: true, seconds: 600 }), true);
  assert.equal(candidatePassesFilters({ embeddable: false, seconds: 600 }), false, "non-embeddable rejected");
  assert.equal(candidatePassesFilters({ embeddable: true, seconds: 99999 }), false, "over MAX_VIDEO_SECONDS rejected");
  assert.equal(candidatePassesFilters({ embeddable: true, seconds: 0 }), false);
  assert.equal(candidatePassesFilters(null), false);
});

test("parseJsonLoose — fence strip + array/object extraction", () => {
  assert.deepEqual(parseJsonLoose('```json\n[{"a":1}]\n```'), [{ a: 1 }]);
  assert.deepEqual(parseJsonLoose('prose... {"x": 2} trailing'), { x: 2 });
  assert.throws(() => parseJsonLoose("no json here"));
});

test("routeSteps — threshold routing (≥0.75 + ts + no conflict → wired)", () => {
  const out = routeSteps([
    { step_index: 0, video_ts: 30, confidence: 0.9, method_conflict: false, note: "" },   // wire
    { step_index: 1, video_ts: 60, confidence: 0.5, method_conflict: false, note: "" },   // low conf → no
    { step_index: 2, video_ts: 90, confidence: 0.99, method_conflict: true, note: "cold pan" }, // conflict → never
    { step_index: 3, video_ts: null, confidence: 0.99, method_conflict: false, note: "skipped" }, // no ts → no
  ]);
  assert.equal(out[0].wired, true);
  assert.equal(out[1].wired, false);
  assert.equal(out[2].wired, false, "method conflict is NEVER auto-wired");
  assert.equal(out[3].wired, false, "null ts never wired");
  assert.equal(out[3].video_ts, null);
});

test("stepsFingerprint — stable, drift-sensitive", () => {
  const a = [{ text: "chop onions" }, { text: "fry them" }];
  assert.equal(stepsFingerprint(a), stepsFingerprint([{ text: "chop onions" }, { text: "fry them" }]));
  assert.notEqual(stepsFingerprint(a), stepsFingerprint([{ text: "chop onions" }, { text: "fry it" }]), "text change shifts fp");
  assert.notEqual(stepsFingerprint(a), stepsFingerprint([{ text: "chop onions" }]), "count change shifts fp");
});

// ── §7 HARD-LINE GREP INVARIANT ──────────────────────────────────────────────
test("§7: no download / no transcript-scraping libs anywhere in the pipeline", () => {
  const src = [join(HERE, "video-match.mjs"), join(HERE, "video-health.mjs")]
    .map((f) => readFileSync(f, "utf8")).join("\n");
  const BANNED = ["ytdl", "youtube-dl", "yt-dlp", "youtube-transcript", "getTranscript", "innertube", "downloadVideo", "ffmpeg", "extractAudio"];
  for (const b of BANNED) assert.equal(src.toLowerCase().includes(b.toLowerCase()), false, `banned token present: ${b}`);
  // the only video understanding is Gemini's official URL ingestion (by reference).
  assert.ok(src.includes("file_uri"), "expected official Gemini URL ingestion (file_uri)");
  assert.ok(src.includes("§7 HARD LINES") || src.includes("OFFICIAL_ONLY"), "expected the §7 hard-line marker comment");
});

test("§7: API keys are never logged (no console.* references a key var/value)", () => {
  const src = readFileSync(join(HERE, "video-match.mjs"), "utf8") + readFileSync(join(HERE, "video-health.mjs"), "utf8");
  for (const line of src.split("\n")) {
    if (/console\.(log|error|warn|info)/.test(line)) {
      assert.equal(/API_KEY|process\.env\.(YOUTUBE|GEMINI|ANTHROPIC)/.test(line), false, `a log line references a key: ${line.trim().slice(0, 80)}`);
    }
  }
});

test("selection is seed-link-first (structural)", () => {
  const src = readFileSync(join(HERE, "video-match.mjs"), "utf8");
  const seedIdx = src.indexOf("themealdb-link");
  const searchIdx = src.indexOf("ytSearch(searchQuery");
  assert.ok(seedIdx > 0 && searchIdx > 0 && seedIdx < searchIdx, "seed-link path must precede the search fallback");
});
