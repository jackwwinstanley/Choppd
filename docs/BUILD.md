# Choppd — Build Summary

**Choppd** (working repo name "MusicCooking") is a Gen‑Z cooking app that teaches absolute
beginners by syncing step‑by‑step cooking cues to music. The flagship moment: cook a
medium‑rare steak in time with *Free Bird*. It's a real, deployed full‑stack web app built
for a live testing/feedback launch, designed to transition seamlessly into an App Store
native app (Capacitor) later.

- **Live:** `https://sizle.nodaysoff.pro` (custom `getchoppd.app` domain is a planned, not‑yet‑executed move)
- **Brand voice:** "the funny friend who actually has your back" — dry, confident humor by default, genuine warmth at the payoff moments; never punches at the user.

---

## 1. Architecture

A single REST/JSON API is the stable contract shared by the web client now and the native app later.

| Part | Stack | Role |
|---|---|---|
| **`mvp/`** | Vanilla JS, **no build step**, classic scripts sharing `window` globals | The web client users actually test |
| **`server/`** | Node + TypeScript + Express | Auth, accounts, entitlements, sessions, recipe/nutrition proxies |
| **`mobile/`** | Expo / React Native scaffold | The eventual native client (early stage) |

- **Database:** SQLite now (`better-sqlite3`, zero infra) → PostgreSQL/RDS at scale. All data access is isolated in `server/src/db.ts` (the swap point).
- **Graceful degradation:** the web client health‑checks the API (`window.API.online`); if unreachable it **falls back to `localStorage`** so the demo always runs offline.
- **Hosting:** Caddy (auto‑HTTPS) reverse‑proxies to the Node app, which serves the static client *and* `/api`. Single origin.
- **Dev server:** `mvp/serve.py` — a threaded, no‑cache Python server so edited assets never go stale.

---

## 2. The cooking experiences

### Four hand‑authored, music‑synced "cooks" (all free)
Each pairs a recipe with a song whose structure the cues are mapped to:

| Cook | Song | Notes |
|---|---|---|
| 🥩 Medium‑Rare Steak | *Free Bird* — Lynyrd Skynyrd | Two methods: **pan‑sear** (default) and **grill**, each with its own cues/prep; doneness gates at the flip and the 125–130°F temp check |
| 🍳 Fluffy Scrambled Eggs | sunrise pairing | Low‑and‑slow figure‑8 technique; per‑step reference photos; doneness gate |
| 🍝 Creamy One‑Pot Pasta | *Bohemian Rhapsody* — Queen | **Two‑phase**: a silent tap‑through simmer first, then the song drops and the sauce is built to the music |
| 🍗 Crispy Chicken Thighs | *Hotel California* — Eagles | Patient cold‑pan render; 165°F safety gate |

Each cue carries: `at` (seconds into the song = cook‑clock position), `type`, `title`, plain
`body`, richer `beginner` copy, a spoken `voice` line, a `haptic`, an optional `heat` level,
and an optional `gate` (a doneness/safety checkpoint).

### Recipe library (TheMealDB)
A catalog of beginner‑friendly recipes imported from TheMealDB (free, attributed) runs in a
simpler **guided / tap‑through mode** (no music sync). Live search + filtering against the
same backend.

---

## 3. The cook engine

### Real‑time music‑synced mode (`screens.cook`)
- A `requestAnimationFrame` loop advances `songPos` (the cook clock) and fires each cue when `songPos >= cue.at`; renders a countdown ring + a timeline.
- **Every cue is a checkpoint that pauses the cook timer** (the song keeps playing underneath, ducked, never rewound) — except the auto‑starting first step and the finish.
- **Doneness/safety gates** block progression until the cook confirms ("It's there", "165°F — done"), with warm "not ready" coaching and a scheduled voice nudge.
- **Manual checkpoint navigation:** ⏮ / ⏭ skip buttons jump to the previous/next checkpoint **and seek the song to that cue's musical moment**, so a cue always lands on the part of the track it was written for. Controls: `[⏮ ⏸ ⏭]` in a row with a full‑width red Quit beneath.
- **Parametric timing:** authored times scale by `paceFactor()` (self‑reported skill blended with observed median pace) × `equipFactor()` (pan + heat source) — a simple behavior‑refined formula, not a trained model.

### Other cook surfaces
- **Pasta Phase‑1 pre‑cook** (`screens.preCook`): silent simmer with tap‑to‑start timers, stir reminders, an early‑exit, and a doneness gate before the music starts.
- **Prep wizard:** one‑step‑per‑screen mise‑en‑place with technique guides.
- **Guided cook** (MealDB): simple tap‑through with per‑step timing, no music sync.
- **Preview / watch‑along:** a highlight‑reel "👀 Preview" that seeks through a cook's cues so users can see what they're in for before committing.

### Reference images (per‑step photos)
- Optional `referenceImage` field on cues. Accepts a **single file** (eggs: 8 approved AI‑generated step photos) **or an array** that **cross‑fades as a slideshow** for motion steps.
- The renderer is **load‑once**: one `<img>` layer per frame, each fetched exactly once, cross‑fading by opacity (no re‑fetching). Handles any frame count (1–3+).
- Graceful: the slot stays hidden until the first frame loads; a missing file never shows a broken icon. Tap to enlarge (lightbox).
- Steak's "Slice & serve" finish step **dwells on the plated photo** with a "✅ Done — rate it" button instead of jumping straight to rating.
- Build‑time generation script (`tools/gen-eggs-images.mjs`) renders + stages images via OpenAI for human review — the **live app never calls an image API**, only loads stored files.

---

## 4. Onboarding, accounts & personalization

- **Welcome → sign in → safety check → about‑you → cuisines → equipment → music** flow.
- **Auth:** passwordless. **Google OAuth** (Identity Services, no server secret) with an **email‑OTP fallback** for dev/offline; issues a **JWT**. `DEV_AUTH` returns the OTP in‑response so testers can sign in with no email provider.
- **Profile/personalization captured:** cooking experience level (drives in‑cook verbosity / "beginner mode"), cuisine preferences (weights recommendations), owned pans + heat source (gas/electric, tunes the heat guidance and timing).
- Preferences: voice on/off + engine + specific voice, haptics, generic‑checkpoint toggle, theme, playback speed (1×/2×).

---

## 5. Smart home screen

- **Time‑of‑day surfacing:** the featured "hero" cook and the "More music cooks" order reorder by the user's **local time** — 🍳 eggs in the morning, 🍝 pasta midday, 🥩 steak evening/late — and the section header rotates through a set of on‑brand phrases per window ("Rise & Sizzle", "Afternoon Fuel", "Tonight's Cook", "Late‑Night Bite"…).
- **Featured card** uses a full‑bleed food photo with a dark gradient overlay; "More music cooks" + search cards show food‑photo thumbnails; each recipe carries an optional `heroImage` beauty shot (browse + prep banner), separate from the per‑step `referenceImage`.
- **Easy picks** + **full recipe search/filter** (free to browse; cooking the MealDB walkthrough is a Premium feature).
- Recipe‑type badges (🎵 Music Sync vs 📖 Recipe library) and a "cooks / rating" stat band.

---

## 6. Ingredients, scaling & nutrition

- **Serving‑size scaling:** eggs / pasta / chicken / steak each have a portion config. Ingredient amounts scale linearly (`scaleAmount`, `injectAmounts`); timing scales gently or not at all where physically inappropriate (steaks sear simultaneously, so steak timing is pinned while amounts scale; pasta fully recomputes its ingredient list).
- **US ⇄ Metric toggle** — display‑only (the internal `measureToGrams` nutrition math is untouched).
- **Optional ingredients** are opt‑out (default on); "level‑it‑up" extras like steak **cowboy butter** are opt‑in (default off) and unlock a matching finishing cue when selected.
- **Nutrition:** a server‑side **Open Food Facts proxy** (sidesteps browser CORS) plus a curated per‑100g seed for common ingredients, surfaced per recipe on demand.

---

## 7. Audio, voice & haptics

- **Music:** royalty‑free demo tracks bundled per cook (the cook clock is driven by playback position; supports ducking under the voice, a quieter background mode during doneness checks, mute, and pitch‑preserved playback rate). **Spotify Premium** path via Authorization‑Code‑with‑PKCE OAuth + the Web Playback SDK (a shared app Client ID, so users just log in); plays a shuffled playlist, a looping track, or a queue. YouTube fallback for the free embed.
- **On‑device neural TTS** via **kokoro‑js** (Kokoro‑82M ONNX, WebGPU/WASM, no API key/server), with Web Speech and system voices as alternative engines. Voice lines duck the music and speak doneness coaching.
- **Haptics** (`navigator.vibrate`) on cues; an audible 3‑2‑1 countdown and synth chimes/beeps via WebAudio.
- **Screen wake‑lock** during cooks (re‑acquired on visibility change) so the phone doesn't sleep mid‑recipe.

---

## 8. Reminders & notifications

- **Steak room‑temp pre‑cook timer:** an optional 30‑minute "let the steak come to room temp" reminder you set and walk away from. Built behind a portable **`Reminders.schedule()` seam** — web now uses the Notification API + `setTimeout` with a graceful in‑app fallback (chime + vibrate + toast); a single marked swap‑point moves delivery to `@capacitor/local-notifications` for reliable locked‑phone notifications in the native app.
- In‑cook gate nudges and simmer stir reminders (chime + haptic + visual).

---

## 9. Saving, history & streaks

- **Save‑for‑later / bookmarks** everywhere (recipe cards, detail, preview), surfaced in a dedicated **Saved** screen. (Storage key kept as the legacy `seartune_saved` so existing data isn't orphaned.)
- **Cook history** + a streak calendar; a **cook streak** badge (server‑computed by local day).
- **Completion screen** is honest to the cook: a conditional first‑cook eyebrow ("First one down" vs "Another one done"), a warm payoff line with the takeout dig, and — on a low self‑rating (≤2★) — a "that one fought back, run it back" message instead of celebrating a flop.
- **Shareable cook card:** a generated image (photo hero + stat band + "Made with Choppd") for the viral loop, downloadable / native‑shareable.

---

## 10. Premium & entitlements

- Free tier: the 4 music cooks + browsing the full library. **Premium** (coming‑soon CTA + a dev/tester unlock code) opens cooking the full library and cooking to your own Spotify/Apple Music. Entitlements are **server‑enforced** (`/api/entitlement/redeem`) with a localStorage fallback offline.

---

## 11. Backend API & data flywheel

- **Routes** (`server/src/routes.ts`): `health`, `auth/*` (Google + OTP), `me` / profile, `entitlement/redeem`, `sessions` (read/write), `recipes/search|stats|:id` (TheMealDB‑backed), and the `nutrition` proxy. Auth‑protected routes use a `requireAuth` JWT middleware.
- **Telemetry — the data‑flywheel seed:** every cook session logs per‑step authored‑vs‑actual time, "not yet" extensions, outcome/rating + comment, equipment (pan + heat source), per‑step heat, and skill — to `localStorage` **and** the backend (`/api/sessions`). Viewable/downloadable in‑app; powers the parametric timing and a profile records/history view.
- **Weekly email digest** of session analytics (cron + nodemailer/SMTP).

---

## 12. Security

- **Scheduled, read‑only security audit** (`server/src/security-audit.ts`, cron every 3 days): scans for hardcoded secrets (never printing values), secret‑file permissions, `npm audit` high/critical CVEs, outdated packages, routes missing `requireAuth`, SQL string‑interpolation, and permissive CORS. Logs to a non‑web‑accessible file and emails on critical/high findings; **never modifies code**.
- A companion **local git‑history secret scan** (`tools/git-secret-scan.sh`, read‑only, values redacted).
- Hardened the real deployment along the way (`.env` perms → 600).

---

## 13. Native‑readiness (Capacitor)

The app is built for a clean wrap into a native iOS shell:
- Standard web code (no browser‑specific hacks), mobile‑first/touch‑first, **self‑contained in‑app navigation** (no reliance on the browser back button, URL bar, or new tabs).
- **PWA** manifest + add‑to‑home‑screen metas with the Choppd icon.
- Native‑sensitive features (notifications) sit behind abstractions with marked swap‑points, so delivery moves to a Capacitor plugin without a rewrite. (Browser Web Push was deliberately avoided — it doesn't run in a Capacitor WKWebView.)

---

## 14. Conventions & docs

- Vanilla JS only on the front end (no modules/bundler/deps); terse single‑file style; small frequent git commits.
- Strategy/spec docs live at the repo root: `PLAN.md`, `ADAPTIVE_CUES_ROADMAP.md`, `RECIPE_INGESTION_SPEC.md`, `COMPETITIVE_ANALYSIS.md`, `MoatBuildingPlan.md`.
- Front‑end is cache‑busted via `?v=N` query strings; JS is sanity‑checked by parsing with JavaScriptCore (no build step); the backend is typechecked with `tsc`.

---

## Status at a glance

✅ Live web app with real auth, 4 music‑synced cooks (+ MealDB library), full cook engine with
gates and skip navigation, per‑step reference photos (eggs + steak slideshow), time‑of‑day
personalization, scaling + units + nutrition, neural TTS + Spotify, save/history/streaks, the
shareable cook card, server‑enforced Premium, the telemetry flywheel, an automated security
audit, and a native‑portability foundation — all in the committed Choppd brand voice.
