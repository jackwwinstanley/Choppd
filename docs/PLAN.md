# Music Cooking App — Plan of Action

> Working title: **MusicCooking** (placeholder)
> A Gen-Z cooking app that teaches beginners to cook by syncing step-by-step
> cooking cues to music. **MVP:** cook a medium-rare steak to *Free Bird* by
> Lynyrd Skynyrd, with cues timed to the song.

---

## 0. Status & Open Items

- **Decisions locked** via discovery (see Appendix A).
- **UX guidelines received & applied** → Section 6 is now a concrete Gen-Z
  design system (mobile-first, dark-mode-first, bold/visual, vibe-driven,
  social, accessible, gamified). Only brand name/exact palette hue/logo remain
  open.
- **To finalize during build:** subscription billing tooling (Apple IAP vs.
  RevenueCat wrapper — defaulting to Apple IAP for compliance).
- **We are building NOW — and it's full-stack, not a demo.** See §0.1.

### 0.1 Current strategy: ship a real web app first, then the App Store

The product is being built as a **real, full-stack web app launched for live
testing + feedback** — used by real people, with real accounts and persisted
data — and is then **transitioned seamlessly into the App Store** native app.
The web app is *not* a throwaway prototype; it's the working product, and the
backend it talks to is the same one the native app will use.

**The seam that makes the transition seamless:** the App-Store app is the **exact
same web client (`mvp/`) wrapped in [Capacitor](https://capacitorjs.com/)** — a
native WebView shell + native plugins — not a rewrite. The single **REST/JSON API**
(`server/`) backs both the browser and the Capacitor iOS app, and native features
(camera, haptics, Apple IAP, push) come from Capacitor plugins over the same JS. We
**"build one client, wrap it"** — the previous "swap to an Expo/React-Native client"
plan is superseded. Design constraint: keep every web choice Capacitor-portable and
flag any that won't wrap (e.g. Web Push → a Capacitor push plugin).

**What exists in the repo today:**

| Piece | Location | State |
|---|---|---|
| **Web client** (the app users test now) | `mvp/` | Working: onboarding, the music-synced cook engine (steak/eggs), TheMealDB recipes, real Spotify (PKCE + Web Playback SDK), in-app music picker w/ shuffle/queue, heat-level guidance, light/dark. |
| **Backend API** (real) | `server/` | Working: Node+TS+Express, **passwordless OTP → JWT auth**, accounts/profile, **server-enforced entitlements**, the **cook-session flywheel**, recipe + nutrition proxies. SQLite now → Postgres/RDS at scale. |
| **Native app** | `mvp/` + Capacitor | The App-Store build is the `mvp/` web client wrapped in Capacitor (not yet scaffolded). `mobile/` is a **legacy Expo scaffold — superseded, do not extend.** |

**Pragmatic "now vs. scale" choices** (documented so they're intentional, not
accidental — the architecture in §4 remains the scale target):
- **DB:** **SQLite** for the testing launch (real, file-backed, zero infra) →
  **PostgreSQL on RDS** for scale. Access is isolated in `server/src/db.ts`.
- **Auth:** **self-contained OTP → JWT** now (no external dependency, deployable
  today) → **AWS Cognito** optional for the native era; the `/api/auth/*`
  contract is unchanged either way.
- **Email:** dev mode returns the login code in-app; production wires an email
  sender (Resend/SES) — one env var, no code change.
- **Hosting:** any Node host (Render/Railway/Fly/VPS) for the web launch → the
  full AWS topology in §4 when scale demands it.

> So: §4–§9 below describe the **production-scale** target (App-Store era). §0.1
> + §10 describe **what we're running right now** for the web testing launch.
> They are the same product at two maturity levels, joined by the REST contract.

---

## 1. Product Summary

### The idea
Beginners (target: Gen Z, people who have never cooked) learn a cooking
technique by following cues that are **synced to a song**. The rhythm and
structure of the music carries them through timing that would otherwise be
intimidating ("when do I flip it?", "is it done?").

### MVP scope (deliberately narrow)
- **One recipe / technique:** pan-seared **medium-rare steak**.
- **One song:** *Free Bird* — Lynyrd Skynyrd (proven to produce a good steak).
- **One music provider:** Spotify (Premium SDK playback).
- **Web app first** (live testing + feedback at a URL anyone can use), then
  **iOS** (App Store) via the same backend, Android-ready architecture.

### Business model (freemium)
- **Free tier:** a small, curated set of song↔recipe experiences (the Free Bird
  steak is the flagship free cook), **ad-supported** (Google AdMob). Users can
  only cook the curated experiences we choose — **no custom song/playlist
  selection.**
- **Premium tier (paid monthly):** full catalog, no ads, all future recipes &
  songs.
- **Custom playlist/song selection** (picking your own music for a cook)
  requires **BOTH**:
  1. **Our app's Premium subscription**, AND
  2. **A Premium subscription on the music platform** (Spotify Premium / Apple
     Music) — needed for full controlled in-app playback.
  Both gates must be satisfied; missing either falls back to the curated free
  experiences.
- Apple In-App Purchase for our subscription billing (App Store compliant).

---

## 2. Locked Decisions (from discovery)

| Area | Decision |
|---|---|
| Mobile stack | **Capacitor** — wrap the `mvp/` web client (iOS first, Android-ready); one codebase, native plugins. (Was React Native + Expo — superseded.) |
| Backend | **Node.js + TypeScript** on **EC2**, **PostgreSQL on RDS** |
| Auth | **Managed auth (AWS Cognito)** — email login (magic link / OTP) |
| Music (MVP) | **Spotify only**, Premium SDK playback; provider-abstraction layer for Apple Music later |
| Cue authoring | **Hand-authored timeline now**, schema designed for **audio-analysis later** |
| Monetization | **Freemium**: AdMob on free tier + **Premium subscription** (Apple IAP) |
| Cue delivery | Voice prompts (default on), big visual step + countdown, haptics (default on, toggleable), passive timeline bar |
| Onboarding | Beginner Yes/No (changes guidance depth) + fast equipment check |
| Safety | Accept disclaimer at signup + inline safety tips during cook |

---

## 3. Core User Experience

### 3.1 First-run flow
1. **Welcome / value prop** (1–2 slick screens).
2. **Email login** (Cognito magic link / OTP — no passwords).
3. **Safety disclaimer** — accept terms (hot surfaces, raw meat, food safety).
4. **Onboarding**
   - *"Have you cooked before?"* → **Yes / No.**
     - **No (beginner):** more reassurance, slower pacing copy, extra inline
       tips, "you've got this" tone.
     - **Yes:** terser cues, fewer reminders.
   - **Fast equipment check:** pan type (cast iron / stainless / nonstick),
     heat source (gas / electric / induction). Used to lightly tune cue copy.
5. **Connect Spotify** (Premium required for in-app synced playback).
6. → Into the flagship cook.

### 3.2 The cook session (the heart of the app)
A single full-screen, hands-free-friendly experience synced to the song:

- **Voice prompts** (default ON): spoken cues ("Salt it now", "Lay the steak
  away from you", "Flip", "Off the heat — let it rest"), **ducked over the
  music** so the song keeps playing.
- **Big visual step cards** + **countdown** to the next action — glanceable from
  across the kitchen.
- **Haptic buzzes** (default ON, can be turned off): vibrate at key moments
  (flip, remove from heat) so the user doesn't need to look.
- **Passive timeline bar** pinned at the bottom: the song timeline with upcoming
  cue markers, so they can see what's coming.
- **Controls:** pause/resume (pauses song + cue clock together to stay in
  sync), restart step, emergency "I need a sec."
- **Beginner vs. experienced** changes verbosity, pacing copy, and number of
  inline tips — same timeline, different guidance density.

### 3.3 Post-cook
- "How did it go?" feedback (used later for tuning + social proof).
- Upsell to Premium (if free user), share moment, suggest next cook.

---

## 4. System Architecture

### 4.1 High-level
```
[ Capacitor iOS app = mvp/ web client in a native WebView shell ]
        │  HTTPS (REST/JSON)
        ▼
[ ALB ]→[ EC2 Auto Scaling Group: Node.js/TS API (stateless) ]
        │                 │
        │                 ├─→ [ RDS PostgreSQL (Multi-AZ) ]
        │                 ├─→ [ ElastiCache Redis (sessions/cache) ]
        │                 └─→ [ S3 (audio assets, voice clips, images) + CloudFront CDN ]
        │
   [ AWS Cognito ]  (email auth)
        │
External: [ Spotify API/SDK ]  [ AdMob ]  [ Apple IAP / App Store Server API ]
```

### 4.2 Scalability principles (built in from day one)
- **Stateless API** behind an **Application Load Balancer** in an **Auto Scaling
  Group** → horizontal scale on CPU/req metrics.
- **RDS PostgreSQL Multi-AZ** for HA; **read replicas** added when read load
  grows. Connection pooling (RDS Proxy / pgBouncer).
- **Redis (ElastiCache)** for session/token caching and hot reads (recipe &
  cue-timeline data is read-heavy, write-rare → cache aggressively).
- **S3 + CloudFront** for all static/media (voice cue audio, step images) — keep
  it off the app servers.
- **Cue timelines are static, versioned content** → cache at CDN/Redis, cheap to
  serve to many users.
- **Infrastructure as Code** (Terraform or AWS CDK) so environments are
  reproducible (dev / staging / prod).
- **Stateless = trivially scalable**: any instance can serve any request.

### 4.3 Backend service layout (modular monolith first)
Start as one well-structured Node/TS service (faster for MVP), with clear module
boundaries so pieces can split into services later:
- `auth` — Cognito integration, session/token validation.
- `users` — profile, beginner flag, equipment, preferences.
- `music` — **provider abstraction** (`MusicProvider` interface; `SpotifyProvider`
  now, `AppleMusicProvider` later) — playback tokens, track metadata.
- `recipes` — recipes, techniques, song↔recipe mappings.
- `cues` — **cue timelines** (versioned, hand-authored now; analysis-generated
  later via same schema).
- `entitlements` — free vs. premium, ad-eligibility, subscription state, and the
  **custom-selection gate** (requires app-Premium **AND** music-platform-Premium).
- `billing` — Apple IAP receipt validation / App Store Server notifications.
- `ads` — config/flags for AdMob placements (server-controlled).
- `content` — signed URLs for S3/CloudFront media.

---

## 5. Data Model (initial sketch)

> PostgreSQL. IDs as UUIDs. Timestamps everywhere. Soft-delete where useful.

- **users** — `id, cognito_sub, email, is_beginner, created_at, ...`
- **user_equipment** — `user_id, pan_type, heat_source`
- **user_preferences** — `user_id, voice_enabled, haptics_enabled, doneness_default`
- **subscriptions** — `user_id, tier (free|premium), status, provider (apple),
  current_period_end, original_transaction_id` (our app's Premium)
- **music_accounts** — `user_id, provider (spotify), provider_user_id, scopes,
  product_tier (free|premium), connected_at` (tokens stored securely / refreshed;
  consider Secrets Manager). `product_tier` records whether the linked Spotify/
  Apple Music account is Premium — used for the custom-selection gate.
- **recipes** — `id, slug, title, technique, difficulty, doneness, description`
- **songs** — `id, provider, provider_track_id (spotify), title, artist, duration_ms`
- **experiences** — join of recipe + song: `id, recipe_id, song_id, is_free,
  status` (the unit the user "plays"). MVP row = Free Bird ↔ medium-rare steak.
- **cue_timelines** — `id, experience_id, version, source (manual|analysis),
  is_active`
- **cues** — `id, timeline_id, at_ms, type (prep|action|flip|rest|temp_check|tip),
  title, body, voice_clip_key (S3), haptic_pattern, beginner_body, experienced_body`
- **cook_sessions** — `id, user_id, experience_id, started_at, completed_at,
  outcome, feedback` (analytics + tuning)
- **ad_placements** — server-driven config: `key, type (banner|interstitial|
  rewarded), enabled, free_only`

**Why this shape:** the **cue timeline is versioned and decoupled** from the
song, so we can re-tune Free Bird's cues without app updates, and later generate
timelines from **audio analysis** into the *same* `cues` table — no rework.

---

## 6. UX / Visual Design System (Gen-Z guidelines applied)

Design is driven by the provided Gen-Z UX guidance. The table below translates
each principle into a **concrete, app-specific rule** so it's actionable, not
abstract.

### 6.1 Principles → how we apply them

| Gen-Z principle (from guidelines) | How MusicCooking implements it |
|---|---|
| **Mobile-first, non-negotiable** | Built for one-handed/thumb use; primary actions in the bottom third; gesture nav (swipe between steps, swipe-up for details); no view-blocking pop-ups. Designed for greasy-hand, across-the-kitchen glanceability. |
| **Dark-mode first** | App ships **dark by default** (kitchens at night, looks sleek, lets food imagery pop) with a light toggle. Dark/light is a user preference (`user_preferences`). |
| **Bold, visually engaging** | Vibrant accent palette, high-contrast type, big food photography/video, cinematic cook hero. Custom visuals — **no generic stock**. The sizzling steak is the hero image. |
| **Simplicity & clarity** | Minimal layouts, bite-sized steps, one clear bold CTA per screen ("Start cooking", "Flip now"). Never more than ~1 primary decision on screen. |
| **Speed & performance** | Compressed/CDN media, fast cold start, optimistic UI, tested on older devices and slow networks. Cook screen never janks (it's the critical moment). |
| **Interactive & immersive** | The cook session *is* an immersive full-screen, rhythm-synced experience: animated countdowns, swipe gestures, tap-to-confirm a step, reactive timeline. |
| **Micro-interactions** | Every action gives feedback — animated cue transitions, button press states, haptic taps, a satisfying "step complete" pop, confetti/sizzle on finish. |
| **Personalization** | Beginner vs. experienced changes tone/verbosity; remembers voice/haptic prefs, theme, equipment, doneness; greets by name; recommends the next cook. |
| **Appeal to the "vibe"** | Music is the personalization engine — browse/cook **by song & mood**, not by dry recipe lists. The vibe of the track sets the vibe of the cook. |
| **Social integration & UGC** | One-tap **share to Instagram/TikTok/Snapchat** — auto-generated "I cooked a steak to Free Bird" result card (photo + song). Post-cook photo capture seeds future UGC/social proof. |
| **Social proof** | Show "X people cooked this", star outcomes, and (later) real user result photos on the experience card. |
| **Authenticity** | Real, encouraging, human voice in copy ("First steak? You've got this." ) — no corporate/fake tone. Honest about what's free vs. paid. |
| **Accessibility = part of design** | WCAG AA contrast, adjustable text sizes, **captions for all voice cues** (cues are bilingual: audio + on-screen text already), screen-reader labels, large tap targets. Voice cues double as an accessibility win. |
| **Gamification (Duolingo-style)** | Light, non-childish: a finished-cooks streak, "first cook" badge, progress toward unlocking new techniques. Encouraging, not gimmicky. |
| **Voice (and future AR)** | Voice cues already core; design leaves room for future hands-free voice control ("Hey — next step") and AR pan-overlay experiments post-MVP. |

### 6.2 Common mistakes — explicitly avoided
Cluttered screens, desktop-first thinking, accessibility as an afterthought,
fake/corporate messaging, slow loads, and silent interactions (no feedback) are
all called out in the guidelines — our rules above counter each one.

### 6.3 Visual system (initial spec)
- **Theme:** dark-first, sleek; high-contrast vibrant accent (final hue TBD with
  brand). Food imagery is the color hero.
- **Type:** bold, modern sans; large glanceable sizes on the cook screen.
- **Motion:** rhythmic, music-reactive; smooth 60fps transitions; micro-feedback
  on every tap; celebratory finish animation.
- **Components:** big step cards, animated countdown ring, passive song timeline
  bar with cue markers, voice/haptic toggles, share result card, streak/badge
  chips, bold CTA buttons.

### 6.4 Screen inventory (MVP)
1. Welcome / value-prop carousel
2. Email login (Cognito OTP)
3. Safety disclaimer accept
4. Onboarding: beginner Y/N → fast equipment check
5. Connect Spotify
6. Home / "tonight's vibe" — featured Free Bird steak cook (+ locked Premium teasers)
7. Experience detail (song + recipe + social proof + Start)
8. **Cook session** (the hero screen: voice + step cards + countdown + haptics + timeline)
9. Post-cook: photo + outcome + share card + Premium upsell
10. Profile/settings: theme, voice/haptics, equipment, subscription, accessibility

> Brand name, exact palette hue, and logo are the only items still open
> (Appendix B); everything else above is locked from the guidelines.

---

## 7. Key Integrations

### 7.1 Spotify (MVP)
- **Premium SDK** for in-app controlled playback (start/seek/pause) → enables
  tight cue sync to song timestamps.
- OAuth connect flow; store/refresh tokens securely.
- The **cue clock is driven by playback position** (poll/observe player state) so
  cues fire at the right moment even if the user pauses.
- Provider abstraction so **Apple Music (MusicKit)** drops in later.

### 7.2 Auth — AWS Cognito
- Email login via **magic link / OTP** (passwordless).
- Cognito issues JWTs; API validates; Redis caches session/entitlement lookups.

### 7.3 Monetization
- **AdMob** (free tier): banner + interstitial + (optional) rewarded. Placement
  flags are **server-controlled** and **suppressed for Premium**.
- **Premium subscription:** **Apple In-App Purchase** (required for digital subs).
  Validate receipts server-side; subscribe to **App Store Server Notifications**
  for renew/cancel/refund → keep `subscriptions` table accurate. (RevenueCat as
  an optional wrapper — decide during build.)
- **Custom-selection gate (server-enforced):** the API only allows choosing a
  custom song/playlist when **`subscriptions.tier = premium`** *AND*
  **`music_accounts.product_tier = premium`**. If either is missing, the user is
  routed to the curated experiences with an upsell explaining which gate to
  unlock. Enforced server-side (never trust the client) and cached in Redis.

### 7.4 Safety
- Accept-terms gate at signup (logged with version).
- Inline safety tips as a cue `type` (hot pan, raw-meat handling, internal-temp
  guidance) woven into the timeline.

---

## 8. Non-Functional Requirements

- **Security:** HTTPS only; secrets in AWS Secrets Manager / SSM; least-priv IAM;
  encrypt RDS at rest + in transit; never store raw provider tokens in plaintext;
  rate limiting on API.
- **Privacy/Compliance:** App Store privacy nutrition labels; clear data policy;
  ad consent (ATT / UMP for AdMob); deletion-on-request.
- **Observability:** CloudWatch metrics/logs/alarms; structured logging; error
  tracking (e.g. Sentry); health-check endpoint for ALB.
- **CI/CD:** GitHub Actions → build/test → deploy API to EC2 (blue/green or
  rolling via ASG); **Expo EAS** for app builds + App Store submission.
- **Testing:** unit (API modules), integration (DB/auth), and a hardware-aware
  manual pass on the cook session sync (the critical UX).
- **Performance budget:** cue firing accurate to within a small tolerance of the
  song position; app cold start fast; media via CDN.

---

## 9. Environments

- **dev** — local + a lightweight cloud env; mocked Spotify where possible.
- **staging** — mirrors prod (smaller); used for App Store TestFlight builds.
- **prod** — Multi-AZ RDS, ASG, CloudFront.
- All provisioned via **IaC** (Terraform/CDK) for reproducibility & scale.

---

## 10. Roadmap / Phases

> **Phase W (we are here): Web testing launch.** Ship the full-stack web app
> (`mvp/` client + `server/` API) at a public URL for real users + feedback.
> Real accounts (OTP→JWT), persisted profiles/entitlements, the cook-session
> flywheel streaming to the backend. SQLite + a single Node host; email sender
> for OTP; analytics on cook sessions; gather feedback. **Everything here is
> built against the same REST API the native app will use** — so Phases 0–4
> below become "lift the proven product onto AWS + wrap it in Expo," not a
> rewrite.

### Phase 0 — Foundations
- Repo structure (monorepo: `app/` + `api/` + `infra/`).
- IaC skeleton (VPC, RDS, EC2/ASG, ALB, S3, CloudFront, Cognito, Secrets).
- CI/CD pipelines; environments.

### Phase 1 — Auth + shell
- Cognito email login in the app; safety disclaimer; onboarding (beginner Y/N +
  equipment check); user profile persisted.

### Phase 2 — Music + cue engine
- Spotify connect + Premium SDK playback.
- Cue timeline data model + **hand-authored Free Bird steak timeline**.
- The cook session screen: voice (ducked), visual steps + countdown, haptics,
  timeline bar; playback-position-driven cue clock; pause/resume sync.

### Phase 3 — Monetization
- Entitlements (free vs premium); AdMob placements on free tier; Apple IAP
  subscription + server-side receipt validation + store notifications.

### Phase 4 — Polish + launch
- Apply final design system (from your attachments); accessibility; analytics on
  cook sessions; post-cook feedback; TestFlight → App Store submission.

### Post-MVP (designed-for, not built yet)
- Apple Music provider; more song↔recipe experiences; **audio-analysis cue
  generation**; Android; social/sharing; creator-authored cooks.

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Spotify Premium requirement limits free users | Free tier uses the curated free experiences; consider a "play in your Spotify + synced timer" fallback for non-Premium later |
| Cue/music sync drift | Drive cue clock from actual playback position; pause cues with playback; tolerance tuning |
| App Store rejection (billing/ads/safety) | Apple IAP for subs, ATT/UMP for ads, clear safety disclaimer & privacy labels |
| Raw-meat / heat liability | Disclaimer + inline safety tips; conservative copy; (optional temp-check later) |
| Music licensing scope | Spotify SDK playback stays within Spotify's terms; revisit before app-hosted audio |
| Single-recipe MVP feels thin | Make the one cook *exceptional*; lean on the novelty + polish; clear roadmap |

---

## Appendix A — Discovery Q&A (decisions captured)

1. **Spotify playback:** Premium SDK playback for paying users; **also plan
   Apple Music** connection; **free tier** with a few curated song↔recipe cooks
   (flagship = Free Bird medium-rare steak) **monetized with ads**.
   - **Custom song/playlist selection** requires **BOTH** our app's Premium
     **AND** a Premium subscription on the music platform (Spotify/Apple Music).
2. **Cue authoring:** **Hand-authored now, audio-analysis later** (same schema).
3. **Mobile stack:** **Capacitor** — ship the `mvp/` web client to the App Store by wrapping it (one codebase, native plugins). (Previously React Native + Expo — superseded.)
4. **Auth:** **Managed auth (Cognito)**, email login.
5. **MVP providers:** **Spotify only** first; Apple Music later via provider
   abstraction.
6. **Ad network:** **Google AdMob.**
7. **Backend:** **Node.js + TypeScript** on EC2, **PostgreSQL on RDS.**
8. **Billing:** **Not finalized** → default to **Apple IAP** (compliant);
   RevenueCat optional.
9. **Cue delivery:** **Voice prompts (default)**, **big visual steps +
   countdown**, **haptics (default on, toggleable)**, **passive timeline bar.**
10. **Onboarding:** **Beginner Yes/No** (changes guidance) + **fast equipment
    check.**
11. **Safety:** **Disclaimer + inline safety tips.**

---

## Appendix B — Still needed from you
- [x] ~~UX design attachments~~ — received; applied in Section 6.
- [ ] App name / brand direction.
- [ ] Exact accent palette hue + logo (Section 6.3).
- [ ] Premium price point (monthly).
- [ ] Confirm billing tooling (Apple IAP only vs. + RevenueCat).
