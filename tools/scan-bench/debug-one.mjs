import fs from "node:fs";
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || fs.readFileSync("../../server/.env", "utf8").match(/ANTHROPIC_API_KEY=(.+)/)?.[1]?.trim();
const { callVisionOne } = await import("../../server/dist/scan.js");
const img = fs.readFileSync("/tmp/bench-01-normal-fridge.jpg").toString("base64");
const r = await callVisionOne(img, "claude-sonnet-4-6");
console.log("MATCHED:", r.matched.join(", "));
console.log("UNCERTAIN:", r.uncertain.map((u) => u.id_or_name).join(", "));
console.log("OTHER:", r.other.join(", "));
console.log("QUALITY:", r.quality);
