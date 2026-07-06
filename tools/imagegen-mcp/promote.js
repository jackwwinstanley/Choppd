#!/usr/bin/env node
// The sanctioned path for wiring an approved image into mvp assets:
//   node tools/imagegen-mcp/promote.js --src <approved-file> --dest mvp/assets/recipes/<r>/<name>.webp [--force]
// Any audited source is valid — including web-UI experiment images (founder
// decision 2026-07: the founder's audit is the only gate). Promotions from an
// experiments/ path get a PROVENANCE.md row beside the destination (pure
// record, zero enforcement) so a future watermark-free upgrade pass is a
// lookup, not a hunt.
import fs from "node:fs";
import path from "node:path";

export function promote({ src, dest, force = false }) {
  if (!src || !dest) return { ok: false, error: "bad_request", message: "--src and --dest are required" };
  const s = path.resolve(src), d = path.resolve(dest);
  if (!/\/mvp\/assets\//.test(d))
    return { ok: false, error: "bad_dest", message: "promote only targets mvp/assets/ — that's its whole job." };
  if (!fs.existsSync(s)) return { ok: false, error: "missing_source", message: `no file at ${s}` };
  if (fs.existsSync(d) && !force) return { ok: false, error: "exists", message: `${d} exists — pass --force to replace a wired asset.` };
  fs.mkdirSync(path.dirname(d), { recursive: true });
  fs.copyFileSync(s, d);
  let provenance = false;
  if (/\/experiments\//.test(s)) {
    const p = path.join(path.dirname(d), "PROVENANCE.md");
    if (!fs.existsSync(p)) fs.writeFileSync(p, "# PROVENANCE — images sourced outside the paid API lane\n\n| slot | source | date | origin |\n|---|---|---|---|\n");
    fs.appendFileSync(p, `| ${path.basename(d)} | ${path.relative(process.cwd(), s)} | ${new Date().toISOString().slice(0, 10)} | web-ui/watermarked |\n`);
    provenance = true;
  }
  return { ok: true, src: s, dest: d, bytes: fs.statSync(d).size, provenance };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : undefined; };
  const res = promote({ src: arg("--src"), dest: arg("--dest"), force: process.argv.includes("--force") });
  console.log(JSON.stringify(res));
  process.exit(res.ok ? 0 : 1);
}
