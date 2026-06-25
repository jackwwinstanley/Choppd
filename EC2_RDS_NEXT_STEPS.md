# Next Steps — Deploying Sizle on EC2 + RDS (Docker)

The remaining sequence, tailored to current state: code is on the private repo,
`server/.env.production` already holds your `JWT_SECRET` + `GOOGLE_CLIENT_ID`.
Steps 1–4 are AWS/Google console work; note what to capture from each. Full
reference: [`DEPLOY.md`](./DEPLOY.md) · tracked as checkboxes in
[`DEPLOY_CHECKLIST.md`](./DEPLOY_CHECKLIST.md).

## 1. Create the RDS Postgres database
- RDS → Create database → **PostgreSQL 15+**, `db.t4g.micro`, same region you'll run EC2 in.
- Set master user + password; DB name `sizle`; **Public access: No**.
- **Capture the endpoint** → build your URL:
  `postgres://USER:PASSWORD@ENDPOINT:5432/sizle`
- Leave its security group for step 3 (lock it to the EC2 instance).

## 2. Launch the EC2 instance
- **Amazon Linux 2023**, `t3.small`, **same VPC** as RDS.
- Security group inbound: **443** + **80** (anywhere), **22** (your IP only). Leave 8788 closed.
- Note its **public IP** and **its security group ID**.

## 3. Wire RDS ↔ EC2 networking
- Edit the **RDS** security group → add inbound **5432** sourced from the **EC2 security group** (not an IP range).

## 4. Point DNS + Google at it
- DNS: an **A record** for your host (e.g. `app.sizle.com`) → EC2 public IP.
- Google Cloud → your OAuth Web client → **Authorized JavaScript origins** → add `https://app.sizle.com`.

## 5. Finish `server/.env.production`
Fill the two `REPLACE_*` values: `DATABASE_URL` (from step 1) and
`CORS_ORIGINS=https://app.sizle.com`.

## 6. Deploy on the box (SSH in)
```bash
sudo dnf install -y docker git && sudo systemctl enable --now docker
git clone https://github.com/jackwwinstanley/MusicCooking.git /opt/sizle
cd /opt/sizle
# copy your filled env up (run from your laptop):
#   scp server/.env.production ec2-user@<IP>:/opt/sizle/server/.env
sudo docker build -t sizle-api .
sudo docker run -d --restart unless-stopped --name sizle \
  -p 127.0.0.1:8788:8788 --env-file server/.env sizle-api
```

## 7. TLS with Caddy
```bash
# install Caddy, then edit the domain in the Caddyfile and:
sudo cp /opt/sizle/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl restart caddy   # auto-provisions a Let's Encrypt cert
```

## 8. Verify
```bash
curl https://app.sizle.com/api/health         # {"ok":true,...}
curl https://app.sizle.com/api/auth/config     # {"googleClientId":"...","devAuth":false}
```
Open the site → **Continue with Google** → you should land in the app and see a row
appear in the RDS `users` table. Then enable RDS automated backups.
