# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**SearTune** (working title "MusicCooking") is a Gen-Z cooking app that teaches beginners by syncing step-by-step cooking cues to music. The flagship experience: cook a medium-rare steak in time with *Free Bird*.

It is being built as a **real full-stack web app** for a live testing/feedback launch, designed to transition seamlessly into an App Store native app. The repo has three parts:

- **`mvp/`** — the **web client** (vanilla-JS, no build step). The app users actually test.
- **`server/`** — the **backend API** (Node + TypeScript + Express). Real auth (passwordless OTP → JWT), accounts/profile, server-enforced entitlements, the cook-session flywheel, and recipe/nutrition proxies. **SQLite now** (`better-sqlite3`, zero infra) → **PostgreSQL/RDS** at scale (data access isolated in `server/src/db.ts`).
- **`mobile/`** — Expo/React-Native scaffold; the eventual native client.

The seam that makes the web→native transition seamless: a **single REST/JSON API** (`server/`) is the stable contract — the web client calls it now, the native app calls the same one later. The web client **degrades gracefully**: if the API is unreachable (`window.API.online === false`) it falls back to localStorage so the demo still runs offline. See `PLAN.md` §0.1 for the full strategy.

## Running the app

```bash
# Backend API (terminal 1)
cd server && npm install && npm run dev      # http://127.0.0.1:8788 (tsx watch)

# Web client (terminal 2)
cd mvp && python3 serve.py                   # http://127.0.0.1:4173 (no-cache dev server)
```

The web client auto-detects the API at `http://127.0.0.1:8788` (override via `localStorage.seartune_api_base`). With `DEV_AUTH=true` (default) the backend returns the login OTP in the response and the client shows it, so you can sign in without an email provider. See `server/README.md` for endpoints + deploy.

Use `serve.py` rather than `python3 -m http.server` — it sends no-cache headers so the browser never serves stale `app.js`/`styles.css` after edits. Front-end assets are cache-busted with `?v=N` query strings in `index.html`; bump those if a hard refresh still shows stale assets.

**Checks:** the front-end has no build step — sanity-check JS edits by parsing with JavaScriptCore via osascript (see `.claude/settings.json`). The backend is TypeScript: `cd server && npm run typecheck` (and `npm run build`).

## Regenerating the recipe catalog

```bash
python3 tools/import_themealdb.py   # writes mvp/recipes.json
```

This pulls beginner-friendly recipes from TheMealDB (free public API, no key), maps them to the SearTune schema, and writes `mvp/recipes.json`. TheMealDB requires attribution — the output carries a top-level attribution string and per-recipe source/YouTube links that the app surfaces in the UI. Imported recipes are `musicSynced: false` and run in "guided" (tap-through) mode because TheMealDB has no reliable timing data.

## Audio (copyright)

`mvp/audio/*.mp3` and other audio are **gitignored — never commit copyrighted tracks**. For local dev, drop a file you own named `freebird.mp3` into `mvp/audio/` (or use the in-app file picker / drag-and-drop on the Prep screen). Production streams via the Spotify Premium SDK (licensed path). See `mvp/audio/README.txt`.

## Architecture

### Backend (`server/`)

Node + TypeScript + Express REST API — the stable contract shared by the web client now and the native app later. SQLite (`better-sqlite3`) for the testing launch → Postgres/RDS at scale.

- **`src/index.ts`** — Express app, CORS, route mounting, boot (`migrate()`).
- **`src/db.ts`** — SQLite + schema (`users`, `auth_codes`, `cook_sessions`, `nutrition_cache`) mirroring PLAN.md §5, plus a curated per-100g nutrition seed for common ingredients. **This is the isolation point for the eventual Postgres swap.**
- **`src/auth.ts`** — passwordless email OTP → JWT; `requireAuth` middleware. `DEV_AUTH` returns the code in-response for the no-email testing launch.
- **`src/routes.ts`** — `/api/{health,auth/*,me,entitlement/redeem,sessions,recipes/search,nutrition}`. The **nutrition** route is a server-side Open Food Facts proxy (sidesteps the browser CORS that makes a client-side OFF call unreliable). See `server/README.md`.

### Web client (`mvp/`)

Classic (non-module) scripts loaded in order by `index.html`; they communicate through `window` globals, not imports:

- **`api.js`** (`window.API`) — backend client. `API.init()` health-checks the server and sets `API.online`; methods for auth/profile/entitlement/sessions/nutrition with a Bearer token in `localStorage.seartune_token`. **The app gates backend calls on `backendOn()` and falls back to localStorage when offline** — keep that pattern when adding API-backed features.
- **`cues.js`** — hand-authored, music-synced cook timelines (`window.FREEBIRD_STEAK`, `window.SCRAMBLED_EGGS`, collected in `window.EXPERIENCES`). Each cook has `prep[]` and a `cues[]` array; each cue has `at` (seconds into the song = cook-clock position), `type`, `title`, `body`, `beginner` copy, `voice` line, `haptic`, an optional `heat` level (`high`/`medium-high`/`medium`/`low`), and an optional `gate` (a doneness/safety checkpoint that blocks progression until the cook confirms). This is the cue schema everything else conforms to.
- **`recipe-map.js`** (`window.RecipeMap.mapMeal`) — a **JS port of the Python mapping in `tools/import_themealdb.py`**. It lets live TheMealDB search results get the same conservative timing estimates and safe-internal-temp doneness gates as the pre-imported catalog. **Keep these two files in sync** when changing timing heuristics, verb tables, protein/safety-temp logic, or difficulty scoring.
- **`tts.js`** (`window.Kokoro`) — on-device neural TTS via kokoro-js (Kokoro-82M ONNX), loaded from CDN, runs in-browser (WebGPU when available, else WASM). No API key/server. The app also supports Web Speech and system voices as engines.
- **`spotify.js`** (`window.Spotify_`) — real Spotify: Authorization-Code-with-PKCE OAuth (no server/secret) + Web Playback SDK. A shared app Client ID is hardcoded so users just log in. `playSelection()` handles a shuffled playlist (fetches tracks + Fisher-Yates client-shuffle), a looping track, or a queue.
- **`app.js`** — the whole app: state, screens, and the cook engine.

### app.js structure

- **`state`** — in-memory session state (email, experience level, equipment, prefs incl. voice engine/haptics/checkpoints/theme/speed). Would live server-side / in secure storage in production.
- **`Telemetry`** — the "data-flywheel seed." Logs each cook session (per-step authored-vs-actual time, "not yet" extensions, outcome/rating, equipment incl. chosen pan + heat source, per-step heat level, skill) to `localStorage` under `seartune_sessions` **and POSTs to the backend** (`/api/sessions`) when connected. Viewable via Settings → session-log viewer; downloadable as JSON.
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
