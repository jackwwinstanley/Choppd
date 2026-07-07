import fs from "node:fs";
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || fs.readFileSync("../../server/.env", "utf8").match(/ANTHROPIC_API_KEY=(.+)/)?.[1]?.trim();
const img = fs.readFileSync("/tmp/bench-01-normal-fridge.jpg").toString("base64");
const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 500, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: img } }, { type: "text", text: "List every distinct food item you can see in this fridge photo, top to bottom. Plain list." }] }] }) });
const j = await res.json();
console.log((j.content || []).map((c) => c.text || "").join(""));
