# Sizle API (`server/`)

The backend for the **full-stack web app** (live testing/feedback launch). It's a
plain REST/JSON service — the **stable contract** the web client (`mvp/`) uses
now and the Expo/React-Native app (`mobile/`) will use later. *Build the API once;
swap the client.*

## Stack
- **Node + TypeScript + Express**
- **Dual-driver data layer** (`src/db.ts`): **SQLite** (`better-sqlite3`) for
  zero-infra local dev, **PostgreSQL/RDS** (`pg`) in production. The driver is
  chosen by `DATABASE_URL` — empty → SQLite, set → Postgres — behind one async
  query contract, so routes and both clients never change.
- **Auth → JWT:** **Google OAuth** (ID-token verified server-side) for production,
  with a self-contained **email-OTP** path for local dev (auto-disabled once
  `GOOGLE_CLIENT_ID` is set).

## Run it
```bash
cd server
cp .env.example .env          # defaults are fine for local
npm install
npm run dev                   # http://127.0.0.1:8788  (tsx watch)
# or: npm start  (no watch) / npm run build && npm run serve:dist
```
The web client auto-detects it at `http://127.0.0.1:8788` (override with
`localStorage.seartune_api_base`). Start the web client separately:
`cd mvp && python3 serve.py` → http://127.0.0.1:4173.

### Dev auth
With `DEV_AUTH=true` (default), `POST /api/auth/request` returns the login code in
the response (and the web client shows it) so anyone can sign in without an email
provider. For production, set `DEV_AUTH=false` and wire an email sender (Resend/SES
— see `.env.example`).

## Endpoints
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | — | liveness |
| GET | `/api/auth/config` | — | `{googleClientId, devAuth}` for the client |
| POST | `/api/auth/google` | — | `{idToken}` (Google ID token) → `{token, user}` |
| POST | `/api/auth/request` | — | dev OTP: `{email}` → `{devCode}` (dev only) |
| POST | `/api/auth/verify` | — | dev OTP: `{email,code}` → `{token, user}` |
| GET | `/api/me` | ✓ | current account |
| PUT | `/api/me` | ✓ | save experience / equipment / prefs / streak |
| POST | `/api/entitlement/redeem` | ✓ | `{code}` (Dev123) → Premium |
| POST | `/api/sessions` | ✓ | log a cook session (the data flywheel) |
| GET | `/api/sessions` | ✓ | the account's sessions |
| GET | `/api/recipes/search?q=` | — | TheMealDB passthrough |
| GET | `/api/nutrition?q=` | — | per-100g nutrition (curated staples → Open Food Facts, cached) |

## Data
Local dev: SQLite file at `DB_PATH` (default `server/data/seartune.db`, git-ignored).
Production: PostgreSQL/RDS via `DATABASE_URL`. Schema (created on boot by `migrate()`):
`users`, `auth_codes`, `cook_sessions`, `nutrition_cache`. The same portable DDL and
queries run on both engines — see `src/db.ts`.

## Deploy
Production target is **EC2 + RDS (Postgres) + Google OAuth + HTTPS**. Full
step-by-step in [`../DEPLOY.md`](../DEPLOY.md). In short:

1. Create RDS Postgres; set `DATABASE_URL`.
2. Create a Google OAuth Web client; set `GOOGLE_CLIENT_ID`.
3. Set `NODE_ENV=production`, a real `JWT_SECRET`, `CORS_ORIGINS`, and
   `SERVE_CLIENT=true` to serve the web client from the same origin.
4. Run via the root `Dockerfile` (`docker build -t sizle-api . && docker run ...`)
   or the `deploy/sizle-api.service` systemd unit (`npm ci && npm run build`).
5. Terminate TLS with `deploy/Caddyfile` (auto Let's Encrypt) or an ALB + ACM cert.

The data layer, auth, hardening (helmet, auth rate-limit, trust-proxy) and static
client serving are all already in the code — deployment is configuration, not a
rewrite.
