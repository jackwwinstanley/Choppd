# How to add a track to the Choppd soundtrack

The cook music is a shuffled, looping **pool** of copyright-free tracks (the "Choppd soundtrack"), played by
one player across a whole music cook. It's **manifest-based** — adding a track is a 3-step, no-code change.

## The 3 steps

1. **Drop the mp3 in** — copy your copyright-free `.mp3` into `mvp/audio/soundtrack/`. Use a clean,
   descriptive filename (e.g. `artist-track-name.mp3`, no spaces).
2. **Add one manifest line** — in `mvp/audio/soundtrack-manifest.js`, add:
   ```js
   { file: "audio/soundtrack/your-file.mp3", title: "Track Name · Artist" },
   ```
   `file` is relative to `mvp/`; `title` is the friendly name shown in the 🎵 panel.
3. **Whitelist + commit** — the pool folder is already whitelisted in `.gitignore`
   (`!mvp/audio/soundtrack/*.mp3`), so just:
   ```sh
   git add mvp/audio/soundtrack/your-file.mp3 mvp/audio/soundtrack-manifest.js
   git commit -m "Soundtrack: add <track>"
   ```

## Rules

- **Copyright-free ONLY.** Never add a copyrighted recording — the pool ships to prod + inside the iOS app.
  Keep licence proof in `mvp/audio/LICENSES.md`.
- **It must resolve.** The boot / CI missing-asset assert (`window.__assertAudioAssets()`) HEAD-checks every
  manifest entry; a missing/typo'd path **fails loud** (`[audio-assets] MISSING …`) rather than shipping
  silence.

## Shipping the new track

- **Web (prod):** the Node server serves `mvp/` — deploy the updated `mvp/` (rsync/checkout) and the new file
  is live at `getchoppd.app/audio/soundtrack/…`.
- **iOS:** `npx cap sync ios` copies `mvp/audio/` into the app bundle. Rebuild to pick it up.
- Because the pool is git-tracked, a clean clone / checkout-deploy ships it deterministically — no
  "works-on-my-Mac" gap.
