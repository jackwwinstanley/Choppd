# Choppd — Security Audit & Scalability Assessment

**Date:** 2026-07-03 · **Mode:** READ-ONLY. No configuration, code, or infrastructure was changed. All fixes below are *proposed*, not applied.
**Target:** getchoppd.app (EC2 `18.191.64.147`, Caddy → Node `:8788`) + RDS Postgres.

## Access I had (what's verifiable) vs. didn't (what's not)

| Capability | Status | Consequence |
|---|---|---|
| Repo + server source + deploy configs (local) | ✅ Full | Code/config findings are verified |
| Live domain, external network probes, HTTP | ✅ Full | Headers/TLS/CORS/ports verified externally |
| `npm audit` (local server deps) | ✅ Ran | Dependency status verified |
| **AWS CLI / console** | ❌ No creds (`~/.aws` absent, no `aws` binary) | **Security groups, RDS public-access, IAM role, elastic IPs, CloudWatch, snapshots — UNVERIFIABLE** |
| **SSH to the EC2 box** | ❌ Denied (`sizle-key.pem` + `CookingMusic-key.pem` both `Permission denied (publickey)`) | **On-box checks (`ss -tlnp`, OS patch level, `authorized_keys`, `sshd_config`, RDS reachability, disk/RAM) — UNVERIFIABLE** |

Nothing unverifiable is marked "OK" below — it's marked **UNVERIFIED** with the exact command you (or a follow-up with creds) should run.

---

# PART A — Security

## Verified findings (ranked)

### A-1 · [HIGH — conditional/UNVERIFIED] SSH (22) exposure to the internet
- **What:** Port 22 is reachable and accepts key auth. The deploy runbook ([EC2_RDS_NEXT_STEPS.md:18](EC2_RDS_NEXT_STEPS.md#L18)) intends "22 (your IP only)," but I cannot confirm the live security group. Port 22 answered from *this laptop* — which is inconclusive, because that's plausibly the same IP the SG would allow.
- **Location:** EC2 instance SG (ID unknown — needs console).
- **Why it matters:** If the SG is `0.0.0.0/0` on 22, the box is exposed to the internet's continuous SSH brute-force background noise. Password auth would make this critical; key-only makes it lower but still HIGH.
- **Verify (you, with console/CLI):** `aws ec2 describe-security-groups` → inbound 22 source. On the box: `sudo grep -Ei 'PasswordAuthentication|PermitRootLogin' /etc/ssh/sshd_config`.
- **Proposed fix (do not apply):** Restrict 22 to your current IP/CIDR (or move to SSM Session Manager and close 22 entirely); ensure `PasswordAuthentication no`.

### A-2 · [MEDIUM] No rate limiting outside `/api/auth`
- **What:** Rate limiting is applied only to `/api/auth` (30 req / 15 min). Every other endpoint — including **unauthenticated writes** and **external-API proxies** — is unthrottled.
- **Location:** [server/src/index.ts:48-55](server/src/index.ts#L48) (limiter mounted only on `/api/auth`). Exposed unauth endpoints: `/api/event`, `/api/visit` ([routes.ts:39,51](server/src/routes.ts#L39)) write a DB row each; `/api/nutrition` ([routes.ts:361](server/src/routes.ts#L361)) writes an unbounded `nutrition_cache` row per unique query **and** calls Open Food Facts; `/api/recipes/search` ([routes.ts:290](server/src/routes.ts#L290)) proxies TheMealDB. `/admin` has no limiter either.
- **Why it matters:** Your tester Discord link is semi-public. A script hitting `/api/nutrition?q=<random>` in a loop bloats the DB indefinitely, burns your t3.small, and can get your IP throttled/banned by Open Food Facts. `/event`/`/visit` flooding pollutes analytics and grows the DB. No global limiter = trivial app-layer DoS on a small instance.
- **Proposed fix:** Add a global `express-rate-limit` (e.g. 300/15min/IP) on `/api`; a tighter one on `/api/nutrition` + `/api/recipes/search`; a login-throttle on `/admin`. Cap `nutrition_cache` growth (reject non-alpha queries; TTL rows).

### A-3 · [MEDIUM] CORS allowlist is stale — set to `sizle.nodaysoff.pro`, not `getchoppd.app` (this is almost certainly your "OAuth/CORS issue")
- **What (confirmed live):** A preflight/GET carrying `Origin: https://getchoppd.app` gets **no `Access-Control-Allow-Origin`** back, while `https://sizle.nodaysoff.pro/api/health` still serves. The box is running with the template's old value `CORS_ORIGINS=https://sizle.nodaysoff.pro` — deploy step 5 (`CORS_ORIGINS=https://getchoppd.app`, [EC2_RDS_NEXT_STEPS.md:30](EC2_RDS_NEXT_STEPS.md#L30)) was never applied.
- **Location:** live env on box; template at [server/.env.production:17](server/.env.production#L17); consumed at [index.ts:43-45](server/src/index.ts#L43).
- **Why it matters:** Today the client is served *same-origin* (`SERVE_CLIENT=true`), so its own `fetch`es to `/api` don't need CORS — which is why the app partly works. But the domain migration is half-done: the **most likely root cause of broken Google sign-in is the companion step 4** — `https://getchoppd.app` not being added to the Google OAuth **Authorized JavaScript origins** (Google Identity Services rejects the origin before any call to your API). I **cannot verify Google Cloud console** (no access). The security-relevant note: **the fix is to add the exact origin, NOT to switch CORS to `*`.** A wildcard here would be the actual vulnerability.
- **Proposed fix:** On the box set `CORS_ORIGINS=https://getchoppd.app,https://sizle.nodaysoff.pro` (keep both while transitioning) and restart; in Google Cloud console add `https://getchoppd.app` to Authorized JavaScript origins. Then decommission the old domain.

### A-4 · [MEDIUM] No Content-Security-Policy + innerHTML-heavy client + JWT in localStorage
- **What:** Helmet is enabled but CSP is deliberately **off** ([index.ts:37](server/src/index.ts#L37)); confirmed live (all other headers present, no `content-security-policy`). The web client renders via `innerHTML` template literals ([app.js:450](mvp/app.js#L450) and ~30 call-sites) and holds the session JWT in `localStorage` (per CLAUDE.md / api.js).
- **Why it matters:** `esc()` is used in *some* client sinks ([app.js:474,484](mvp/app.js#L474)) but not consistently across all `innerHTML` sites that can receive external strings (TheMealDB recipe titles, session comments, Google display names). Any single reflected/stored XSS becomes **full session-token theft** because the token is script-readable and lives 30 days (see A-6). No CSP means no defense-in-depth net.
- **Location:** [server/src/index.ts:36-40](server/src/index.ts#L36); client sinks throughout [mvp/app.js](mvp/app.js).
- **Proposed fix:** (1) Add a tailored CSP (script-src 'self' + the specific CDNs: Google Identity, kokoro/jsDelivr, Spotify SDK; object-src 'none'; base-uri 'self'). (2) Do a focused client-side XSS pass ensuring every `innerHTML` that can carry external/user data goes through `esc()`. (Note: the *server-side* admin HTML **is** correctly escaped via `esc()` — [analytics.ts:110](server/src/analytics.ts#L110) — so admin is not the gap.)

### A-5 · [LOW] RDS connection is encrypted but certificate-unverified by default
- **What:** Postgres TLS uses `ssl: { rejectUnauthorized: false }` unless `PG_CA_CERT` is set ([db.ts:55-57](server/src/db.ts#L55)). `PG_CA_CERT` is **not** in the production env template, so it's likely unset → encrypted-but-unverified. Auth to RDS is **password via `DATABASE_URL`** (not IAM auth).
- **Why it matters:** Within the VPC (EC2↔RDS over a private SG) the practical MITM risk is low, but this defeats cert validation and is trivial to harden.
- **Proposed fix:** Ship Amazon's RDS CA bundle to the box, set `PG_CA_CERT=/path/rds-ca.pem` (code already flips to `rejectUnauthorized:true`). Optionally migrate to RDS IAM auth later.

### A-6 · [LOW] JWT: 30-day life, no server-side revocation, client-only logout
- **What:** Tokens are signed with 30-day expiry ([auth.ts:115](server/src/auth.ts#L115)); there's no revocation list and logout just drops the client token. A stolen token is valid for up to 30 days.
- **Proposed fix:** Shorten access-token TTL (e.g. 24h) + refresh flow, or add a server-side token-version/`jti` denylist so logout and compromise can invalidate.

### A-7 · [LOW] Static premium unlock code `Dev123`
- **What:** `/api/entitlement/redeem` grants premium for the static code `DEV_PREMIUM_CODE` (default `"Dev123"`, [routes.ts:15,127-131](server/src/routes.ts#L127)), set in the prod env ([.env.production:25](server/.env.production#L25)).
- **Why it matters:** By design for testers pre-launch, but it's a shared static secret — anyone who learns it unlocks premium.
- **Proposed fix:** Fine for now; rotate to per-user codes (or remove) before real monetization.

### A-8 · [LOW] Production JWT secret sits in the working tree; static/never-rotated
- **What:** The real `JWT_SECRET` is in [server/.env.production:8](server/.env.production#L8) in plaintext. **Good news, verified:** `.env`/`.env.production` are gitignored ([.gitignore](.gitignore)) and **never appear in git history** (`git log` shows only `.env.example` was ever committed) — so the secret is **not** burned/leaked via git. Local file perms are `600`.
- **Why it matters:** It's a long-lived static secret duplicated across laptop + box; there's no rotation story. Not currently exposed, but fragile.
- **Proposed fix:** Move prod secrets to SSM Parameter Store / Secrets Manager; confirm `/opt/sizle/server/.env` is `chmod 600` owned by the `sizle` user on the box; define a rotation procedure.

## Verified positives (no action)
Helmet headers live (HSTS `max-age=31536000; includeSubDomains`, `x-content-type-options: nosniff`, `x-frame-options: SAMEORIGIN`, `referrer-policy: no-referrer`, COOP `same-origin-allow-popups`, CORP `same-origin`) · HTTP→HTTPS 308 redirect · CORS does **not** reflect a forged origin and does **not** use `*`+credentials · **all SQL is parameterized** (the one interpolated value, `LIMIT ${limit}` at [routes.ts:331](server/src/routes.ts#L331), is a clamped integer — not injectable) · **no file-upload endpoint exists** (no multer/busboy; the "meal photo/cook card" is client-side canvas), so stored-XSS-via-upload is N/A · admin dashboard escapes all output, uses `timingSafeEqual`, and 503s when `ADMIN_PASSWORD` is unset (empty password disables, does not bypass) · `devAuth:false` confirmed in prod · JWT falls back to a dev secret but **throws on boot** if that default is used with `NODE_ENV=production` ([auth.ts:24](server/src/auth.ts#L24)) · Google ID tokens verified with audience + `email_verified` ([auth.ts:38-48](server/src/auth.ts#L38)) · **`npm audit`: 0 vulnerabilities** · port `8788` is **not** externally exposed (Caddy-only) · systemd unit runs as non-root `sizle` with `NoNewPrivileges`/`ProtectSystem=full` and `Restart=on-failure` · a scheduled read-only self-audit script exists ([security-audit.ts](server/src/security-audit.ts), not a mounted route).

## UNVERIFIED — needs AWS console/CLI or SSH (do not assume OK)
| Item | Command to run |
|---|---|
| EC2 SG: all inbound rules, 22 source, is 8788 truly closed at SG | `aws ec2 describe-security-groups --group-ids <sg>` |
| **RDS public accessibility (CRITICAL if yes)** | `aws rds describe-db-instances --query '...PubliclyAccessible'` |
| RDS SG sourced from EC2 SG (not a CIDR) | `aws ec2 describe-security-groups` on the RDS SG |
| EC2 IAM role + policy breadth (flag `*`/AdministratorAccess) | `aws ec2 describe-instances` → IamInstanceProfile; `aws iam get-role-policy` |
| Elastic IPs (unattached = waste) | `aws ec2 describe-addresses` |
| All listeners on the box | `sudo ss -tlnp` |
| OS patch level + unattended-upgrades | `dnf check-update; systemctl status dnf-automatic` |
| `authorized_keys`, `PasswordAuthentication` | `cat ~/.ssh/authorized_keys; sudo sshd -T | grep passwordauth` |
| **Is prod actually on RDS Postgres, or SQLite fallback?** | on box: `journalctl -u sizle | grep 'db='` (boot logs `db=postgres|sqlite`) |
| RDS automated backups + retention | `aws rds describe-db-instances --query '...BackupRetentionPeriod'` |

---

# PART B — Scalability

## B1 · Current specs
- **Documented target (UNVERIFIED live):** EC2 **t3.small** (2 vCPU burstable, 2 GB), RDS **db.t4g.micro** Postgres 15 ([EC2_RDS_NEXT_STEPS.md:10,17](EC2_RDS_NEXT_STEPS.md#L10)). Could not confirm live instance types, CPU/RAM/disk %, gp2 vs gp3, or `max_connections` (no AWS/SSH).
- **App server (verified in code):** single Node process — `app.listen()` once, **no clustering/PM2** ([index.ts:77](server/src/index.ts#L77)). PG pool **max 10 per process** ([db.ts:58](server/src/db.ts#L58)). JSON body cap 256 KB (good).
- **Static assets served *through Node*** via `express.static` + SPA catch-all ([index.ts:65-68](server/src/index.ts#L65)) — including multi-MB demo `.mp3`s. Caddy only reverse-proxies; it does not serve files directly.

## B2 · Single points of failure
- **One EC2 box = full outage if it dies.** Blast radius depends on an unverified fact: **is prod on RDS Postgres or the SQLite fallback?** If `DATABASE_URL` is unset the app silently uses a local SQLite file ([db.ts](server/src/db.ts)) — then **user accounts, cook sessions, and streaks live on the instance disk and are lost on instance failure = CRITICAL.** Must verify (B1 table). If Postgres/RDS, user data survives an EC2 loss.
- **TTS audio is client-side** (kokoro in-browser, per CLAUDE.md) — nothing server-generated to lose. Demo mp3s are in git (recoverable).
- **Supervision exists:** systemd `Restart=on-failure, RestartSec=3` (or Docker `--restart unless-stopped` per the runbook) — a 2 a.m. crash auto-restarts. Confirm which is actually deployed.

## B3 · Load behavior (estimated — no load test run)
I deliberately **did not run a load test.** No local staging exists (needs the DB), and hammering prod would write to unauthenticated analytics endpoints and hit external APIs — inappropriate for a live tester environment without your go-ahead. Estimate from the code:
- **Heaviest path:** static + audio through the single Node process. mp3 delivery on a t3.small's burst CPU + shared bandwidth is the first thing to saturate.
- **DB-heavy endpoints** `/api/recipes` and `/api/profile/*` load rows then filter/paginate **in JS in memory** ([routes.ts:210-235,251-287](server/src/routes.ts#L210)) — fine at near-zero data, wasteful as `cook_sessions` grows (full per-user scan per request). `recordsCache` (5-min/user) softens `/records`.
- No obvious missing index on the current hot paths, but everything funnels through pool=10 on one process.

## B4 · Verdict + roadmap
1. **At ~100 concurrent:** first strain is **CPU/bandwidth serving static+audio through Node**, not the DB (pool 10 vs ~80–100 RDS max is comfortable). A t3.small *probably survives* bursty use but p95 latency will spike during audio loads and CPU credits can deplete under sustained load. Fragile, not broken.
2. **At ~1,000 concurrent:** the single Node process and static bandwidth saturate → it breaks. **Minimum change set:** (a) **move static + audio to S3 + CloudFront** (removes the biggest load from the box, adds edge caching); (b) **run Node clustered** (PM2/`cluster`, N=vCPUs) or a 2nd instance behind an ALB, sizing PG pool per process under `max_connections`; (c) **confirm Postgres** + enable storage autoscaling; (d) bump to t3.medium/large as an interim. **Read replica: not yet** — you're write-light and single-instance; skip it.
3. **Cost (rough, us-east-2 on-demand):** t3.small ~$15/mo + db.t4g.micro ~$13/mo + EBS/transfer ≈ **$30–45/mo now.** Waste to check **now:** unattached Elastic IP (~$3.6/mo each if idle — `describe-addresses`), and **gp2→gp3** (cheaper + faster baseline). t3.small is not oversized given it also serves all static.
4. **Top 3 scale levers (effort→impact):** (1) **Static+audio → S3+CloudFront** — medium effort, largest impact. (2) **Cluster Node / stop serving static from the app** — low effort, high impact. (3) **Confirm RDS Postgres + right-size the pool** — trivial effort, prevents a data-loss and a hidden connection ceiling.

---

# TOP 5 ACTIONS OVERALL (risk × ease)
1. **Verify the two big unknowns in the AWS console** — RDS **`PubliclyAccessible = No`** (CRITICAL if yes) and the RDS SG sourced from the **EC2 SG**; and lock EC2 **SG :22 to your IP**. *Easy, highest risk-reduction.* (A-1, unverified table)
2. **Finish the domain migration:** set `CORS_ORIGINS=https://getchoppd.app` on the box and add `https://getchoppd.app` to Google's Authorized JavaScript origins — do **not** use `*`. This is the likely OAuth fix. *Easy.* (A-3)
3. **Confirm prod runs on RDS Postgres (not SQLite fallback) and enable RDS automated backups.** *Easy; prevents silent CRITICAL data loss.* (B2)
4. **Add global + endpoint rate limiting** (all of `/api`, tighter on `/nutrition` & `/recipes/search`, and `/admin`), and cap `nutrition_cache` growth. *Easy–medium; closes DoS/cost abuse before the Discord push.* (A-2)
5. **Move static+audio to S3+CloudFront and add a CSP** — the highest-leverage scale change, bundled with the main remaining security hardening. *Medium.* (A-4, B4)

*All findings are proposals. Nothing was changed. Re-run the UNVERIFIED table with AWS creds / SSH to close the gaps I couldn't reach.*
