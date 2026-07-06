#!/usr/bin/env node
// The ONE sanctioned path for wiring an approved image into mvp assets:
//   node tools/imagegen-mcp/promote.js --src <approved-file> --dest mvp/assets/recipes/<r>/<name>.webp [--force]
// Enforces THE QUARANTINE: any source under an experiments/ path is refused —
// web-UI experiment images are watermarked and never ship.
import fs from "node:fs";
import path from "node:path";

export function promote({ src, dest, force = false }) {
  if (!src || !dest) return { ok: false, error: "bad_request", message: "--src and --dest are required" };
  const s = path.resolve(src), d = path.resolve(dest);
  if (/\/experiments\//.test(s))
    return { ok: false, error: "quarantined_source", message: "experimental images are watermarked; regenerate the winning prompt via /generate-images, then promote that output." };
  if (!/\/mvp\/assets\//.test(d))
    return { ok: false, error: "bad_dest", message: "promote only targets mvp/assets/ — that's its whole job." };
  if (!fs.existsSync(s)) return { ok: false, error: "missing_source", message: `no file at ${s}` };
  if (fs.existsSync(d) && !force) return { ok: false, error: "exists", message: `${d} exists — pass --force to replace a wired asset.` };
  fs.mkdirSync(path.dirname(d), { recursive: true });
  fs.copyFileSync(s, d);
  return { ok: true, src: s, dest: d, bytes: fs.statSync(d).size };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : undefined; };
  const res = promote({ src: arg("--src"), dest: arg("--dest"), force: process.argv.includes("--force") });
  console.log(JSON.stringify(res));
  process.exit(res.ok ? 0 : 1);
}
