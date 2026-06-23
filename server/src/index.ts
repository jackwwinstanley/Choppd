/*
 * SearTune API — entrypoint.
 * Full-stack web app (testing launch). The REST contract here is the seam that
 * lets us swap the web client for the Expo/native app later without backend rework.
 */
import "dotenv/config";
import express from "express";
import cors from "cors";
import { migrate } from "./db.js";
import { api } from "./routes.js";

migrate();

const app = express();
app.use(express.json({ limit: "256kb" }));

const origins = (process.env.CORS_ORIGINS || "http://127.0.0.1:4173,http://localhost:4173")
  .split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));

app.use("/api", api);

// Friendly root + 404
app.get("/", (_req, res) => res.json({ service: "seartune-api", health: "/api/health" }));
app.use((_req, res) => res.status(404).json({ error: "not-found" }));

const PORT = Number(process.env.PORT || 8788);
app.listen(PORT, () => {
  console.log(`SearTune API listening on http://127.0.0.1:${PORT}  (CORS: ${origins.join(", ")})`);
});
