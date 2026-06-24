# SearTune — EC2 + RDS Launch Checklist

## 1. Database (SQLite → Postgres/RDS)
- [ ] Rewrite `server/src/db.ts` data layer to support Postgres (`pg` driver, async).
- [ ] Keep SQLite for local dev via a `DATABASE_URL` switch (set = Postgres/RDS, unset = SQLite).
- [ ] Translate schema to portable SQL; change `auth_codes.expires_at` to **BIGINT** (Postgres `INTEGER` overflows on `Date.now()` ms).
- [ ] Replace SQLite-only syntax: `INSERT OR REPLACE` → `INSERT ... ON CONFLICT DO UPDATE`.
- [ ] Make all query call sites in `routes.ts` / `auth.ts` `async/await`.
- [ ] Cast `BIGINT` reads with `Number(...)` (pg returns bigints as strings).
- [ ] Provision RDS Postgres instance; set `DATABASE_URL` env (with SSL).
- [ ] Lock RDS security group to the EC2 instance/subnet only.
- [ ] Verify `migrate()` runs against RDS on boot.

## 2. Auth (Google OAuth)
- [ ] Create Google OAuth client ID/secret in Google Cloud Console.
- [ ] Add authorized origins + redirect URIs (your prod domain).
- [ ] Add backend Google ID-token verification (`google-auth-library`).
- [ ] Issue app JWT after verifying the Google token; create/lookup user by email.
- [ ] Add Google Sign-In button to the web client login screen.
- [ ] Set `DEV_AUTH=false` in production (no OTP-in-response).
- [ ] Set a real `JWT_SECRET` (not `dev-only-change-me`).

## 3. Server hardening
- [ ] Add `helmet` for security headers.
- [ ] Add `express-rate-limit` on `/api/auth/*` endpoints.
- [ ] Set `app.set('trust proxy', 1)` (behind ALB/reverse proxy).
- [ ] Set `CORS_ORIGINS` to the real web origin (or serve same-origin).
- [ ] Validate/limit request bodies (already `256kb`).

## 4. Hosting & TLS
- [ ] Launch EC2 (Node 20+); install build tools if using native `better-sqlite3`.
- [ ] Decide static hosting: serve `mvp/` from Express (same origin, simplest) or S3/CloudFront.
- [ ] TLS via ALB + ACM cert, or Caddy/nginx reverse proxy with auto-HTTPS.
- [ ] Point DNS at the load balancer / instance.

## 5. Process & ops
- [ ] Run as a managed service: systemd unit, pm2, or Docker (not `npm start`/tsx in foreground).
- [ ] `npm ci && npm run build && npm run serve:dist` for the production process.
- [ ] Auto-restart on crash + start on boot.
- [ ] Configure logging and a health check (`/api/health`) for the ALB target group.
- [ ] RDS automated backups / snapshots enabled.

## 6. Secrets & config
- [ ] Store `JWT_SECRET`, `DATABASE_URL`, Google creds in env / SSM Parameter Store / Secrets Manager (not committed).
- [ ] Set `DEV_PREMIUM_CODE` (or replace with real entitlements before public billing).
- [ ] Confirm `.env` and DB files are git-ignored.

## 7. Frontend wiring
- [ ] Set web client `seartune_api_base` to the prod API (or serve same-origin so it auto-detects).
- [ ] Bump `?v=N` cache-busting query strings on changed assets in `index.html`.
- [ ] Update Spotify OAuth redirect URI to the HTTPS prod domain.

## 8. Pre-launch verification
- [ ] Sign in end-to-end via Google on the deployed URL.
- [ ] Confirm sessions/profile persist to RDS across restarts.
- [ ] Confirm CORS + HTTPS work from the real origin.
- [ ] Smoke-test recipe search + nutrition proxy.
```

Note: the main agent is actively implementing several of these (the dual-driver DB layer, Google OAuth, hardening, and deploy assets), so some items may already be in progress.