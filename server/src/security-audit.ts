/*
 * security-audit.ts — scheduled, READ-ONLY security audit.
 * ============================================================================
 * Runs the mechanical, detectable checks and prints a report (cron appends it
 * to ~/sizle/security-audit.log, which is OUTSIDE the web root). Emails a
 * summary via the existing digest SMTP setup ONLY when there are critical/high
 * findings. Reuses nodemailer + SMTP_URL / DIGEST_TO / DIGEST_FROM from .env.
 *
 * Guarantees:
 *   - READ-ONLY. It scans + reports. It never edits, fixes, or commits code.
 *   - NEVER prints secret VALUES — only the file:line where a pattern matched.
 *
 * Run: cd server && node dist/security-audit.js   (cwd = server/, repo = ..)
 * It covers the mechanical checks only; git-history + per-user-auth + XSS etc.
 * still need manual review (see tools/git-secret-scan.sh and the report footer).
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import nodemailer from "nodemailer";

type Sev = "critical" | "high" | "medium" | "low";
interface Finding { sev: Sev; title: string; where: string; detail: string; fix: string; }
const findings: Finding[] = [];
const add = (sev: Sev, title: string, where: string, detail: string, fix: string) =>
  findings.push({ sev, title, where, detail, fix });

const SERVER = process.cwd();             // run via: cd server && node dist/security-audit.js
const REPO = path.resolve(SERVER, "..");  // repo root = server's parent
const rel = (p: string) => path.relative(REPO, p);

// ---- read-only file walk ----
const SKIP_DIR = new Set(["node_modules", ".git", "dist", "eggs-gen", "__pycache__", ".venv", "venv"]);
const SKIP_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".mp3", ".m4a", ".wav", ".webmanifest", ".map", ".lock"]);
function walk(dir: string, out: string[] = []): string[] {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) walk(p, out); }
    else if (!SKIP_EXT.has(path.extname(e.name).toLowerCase())) out.push(p);
  }
  return out;
}

// ---- 1. hardcoded secrets (value never printed) ----
const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "OpenAI API key", re: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "Private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  { name: "hardcoded secret assignment", re: /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\b\s*[:=]\s*["'][^"'\s]{8,}["']/i },
];
function scanSecrets() {
  for (const f of walk(REPO)) {
    const r = rel(f);
    if (/(^|\/)\.env/.test(r)) continue;                  // .env legitimately holds secrets
    if (/package-lock\.json$/.test(r)) continue;
    if (/security-audit\.(ts|js)$/.test(r)) continue;     // don't match our own patterns
    let lines: string[];
    try { lines = fs.readFileSync(f, "utf8").split("\n"); } catch { continue; }
    lines.forEach((line, i) => {
      for (const { name, re } of SECRET_PATTERNS) {
        if (!re.test(line)) continue;
        const placeholder = /process\.env|YOUR_|EXAMPLE|placeholder|changeme|change-me|dev-only|<[a-z_]+>|\.\.\./i.test(line);
        if (placeholder) add("low", `Possible ${name} (looks like a placeholder/env read)`, `${r}:${i + 1}`, "Matched a secret pattern but appears to be a placeholder or env read.", "Confirm it isn't a real secret; real secrets belong in .env.");
        else add("high", `Possible hardcoded ${name}`, `${r}:${i + 1}`, "A string matching a secret pattern is committed in source (value not shown).", "If real: remove it, rotate the secret, and load it from .env.");
        break;
      }
    });
  }
}

// ---- 2. secret-file permissions ----
function scanPerms() {
  for (const rp of ["server/.env", "server/.env.production", "server/.env.local"]) {
    const p = path.join(REPO, rp);
    if (!fs.existsSync(p)) continue;
    const mode = fs.statSync(p).mode & 0o777;
    if (mode & 0o077) add("critical", "Secret file is group/world-readable", rp, `Mode ${mode.toString(8)} — readable beyond the owner; it holds real secrets.`, `chmod 600 ${rp}`);
  }
}

// ---- 3. npm audit (read-only) ----
function npmAudit() {
  let json: any;
  try { json = JSON.parse(execSync("npm audit --json", { cwd: SERVER, stdio: ["ignore", "pipe", "ignore"] }).toString()); }
  catch (e: any) { try { json = JSON.parse((e.stdout || "").toString()); } catch { return; } }
  const v = json?.metadata?.vulnerabilities || {};
  if (v.critical) add("critical", `${v.critical} critical npm vulnerabilit${v.critical > 1 ? "ies" : "y"}`, "server (npm audit)", "Installed packages have known critical CVEs.", "Run `npm audit` for details, then update the affected packages.");
  if (v.high) add("high", `${v.high} high npm vulnerabilit${v.high > 1 ? "ies" : "y"}`, "server (npm audit)", "Installed packages have known high-severity CVEs.", "Run `npm audit`; update affected packages.");
  if (v.moderate) add("medium", `${v.moderate} moderate npm vulnerabilities`, "server (npm audit)", "Installed packages have moderate CVEs.", "Review with `npm audit`.");
}

// ---- 4. outdated packages (a full major behind) ----
function npmOutdated() {
  let json: any = {};
  try { execSync("npm outdated --json", { cwd: SERVER, stdio: ["ignore", "pipe", "ignore"] }); }
  catch (e: any) { try { json = JSON.parse((e.stdout || "{}").toString()); } catch { /* none */ } }
  const behind = Object.entries(json).filter(([, info]: [string, any]) => {
    const cur = +String(info.current || "").split(".")[0], lat = +String(info.latest || "").split(".")[0];
    return cur && lat && lat - cur >= 1;
  }).map(([n]) => n);
  if (behind.length) add("low", `${behind.length} package(s) a major version behind`, "server/package.json", behind.join(", "), "Review + update where safe (test after each).");
}

// ---- 5. route auth heuristic ----
function scanRoutes() {
  const f = path.join(REPO, "server/src/routes.ts");
  if (!fs.existsSync(f)) return;
  const PUBLIC_OK = /^\/(health|auth\/|visit|event|recipes|nutrition|waitlist)/; // intentionally public (waitlist = the landing signup, deliberately unauthenticated + rate-limited)
  fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    const m = line.match(/api\.(get|post|put|delete)\(\s*["']([^"']+)["']/);
    if (!m) return;
    const [, method, route] = m;
    if (!/requireAuth/.test(line) && !PUBLIC_OK.test(route))
      add("medium", `Route without requireAuth: ${method.toUpperCase()} ${route}`, `server/src/routes.ts:${i + 1}`, "No auth middleware — confirm this endpoint is meant to be public.", "Add requireAuth if it touches user data; else confirm intentional.");
  });
}

// ---- 6. SQL built with string interpolation ----
function scanSql() {
  for (const fn of ["db.ts", "analytics.ts", "routes.ts", "auth.ts", "streaks.ts", "admin.ts"]) {
    const f = path.join(REPO, "server/src", fn);
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => {
      if (/(SELECT|INSERT|UPDATE|DELETE|ALTER|DROP|FROM|WHERE)[^`]*\$\{/i.test(line))
        add("medium", "SQL built with template interpolation", `server/src/${fn}:${i + 1}`, "A query string contains ${…} — only safe if that value is never user input.", "Use ? parameter placeholders for any user-controlled value.");
    });
  }
}

// ---- 7. CORS ----
function scanCors() {
  const f = path.join(REPO, "server/src/index.ts");
  if (!fs.existsSync(f)) return;
  const src = fs.readFileSync(f, "utf8");
  if (/cors\(\s*\)/.test(src) || /origin:\s*true/.test(src) || /origin:\s*["']\*["']/.test(src))
    add("medium", "CORS may allow any origin", "server/src/index.ts", "CORS can reflect/allow all origins (e.g. when no allowlist env is configured).", "Set an explicit origin allowlist (env-driven) in production.");
}

// ---- report ----
const ORDER: Record<Sev, number> = { critical: 0, high: 1, medium: 2, low: 3 };
function buildReport() {
  findings.sort((a, b) => ORDER[a.sev] - ORDER[b.sev]);
  const c: Record<Sev, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) c[f.sev]++;
  let t = `\n========================================================\n`;
  t += `Sizle security audit — ${new Date().toISOString()}\n`;
  t += `critical:${c.critical}  high:${c.high}  medium:${c.medium}  low:${c.low}  (total ${findings.length})\n`;
  t += `read-only scan · secret VALUES are never shown (only file:line)\n`;
  t += `========================================================\n`;
  if (!findings.length) t += `\n✓ No mechanical issues found.\n`;
  for (const f of findings) t += `\n[${f.sev.toUpperCase()}] ${f.title}\n  where: ${f.where}\n  note:  ${f.detail}\n  fix:   ${f.fix}\n`;
  t += `\n--- NOT covered (manual review still needed) ---\n`;
  t += `  · per-user authorization / IDOR (a route can have auth but still leak another user's data)\n`;
  t += `  · OTP / login rate-limiting & brute-force protection\n`;
  t += `  · XSS in client-side template HTML; input validation / SSRF (e.g. nutrition proxy)\n`;
  t += `  · secrets in git HISTORY — run \`bash tools/git-secret-scan.sh\` locally\n`;
  t += `  · infra: TLS config, firewall, DB access, server hardening; dependency supply-chain\n`;
  return { text: t, urgent: c.critical + c.high, c };
}

(async () => {
  try { scanSecrets(); } catch (e: any) { console.log("[audit] scanSecrets error: " + e.message); }
  try { scanPerms(); } catch (e: any) { console.log("[audit] scanPerms error: " + e.message); }
  try { npmAudit(); } catch (e: any) { console.log("[audit] npmAudit error: " + e.message); }
  try { npmOutdated(); } catch (e: any) { console.log("[audit] npmOutdated error: " + e.message); }
  try { scanRoutes(); } catch (e: any) { console.log("[audit] scanRoutes error: " + e.message); }
  try { scanSql(); } catch (e: any) { console.log("[audit] scanSql error: " + e.message); }
  try { scanCors(); } catch (e: any) { console.log("[audit] scanCors error: " + e.message); }

  const { text, urgent, c } = buildReport();
  console.log(text); // cron appends to ~/sizle/security-audit.log

  const smtp = process.env.SMTP_URL, to = process.env.DIGEST_TO;
  if (urgent > 0 && smtp && to) {
    const from = process.env.DIGEST_FROM || "Sizle <digest@sizle.nodaysoff.pro>";
    try {
      await nodemailer.createTransport(smtp).sendMail({
        from, to,
        subject: `⚠️ Sizle security audit — ${c.critical} critical, ${c.high} high`,
        text,
      });
      console.log(`[audit] emailed ${to} (${urgent} urgent finding${urgent > 1 ? "s" : ""})`);
    } catch (e: any) { console.log("[audit] email failed: " + e.message); }
  } else if (urgent > 0) {
    console.log("[audit] urgent findings but SMTP_URL/DIGEST_TO not set — see the log above.");
  }
})();
