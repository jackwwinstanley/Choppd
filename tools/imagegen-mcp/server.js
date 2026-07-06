#!/usr/bin/env node
// MCP server (stdio): ONE tool — generate_image (Gemini / Nano Banana).
// Read-only against everything except the requested output path.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { generateImage, loadLocalEnv, IMAGE_MODEL } from "./core.js";

loadLocalEnv();

const server = new McpServer({ name: "imagegen", version: "1.0.0" });

server.registerTool("generate_image", {
  description: `Generate one image with ${IMAGE_MODEL} (Nano Banana) and write it to output_path. Refuses to overwrite existing files unless overwrite:true — audited images are protected. Returns { ok, path, model } or { ok:false, error } where error 'rate_limited' means BACK OFF, don't retry immediately.`,
  inputSchema: {
    prompt: z.string().describe("The full image prompt (include the style spec — the tool adds nothing)"),
    output_path: z.string().describe("Absolute or repo-relative file path to write (parent dirs created)"),
    aspect_ratio: z.string().optional().describe('e.g. "1:1", "16:9" — omit for model default'),
    overwrite: z.boolean().optional().describe("Required true to replace an existing file (--force)"),
  },
}, async ({ prompt, output_path, aspect_ratio, overwrite }) => {
  const res = await generateImage({ prompt, output_path, aspect_ratio, overwrite });
  return { content: [{ type: "text", text: JSON.stringify(res) }], isError: !res.ok };
});

const transport = new StdioServerTransport();
await server.connect(transport);
