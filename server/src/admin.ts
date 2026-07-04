/*
 * /admin — HTTP Basic Auth dashboard rendering the session analytics in the
 * browser. Single shared password via ADMIN_PASSWORD; disabled (503) if unset.
 * Mounted at top level (not under /api) in index.ts, before the SPA catch-all.
 */
import crypto from "node:crypto";
import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "./db.js";
import { computeReport, reportToHtml, listUsers, usersToHtml, monthlyLogins, monthlyToHtml, computeAarrr, aarrrToHtml, cookCounts, cookCountsToHtml } from "./analytics.js";

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

// Funnel tab — AARRR pirate metrics (read-only aggregate reporting).
adminRouter.get("/funnel", adminAuth, async (_req, res) => {
  try {
    const aarrr = await computeAarrr(db);
    res.type("html").send(aarrrToHtml(aarrr));
  } catch (e: any) {
    res.status(500).type("text").send("Funnel error (analytics require Postgres): " + (e?.message || e));
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

// Cook Counts tab — per-recipe cook totals (live from cook_sessions) + the
// show_cook_count flag. Counts are read-only; the flag toggles per recipe so a
// count can be re-enabled on user-facing cards once its numbers are strong.
adminRouter.get("/cookcounts", adminAuth, async (_req, res) => {
  try {
    const rows = await cookCounts(db);
    res.type("html").send(cookCountsToHtml(rows));
  } catch (e: any) {
    res.status(500).type("text").send("Cook counts error: " + (e?.message || e));
  }
});

// Flip one recipe's show_cook_count flag (recipe name via query string — no
// body parser needed), then bounce back to the tab.
adminRouter.post("/cookcounts/toggle", adminAuth, async (req, res) => {
  const recipe = String(req.query.recipe || "").trim();
  if (!recipe) return res.status(400).type("text").send("Missing ?recipe=");
  try {
    const cur = (await db.all("SELECT show_cook_count FROM recipe_flags WHERE recipe = ?", [recipe])) as any[];
    if (cur.length) await db.run("UPDATE recipe_flags SET show_cook_count = 1 - show_cook_count WHERE recipe = ?", [recipe]);
    else await db.run("INSERT INTO recipe_flags (recipe, show_cook_count) VALUES (?, 1)", [recipe]);
    res.redirect(303, "/admin/cookcounts");
  } catch (e: any) {
    res.status(500).type("text").send("Toggle error: " + (e?.message || e));
  }
});

// Monthly tab — logins in the current calendar month: per-user counts plus
// unique-user and total-login tallies.
adminRouter.get("/monthly", adminAuth, async (_req, res) => {
  try {
    const monthly = await monthlyLogins(db);
    res.type("html").send(monthlyToHtml(monthly));
  } catch (e: any) {
    res.status(500).type("text").send("Monthly error: " + (e?.message || e));
  }
});
