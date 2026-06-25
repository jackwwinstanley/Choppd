/*
 * /admin — HTTP Basic Auth dashboard rendering the session analytics in the
 * browser. Single shared password via ADMIN_PASSWORD; disabled (503) if unset.
 * Mounted at top level (not under /api) in index.ts, before the SPA catch-all.
 */
import crypto from "node:crypto";
import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "./db.js";
import { computeReport, reportToHtml, listUsers, usersToHtml } from "./analytics.js";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

function adminAuth(req: Request, res: Response, next: NextFunction) {
  if (!ADMIN_PASSWORD) return res.status(503).send("Admin disabled — set ADMIN_PASSWORD in the server env.");
  const h = req.headers.authorization || "";
  const [scheme, b64] = h.split(" ");
  let ok = false;
  if (scheme === "Basic" && b64) {
    const pass = Buffer.from(b64, "base64").toString().split(":").slice(1).join(":");
    const a = Buffer.from(pass), b = Buffer.from(ADMIN_PASSWORD);
    ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  if (!ok) {
    res.set("WWW-Authenticate", 'Basic realm="Sizle admin", charset="UTF-8"');
    return res.status(401).send("Authentication required.");
  }
  next();
}

export const adminRouter = Router();

adminRouter.get("/", adminAuth, async (_req, res) => {
  try {
    const report = await computeReport(db);
    res.type("html").send(reportToHtml(report));
  } catch (e: any) {
    res.status(500).type("text").send("Report error (analytics require Postgres): " + (e?.message || e));
  }
});

// Users tab — every account that has ever logged in (unique by email).
adminRouter.get("/users", adminAuth, async (_req, res) => {
  try {
    const users = await listUsers(db);
    res.type("html").send(usersToHtml(users));
  } catch (e: any) {
    res.status(500).type("text").send("Users error: " + (e?.message || e));
  }
});
