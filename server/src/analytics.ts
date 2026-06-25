/*
 * Session analytics — the single source of truth for the /admin dashboard and
 * the weekly email digest. Postgres-only (uses jsonb + percentile_cont); the
 * production DB is RDS Postgres, which is the only place this runs.
 */
import type { Db } from "./db.js";

const STEPS = "jsonb_array_elements(COALESCE((cs.payload_json)::jsonb->'steps','[]'::jsonb)) s";
const RATIO = "(s->>'actualSec')::numeric / nullif((s->>'authoredSec')::numeric,0)";
const VALID = "(s->>'authoredSec')::numeric > 5 AND (s->>'actualSec')::numeric > 0";

export interface Report {
  overview: { total: number; completed: number; users: number; first: string | null; last: string | null };
  ratings: any[]; ratingDist: any[]; heat: any[]; pan: any[]; pace: any[]; slowest: any[]; feedback: any[];
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
  const pace = await db.all(`SELECT cs.recipe, count(*)::int steps,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ${RATIO})::numeric,2) median_ratio
    FROM cook_sessions cs, ${STEPS} WHERE ${VALID} GROUP BY cs.recipe ORDER BY median_ratio DESC NULLS LAST`);
  const slowest = await db.all(`SELECT cs.recipe, s->>'title' step, count(*)::int n,
      round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ${RATIO})::numeric,2) median_ratio
    FROM cook_sessions cs, ${STEPS} WHERE ${VALID} GROUP BY cs.recipe, s->>'title' ORDER BY median_ratio DESC NULLS LAST LIMIT 12`);
  const feedback = await db.all(`SELECT cs.created_at, cs.recipe, cs.rating, (cs.payload_json)::jsonb->>'comment' comment, u.email
    FROM cook_sessions cs LEFT JOIN users u ON u.id = cs.user_id
    WHERE COALESCE((cs.payload_json)::jsonb->>'comment','') <> '' ORDER BY cs.created_at DESC LIMIT 50`);
  return { overview, ratings, ratingDist, heat, pan, pace, slowest, feedback };
}

/** Every user who has ever logged in (a row is created on first sign-in), with cook counts. */
export async function listUsers(db: Db): Promise<any[]> {
  return db.all(`SELECT u.email, u.name, u.tier, (u.google_sub IS NOT NULL) AS via_google,
      u.created_at, count(cs.id)::int AS cooks
    FROM users u LEFT JOIN cook_sessions cs ON cs.user_id = u.id
    GROUP BY u.id ORDER BY u.created_at DESC`);
}

const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const pctOf = (a: number, b: number) => (b ? Math.round((1000 * a) / b) / 10 + "%" : "—");
const card = (title: string, body: string) =>
  `<div style="background:#1b1b24;border:1px solid #33334a;border-radius:14px;padding:16px 18px;margin:14px 0">
    <div style="font:700 12px/1 'Instrument Sans',sans-serif;letter-spacing:1px;text-transform:uppercase;color:#9a9ab0;margin-bottom:12px">${title}</div>${body}</div>`;
const li = (l: string, rgt: string) =>
  `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #23232e"><span>${l}</span><b style="color:#fff">${rgt}</b></div>`;

/** Shared page chrome with the tab switcher, used by every /admin view. */
function pageShell(active: "insights" | "users", body: string, subtitle = ""): string {
  const tab = (href: string, label: string, key: string) =>
    `<a href="${href}" style="text-decoration:none;padding:9px 15px;border-radius:99px;font:700 13px/1 'Instrument Sans',sans-serif;${active === key ? "background:linear-gradient(135deg,#ff5500,#c44dff);color:#fff" : "color:#9a9ab0;border:1px solid #33334a"}">${label}</a>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sizle · admin</title></head>
  <body style="margin:0;background:#0b0b0f;color:#f4f4f7;font-family:Inter,system-ui,sans-serif">
    <div style="max-width:720px;margin:0 auto;padding:28px 18px 60px">
      <div style="font:700 22px/1 'Instrument Sans',sans-serif;background:linear-gradient(135deg,#ff5500,#c44dff);-webkit-background-clip:text;background-clip:text;color:transparent">SIZLE · admin</div>
      ${subtitle ? `<div style="color:#9a9ab0;font-size:12px;margin-top:4px">${subtitle}</div>` : ""}
      <div style="display:flex;gap:8px;margin:16px 0 2px">${tab("/admin", "📊 Insights", "insights")}${tab("/admin/users", "👥 Users", "users")}</div>
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
