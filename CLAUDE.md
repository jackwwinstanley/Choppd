# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**SearTune** (working title "MusicCooking") is a Gen-Z cooking app that teaches beginners by syncing step-by-step cooking cues to music. The flagship experience: cook a medium-rare steak in time with *Free Bird*.

The repo currently contains a **front-end-only MVP** in `mvp/` — a vanilla-JS browser demo with no build step and no real backend. Cognito/Spotify/RDS are mocked; only the cook engine is real. A future Expo/React Native production build is anticipated (see `.gitignore` Node entries) but does not exist yet.

## Running the app

```bash
cd mvp
python3 serve.py          # no-cache dev server on http://127.0.0.1:4173
```

Use `serve.py` rather than `python3 -m http.server` — it sends no-cache headers so the browser never serves stale `app.js`/`styles.css` after edits. Assets are also cache-busted with `?v=N` query strings in `index.html`; bump those if a hard refresh still shows stale assets.

There is **no build, lint, or test suite**. To sanity-check JS edits, the project parses files with JavaScriptCore via osascript (see `.claude/settings.json` for the exact incantation) — effectively a syntax check, not a test runner.

## Regenerating the recipe catalog

```bash
python3 tools/import_themealdb.py   # writes mvp/recipes.json
```

This pulls beginner-friendly recipes from TheMealDB (free public API, no key), maps them to the SearTune schema, and writes `mvp/recipes.json`. TheMealDB requires attribution — the output carries a top-level attribution string and per-recipe source/YouTube links that the app surfaces in the UI. Imported recipes are `musicSynced: false` and run in "guided" (tap-through) mode because TheMealDB has no reliable timing data.

## Audio (copyright)

`mvp/audio/*.mp3` and other audio are **gitignored — never commit copyrighted tracks**. For local dev, drop a file you own named `freebird.mp3` into `mvp/audio/` (or use the in-app file picker / drag-and-drop on the Prep screen). Production streams via the Spotify Premium SDK (licensed path). See `mvp/audio/README.txt`.

## Architecture

The MVP is four classic (non-module) scripts loaded in order by `index.html`; they communicate through `window` globals, not imports:

- **`cues.js`** — hand-authored, music-synced cook timelines (`window.FREEBIRD_STEAK`, `window.SCRAMBLED_EGGS`, collected in `window.EXPERIENCES`). Each cook has `prep[]` and a `cues[]` array; each cue has `at` (seconds into the song = cook-clock position), `type`, `title`, `body`, `beginner` copy, `voice` line, `haptic`, and an optional `gate` (a doneness/safety checkpoint that blocks progression until the cook confirms). This is the cue schema everything else conforms to.
- **`recipe-map.js`** (`window.RecipeMap.mapMeal`) — a **JS port of the Python mapping in `tools/import_themealdb.py`**. It lets live TheMealDB search results get the same conservative timing estimates and safe-internal-temp doneness gates as the pre-imported catalog. **Keep these two files in sync** when changing timing heuristics, verb tables, protein/safety-temp logic, or difficulty scoring.
- **`tts.js`** (`window.Kokoro`) — on-device neural TTS via kokoro-js (Kokoro-82M ONNX), loaded from CDN, runs in-browser (WebGPU when available, else WASM). No API key/server. The app also supports Web Speech and Google voices as engines.
- **`app.js`** — the whole app: state, screens, and the cook engine.

### app.js structure

- **`state`** — in-memory session state (email, experience level, equipment, prefs incl. voice engine/haptics/checkpoints/theme/speed). Would live server-side / in secure storage in production.
- **`Telemetry`** — the "data-flywheel seed." Logs each cook session (per-step authored-vs-actual time, "not yet" extensions, outcome/rating, equipment, skill) to `localStorage` under `seartune_sessions`. Local-only in the demo; intended to stream to the backend to train timing models. Viewable via Settings → session-log viewer.
- **Parametric timing** — `adjustedSec(base)` scales authored times by `paceFactor()` (self-reported skill blended with observed median pace from telemetry) × `equipFactor()` (pan + heat). Deliberately a simple formula refined by behavior, *not* a trained model or thousands of authored variants.
- **`Music`** — wraps an `<Audio>` element. The cook clock is driven by playback position; supports ducking under the voice, a quieter "background" mode during doneness checks, mute, and playback-rate (with preserved pitch). Mirrors the production Spotify SDK model.
- **`screens`** — an object of render functions (`screens.welcome`, `.login`, `.home`, `.recipeDetail`, `.prep`, `.cook`, `.guidedCook`, `.finish`, `.settings`, `.profile`, etc.). Navigation = calling the next `screens.x()`. The tiny `h(html)` helper replaces `#app`'s contents; `$`/`$$` are scoped query helpers. Boot is at the bottom: `Sidebar.mount(); screens.welcome();`.

### Two cook modes

- **`screens.cook`** — the real-time, music-synced engine for authored cooks. A `requestAnimationFrame` `loop` advances `songPos` (the cook clock), fires cues when `songPos >= cue.at`, and renders the countdown ring / timeline. **Every cue is a checkpoint that pauses the cook timer** (the song keeps playing underneath, never rewound) **except the first step (auto-starts) and the finish cue**; generic checkpoints can be toggled off in Settings, but `gate` cues always wait. Gates show coach copy and a "not ready" path that schedules a nudge after `nudgeSec`.
- **`screens.guidedCook`** — simple tap-through mode for imported (`musicSynced: false`) recipes, with per-step timing guidance but no music sync.

## Conventions

- Vanilla JS only, classic scripts sharing `window` globals — **no modules, no bundler, no dependencies to install.** Match the existing terse, single-file style.
- After each change, commit to git for rollback safety (small, frequent commits).
- The planning/strategy docs at the repo root (`PLAN.md`, `ADAPTIVE_CUES_ROADMAP.md`, `RECIPE_INGESTION_SPEC.md`, `COMPETITIVE_ANALYSIS.md`, `MoatBuildingPlan.md`) describe product direction and the cue/ingestion specs — consult them for intent, e.g. "Phase A/B/C" feature references in commit messages map to `ADAPTIVE_CUES_ROADMAP.md`.
