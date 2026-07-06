// unit-ish tests: mock the Gemini call; exercise write / overwrite-guard / 429 / no-key
import { generateImage } from "./core.js";
import fs from "node:fs";
const tmp = "/tmp/imagegen-mock-test";
fs.rmSync(tmp, { recursive: true, force: true });
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
let pass = 0, fail = 0;
const t = (name, cond) => { cond ? pass++ : (fail++, console.log("FAIL:", name)); };

// 1. success writes the file (parent dirs created)
let r = await generateImage({ prompt: "x", output_path: tmp + "/a/b.png", _mockCall: async () => PNG });
t("success writes", r.ok && fs.existsSync(tmp + "/a/b.png"));

// 2. existing file without overwrite refuses
r = await generateImage({ prompt: "x", output_path: tmp + "/a/b.png", _mockCall: async () => PNG });
t("overwrite-guard refuses", !r.ok && r.error === "exists");

// 3. overwrite:true replaces
r = await generateImage({ prompt: "x", output_path: tmp + "/a/b.png", overwrite: true, _mockCall: async () => PNG });
t("force overwrites", r.ok);

// 4. 429 returns the distinct code (no retry hammering)
let calls = 0;
r = await generateImage({ prompt: "x", output_path: tmp + "/c.png", _mockCall: async () => { calls++; throw Object.assign(new Error("429 RESOURCE_EXHAUSTED"), { status: 429 }); } });
t("429 distinct code", !r.ok && r.error === "rate_limited" && calls === 1);

// 5. transient 5xx retries once then succeeds
calls = 0;
r = await generateImage({ prompt: "x", output_path: tmp + "/d.png", _mockCall: async () => { calls++; if (calls === 1) throw Object.assign(new Error("500 internal"), { status: 500 }); return PNG; } });
t("5xx retries once", r.ok && calls === 2);

// 6. missing key errors cleanly (no mock, no key)
const saved = process.env.GEMINI_API_KEY; delete process.env.GEMINI_API_KEY;
r = await generateImage({ prompt: "x", output_path: tmp + "/e.png" });
t("no key clean error", !r.ok && r.error === "no_api_key");
if (saved) process.env.GEMINI_API_KEY = saved;

// 7. generation into experiments/ paths is allowed (quarantine removed 2026-07)
r = await generateImage({ prompt: "x", output_path: tmp + "/experiments/exp-a-1.png", _mockCall: async () => PNG });
t("gen writes experiments path", r.ok && fs.existsSync(tmp + "/experiments/exp-a-1.png"));

// 8. promote from an experiments/ source succeeds AND writes the provenance row
const { promote } = await import("./promote.js");
fs.mkdirSync(tmp + "/experiments/e1/results", { recursive: true });
fs.writeFileSync(tmp + "/experiments/e1/results/exp-a-1.png", PNG);
r = promote({ src: tmp + "/experiments/e1/results/exp-a-1.png", dest: tmp + "/mvp/assets/recipes/pasta/from-exp.webp" });
const prov = tmp + "/mvp/assets/recipes/pasta/PROVENANCE.md";
t("promote accepts experiments source", r.ok && r.provenance === true && fs.existsSync(tmp + "/mvp/assets/recipes/pasta/from-exp.webp"));
t("provenance row written", fs.existsSync(prov) && /from-exp\.webp.*web-ui\/watermarked/.test(fs.readFileSync(prov, "utf8")));

// 9. promote works for legit sources into mvp/assets
fs.writeFileSync(tmp + "/approved.webp", PNG);
r = promote({ src: tmp + "/approved.webp", dest: tmp + "/mvp/assets/recipes/pasta/ok.webp" });
t("promote copies approved", r.ok && fs.existsSync(tmp + "/mvp/assets/recipes/pasta/ok.webp"));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
