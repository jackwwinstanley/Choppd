/*
 * Sizle API — entrypoint.
 * Full-stack web app. The REST contract here is the seam that lets us swap the
 * web client for the Expo/native app later without backend rework. Boots the
 * data layer (SQLite locally, Postgres/RDS when DATABASE_URL is set), then the
 * HTTP server with production hardening (helmet, auth rate-limit, trust proxy).
 */
import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { initDb, migrate, usingPostgres } from "./db.js";
import { api } from "./routes.js";
import { adminRouter } from "./admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  await initDb();
  await migrate();

  const app = express();
  // Behind an ALB / Caddy / nginx in production: trust the proxy so rate-limit
  // and protocol detection see the real client IP and https.
  app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));

  // helmet adds standard security headers. CSP off by default so the static
  // client (and its CDN scripts: Google Identity, kokoro, Spotify) keep working;
  // enable a tailored CSP later if serving the client from this origin.
  // COOP must allow popups: Google Identity Services signs in via a popup that
  // posts the credential back through window.opener — helmet's default
  // "same-origin" nulls window.opener and breaks sign-in.
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  }));
  app.use(express.json({ limit: "256kb" }));

  const origins = (process.env.CORS_ORIGINS || "http://127.0.0.1:4173,http://localhost:4173")
    .split(",").map((s) => s.trim()).filter(Boolean);
  app.use(cors({ origin: origins.length ? origins : true }));

  // ---- rate limiting -------------------------------------------------------
  // Every tier keys on req.ip, which honors `trust proxy` above — behind Caddy
  // the limiter sees the real client IP from X-Forwarded-For, not Caddy's
  // address (NAT'd testers don't limit each other; abuse can't hide as one IP).
  // 429s carry an explicit Retry-After. All tiers env-tunable without a deploy.
  const tier = (windowMs: number, limit: number) => rateLimit({
    windowMs, limit,
    standardHeaders: true, legacyHeaders: false,
    handler: (_req, res) => { res.setHeader("Retry-After", String(Math.ceil(windowMs / 1000))); res.status(429).json({ error: "rate-limited" }); },
  });
  // Loose global backstop over every /api route (auth'd ones included).
  app.use("/api", tier(60 * 1000, Number(process.env.RATE_LIMIT_GLOBAL || 300)));
  // Auth endpoints (OTP request/verify, Google) — tightest, per 15 min.
  app.use("/api/auth", tier(15 * 60 * 1000, Number(process.env.AUTH_RATE_LIMIT || 30)));
  // Unauthenticated DB writes (anonymous analytics).
  const writeLimiter = tier(60 * 1000, Number(process.env.RATE_LIMIT_WRITE || 30));
  app.use("/api/event", writeLimiter);
  app.use("/api/visit", writeLimiter);
  // External-API proxies (OpenFoodFacts / TheMealDB) — protects us from upstream bans.
  const proxyLimiter = tier(60 * 1000, Number(process.env.RATE_LIMIT_PROXY || 20));
  app.use("/api/nutrition", proxyLimiter);
  app.use("/api/recipes/search", proxyLimiter);
  // Admin is a single shared password — throttle guessing at the auth tier.
  app.use("/admin", tier(15 * 60 * 1000, Number(process.env.AUTH_RATE_LIMIT || 30)));

  // CSP violation reports (Report-Only policy) — just log server-side for now.
  app.post("/api/csp-report",
    express.json({ type: ["application/csp-report", "application/reports+json", "application/json"], limit: "64kb" }),
    (req, res) => { console.warn("[csp-report]", JSON.stringify(req.body)); res.status(204).end(); });

  app.use("/api", api);
  app.get("/api", (_req, res) => res.json({ service: "sizle-api", health: "/api/health" }));

  // Password-protected analytics dashboard (top-level, before static + SPA catch-all).
  app.use("/admin", adminRouter);

  // Optionally serve the web client (mvp/) from this same origin — simplest TLS,
  // no CORS. Enable with SERVE_CLIENT=true; override the path with CLIENT_DIR.
  if (process.env.SERVE_CLIENT === "true") {
    const clientDir = process.env.CLIENT_DIR || path.resolve(__dirname, "../../mvp");
    app.use(express.static(clientDir));
    app.get(/^(?!\/api|\/admin).*/, (_req, res) => res.sendFile(path.join(clientDir, "index.html")));
    console.log(`Serving web client from ${clientDir}`);
  } else {
    app.get("/", (_req, res) => res.json({ service: "sizle-api", health: "/api/health" }));
  }

  app.use((_req, res) => res.status(404).json({ error: "not-found" }));

  const PORT = Number(process.env.PORT || 8788);
  app.listen(PORT, () => {
    console.log(`Sizle API on :${PORT}  ·  db=${usingPostgres ? "postgres" : "sqlite"}  ·  CORS: ${origins.join(", ")}`);
  });
}

main().catch((err) => {
  console.error("Fatal boot error:", err);
  process.exit(1);
});
