# Cue voiceover generation (Kokoro)

Pre-generates the spoken cue audio so the app plays **files** (works hands-free on
iPhone — no model on the phone). Michael (`am_michael`) is the free default; the
other Kokoro voices are premium and generated the same way.

Output: `mvp/audio/voice/<voiceId>/<hash>.mp3` (+ `manifest.json`). The filename is a
content hash (cyrb53) of the exact line — the app hashes `cue.voice` at play time and
plays that file. **`voiceHash()` in `mvp/app.js` and `gen.mjs` must stay identical.**

## First-time setup
```bash
cd tools/voicegen && npm install        # kokoro-js + onnxruntime + lamejs (large, re-installable)
```

## Regenerating (re-runnable)
1. **Refresh the line list** (only needed if you added/edited a cue, gate coach, greeting,
   fat/liquid variant, etc.). In the running dev app's devtools console:
   ```js
   copy(JSON.stringify({ lines: window.__voiceLines() }))
   ```
   Paste into `tools/voicegen/voice-lines.json`. (`__voiceLines()` runs the app's REAL
   transforms across every recipe + fat/liquid/stove variant, so clips can't drift.)
2. **Generate:**
   ```bash
   node gen.mjs                 # am_michael, only missing/changed lines (fast)
   node gen.mjs --force         # regenerate everything
   node gen.mjs --voice=af_heart   # a premium voice set (then add "af_heart" to AVAILABLE_VOICES in app.js)
   ```
   Default skips existing files: unchanged lines keep their hash → skipped; edited/new
   lines get a new hash → generated. So editing one cue regenerates just that clip.
3. **Deploy** the files (they're royalty-free, so committed + rsync'd, unlike the cook songs):
   ```bash
   rsync -az -e "ssh -i ~/.ssh/CookingMusic-key.pem" mvp/audio/voice/ ubuntu@<host>:~/sizle/mvp/audio/voice/
   ```

Total Michael set: ~100 clips, ~4.7 MB.
