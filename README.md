# Choppd 🍳

**A voice-guided cooking app for beginners.** It talks you through a recipe step by step, out loud, with music underneath, and pauses at doneness/safety checkpoints until you confirm you're ready to move on.

Live at **[getchoppd.app](https://getchoppd.app)**.

---

## What it does

Most recipe apps assume you already know how to cook. Choppd is built for people who don't:

- **Spoken, timed instructions** synced to a music track, instead of a wall of text you have to keep checking
- **Safety/doneness checkpoints ("gates")**: the cook pauses and waits for you to confirm ("is it golden-brown yet?") before it moves on, so you can't get rushed past the part that actually matters
- **AI fridge scan**: take a photo of what's in your fridge/pantry, a vision model identifies ingredients against a controlled vocabulary, and the app suggests what you can cook right now
- **Stove-physics-aware timing**, cues account for real-world lag (electric vs. gas, searing vs. simmering) rather than naive countdown timers
- **Works offline**: the client falls back to local storage when the backend is unreachable, so a flaky connection doesn't break mid-cook

---

## How it's built

**One codebase, two shipping targets.** The web client *is* the product. The iOS App Store build is that same client wrapped in **Capacitor 7** (native WebView + plugins), not a parallel rewrite.

```
mvp/        Web client, vanilla JS, no build step, no bundler, no framework.
            Classic <script> files sharing `window` globals, loaded in order.
server/     Backend API, Node + TypeScript + Express.
ios/        Capacitor/Xcode project wrapping mvp/ for the App Store.
deploy/     Production config (Caddy reverse proxy + static marketing site).
docs/       Architecture specs, recipe format, regression locks.
recipes/    Recipe drafts and the authoring/verification pipeline.
```

### Frontend: deliberately framework-free

No React, no bundler, no build step. Each screen is a plain render function (`screens.cook()`, `screens.scan()`, etc.) that swaps the contents of a single container, so the entire app is readable top to bottom in a handful of files. This was a conscious tradeoff: instant reloads during development, zero dependency/toolchain risk, and a direct path to a Capacitor wrap with no transpilation step to keep portable.

The cook experience is modeled as a **cue timeline**: a recipe is `prep[]` plus `cues[]`, each cue carrying a timestamp, spoken/display copy, a haptic cue, and an optional safety "gate." Two playback engines run off the same schema: one real-time and music-synced (`requestAnimationFrame`-driven), one tap-through for recipes without a soundtrack.

### Backend

Node + TypeScript + Express, with passwordless OTP to JWT auth. Runs on **SQLite** locally and **Postgres (AWS RDS)** in production behind a single swappable data layer, so development has zero cloud dependency and production runs against a managed database with no code changes.

### AI / computer vision

The fridge-scan feature calls the **Anthropic Claude API** directly (`api.anthropic.com/v1/messages`) as its vision model:

- Each photo is matched against a controlled ingredient vocabulary rather than open-ended labeling, which keeps results grounded and app-usable instead of free-text hallucination
- Model selection is cost-aware and tiered: a default vision model handles the normal case, with automatic escalation to a stronger model only when a clear photo returns a suspiciously sparse match (a cheap first pass, a smarter second pass only when needed)
- A separate, deliberately cheaper model handles a lower-stakes creative text task (recipe idea generation). Model choice is pinned per use case so a cost/quality upgrade on one path can't silently leak spend onto another

### Infrastructure

- Single EC2 box running the API under `systemd`, with Caddy terminating TLS and reverse-proxying to Node
- Deploys are surgical (specific files, rebuild, service restart), not full-tree syncs, to protect a production environment that has necessarily diverged in small ways from `main`
- A scripted native regression gate (`scripts/native-verify.sh`) runs on every push that touches the mobile client: freshness check, Capacitor sync, simulator build/boot, CORS reachability, scripted login/audio UI flows

---

## Engineering practices worth noting

- **Feature flags over deletion.** Unfinished or hidden functionality is flag-gated, never ripped out, so everything is one constant away from shipping or rolling back.
- **Regression locks.** Hard-won invariants in the audio/cook engine (e.g. "music stops exactly at the finish cue," "a screen change always cuts the in-flight voice line") are numbered, documented, and checked before any change near that code path. Each one exists because it broke in production once.
- **A recipe-authoring pipeline with automated review.** New recipes are drafted and then run through a battery of specialist checks: format compliance, stove-physics timing, ingredient/step cross-referencing, beginner-readability, and a "first-time cook with an electric stove" adversarial read, before they ship.
- **Privacy/compliance pass.** Account deletion cascades through child records and anonymizes analytics. This was audited end-to-end against App Store data-deletion requirements.

---

## Running it locally

```bash
# Backend
cd server && npm install && npm run dev      # API on http://127.0.0.1:8788

# Frontend
cd mvp && python3 serve.py                   # client on http://127.0.0.1:4173
```

No build step on the frontend: edit, refresh, done.

### Checks

```bash
node --check mvp/app.js          # sanity-check a frontend edit
cd server && npm run typecheck   # backend type checking
cd server && npm run test:match  # fridge-scan matching guarantee suite
```

---

## Status

Pre-launch, approaching App Store submission. Core cook flow, fridge scan, auth, and the native iOS wrap are built and working; premium features are flag-hidden pending v1.0.

---

*Built solo, top to bottom: product design, cook-engine architecture, backend, native iOS wrap, and infrastructure.*
