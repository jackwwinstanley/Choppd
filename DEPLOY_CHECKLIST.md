# Sizle — EC2 + RDS Launch Checklist

**Status:** all **code/local** items are done and committed; what's left is
**manual cloud setup** (AWS / Google / Spotify consoles + DNS) that needs your
account and can't be driven from the dev machine. Runbook: [`DEPLOY.md`](./DEPLOY.md).
Production env is staged (gitignored) at **`server/.env.production`** — fill its
two remaining `REPLACE_*` values (`DATABASE_URL`, `CORS_ORIGINS`) before shipping.

Legend: `[x]` done · `[~]` partial · `[ ]` your turn (manual/cloud).

## 1. Database (SQLite → Postgres/RDS)
- [x] Rewrite `server/src/db.ts` data layer to support Postgres (`pg` driver, async).
- [x] Keep SQLite for local dev via a `DATABASE_URL` switch (set = Postgres/RDS, unset = SQLite).
- [x] Translate schema to portable SQL; `auth_codes.expires_at` → **BIGINT**.
- [x] Replace SQLite-only syntax: `INSERT OR REPLACE` → `INSERT ... ON CONFLICT DO UPDATE`.
- [x] Make all query call sites in `routes.ts` / `auth.ts` `async/await`.
- [x] Cast `BIGINT` reads with `Number(...)` (pg returns bigints as strings).
- [ ] Provision RDS Postgres instance; set `DATABASE_URL` env (with SSL).  ·  *DEPLOY.md §1*
- [ ] Lock RDS security group to the EC2 instance/subnet only.
- [ ] Verify `migrate()` runs against RDS on boot (`/api/health` after deploy).

## 2. Auth (Google OAuth)
- [x] Backend Google ID-token verification (`google-auth-library`).
- [x] Issue app JWT after verifying the Google token; create/lookup user by `google_sub`/email.
- [x] Add Google Sign-In button to the web client login screen.
- [x] `DEV_AUTH=false` in production (auto-off when `GOOGLE_CLIENT_ID` is set).
- [x] Real `JWT_SECRET` generated → `server/.env.production` (gitignored, not on screen).
- [~] Google OAuth client exists (`GOOGLE_CLIENT_ID` set) — **verify it's a *Web* client**.
- [ ] Add your **prod origin** to Authorized JavaScript origins (e.g. `https://app.sizle.com`).  ·  *DEPLOY.md §2*

## 3. Server hardening
- [x] `helmet` for security headers.
- [x] `express-rate-limit` on `/api/auth/*`.
- [x] `app.set('trust proxy', …)` (behind ALB/reverse proxy).
- [x] `CORS_ORIGINS` configurable; same-origin serving available.
- [x] Request body limited (`256kb`); prod refuses default `JWT_SECRET`.

## 4. Hosting & TLS
- [x] Static hosting decided: serve `mvp/` from Express (`SERVE_CLIENT=true`, same origin).
- [x] TLS assets ready: `deploy/Caddyfile` (auto-HTTPS) or ALB + ACM.
- [ ] Launch EC2 (Node 20+), same VPC as RDS; SG: 443/80 public, 22 your-IP, 8788 internal.  ·  *DEPLOY.md §3*
- [ ] Point DNS A record at the instance / load balancer.  ·  *DEPLOY.md §5*

## 5. Process & ops
- [x] Managed-service assets: root `Dockerfile` + `deploy/sizle-api.service` (systemd).
- [x] Production process is `npm run build` → `node dist/index.js` (baked into both).
- [x] Auto-restart configured (`Restart=on-failure` / `--restart unless-stopped`).
- [x] Health check endpoint `/api/health` exists.
- [ ] Wire the health check into the ALB target group (if using an ALB).
- [ ] Enable RDS automated backups / snapshots.

## 6. Secrets & config
- [x] `JWT_SECRET` / `DATABASE_URL` / Google ID kept in `server/.env.production` (gitignored).
- [x] `DEV_PREMIUM_CODE` set (replace with real entitlements before public billing).
- [x] `.env`, `.env.production`, and SQLite DB files are git-ignored (verified).
- [ ] *(optional)* Move secrets to AWS Secrets Manager / SSM Parameter Store.

## 7. Frontend wiring
- [x] `seartune_api_base`: same-origin auto-detect (served by the API, no override needed).
- [x] Bumped `?v=N` cache-busting on changed assets (`api.js` v2, `app.js` v37).
- [x] Spotify redirect URI is dynamic (`location.origin + path`) — auto-uses the prod domain.
- [ ] Register that exact prod redirect URI in the **Spotify app dashboard**.

## 8. Pre-launch verification
- [x] Local smoke tests: SQLite auth→JWT→/me, nutrition seed, same-origin client serving, prod secret guard.
- [x] `pg` adapter constructs + `?`→`$n` translation verified (no live DB on dev machine).
- [ ] Sign in end-to-end via Google on the deployed URL.
- [ ] Confirm sessions/profile persist to RDS across restarts.
- [ ] Confirm CORS + HTTPS work from the real origin.
- [ ] Smoke-test recipe search + nutrition proxy against prod.

---

### Decisions still open (fill in, then I can tailor configs)
- **Region:** _TBD_   ·   **Domain/host:** _TBD_   ·   **Run mode:** Docker (recommended) vs systemd
- **Code delivery to EC2:** no git remote exists yet — create a private GitHub repo to
  `git clone`, or plan to `scp`/rsync the tree up.
