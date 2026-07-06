// Core generation logic — shared by the MCP server (server.js) and the CLI
// (cli.js) so both paths are byte-identical. Key from env only; never logged.
import fs from "node:fs";
import path from "node:path";

export const IMAGE_MODEL = process.env.IMAGE_MODEL || "gemini-2.5-flash-image";
const TIMEOUT_MS = 60_000;

// tiny .env loader (same pattern as server/.env): tools/imagegen-mcp/.env,
// KEY=value lines, never committed (.env is gitignored repo-wide)
export function loadLocalEnv() {
  const here = path.dirname(new URL(import.meta.url).pathname);
  // checked in order; first definition of a var wins. server/.env is the
  // repo's existing key file — appending GEMINI_API_KEY there works too.
  for (const p of [path.join(here, ".env"), path.join(here, "..", "..", "server", ".env")]) {
    try {
      if (!fs.existsSync(p)) continue;
      for (const line of fs.readFileSync(p, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
      }
    } catch (e) { /* unreadable env file — skip */ }
  }
}

export async function generateImage({ prompt, output_path, aspect_ratio, overwrite = false, _mockCall = null }) {
  if (!prompt || !output_path) return { ok: false, error: "bad_request", message: "prompt and output_path are required" };
  const key = process.env.GEMINI_API_KEY;
  if (!key && !_mockCall) return { ok: false, error: "no_api_key", message: "GEMINI_API_KEY is not set — put it in tools/imagegen-mcp/.env or your shell profile (see README). No key, no generation; nothing crashed." };
  const out = path.resolve(output_path);
  if (fs.existsSync(out) && !overwrite) return { ok: false, error: "exists", message: `Refusing to overwrite ${out} — audited/approved images are protected. Pass overwrite:true (--force) to regenerate.` };

  const call = _mockCall || (async () => {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: key });
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const resp = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: prompt,
        config: { responseModalities: ["IMAGE"], ...(aspect_ratio ? { imageConfig: { aspectRatio: aspect_ratio } } : {}), abortSignal: ctl.signal },
      });
      const part = (((resp.candidates || [])[0] || {}).content || {}).parts?.find((p) => p.inlineData && p.inlineData.data);
      if (!part) throw Object.assign(new Error("no image in response"), { code: "no_image" });
      return Buffer.from(part.inlineData.data, "base64");
    } finally { clearTimeout(t); }
  });

  const attempt = async () => await call();
  let bytes;
  try { bytes = await attempt(); }
  catch (e) {
    const status = e?.status || e?.code || (String(e?.message).match(/\b(429|5\d\d)\b/) || [])[0];
    if (String(status) === "429" || /RESOURCE_EXHAUSTED|rate/i.test(String(e?.message)))
      return { ok: false, error: "rate_limited", message: "429/rate limit from the API — back off and retry later; do not hammer." };
    // transient (5xx / network / abort): retry ONCE
    if (/5\d\d|fetch|network|abort|ECONN|ETIMEDOUT/i.test(String(status) + String(e?.message))) {
      try { bytes = await attempt(); }
      catch (e2) { return { ok: false, error: "transient_failed", message: String(e2?.message || e2).slice(0, 200) }; }
    } else return { ok: false, error: "api_error", message: String(e?.message || e).slice(0, 200) };
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, bytes);
  return { ok: true, path: out, bytes: bytes.length, model: IMAGE_MODEL };
}
