# Deploying Sizle to EC2 + RDS

This is the launch path for the full-stack web app: the **API on an EC2 instance**,
**PostgreSQL on RDS**, **Google OAuth** for login, and **HTTPS** in front. The web
client (`mvp/`) is served from the same origin as the API, so there's no CORS and
one TLS cert covers everything.

The codebase already supports all of this — it's wired by environment variables.
SQLite is still the default for local dev (no infra); setting `DATABASE_URL`
flips the same code to Postgres/RDS.

---

## 1. Create the RDS Postgres database

1. RDS → **Create database** → PostgreSQL (15+), the smallest instance is fine to start (`db.t4g.micro`).
2. Set master username/password; note the **endpoint** hostname.
3. Create a database named `sizle` (or use the default and adjust the URL).
4. **Security group:** allow inbound TCP **5432** *only from the EC2 instance's
   security group* (not `0.0.0.0/0`).
5. Keep "Public access" **off** — the API reaches it over the VPC. RDS enforces TLS;
   the app connects with TLS automatically.

Your connection string:
```
postgres://USER:PASSWORD@your-db.xxxx.us-east-1.rds.amazonaws.com:5432/sizle
```
The app creates its tables on boot (`migrate()`), so no manual schema step.

## 2. Configure Google OAuth

1. Google Cloud Console → **APIs & Services → Credentials → Create OAuth client ID**.
2. Application type: **Web application**.
3. **Authorized JavaScript origins:** your site origin, e.g. `https://getchoppd.app`
   (and `http://localhost:4173` for local testing).
4. Copy the **Client ID** → that's `GOOGLE_CLIENT_ID`. (No client secret is needed —
   the browser gets an ID token via Google Identity Services and the backend verifies it.)

## 3. Launch the EC2 instance

- Amazon Linux 2023 or Ubuntu 22.04, `t3.small` is plenty to start.
- Security group inbound: **443** (and **80** for the ACME challenge / redirect) from
  anywhere; **22** from your IP. The API port **8788** stays internal — do **not**
  expose it publicly; traffic reaches it only through the reverse proxy.
- Put the instance in the same VPC as RDS.

### Option A — Docker (recommended)
```bash
sudo dnf install -y docker git && sudo systemctl enable --now docker   # AL2023
git clone <your-repo> /opt/sizle && cd /opt/sizle
cp server/.env.example server/.env   # then edit (see §4)
sudo docker build -t sizle-api .
sudo docker run -d --restart unless-stopped --name sizle \
  -p 127.0.0.1:8788:8788 --env-file server/.env sizle-api
```

### Option B — systemd (no Docker)
```bash
sudo dnf install -y nodejs git
sudo useradd -r -s /usr/sbin/nologin sizle
sudo git clone <your-repo> /opt/sizle
cd /opt/sizle/server && sudo npm ci && sudo npm run build
sudo cp ../deploy/sizle-api.service /etc/systemd/system/
# edit server/.env (see §4), then:
sudo chown -R sizle:sizle /opt/sizle
sudo systemctl daemon-reload && sudo systemctl enable --now sizle-api
journalctl -u sizle-api -f
```

## 4. Environment (`server/.env`)

Copy `server/.env.example` and set, at minimum:

```ini
NODE_ENV=production
JWT_SECRET=<openssl rand -hex 32>
DATABASE_URL=postgres://USER:PASSWORD@your-db...rds.amazonaws.com:5432/sizle
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
CORS_ORIGINS=https://getchoppd.app
SERVE_CLIENT=true            # serve the mvp/ web client from this same origin
TRUST_PROXY=1                # behind Caddy/ALB
```

With `GOOGLE_CLIENT_ID` set, dev email-OTP auto-disables (`DEV_AUTH` defaults to
false) — Google is the only login path. The server refuses to start in production
if `JWT_SECRET` is still the default.

## 5. HTTPS

**Caddy (simplest — automatic Let's Encrypt certs):**
```bash
# install Caddy, then:
sudo cp /opt/sizle/deploy/Caddyfile /etc/caddy/Caddyfile   # edit the domain
sudo systemctl restart caddy
```
Point a DNS A record at the instance's public IP first; Caddy provisions the cert
on first request and auto-renews.

**Or an ALB + ACM cert:** put an Application Load Balancer in front, attach an ACM
certificate, target group → instance:8788. Keep `TRUST_PROXY=1`.

## 6. Verify

```bash
curl https://getchoppd.app/api/health         # {"ok":true,...}
curl https://getchoppd.app/api/auth/config     # {"googleClientId":"...","devAuth":false}
```
Open `https://getchoppd.app`, click **Continue with Google**, and confirm you
land in the app and a row appears in the RDS `users` table.

---

## Operating notes

- **Backups:** enable RDS automated backups / snapshots. The app data lives entirely
  in Postgres now — the EC2 box is stateless and replaceable.
- **Secrets:** `server/.env` holds them on the box. For stricter setups, pull
  `JWT_SECRET` / `DATABASE_URL` from AWS Secrets Manager or SSM Parameter Store at
  boot instead.
- **Scaling:** because the API is stateless (JWT auth, all state in RDS), you can run
  several instances behind the ALB and scale horizontally.
- **Local dev is unchanged:** leave `DATABASE_URL` empty and it uses SQLite; leave
  `GOOGLE_CLIENT_ID` empty and dev email-OTP login works with no provider.
