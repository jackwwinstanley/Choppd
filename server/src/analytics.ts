/*
 * Session analytics — the single source of truth for the /admin dashboard and
 * the weekly email digest. Postgres-only (uses jsonb + percentile_cont); the
 * production DB is RDS Postgres, which is the only place this runs.
 */
import type { Db } from "./db.js";

// Both cook modes log a `steps[]` array but with DIFFERENT shapes, so pace must
// normalize them to one (planned, actual) pair per step:
//   - guided cooks record `authoredSec`/`actualSec` directly;
//   - music cooks record `atSec` (cue position on the cook-clock) and `waitSec`
//     (time the cook paused at that checkpoint). For those, the planned time for
//     a step is the gap to the NEXT cue, and the actual time is that gap plus the
//     pause — so `ratio>1` still means "slower than authored".
// (Originally this only matched the guided shape, so the music-synced authored
// cooks — which is what testers run — produced empty Pace/Slowest cards.)
const NORM_STEPS = `
  WITH srows AS (
    SELECT cs.id, cs.recipe,
      e.value->>'title' AS title,
      (e.value->>'authoredSec')::numeric AS authored_sec,
      (e.value->>'actualSec')::numeric   AS actual_sec,
      (e.value->>'atSec')::numeric        AS at_sec,
      COALESCE((e.value->>'waitSec')::numeric, 0) AS wait_sec,
      lead((e.value->>'atSec')::numeric) OVER (PARTITION BY cs.id ORDER BY e.ord) AS next_at
    FROM cook_sessions cs,
      jsonb_array_elements(COALESCE((cs.payload_json)::jsonb->'steps','[]'::jsonb)) WITH ORDINALITY AS e(value, ord)
  ),
  norm AS (
    SELECT recipe, title,
      CASE WHEN authored_sec IS NOT NULL THEN authored_sec ELSE next_at - at_sec END AS planned,
      CASE WHEN authored_sec IS NOT NULL THEN actual_sec   ELSE (next_at - at_sec) + wait_sec END AS actual
    FROM srows
  )`;
const VALID = "planned > 5 AND actual > 0";

export interface Report {
  overview: { total: number; completed: number; users: number; first: string | null; last: string | null };
  ratings: any[]; ratingDist: any[]; heat: any[]; pan: any[]; pace: any[]; slowest: any[]; feedback: any[];
  cards: { generated: number; shared: number };
}

export async function computeReport(db: Db): Promise<Report> {
  const [overview] = await db.all(
    `SELECT count(*)::int total, COALESCE(sum(completed),0)::int completed,
       count(DISTINCT user_id)::int users, min(created_at) first, max(created_at) last FROM cook_sessions`
  );
  const ratings = await db.all(`SELECT recipe, count(*)::int n, round(avg(rating)::numeric,2) avg_rating
    FROM cook_sessions WHERE rating IS NOT NULL GROUP BY recipe ORDER BY n DESC, avg_rating DESC`);
  const ratingDist = await db.all(`SELECT rating, count(*)::int n FROM cook_sessions WHERE rating IS NOT NULL GROUP BY rating ORDER BY rating DESC`);
  const heat = await db.all(`SELECT COALESCE(heat_source,'(unknown)') k, count(*)::int n FROM cook_sessions GROUP BY 1 ORDER BY n DESC`);
  const pan = await db.all(`SELECT COALESCE(pan,'(unknown)') k, count(*)::int n FROM cook_sessions GROUP BY 1 ORDER BY n DESC`);
  const pace = await db.all(`${NORM_STEPS}
    SELECT recipe, count(*)::int steps,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY actual / planned)::numeric, 2) median_ratio
    FROM norm WHERE ${VALID} GROUP BY recipe ORDER BY median_ratio DESC NULLS LAST`);
  const slowest = await db.all(`${NORM_STEPS}
    SELECT recipe, title AS step, count(*)::int n,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY actual / planned)::numeric, 2) median_ratio
    FROM norm WHERE ${VALID} GROUP BY recipe, title ORDER BY median_ratio DESC NULLS LAST LIMIT 12`);
  const feedback = await db.all(`SELECT cs.created_at, cs.recipe, cs.rating, (cs.payload_json)::jsonb->>'comment' comment, u.email
    FROM cook_sessions cs LEFT JOIN users u ON u.id = cs.user_id
    WHERE COALESCE((cs.payload_json)::jsonb->>'comment','') <> '' ORDER BY cs.created_at DESC LIMIT 50`);
  const cardRows = await db.all(`SELECT type, count(*) AS n FROM events WHERE type IN ('card_generated','card_shared') GROUP BY type`);
  const cards = { generated: 0, shared: 0 };
  for (const r of cardRows) { if (r.type === "card_generated") cards.generated = Number(r.n); if (r.type === "card_shared") cards.shared = Number(r.n); }
  return { overview, ratings, ratingDist, heat, pan, pace, slowest, feedback, cards };
}

/** Every user who has ever logged in (a row is created on first sign-in), with cook counts. */
export async function listUsers(db: Db): Promise<any[]> {
  return db.all(`SELECT u.email, u.name, u.tier, (u.google_sub IS NOT NULL) AS via_google,
      u.created_at, count(cs.id)::int AS cooks
    FROM users u LEFT JOIN cook_sessions cs ON cs.user_id = u.id
    GROUP BY u.id ORDER BY u.created_at DESC`);
}

export interface MonthlyUsers {
  monthLabel: string; uniqueUsers: number; totalLogins: number;
  activeUsers: number; totalVisits: number; rows: any[];
}

/**
 * Logins in the current calendar month (UTC). Each successful sign-in appends a
 * row to `logins`, so this counts repeat sign-ins per user, not just distinct
 * users. The month boundary is computed in JS and compared as an ISO string
 * (created_at is ISO-8601 TEXT) so it stays portable across SQLite/Postgres.
 */
export async function monthlyLogins(db: Db): Promise<MonthlyUsers> {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const rows = await db.all(
    `SELECT u.email, u.name, u.tier, count(l.id)::int AS logins, max(l.created_at) AS last_login
       FROM logins l JOIN users u ON u.id = l.user_id
       WHERE l.created_at >= ?
       GROUP BY u.id ORDER BY logins DESC, last_login DESC`,
    [start]
  );
  const totalLogins = rows.reduce((a, r) => a + Number(r.logins), 0);
  // App opens this month — counts everyone who came on the app, not just sign-ins.
  const vis = await db.all(
    `SELECT count(*) AS total, count(DISTINCT visitor_id) AS users FROM app_visits WHERE created_at >= ?`, [start]
  );
  const activeUsers = Number(vis[0]?.users || 0);
  const totalVisits = Number(vis[0]?.total || 0);
  const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return { monthLabel, uniqueUsers: rows.length, totalLogins, activeUsers, totalVisits, rows };
}

const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const pctOf = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 10 + "%" : "—");
const card = (title: string, body: string) =>
  `<div style="background:#1b1b24;border:1px solid #33334a;border-radius:14px;padding:16px 18px;margin:14px 0">
    <div style="font:700 12px/1 'Instrument Sans',sans-serif;letter-spacing:1px;text-transform:uppercase;color:#9a9ab0;margin-bottom:12px">${title}</div>${body}</div>`;
const li = (l: string, rgt: string) =>
  `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #23232e"><span>${l}</span><b style="color:#fff">${rgt}</b></div>`;

/** Shared page chrome with the tab switcher, used by every /admin view. */
function pageShell(active: "insights" | "funnel" | "users" | "monthly" | "cookcounts", body: string, subtitle = ""): string {
  const tab = (href: string, label: string, key: string) =>
    `<a href="${href}" style="text-decoration:none;padding:9px 15px;border-radius:99px;font:700 13px/1 'Instrument Sans',sans-serif;${active === key ? "background:linear-gradient(135deg,#ff5500,#c44dff);color:#fff" : "color:#9a9ab0;border:1px solid #33334a"}">${label}</a>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Choppd · admin</title></head>
  <body style="margin:0;background:#0b0b0f;color:#f4f4f7;font-family:Inter,system-ui,sans-serif">
    <div style="max-width:720px;margin:0 auto;padding:28px 18px 60px">
      <div style="font:700 22px/1 'Instrument Sans',sans-serif;background:linear-gradient(135deg,#ff5500,#c44dff);-webkit-background-clip:text;background-clip:text;color:transparent">CHOPPD · admin</div>
      ${subtitle ? `<div style="color:#9a9ab0;font-size:12px;margin-top:4px">${subtitle}</div>` : ""}
      <div style="display:flex;gap:8px;margin:16px 0 2px;flex-wrap:wrap">${tab("/admin", "📊 Insights", "insights")}${tab("/admin/funnel", "📈 Funnel", "funnel")}${tab("/admin/users", "👥 Users", "users")}${tab("/admin/monthly", "📅 This month", "monthly")}${tab("/admin/cookcounts", "🍳 Cook Counts", "cookcounts")}</div>
      ${body}
    </div>
  </body></html>`;
}

export function reportToText(r: Report): string {
  const L: string[] = [];
  const o = r.overview;
  L.push(`SIZLE — SESSION DIGEST  (${new Date().toISOString().slice(0, 10)})`);
  L.push(`sessions ${o.total} · completed ${o.completed} (${pctOf(o.completed, o.total)}) · users ${o.users}`);
  if (!o.total) { L.push("\nNo sessions yet — finish a cook while logged in to populate this."); return L.join("\n"); }
  L.push("\nAVG RATING PER RECIPE"); r.ratings.forEach((x) => L.push(`  ${x.recipe} — n=${x.n} ⭐${x.avg_rating}`));
  L.push("\nHEAT SOURCE"); r.heat.forEach((x) => L.push(`  ${x.k}: ${x.n}`));
  L.push("PAN"); r.pan.forEach((x) => L.push(`  ${x.k}: ${x.n}`));
  L.push("\nPACE (median actual÷planned; >1 = slower than authored)"); r.pace.forEach((x) => L.push(`  ${x.recipe} — ×${x.median_ratio} (${x.steps} steps)`));
  L.push("\nSLOWEST STEPS (retune first)"); r.slowest.forEach((x) => L.push(`  ×${x.median_ratio} ${x.recipe} / ${x.step} (n=${x.n})`));
  L.push("\nWRITTEN FEEDBACK"); (r.feedback.length ? r.feedback : [{ comment: "(none yet)" }]).forEach((x: any) =>
    L.push(x.comment === "(none yet)" ? "  (none yet)" : `  [${String(x.created_at).slice(0, 10)}] ${x.recipe} ${x.rating ?? "—"}★ <${x.email || "?"}>\n    "${(x.comment || "").replace(/\s+/g, " ").trim()}"`));
  return L.join("\n");
}

export function reportToHtml(r: Report): string {
  const o = r.overview;
  const rows = (arr: any[], fmt: (x: any) => string, empty = "—") =>
    arr.length ? arr.map(fmt).join("") : `<div style="color:#9a9ab0">${empty}</div>`;
  const body = !o.total
    ? `<p style="color:#9a9ab0">No sessions yet — finish a cook while logged in to populate this.</p>`
    : [
        card("Overview",
          li("Sessions logged", String(o.total)) + li("Completed", `${o.completed} (${pctOf(o.completed, o.total)})`) +
          li("Distinct users with a cook", String(o.users)) + li("Range", `${esc(String(o.first).slice(0,10))} → ${esc(String(o.last).slice(0,10))}`)),
        card("Cook cards — the viral loop",
          li("Cards generated", `${r.cards.generated} <span style="color:#9a9ab0">(${pctOf(r.cards.generated, o.completed)} of completed cooks)</span>`) +
          li("Share sheet opened", `${r.cards.shared} <span style="color:#9a9ab0">(${pctOf(r.cards.shared, o.completed)} of completed cooks)</span>`)),
        card("Avg rating per recipe", rows(r.ratings, (x) => li(esc(x.recipe), `n=${x.n} · ⭐${x.avg_rating}`))),
        card("Equipment", `<div style="color:#9a9ab0;font-size:12px;margin-bottom:4px">heat source</div>` +
          rows(r.heat, (x) => li(esc(x.k), String(x.n))) +
          `<div style="color:#9a9ab0;font-size:12px;margin:10px 0 4px">pan</div>` + rows(r.pan, (x) => li(esc(x.k), String(x.n)))),
        card("Pace — median actual vs planned (×&gt;1 = slower than authored)",
          rows(r.pace, (x) => li(esc(x.recipe), `×${x.median_ratio} <span style="color:#9a9ab0">(${x.steps} steps)</span>`))),
        card("Slowest steps — retune these cues first",
          rows(r.slowest, (x) => li(`<span style="color:#ff5500;font-weight:700">×${x.median_ratio}</span> ${esc(x.recipe)} / ${esc(x.step)}`, `n=${x.n}`))),
        card("Written feedback", rows(r.feedback, (x) =>
          `<div style="padding:10px 0;border-bottom:1px solid #23232e">
            <div style="font-size:12px;color:#9a9ab0">${esc(String(x.created_at).slice(0,16).replace("T"," "))} · ${esc(x.recipe)} · ${x.rating ?? "—"}★ · ${esc(x.email || "?")}</div>
            <div style="margin-top:4px">"${esc((x.comment || "").replace(/\s+/g, " ").trim())}"</div></div>`, "(no written comments yet)")),
      ].join("");
  return pageShell("insights", body, `generated ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`);
}

export function usersToHtml(users: any[]): string {
  const viaG = users.filter((u) => u.via_google).length;
  const emails = users.map((u) => u.email).join("\n");
  const rowsHtml = users.length
    ? users.map((u) =>
        `<div style="display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #23232e">
          <div style="min-width:0">
            <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.email)}</div>
            <div style="color:#9a9ab0;font-size:12px">${esc(u.name || "")}${u.tier && u.tier !== "free" ? " · " + esc(u.tier) : ""}</div>
          </div>
          <div style="text-align:right;flex:0 0 auto;color:#9a9ab0;font-size:12px">${u.via_google ? "Google" : "email"} · ${u.cooks} cook${u.cooks === 1 ? "" : "s"}<br>${esc(String(u.created_at).slice(0, 10))}</div>
        </div>`).join("")
    : `<div style="color:#9a9ab0">No users yet.</div>`;
  const body =
    card(`${users.length} user${users.length === 1 ? "" : "s"} · ${viaG} via Google`, rowsHtml) +
    card("All emails (copy-paste)",
      `<textarea readonly onclick="this.select()" style="width:100%;min-height:130px;background:#0b0b0f;color:#f4f4f7;border:1px solid #33334a;border-radius:10px;padding:10px;font-family:ui-monospace,Menlo,monospace;font-size:12px;resize:vertical">${esc(emails)}</textarea>`);
  return pageShell("users", body);
}

export function monthlyToHtml(m: MonthlyUsers): string {
  const rowsHtml = m.rows.length
    ? m.rows.map((u) =>
        `<div style="display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #23232e">
          <div style="min-width:0">
            <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.email)}</div>
            <div style="color:#9a9ab0;font-size:12px">${esc(u.name || "")}${u.tier && u.tier !== "free" ? " · " + esc(u.tier) : ""}</div>
          </div>
          <div style="text-align:right;flex:0 0 auto"><b style="color:#fff">${u.logins}</b> <span style="color:#9a9ab0;font-size:12px">login${u.logins === 1 ? "" : "s"}</span><br><span style="color:#9a9ab0;font-size:12px">last ${esc(String(u.last_login).slice(0, 10))}</span></div>
        </div>`).join("")
    : `<div style="color:#9a9ab0">No logins recorded yet this month.</div>`;
  const body =
    card(`${esc(m.monthLabel)} — at a glance`,
      li("👀 Active users this month <span style='color:#9a9ab0;font-weight:400'>(opened the app)</span>", String(m.activeUsers)) +
      li("App opens this month", String(m.totalVisits)) +
      li("🔑 Signed-in users this month", String(m.uniqueUsers)) +
      li("Total logins this month", String(m.totalLogins))) +
    card("Logins per user this month", rowsHtml);
  return pageShell("monthly", body, `${esc(m.monthLabel)} · calendar month to date · UTC`);
}

// ============================================================================
// AARRR pirate-metrics funnel (read-only aggregate reporting)
// ----------------------------------------------------------------------------
// "A cook" = a COMPLETED session (completed=1) throughout. North Star = Weekly
// Active Cooks. All metrics are derived from existing tables (users, cook_sessions,
// events) — nothing here writes or changes app behaviour. Postgres-only, like the
// rest of this file. Live queries are fine at testing-launch scale; the cohort +
// per-user-first-cook joins are the heaviest, so a nightly rollup table would be
// the place to cache if volume grows (not needed yet).
// ============================================================================
export interface Aarrr {
  northStar: number;
  acq: { today: number; d7: number; d30: number };
  act: { signups: number; activated: number; settledSignups: number; settledActivated: number; medianHrs: number | null };
  ret: { cookedAgain: number; totalCompleted: number };
  ref: { shares: number; sharers: number; completed: number };
  rev: { premium: number; premiumActive: number };
  funnel: { signedUp: number; activated: number; retained: number; referring: number; paying: number };
  cohorts: { week: string; size: number; cells: (number | null)[] }[];
}

export async function computeAarrr(db: Db): Promise<Aarrr> {
  const now = Date.now(), DAY = 86400000;
  const midnight = new Date(); midnight.setUTCHours(0, 0, 0, 0);
  const sinceToday = midnight.toISOString();
  const d7 = new Date(now - 7 * DAY).toISOString();
  const d30 = new Date(now - 30 * DAY).toISOString();
  const d48 = new Date(now - 2 * DAY).toISOString();

  const num = (rows: any[], k = "n") => Number(rows[0]?.[k] ?? 0);
  const [ns] = await db.all(`SELECT count(DISTINCT user_id)::int n FROM cook_sessions WHERE completed=1 AND created_at >= ?`, [d7]);
  const acq = (await db.all(`SELECT
      count(*) FILTER (WHERE created_at >= ?)::int today,
      count(*) FILTER (WHERE created_at >= ?)::int d7,
      count(*) FILTER (WHERE created_at >= ?)::int d30 FROM users`, [sinceToday, d7, d30]))[0] || {};
  const signups = num(await db.all(`SELECT count(*)::int n FROM users`));
  const activated = num(await db.all(`SELECT count(DISTINCT user_id)::int n FROM cook_sessions WHERE completed=1`));
  const settledSignups = num(await db.all(`SELECT count(*)::int n FROM users WHERE created_at < ?`, [d48]));
  const settledActivated = num(await db.all(`SELECT count(DISTINCT u.id)::int n FROM users u
      JOIN cook_sessions cs ON cs.user_id=u.id AND cs.completed=1 WHERE u.created_at < ?`, [d48]));
  const medianHrs = (await db.all(`SELECT round(percentile_cont(0.5) WITHIN GROUP
      (ORDER BY EXTRACT(EPOCH FROM (f.firstcook - u.created_at::timestamptz))/3600)::numeric, 1) hrs
    FROM users u JOIN (SELECT user_id, min(created_at::timestamptz) firstcook FROM cook_sessions WHERE completed=1 GROUP BY user_id) f
      ON f.user_id=u.id`))[0]?.hrs;
  const cookedAgain = num(await db.all(`SELECT count(*)::int n FROM
      (SELECT user_id FROM cook_sessions WHERE completed=1 GROUP BY user_id HAVING count(*)>=2) x`));
  const totalCompleted = num(await db.all(`SELECT count(*)::int n FROM cook_sessions WHERE completed=1`));
  const sh = (await db.all(`SELECT count(*)::int shares, count(DISTINCT user_id)::int sharers FROM events WHERE type='card_shared'`))[0] || {};
  const premium = num(await db.all(`SELECT count(*)::int n FROM users WHERE tier='premium'`));
  const premiumActive = num(await db.all(`SELECT count(DISTINCT u.id)::int n FROM users u
      JOIN cook_sessions cs ON cs.user_id=u.id AND cs.completed=1 AND cs.created_at >= ? WHERE u.tier='premium'`, [d7]));

  // weekly cohort triangle: % of each signup-week cohort still cooking in week N after signup
  const sizes = await db.all(`SELECT to_char(date_trunc('week', created_at::timestamptz),'YYYY-MM-DD') week, count(*)::int size
    FROM users GROUP BY 1 ORDER BY 1`);
  const acts = await db.all(`
    WITH u AS (SELECT id, date_trunc('week', created_at::timestamptz) cw, created_at::timestamptz signup FROM users),
         a AS (SELECT user_id, created_at::timestamptz cooked FROM cook_sessions WHERE completed=1)
    SELECT to_char(u.cw,'YYYY-MM-DD') week,
           floor(EXTRACT(EPOCH FROM (a.cooked - u.signup))/(7*86400))::int woff,
           count(DISTINCT u.id)::int active
    FROM u JOIN a ON a.user_id=u.id AND a.cooked >= u.signup
    GROUP BY 1,2`);
  const actMap = new Map<string, Map<number, number>>();
  for (const r of acts) { const m = actMap.get(r.week) || new Map(); m.set(Number(r.woff), Number(r.active)); actMap.set(r.week, m); }
  const cohorts = sizes.map((s: any) => {
    const elapsed = Math.floor((now - new Date(s.week + "T00:00:00Z").getTime()) / (7 * DAY));
    const cells: (number | null)[] = [];
    for (let n = 0; n <= Math.min(elapsed, 11); n++) {
      const a = actMap.get(s.week)?.get(n) ?? 0;
      cells.push(s.size ? Math.round((1000 * a) / s.size) / 10 : null);
    }
    return { week: s.week, size: Number(s.size), cells };
  }).reverse(); // newest cohort first

  return {
    northStar: Number(ns?.n ?? 0),
    acq: { today: Number(acq.today ?? 0), d7: Number(acq.d7 ?? 0), d30: Number(acq.d30 ?? 0) },
    act: { signups, activated, settledSignups, settledActivated, medianHrs: medianHrs != null ? Number(medianHrs) : null },
    ret: { cookedAgain, totalCompleted },
    ref: { shares: Number(sh.shares ?? 0), sharers: Number(sh.sharers ?? 0), completed: totalCompleted },
    rev: { premium, premiumActive },
    funnel: { signedUp: signups, activated, retained: cookedAgain, referring: Number(sh.sharers ?? 0), paying: premium },
    cohorts,
  };
}

export function aarrrToHtml(a: Aarrr): string {
  const fmtHrs = (h: number | null) => h == null ? "—" : h < 48 ? `${h} h` : `${Math.round((h / 24) * 10) / 10} d`;
  // North Star headline
  const northStar = `<div style="background:linear-gradient(135deg,#1f1408,#1b1b24);border:1px solid #ff5500;border-radius:16px;padding:22px;margin:14px 0;text-align:center">
      <div style="font:700 12px/1 'Instrument Sans',sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:#ff9a5c">★ North Star · Weekly Active Cooks</div>
      <div style="font:800 56px/1 'Instrument Sans',sans-serif;margin:12px 0 6px;background:linear-gradient(135deg,#ff5500,#c44dff);-webkit-background-clip:text;background-clip:text;color:transparent">${a.northStar}</div>
      <div style="color:#9a9ab0;font-size:13px">distinct users who completed a cook in the last 7 days</div></div>`;

  // funnel — distinct users at each stage, with step-over-step conversion + drop callout
  const f = a.funnel;
  const stages = [
    { label: "Signed up", n: f.signedUp },
    { label: "Activated · first cook", n: f.activated },
    { label: "Retained · cooked again", n: f.retained },
    { label: "Referring · shared a card", n: f.referring },
    { label: "Paying · premium", n: f.paying },
  ];
  const top = f.signedUp || 1;
  const funnelBars = stages.map((s, i) => {
    const w = Math.max(s.n ? 2 : 0, Math.round((100 * s.n) / top));
    const prev = i === 0 ? null : stages[i - 1].n;
    const conv = prev != null ? ` <span style="color:#9a9ab0">· ${pctOf(s.n, prev)} of prev</span>` : "";
    const drop = (prev != null && prev > s.n) ? `<div style="font-size:11px;margin-top:2px;text-align:right;color:#ff6b6b">▼ ${pctOf(prev - s.n, prev)} drop-off</div>` : "";
    return `<div style="margin:11px 0">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>${s.label}</span><span><b style="color:#fff">${s.n}</b>${conv}</span></div>
      <div style="height:22px;background:#23232e;border-radius:6px;overflow:hidden"><div style="height:100%;width:${w}%;background:linear-gradient(135deg,#ff5500,#c44dff)"></div></div>${drop}</div>`;
  }).join("");

  // cohort triangle
  const maxN = a.cohorts.reduce((m, c) => Math.max(m, c.cells.length - 1), 0);
  const cell = (v: number | null) => v == null
    ? `<td style="padding:6px 7px;text-align:center;color:#33334a">·</td>`
    : `<td style="padding:6px 7px;text-align:center;color:#fff;font-size:12px;background:rgba(255,85,0,${Math.max(0.07, Math.min(0.9, v / 100 * 0.9))})">${v}%</td>`;
  const cohortTable = a.cohorts.length
    ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
        <tr style="color:#9a9ab0;text-align:left"><th style="padding:6px 7px">cohort wk</th><th style="padding:6px 7px">size</th>${Array.from({ length: maxN + 1 }, (_, i) => `<th style="padding:6px 7px;text-align:center">W${i}</th>`).join("")}</tr>
        ${a.cohorts.map((c) => `<tr><td style="padding:6px 7px;color:#9a9ab0">${esc(c.week)}</td><td style="padding:6px 7px"><b>${c.size}</b></td>${Array.from({ length: maxN + 1 }, (_, i) => i < c.cells.length ? cell(c.cells[i]) : `<td></td>`).join("")}</tr>`).join("")}
      </table></div><div style="color:#9a9ab0;font-size:11px;margin-top:8px">Each cell = % of that signup-week cohort that completed a cook in week N after signing up. W0 is their first week.</div>`
    : `<div style="color:#9a9ab0">Not enough signup history yet.</div>`;

  const body = a.act.signups === 0
    ? northStar + `<p style="color:#9a9ab0">No users yet — metrics populate as people sign in and cook.</p>`
    : northStar +
      card("🪝 The funnel — where users drop off", funnelBars) +
      card("Acquisition — new signups",
        li("Today", String(a.acq.today)) + li("Last 7 days", String(a.acq.d7)) + li("Last 30 days", String(a.acq.d30)) +
        `<div style="color:#9a9ab0;font-size:12px;margin-top:10px">Source (referral vs direct): <b style="color:#c9c9da">needs a referral / attribution system</b> — not currently captured.</div>`) +
      card("Activation — successful first cook",
        li("First-cook rate <span style='color:#9a9ab0;font-weight:400'>(lifetime, all signups)</span>", `${pctOf(a.act.activated, a.act.signups)} <span style="color:#9a9ab0">(${a.act.activated}/${a.act.signups})</span>`) +
        li("First-cook rate <span style='color:#9a9ab0;font-weight:400'>(settled — signups &gt;48h old)</span>", `${pctOf(a.act.settledActivated, a.act.settledSignups)} <span style="color:#9a9ab0">(${a.act.settledActivated}/${a.act.settledSignups})</span>`) +
        li("Median time signup → first cook", fmtHrs(a.act.medianHrs))) +
      card("Retention — do they come back?",
        li("★ Weekly active cooks <span style='color:#9a9ab0;font-weight:400'>(last 7d)</span>", String(a.northStar)) +
        li("Cook-again rate <span style='color:#9a9ab0;font-weight:400'>(≥2 cooks)</span>", `${pctOf(a.ret.cookedAgain, a.act.activated)} <span style="color:#9a9ab0">(${a.ret.cookedAgain}/${a.act.activated} activated)</span>`) +
        li("Repeat rate <span style='color:#9a9ab0;font-weight:400'>(avg cooks / activated user)</span>", a.act.activated ? String(Math.round((100 * a.ret.totalCompleted) / a.act.activated) / 100) : "—")) +
      card("Weekly cohort retention", cohortTable) +
      card("Referral — are they spreading it?",
        li("Cook cards shared", `${a.ref.shares} <span style="color:#9a9ab0">(${pctOf(a.ref.shares, a.ref.completed)} of completed cooks)</span>`) +
        li("Distinct users who shared", String(a.ref.sharers)) +
        `<div style="color:#9a9ab0;font-size:12px;margin-top:10px">Referral signups: <b style="color:#c9c9da">needs a referral system</b> (codes/links) to attribute.</div>`) +
      card("Revenue — premium conversion",
        li("Premium users", String(a.rev.premium)) +
        li("Conversion rate <span style='color:#9a9ab0;font-weight:400'>(of all signups)</span>", pctOf(a.rev.premium, a.funnel.signedUp)) +
        li("% of weekly-active users on premium", pctOf(a.rev.premiumActive, a.northStar)));

  return pageShell("funnel", body, `generated ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC · read-only`);
}

// ---- Cook Counts tab -------------------------------------------------------
// One row per recipe: total cooks (live from cook_sessions), last-cooked date,
// and the recipe_flags.show_cook_count state. Counts are read-only here; the
// flag is toggleable (POST /admin/cookcounts/toggle) so re-enabling a single
// recipe's user-facing count is one click. Rows = every music-sync recipe +
// anything that has ever been cooked (400 zero-count library rows are noise).
export interface CookCountRow { recipe: string; cooks: number; lastCooked: string | null; show: boolean }

export async function cookCounts(db: Db): Promise<CookCountRow[]> {
  const rows = (await db.all(`
    SELECT x.recipe,
           coalesce(s.cooks, 0) AS cooks,
           s.last_cooked,
           coalesce(f.show_cook_count, 0) AS show
      FROM (
        SELECT name AS recipe FROM recipes WHERE is_music_sync = 1 AND name IS NOT NULL
        UNION
        SELECT DISTINCT recipe FROM cook_sessions WHERE recipe IS NOT NULL AND recipe <> ''
        UNION
        SELECT recipe FROM recipe_flags
      ) x
      LEFT JOIN (SELECT recipe, count(*) AS cooks, max(created_at) AS last_cooked
                   FROM cook_sessions WHERE recipe IS NOT NULL AND recipe <> '' GROUP BY recipe) s
        ON s.recipe = x.recipe
      LEFT JOIN recipe_flags f ON f.recipe = x.recipe
     ORDER BY cooks DESC, x.recipe
  `)) as any[];
  return rows.map((r) => ({ recipe: String(r.recipe), cooks: Number(r.cooks), lastCooked: r.last_cooked ? String(r.last_cooked).slice(0, 10) : null, show: Number(r.show) === 1 }));
}

export function cookCountsToHtml(rows: CookCountRow[]): string {
  const shownN = rows.filter((r) => r.show).length;
  const toggle = (r: CookCountRow) =>
    `<form method="post" action="/admin/cookcounts/toggle?recipe=${encodeURIComponent(r.recipe)}" style="display:inline;margin:0">
       <button type="submit" style="cursor:pointer;font:700 11px/1 'Instrument Sans',sans-serif;padding:6px 12px;border-radius:99px;border:1px solid ${r.show ? "rgba(52,211,153,.5)" : "#33334a"};background:${r.show ? "rgba(52,211,153,.12)" : "transparent"};color:${r.show ? "#34d399" : "#9a9ab0"}">${r.show ? "SHOWN ✓ — click to hide" : "HIDDEN — click to show"}</button>
     </form>`;
  const rowsHtml = rows.length
    ? rows.map((r) =>
        `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid #23232e">
          <div style="min-width:0">
            <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.recipe)}</div>
            <div style="color:#9a9ab0;font-size:12px">${r.cooks} cook${r.cooks === 1 ? "" : "s"}${r.lastCooked ? ` · last cooked ${esc(r.lastCooked)}` : " · never cooked"}</div>
          </div>
          <div style="flex:0 0 auto">${toggle(r)}</div>
        </div>`).join("")
    : `<div style="color:#9a9ab0">No recipes or cooks yet.</div>`;
  const body =
    card(`Per-recipe cook counts · ${shownN} of ${rows.length} shown to users`,
      `<div style="color:#9a9ab0;font-size:12px;margin-bottom:10px">Counts keep accumulating for every recipe regardless of the flag — this only controls whether USERS see the "🔥 N cooks" line on cards. Default: hidden. Flip a recipe on once its numbers are strong.</div>` + rowsHtml);
  return pageShell("cookcounts", body, `live from cook_sessions · generated ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`);
}
