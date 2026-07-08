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

// IDEAS BADGE — visible from ANY admin page without touching each tab's HTML:
// a response hook injects a fixed-position badge chip (status=new count) into
// every text/html admin response.
adminRouter.use(async (_req, res, next) => {
  const send = res.send.bind(res);
  (res as any).send = async function (body: any) {
    try {
      if (typeof body === "string" && body.includes("<") && (res.get("Content-Type") || "").includes("html")) {
        const n = Number((((await db.all("SELECT count(*) AS n FROM concept_requests WHERE status = 'new'")) as any[])[0] || {}).n || 0);
        body += `<a href="/admin/ideas" style="position:fixed;top:10px;right:10px;background:${n ? "#ff6b35" : "#333"};color:#fff;border-radius:999px;padding:6px 12px;font:12px system-ui;text-decoration:none;z-index:99">💡 Ideas${n ? " (" + n + ")" : ""}</a>`;
      }
    } catch { /* badge is best-effort */ }
    return send(body);
  };
  next();
});

// Ideas tab — the concept-request system (Scan 2.1). The Instagram DM itself is
// MANUAL (founder's); this tab makes handles copyable and drives statuses.
// Rendering choice: individual rows newest-first with a ×N same-title count chip
// (grouping would hide per-user messages/handles, which are the point here).
adminRouter.get("/ideas", adminAuth, async (req, res) => {
  try {
    const openId = String(req.query.open || "");
    if (openId) await db.run("UPDATE concept_requests SET status = 'seen' WHERE id = ? AND status = 'new'", [openId]);
    const rows = (await db.all("SELECT * FROM concept_requests ORDER BY created_at DESC LIMIT 200")) as any[];
    const counts: Record<string, number> = {};
    for (const r of rows) { let t = ""; try { t = JSON.parse(r.concept_json || "{}").title || ""; } catch { /* ignore */ } (r as any).__title = t || "(no concept)"; counts[(r as any).__title] = (counts[(r as any).__title] || 0) + 1; }
    const esc = (x: any) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
    const STATUSES = ["new", "seen", "building", "shipped"];
    const tr = rows.map((r: any) => `<tr style="${r.status === "new" ? "background:#221a10" : ""}">
      <td>${r.status === "new" ? `<a href="/admin/ideas?open=${r.id}"><b>● ${esc(r.__title)}</b></a>` : esc(r.__title)}${counts[r.__title] > 1 ? ` <span style="color:#ff6b35">×${counts[r.__title]}</span>` : ""}</td>
      <td>${esc(r.message || "")}</td>
      <td>${r.instagram_handle ? `<code onclick="navigator.clipboard.writeText('@${esc(r.instagram_handle)}');this.textContent='copied ✓'" style="cursor:pointer">@${esc(r.instagram_handle)}</code>` : "—"}</td>
      <td><code style="font-size:11px">${esc(JSON.parse(r.ingredient_set || "[]").join(", ")).slice(0, 70)}</code></td>
      <td>${esc(String(r.created_at).slice(0, 10))}</td>
      <td>${r.status === "shipped" ? `shipped → ${esc(r.shipped_recipe || "")}` : `
        <form method="post" action="/admin/ideas/status?id=${r.id}" style="display:flex;gap:4px">
          <select name="to">${STATUSES.map((st) => `<option ${st === r.status ? "selected" : ""}>${st}</option>`).join("")}</select>
          <input name="recipe" placeholder="live title (if shipped)" style="width:120px">
          <button>set</button></form>`}</td>
    </tr>`).join("");
    res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ideas</title>
      <style>body{font:14px system-ui;margin:20px;background:#111;color:#eee}table{border-collapse:collapse;width:100%}td,th{border:1px solid #333;padding:6px 8px;text-align:left;vertical-align:top}a{color:#7ecbff}input,button,select{font:12px system-ui;padding:3px 5px;background:#222;color:#eee;border:1px solid #444}</style>
      <p><a href="/admin">Report</a> · <a href="/admin/requests">Requests (legacy)</a> · <a href="/admin/limits">Limits</a> · <b>Ideas</b></p>
      <h2>Concept requests — the DM loop</h2>
      <p style="color:#999">● bold = unread (click title to mark seen). DM manually from the copyable handle; "shipped" + live title fires the in-app fulfillment card.</p>
      <table><tr><th>Concept</th><th>Message</th><th>IG</th><th>Their fridge</th><th>Date</th><th>Status</th></tr>${tr || "<tr><td colspan=6>No requests yet.</td></tr>"}</table>`);
  } catch (e: any) { res.status(500).type("text").send("Ideas error: " + (e?.message || e)); }
});

adminRouter.post("/ideas/status", adminAuth, urlencoded({ extended: false }), async (req, res) => {
  const id = String(req.query.id || "");
  const to = String((req.body as any)?.to || "");
  const recipe = String((req.body as any)?.recipe || "").trim().slice(0, 80);
  if (!id || !["new", "seen", "building", "shipped"].includes(to)) return res.status(400).type("text").send("Bad status");
  try {
    if (to === "shipped" && !recipe) return res.status(400).type("text").send("Shipped needs the live recipe title (drives the user notification).");
    await db.run("UPDATE concept_requests SET status = ?, shipped_recipe = COALESCE(?, shipped_recipe) WHERE id = ?", [to, recipe || null, id]);
    try { await db.run("INSERT INTO events (id, type, recipe, user_id, created_at) VALUES (?, 'admin_idea_status_changed', ?, NULL, ?)", [crypto.randomUUID(), to.slice(0, 40), new Date().toISOString()]); } catch { /* best-effort */ }
    res.redirect(303, "/admin/ideas");
  } catch (e: any) { res.status(500).type("text").send("Status error: " + (e?.message || e)); }
});

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

// Limits tab — per-account exempt toggle + counters (usage-limits switchboard).
adminRouter.get("/limits", adminAuth, async (_req, res) => {
  try {
    const rows = (await db.all(`
      SELECT u.email, u.limits_exempt,
        (SELECT count(*) FROM scans s WHERE s.user_id = u.id AND s.created_at >= datetime('now','-7 day') AND s.detected_ids <> '[]') AS scans7d,
        (SELECT count(*) FROM premium_unlocks p WHERE p.user_id = u.id) AS unlocks,
        (SELECT count(*) FROM premium_waitlist w WHERE w.user_id = u.id) AS waitlisted
      FROM users u ORDER BY u.created_at DESC LIMIT 200`)) as any[];
    const esc = (x: any) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const tr = rows.map((r) => `<tr><td>${esc(r.email)}</td><td>${Number(r.limits_exempt ?? 1) ? "EXEMPT" : "limited"}</td>
      <td>${r.scans7d}/3</td><td>${r.unlocks}/3</td><td>${r.waitlisted ? "✓" : ""}</td>
      <td><form method="post" action="/admin/limits/toggle?email=${encodeURIComponent(r.email)}"><button>toggle</button></form></td></tr>`).join("");
    res.type("html").send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Limits</title>
      <style>body{font:14px system-ui;margin:20px;background:#111;color:#eee}table{border-collapse:collapse}td,th{border:1px solid #333;padding:5px 8px}a{color:#7ecbff}</style>
      <p><a href="/admin">Report</a> · <a href="/admin/requests">Requests</a> · <b>Limits</b></p>
      <h2>Usage limits (everyone exempt until LIMITS_DEFAULT_EXEMPT flips)</h2>
      <table><tr><th>Email</th><th>State</th><th>Scans 7d</th><th>Unlocks</th><th>Waitlist</th><th></th></tr>${tr}</table>`);
  } catch (e: any) { res.status(500).type("text").send("Limits error: " + (e?.message || e)); }
});
adminRouter.post("/limits/toggle", adminAuth, async (req, res) => {
  const email = String(req.query.email || "").trim();
  if (!email) return res.status(400).type("text").send("Missing ?email=");
  try {
    await db.run("UPDATE users SET limits_exempt = 1 - COALESCE(limits_exempt, 1) WHERE email = ?", [email]);
    res.redirect(303, "/admin/limits");
  } catch (e: any) { res.status(500).type("text").send("Toggle error: " + (e?.message || e)); }
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
