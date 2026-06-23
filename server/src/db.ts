/*
 * Data layer. Dual-driver, single async contract:
 *   - DATABASE_URL set  -> PostgreSQL (AWS RDS) via `pg`        [production/scale]
 *   - DATABASE_URL empty -> SQLite (better-sqlite3), file-backed [zero-infra local dev]
 *
 * Every route/query goes through the same `all/get/run/exec` helpers, so the
 * client contract (and both web + native clients) never change when we move from
 * SQLite to RDS. SQL is written with `?` placeholders; the Postgres adapter
 * rewrites them to `$1,$2,…`. Keep the DDL portable (TEXT / INTEGER / BIGINT).
 */
const DATABASE_URL = process.env.DATABASE_URL || "";
export const usingPostgres = !!DATABASE_URL;

export interface Db {
  all(sql: string, params?: any[]): Promise<any[]>;
  get(sql: string, params?: any[]): Promise<any | undefined>;
  run(sql: string, params?: any[]): Promise<void>;
  exec(ddl: string): Promise<void>; // multi-statement DDL, no params
}

// `?`  ->  `$1, $2, …`  (Postgres positional params)
function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

let dbImpl: Db;

async function makeSqlite(): Promise<Db> {
  const { default: Database } = await import("better-sqlite3");
  const { mkdirSync } = await import("node:fs");
  const { dirname } = await import("node:path");
  const DB_PATH = process.env.DB_PATH || "./data/seartune.db";
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return {
    async all(sql, params = []) { return sqlite.prepare(sql).all(...params); },
    async get(sql, params = []) { return sqlite.prepare(sql).get(...params); },
    async run(sql, params = []) { sqlite.prepare(sql).run(...params); },
    async exec(ddl) { sqlite.exec(ddl); },
  };
}

async function makePostgres(): Promise<Db> {
  const { Pool } = await import("pg");
  // RDS requires TLS; default to verify-relaxed unless a CA bundle is provided.
  const ssl = process.env.PGSSL_DISABLE === "true" ? undefined : { rejectUnauthorized: false };
  const pool = new Pool({ connectionString: DATABASE_URL, ssl, max: Number(process.env.PG_POOL_MAX || 10) });
  return {
    async all(sql, params = []) { return (await pool.query(toPg(sql), params)).rows; },
    async get(sql, params = []) { return (await pool.query(toPg(sql), params)).rows[0]; },
    async run(sql, params = []) { await pool.query(toPg(sql), params); },
    async exec(ddl) { await pool.query(ddl); }, // pg runs multi-statement strings (no params)
  };
}

/** Initialise the chosen driver. Call once at boot before `migrate()`. */
export async function initDb(): Promise<Db> {
  dbImpl = usingPostgres ? await makePostgres() : await makeSqlite();
  return dbImpl;
}

// Thin proxy so modules can `import { db }` and call db.get(...) after initDb().
export const db: Db = {
  all: (s, p) => dbImpl.all(s, p),
  get: (s, p) => dbImpl.get(s, p),
  run: (s, p) => dbImpl.run(s, p),
  exec: (d) => dbImpl.exec(d),
};

export async function migrate() {
  // Portable DDL (works on both SQLite and Postgres). `expires_at` is BIGINT
  // because it stores epoch-ms (Date.now()), which overflows a 32-bit INTEGER.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      google_sub TEXT UNIQUE,
      name TEXT,
      avatar_url TEXT,
      experience TEXT,
      is_beginner INTEGER DEFAULT 0,
      equipment_json TEXT DEFAULT '{}',
      prefs_json TEXT DEFAULT '{}',
      tier TEXT DEFAULT 'free',
      music_platform TEXT,
      streak INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_codes (
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_auth_codes_email ON auth_codes(email);

    CREATE TABLE IF NOT EXISTS cook_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      mode TEXT,
      recipe TEXT,
      rating INTEGER,
      heat_source TEXT,
      pan TEXT,
      completed INTEGER DEFAULT 0,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON cook_sessions(user_id, created_at);

    CREATE TABLE IF NOT EXISTS nutrition_cache (
      ingredient TEXT PRIMARY KEY,
      data_json TEXT,
      updated_at TEXT NOT NULL
    );
  `);
  await seedNutrition();
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

async function seedNutrition() {
  const now = new Date().toISOString();
  // ON CONFLICT DO NOTHING is portable across SQLite and Postgres.
  for (const [name, v] of Object.entries(NUTRITION_SEED)) {
    await db.run(
      `INSERT INTO nutrition_cache (ingredient, data_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(ingredient) DO NOTHING`,
      [name, JSON.stringify({ ...v, source: "seed" }), now]
    );
  }
}
