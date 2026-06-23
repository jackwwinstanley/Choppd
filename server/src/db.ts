/*
 * Data layer. SQLite (better-sqlite3) for the web testing launch — a real,
 * file-backed DB with zero infra. The schema mirrors PLAN.md §5; the access
 * goes through small helpers so swapping to PostgreSQL/RDS at scale is a
 * contained change (same tables, same queries in portable SQL).
 */
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DB_PATH = process.env.DB_PATH || "./data/seartune.db";
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      experience TEXT,
      is_beginner INTEGER DEFAULT 0,
      equipment_json TEXT DEFAULT '{}',   -- { pans: string[], heat: string }
      prefs_json TEXT DEFAULT '{}',       -- voice/haptics/theme/voiceURI/engine…
      tier TEXT DEFAULT 'free',           -- free | premium
      music_platform TEXT,                -- spotify | apple | null
      streak INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_codes (
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_auth_codes_email ON auth_codes(email);

    CREATE TABLE IF NOT EXISTS cook_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      mode TEXT,                          -- music | guided
      recipe TEXT,
      rating INTEGER,
      heat_source TEXT,
      pan TEXT,
      completed INTEGER DEFAULT 0,
      payload_json TEXT NOT NULL,         -- the full telemetry blob (steps, timings, heat…)
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON cook_sessions(user_id, created_at);

    CREATE TABLE IF NOT EXISTS nutrition_cache (
      ingredient TEXT PRIMARY KEY,        -- normalized lowercase name
      data_json TEXT,                     -- { kcal, protein, fat, carbs, source } | null
      updated_at TEXT NOT NULL
    );
  `);
  seedNutrition();
}

// Per-100g values for common raw ingredients (USDA-ballpark). Open Food Facts is
// a packaged-product DB and misses produce; this seed gives the proxy good
// coverage for the staples recipes actually use. Approximate, clearly labeled.
const NUTRITION_SEED: Record<string, { kcal: number; protein: number; fat: number; carbs: number }> = {
  egg: { kcal: 143, protein: 13, fat: 10, carbs: 1 },
  eggs: { kcal: 143, protein: 13, fat: 10, carbs: 1 },
  flour: { kcal: 364, protein: 10, fat: 1, carbs: 76 },
  milk: { kcal: 61, protein: 3, fat: 3, carbs: 5 },
  butter: { kcal: 717, protein: 1, fat: 81, carbs: 0 },
  sugar: { kcal: 387, protein: 0, fat: 0, carbs: 100 },
  salt: { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  "black pepper": { kcal: 251, protein: 10, fat: 3, carbs: 64 },
  "olive oil": { kcal: 884, protein: 0, fat: 100, carbs: 0 },
  "sunflower oil": { kcal: 884, protein: 0, fat: 100, carbs: 0 },
  "vegetable oil": { kcal: 884, protein: 0, fat: 100, carbs: 0 },
  rice: { kcal: 365, protein: 7, fat: 1, carbs: 80 },
  chicken: { kcal: 165, protein: 31, fat: 4, carbs: 0 },
  "chicken breast": { kcal: 165, protein: 31, fat: 4, carbs: 0 },
  beef: { kcal: 250, protein: 26, fat: 15, carbs: 0 },
  steak: { kcal: 271, protein: 25, fat: 19, carbs: 0 },
  onion: { kcal: 40, protein: 1, fat: 0, carbs: 9 },
  garlic: { kcal: 149, protein: 6, fat: 1, carbs: 33 },
  tomato: { kcal: 18, protein: 1, fat: 0, carbs: 4 },
  potato: { kcal: 77, protein: 2, fat: 0, carbs: 17 },
  pumpkin: { kcal: 26, protein: 1, fat: 0, carbs: 7 },
  "egg plants": { kcal: 25, protein: 1, fat: 0, carbs: 6 },
  eggplant: { kcal: 25, protein: 1, fat: 0, carbs: 6 },
  cheese: { kcal: 402, protein: 25, fat: 33, carbs: 1 },
  pasta: { kcal: 371, protein: 13, fat: 2, carbs: 75 },
  raspberries: { kcal: 52, protein: 1, fat: 1, carbs: 12 },
  blueberries: { kcal: 57, protein: 1, fat: 0, carbs: 14 },
};

function seedNutrition() {
  const now = new Date().toISOString();
  const up = db.prepare(
    `INSERT INTO nutrition_cache (ingredient, data_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(ingredient) DO NOTHING`
  );
  const tx = db.transaction(() => {
    for (const [name, v] of Object.entries(NUTRITION_SEED)) {
      up.run(name, JSON.stringify({ ...v, source: "seed" }), now);
    }
  });
  tx();
}
