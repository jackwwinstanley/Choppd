#!/usr/bin/env node
// CLI twin of the MCP tool (same core): node cli.js --prompt "..." --out path [--aspect 1:1] [--force]
import { generateImage, loadLocalEnv } from "./core.js";
loadLocalEnv();
const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : undefined; };
const res = await generateImage({ prompt: arg("--prompt"), output_path: arg("--out"), aspect_ratio: arg("--aspect"), overwrite: process.argv.includes("--force") });
console.log(JSON.stringify(res));
process.exit(res.ok ? 0 : 1);
