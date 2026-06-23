# SearTune API (`server/`)

The backend for the **full-stack web app** (live testing/feedback launch). It's a
plain REST/JSON service — the **stable contract** the web client (`mvp/`) uses
now and the Expo/React-Native app (`mobile/`) will use later. *Build the API once;
swap the client.*

## Stack
- **Node + TypeScript + Express**
- **SQLite** (`better-sqlite3`) for the testing launch — a real, file-backed DB
  with zero infra. Swappable for **PostgreSQL/RDS** at scale (see "Going to
  Postgres" below); the data access is small and isolated in `src/db.ts`.
- **Passwordless email OTP → JWT** auth (self-contained; `aws-cognito`-ready).

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
| POST | `/api/auth/request` | — | `{email}` → sends OTP (`{devCode}` in dev) |
| POST | `/api/auth/verify` | — | `{email,code}` → `{token, user}` |
| GET | `/api/me` | ✓ | current account |
| PUT | `/api/me` | ✓ | save experience / equipment / prefs / streak |
| POST | `/api/entitlement/redeem` | ✓ | `{code}` (Dev123) → Premium |
| POST | `/api/sessions` | ✓ | log a cook session (the data flywheel) |
| GET | `/api/sessions` | ✓ | the account's sessions |
| GET | `/api/recipes/search?q=` | — | TheMealDB passthrough |
| GET | `/api/nutrition?q=` | — | per-100g nutrition (curated staples → Open Food Facts, cached) |

## Data
SQLite file at `DB_PATH` (default `server/data/seartune.db`, git-ignored). Schema in
`src/db.ts` mirrors PLAN.md §5: `users`, `auth_codes`, `cook_sessions`,
`nutrition_cache`.

## Deploy (web testing launch)
Any Node host works (Render / Railway / Fly.io / a small VPS):
1. Set env: `JWT_SECRET` (real secret), `CORS_ORIGINS` (your web origin),
   `DEV_AUTH=false` + an email key, `DB_PATH` to a persistent volume.
2. `npm ci && npm run build && npm run serve:dist` (or run `npm start`).
3. Point the web client's `seartune_api_base` at the deployed URL (or serve the
   web client from the same origin so it's auto-detected).

## Going to Postgres (scale / App-Store era)
Per PLAN.md the production target is **PostgreSQL on RDS**. The migration is
contained: swap `better-sqlite3` in `src/db.ts` for `pg`, translate the (portable)
`CREATE TABLE`s, and keep every route/query the same. The REST contract — and
therefore both clients — do not change.
