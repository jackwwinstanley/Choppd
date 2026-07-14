# continueOTP.md — OTP as the universal sign-in (native + web)

> **Handoff / continuation doc.** Investigation is complete; implementation is
> **paused on one founder decision (email transport)**. This file holds every
> finding + the full build plan so it can be resumed cold. Nothing below is built
> yet. Author: build assistant, 2026-07-13.

---

## 0. THE ONE BLOCKER (resume here)

**OTP email has NO working transport in production.** On the box, `SMTP_URL` is
empty and `DIGEST_TO` is empty → even the weekly digest runs in dry-run and has
never sent a real email. The auth path never calls `sendMail` at all. So OTP-as-
universal-auth cannot function for real users, and **App Store review (which signs
in via OTP on the native build, where Google is hidden) will reject** if the code
never arrives. iCloud/Apple-relay deliverability matters specifically (strict on
unauthenticated senders).

**Decision needed (the rejected AskUserQuestion — awaiting founder):**

| Option | What it means | Trade |
|---|---|---|
| **A. Transactional provider** (Resend/Postmark/SES) | Wire a provider behind a `Mailer` seam; founder supplies an API key. | Best deliverability incl. iCloud. It's **net-new provisioning, not a "migration"** (there's no transport to preserve), so it doesn't really cross the "no email migration" fence. Sender = a verified subdomain now; getchoppd.app SPF/DKIM is the flagged fast-follow. **(recommended)** |
| **B. Founder provides `SMTP_URL`** | Founder gives an SMTP_URL (Google Workspace app-password / their mail host); wire OTP to the existing `nodemailer` path as-is. | Fastest to stand up. Gmail-from / `sizle.nodaysoff.pro` sender risks iCloud/Gmail spam — the deliverability problem, unsolved. |
| **C. Build hardening now, defer email** | Build DEV_AUTH lockout + OTP hardening + platform split now; leave email wiring until a transport exists. | Unblocks web hardening only. **Native can't ship until email works** (Google hidden there). |

**Sub-decisions bundled with the transport choice:**
- Sender domain: `getchoppd.app` (needs founder to add SPF/DKIM DNS — the flagged
  fast-follow) vs. a provider-verified subdomain for the first working version.
- An **iCloud address to test** + founder to eyeball inbox-vs-spam placement
  (I can verify Gmail placement myself via the Gmail MCP; I can't see an iCloud inbox).

Everything in §4 below is transport-agnostic and can be built the moment A or B is
chosen (or immediately under C, minus the send).

---

## 1. TASK RECAP

Native iOS (Capacitor) can't use Google OAuth in WKWebView and **must not show it**
(Apple Guideline 4.8 would then force Sign in with Apple). So: **email OTP becomes
the universal auth path on BOTH native and web; Google stays web-only**, with all
Google/OAuth server infrastructure left fully intact for native Apple+Google in v1.1.

**Fences:** no Apple Sign-In this pass; no changes to the Google OAuth web flow, no
new providers, no JWT/session redesign; all user-facing strings ship as functional
drafts marked DRAFT-PENDING-VOICE-REVIEW; deploy diff-scoped (app.js holds parked
video-match client code that must not ride to prod; the box's `db.ts`/`routes.ts`
are already video-match-stripped — patch additions in, never overwrite).

---

## 2. BEFORE-CODING FINDINGS (investigation complete)

### ① SMTP reality — 🔴 no transport (see §0)
- `mvp`/`server` auth path sends no email: `POST /api/auth/request` → `issueCode()`
  only **stores** the code and `console.log`s it in the `!DEV_AUTH` branch.
- Only mail transport in the repo: `server/src/digest.ts` + `server/src/security-audit.ts`
  via `nodemailer.createTransport(SMTP_URL)`. Sender default `sizle.nodaysoff.pro`.
- Box `.env` (key names only, values not read): `SMTP_URL` **empty**, `DIGEST_TO`
  **empty**, `DIGEST_FROM` set, `NODE_ENV=production`, `DEV_AUTH=false`,
  `GOOGLE_CLIENT_ID` set, `JWT_SECRET`, `TOKEN_VERSION`, `AUTH_RATE_LIMIT`. `nodemailer`
  is installed in server deps. sizle-api systemd `EnvironmentFile=.../server/.env`.

### ② DEV_AUTH + log/plaintext leaks
- `server/src/auth.ts:23` — `DEV_AUTH = (process.env.DEV_AUTH || (GOOGLE_CLIENT_ID ? "false":"true")) === "true"`.
  **Env-only, not tied to `NODE_ENV`.** Prod `.env` is `DEV_AUTH=false` (safe today),
  but a stray `DEV_AUTH=true` in prod **would** return the code in the response. This
  is the §1 failure mode.
- `server/src/auth.ts:81` — `console.log("[auth] code for ${email}: ${code}")` fires
  in the **`!DEV_AUTH` (prod)** branch → plaintext OTP into journald. Currently 0
  occurrences (OTP unused in prod), but must be removed.
- `server/src/auth.ts:80` — code stored **plaintext** in `auth_codes.code`.
- `verifyCode` (85–93) has **no attempt counter** and no throttle.

### ③ Account schema — 🟢 already unified (NO migration)
- `server/src/db.ts:92` `users`: `email TEXT UNIQUE NOT NULL`, `google_sub TEXT UNIQUE`
  (nullable) **on the same row**.
- `upsertGoogleUser` (auth.ts:52) matches by `google_sub` OR `email`; when it matches
  by email it **sets google_sub on that existing row**. OTP path `getOrCreateUser`
  (auth.ts:95) matches/creates by email. Both lowercase the address (`routes.ts:85`
  `.trim().toLowerCase()`; `auth.ts:45` `p.email.toLowerCase()`).
- ⇒ Google + OTP with the same email already resolve to **one account** (id, streaks,
  sessions, entitlements). No separate identity rows → **§4 gate structurally clear.**
  First successful OTP verify creates the account (existing, preserved).

### ④ Current auth code map
- `server/src/auth.ts` — helpers: `DEV_AUTH`, `GOOGLE_CLIENT_ID`, `verifyGoogleIdToken`,
  `upsertGoogleUser`, `issueCode`, `verifyCode`, `getOrCreateUser`, `recordLogin`,
  `signToken` (7d, `TOKEN_VERSION` claim), `decodeToken`, `requireAuth`, `optionalUserId`.
- `server/src/routes.ts` — routes: `GET /auth/config` (68), `POST /auth/google` (73),
  `POST /auth/request` (84), `POST /auth/verify` (91).
- `server/src/db.ts` — `users` (92), `auth_codes` (109: `email, code, expires_at` +
  `idx_auth_codes_email`).
- `server/src/index.ts` — rate limit: `app.use("/api/auth", tier(15*60*1000, AUTH_RATE_LIMIT||30))`
  (30 req / 15 min per IP across ALL auth endpoints); global `/api` backstop 300/min.

### ⑤ Client Google-button logic + native detection
- `mvp/app.js:2079` `screens.login`; `2080` `googleReady = backendOn() && !!API.googleClientId`;
  `2081` `showEmail = !backendOn() || API.devAuth` → **prod currently HIDES OTP** (Google-only).
- `mvp/app.js:2113` `screens.otp` (prefills `pendingDevCode` in dev).
- `mvp/api.js` — `LS_TOKEN="seartune_token"`, `cfg={googleClientId,devAuth}` from
  `/api/auth/config`, methods `google/requestCode/verify`.
- **Native detection is ALREADY available**: `mvp/native.js` sets `html.native` before
  paint in the Capacitor WebView (shipped in the prior "native full-bleed" task). Use
  `document.documentElement.classList.contains("native")` (and/or `window.Capacitor?.isNativePlatform()`).

### ⑥ JWT storage/expiry
- `localStorage["seartune_token"]`; **7-day** expiry (`signToken`); `TOKEN_VERSION` env =
  mass-logout lever. WKWebView localStorage persists across kill/relaunch (app data
  container). Expired token → `decodeToken` null → `requireAuth` 401 → client must land
  on sign-in (verify the boot path degrades, not breaks). On-device check = founder step.
  Future (not this pass): `@capacitor/preferences` is more durable than WKWebView
  localStorage under storage pressure.

### ⑦ App Store review
- Hiding Google on native + **email-OTP-only avoids Guideline 4.8** (Apple Sign-In is
  required only when a third-party/**social** login is offered; email OTP is first-party).
  Apple Sign-In defers to v1.1 with native Google. ✅
- **Working OTP delivery is a hard submission gate** (reviewers sign in via OTP). See §0.

---

## 3. IMPLEMENTATION PLAN (build once transport chosen)

### §0 — Mailer seam (new `server/src/mailer.ts`)
- Export `sendOtpEmail(email, code): Promise<void>` behind a tiny interface so the
  transport can swap without touching the routes (mirrors the app's portability seams).
- Transport resolved from env at boot:
  - Option A: provider SDK/HTTP (e.g. Resend) keyed by `RESEND_API_KEY` + `MAIL_FROM`.
  - Option B: `nodemailer.createTransport(SMTP_URL)` (reuse the digest pattern) + `MAIL_FROM`.
  - No transport configured + dev → log-guarded no-op (never in prod).
- The **route** calls `issueCode` (stores hashed) then, when not dev-returning, awaits
  `sendOtpEmail`. Response shape is identical whether it sends or dev-returns.

### §1 — DEV_AUTH structural lockout (`server/src/auth.ts`)
- Replace line 23 with:
  ```ts
  export const DEV_AUTH =
    process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_AUTH === "true";
  ```
  Fails **closed** in prod regardless of any env. Drop the GOOGLE_CLIENT_ID default.
- **Delete** the `console.log("[auth] code ...")` at line 81 (plaintext leak).
- Proof to capture: prod build + `NODE_ENV=production DEV_AUTH=true ALLOW_DEV_AUTH=true`
  → `/auth/request` response has **no `devCode`**.

### §2 — OTP hardening (`server/src/db.ts`, `auth.ts`, `index.ts`)
- **Schema** (`auth_codes`, via `addColumnIfMissing` — the box's Postgres is live):
  replace plaintext `code` usage with `code_hash TEXT`, add `attempts INTEGER DEFAULT 0`,
  `created_at TEXT`. Keep single-active-code (delete prior on new request). Consider a
  small `otp_requests(email, created_at)` append log (pruned) to enforce the resend
  throttle, since the single-active-code delete erases issue history.
- **`issueCode`**: hash the code (`sha256`/HMAC with a server pepper) before store; never
  log plaintext; stamp `created_at`.
- **`verifyCode`**: increment `attempts`; if `attempts >= 5` → delete row + fail (force
  fresh); constant-time compare of hash; check expiry; delete on success.
- **Throttles**: per-email resend **1/min + 5/hour**; per-code verify **5 attempts**.
- **IP rate limits** (split the shared auth tier): request **15/hour/IP**, verify
  **30/hour/IP** (env-tunable like existing tiers). *(numbers = proposal, founder to confirm)*
- **No enumeration**: `/auth/request` always returns `{sent:true}` (or the identical
  throttle error) regardless of account existence; `/auth/verify` returns token on
  success / identical `401 bad-code` on failure. Account creation happens **after** a
  valid code (so it can't be used to probe existence). Keep response shapes + timing
  comparable for known vs unknown emails.

### §3 — Platform split (`mvp/app.js`, `mvp/api.js`)
- `screens.login`: `const isNative = document.documentElement.classList.contains("native");`
  - `googleReady = backendOn() && !!API.googleClientId && !isNative;` (Google hidden on native)
  - `showEmail = true;` (OTP is now the universal path — always visible, web + native)
- Remove the "OTP only offline/dev" gating + all "test mode" copy from the prod path.
- `screens.otp`: prefill only under dev (`API.devAuth`); in prod no prefill; add a
  **Resend code** control wired to the per-email throttle.
- Zero changes to the Google web flow itself (`mountGoogleSignIn`, `/auth/google`).

### §4 — Account linking (verify + test only; no migration)
- Already unified on email (finding ③). Add a round-trip test: Google sign-in email X →
  OTP sign-in email X → same `users.id`, same streak/sessions/entitlements.

### §5 — Native JWT (verify + report; no redesign)
- Confirm boot path: invalid/expired token → `/api/me` 401 → routes to `screens.login`
  (not a broken state). Report storage (`localStorage`) + 7d expiry. On-device
  kill/relaunch persistence = founder verification step.

### User-facing strings (DRAFT-PENDING-VOICE-REVIEW — list verbatim for marketing)
- **OTP email subject:** `Your Choppd code: 123456`
- **OTP email body:** `Here's your code to sign in to Choppd:` / `123456` /
  `This code expires in 10 minutes. Didn't request it? You can safely ignore this email.`
- **Enter-email:** heading `What's your email?` · sub `We'll send a 6-digit code to your inbox. No passwords, ever.` · button `Send code`
- **Check-email:** heading `Check your email` · sub `We sent a 6-digit code to {email}.` · button `Verify & continue` · link `Use a different email` · resend `Didn't get it? Resend code`
- **Errors:** wrong `That code isn't right — check the digits and try again.` · expired `That code's expired. Request a new one.` · too-many-attempts `Too many tries — request a fresh code.` · resend-throttle `Hang tight — you can request another code in a minute.` · ip-throttle `Too many attempts. Give it a few minutes and try again.`

---

## 4. DEPLOY DISCIPLINE (when the time comes)
- **Server** (`auth.ts`, `routes.ts`, `db.ts`, `index.ts`, new `mailer.ts`): `db.ts` and
  `routes.ts` on the box are already video-match-stripped — **pull the box copies, patch
  the additions in locally, assert 0 new `video_matches`, scp back**; scp new/clean files
  directly; rebuild on box; verify `dist` feature code has 0 `video_matches`; restart
  `sizle-api`; health + 401 checks. (Same procedure used for the skill-graph deploy.)
- **Client** (`app.js`, `api.js`): rsync the changed files only + bump `?v=` in `index.html`.
- Add the new env keys to the box `.env` (transport creds, `ALLOW_DEV_AUTH` NOT set in prod).

## 5. VERIFICATION BATTERY
- DEV_AUTH lockout proof (prod build + malicious env → no `devCode`).
- Expired code rejected; 6th verify attempt rejected; resend throttle (2nd within 60s) rejected.
- Identical response shape/timing for existing vs unknown email (both `/request` + `/verify`).
- SMTP delivery to **Gmail** (send via prod, read placement + latency via Gmail MCP) and
  **iCloud** (founder checks placement) — once a transport is chosen.
- Platform split headless: force `html.native` → Google button absent, OTP present; web
  (no native) → both present.
- Account-link round trip (Google + OTP same email → one id) server-side.
- Native device (founder): full OTP round trip → kill → relaunch → still signed in; Google absent.

## 6. OPEN DECISIONS FOR FOUNDER (bundle when resuming)
1. **Transport: A / B / C** (§0) — the blocker.
2. Sender domain: getchoppd.app + SPF/DKIM (fast-follow) vs provider subdomain now.
3. Rate-limit numbers (§2) — confirm or adjust.
4. Draft strings (§3) — voice pass.
5. An **iCloud test address** + founder to eyeball inbox-vs-spam.
