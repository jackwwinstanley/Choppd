/*
 * /admin — HTTP Basic Auth dashboard rendering the session analytics in the
 * browser. Single shared password via ADMIN_PASSWORD; disabled (503) if unset.
 * Mounted at top level (not under /api) in index.ts, before the SPA catch-all.
 */
import crypto from "node:crypto";
import { Router, urlencoded, type Request, type Response, type NextFunction } from "express";
import { db } from "./db.js";
import { computeReport, reportToHtml, listUsers, usersToHtml, monthlyLogins, monthlyToHtml, computeAarrr, aarrrToHtml, cookCounts, cookCountsToHtml, scanDemand, scanDemandToHtml } from "./analytics.js";

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

// Scan Demand tab — the fridge-scan flywheel readout (D4): no-match combos
// ranked by frequency = the recipe-authoring priority list.
adminRouter.get("/scans", adminAuth, async (_req, res) => {
  try {
    res.type("html").send(scanDemandToHtml(await scanDemand(db)));
  } catch (e: any) {
    res.status(500).type("text").send("Scan demand error: " + (e?.message || e));
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

// Requests tab — §4.2 fridge-scanner spec: explicit user demand from AI concept
// previews, ranked by request count. This is /new-recipe's input queue.
// EXPLICIT NON-GOAL: no automated generation-to-catalog — the human gate
// (founder stove-test) stays. If volume ever outruns founder throughput, THAT
// is the telemetry signal to revisit automation, per the Five Forces doc.
adminRouter.get("/requests", adminAuth, async (_req, res) => {
  try {
    const rows = (await db.all(`
      SELECT COALESCE(concept_title, '(no concept — bare request)') AS title,
             COUNT(*) AS n,
             SUM(CASE WHEN status = 'requested' THEN 1 ELSE 0 END) AS open,
             SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) AS shipped,
             MAX(created_at) AS latest,
             MIN(ingredient_ids) AS sample_ids
      FROM recipe_requests GROUP BY COALESCE(concept_title, '(no concept — bare request)')
      ORDER BY open DESC, n DESC LIMIT 100`)) as any[];
    const esc = (x: any) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
    const tr = rows.map((r) => `<tr>
      <td>${esc(r.title)}</td><td>${r.n}</td><td>${r.open}</td><td>${r.shipped}</td>
      <td>${esc(String(r.latest).slice(0, 10))}</td>
      <td><code style="font-size:11px">${esc(JSON.parse(r.sample_ids || "[]").join(", ")).slice(0, 90)}</code></td>
      <td>${Number(r.open) > 0 ? `<form method="post" action="/admin/requests/ship?title=${encodeURIComponent(r.title)}" style="display:flex;gap:4px">
        <input name="recipe" placeholder="live recipe title" required style="width:150px">
        <button>Mark shipped</button></form>` : "—"}</td>
    </tr>`).join("");
    res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Requests</title><style>body{font:14px system-ui;margin:20px;background:#111;color:#eee}
      table{border-collapse:collapse;width:100%}td,th{border:1px solid #333;padding:6px 8px;text-align:left}
      a{color:#7ecbff}input,button{font:13px system-ui;padding:4px 6px}</style>
      <p><a href="/admin">Report</a> · <a href="/admin/funnel">Funnel</a> · <a href="/admin/scans">Scan demand</a> · <b>Requests</b></p>
      <h2>Recipe requests (ranked — /new-recipe's input queue)</h2>
      <p style="color:#999">Human gate stays: fulfill via /new-recipe → verifiers → stove-test → mark shipped here. No auto-generation.</p>
      <table><tr><th>Concept</th><th>Total</th><th>Open</th><th>Shipped</th><th>Latest</th><th>Sample ingredient set</th><th>Fulfill</th></tr>${tr || "<tr><td colspan=7>No requests yet.</td></tr>"}</table>`);
  } catch (e: any) {
    res.status(500).type("text").send("Requests error: " + (e?.message || e));
  }
});

// Mark every open request for a concept as shipped, recording the live recipe
// title (drives the user-facing notification card + request_to_cook matching).
adminRouter.post("/requests/ship", adminAuth, urlencoded({ extended: false }), async (req, res) => {
  const title = String(req.query.title || "").trim();
  const recipe = String((req.body && (req.body as any).recipe) || req.query.recipe || "").trim().slice(0, 80);
  if (!title || !recipe) return res.status(400).type("text").send("Missing concept title or recipe title.");
  try {
    const where = title === "(no concept — bare request)" ? "concept_title IS NULL" : "concept_title = ?";
    const params = title === "(no concept — bare request)" ? [recipe] : [recipe, title];
    await db.run(`UPDATE recipe_requests SET status = 'shipped', shipped_recipe = ? WHERE ${where} AND status = 'requested'`, params);
    res.redirect(303, "/admin/requests");
  } catch (e: any) {
    res.status(500).type("text").send("Ship error: " + (e?.message || e));
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
