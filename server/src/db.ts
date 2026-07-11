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
  const { readFileSync } = await import("node:fs");
  // RDS serves TLS from Amazon's own CA (absent from Node's trust store). Strip any
  // sslmode/ssl param from the URL so THIS ssl config is authoritative across pg
  // versions, then verify against the RDS CA bundle when provided (PG_CA_CERT),
  // else relax verification (encrypted but unverified).
  let conn = DATABASE_URL;
  try { const u = new URL(DATABASE_URL); u.searchParams.delete("sslmode"); u.searchParams.delete("ssl"); conn = u.toString(); } catch { /* keep as-is */ }
  // TLS verification ladder (default stays OFF — encrypted but unverified — so
  // nothing breaks until the env flag is flipped after prod testing):
  //   PGSSL_DISABLE=true   → no TLS at all (local dev against plain postgres)
  //   PG_CA_CERT=/path.pem → verify against a custom CA file
  //   PGSSL_VERIFY=true    → verify against the BUNDLED AWS RDS global CA
  //                          (server/certs/rds-global-bundle.pem, checked in)
  let ssl: any = { rejectUnauthorized: false };
  if (process.env.PGSSL_DISABLE === "true") ssl = false;
  else if (process.env.PG_CA_CERT) ssl = { ca: readFileSync(process.env.PG_CA_CERT, "utf8"), rejectUnauthorized: true };
  else if (process.env.PGSSL_VERIFY === "true") ssl = { ca: readFileSync(new URL("../certs/rds-global-bundle.pem", import.meta.url), "utf8"), rejectUnauthorized: true };
  const pool = new Pool({ connectionString: conn, ssl, max: Number(process.env.PG_POOL_MAX || 10) });
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

    -- COOK RESUME (§ server-side cook state). ONE active cook per account, so the
    -- PK is user_id itself (upsert semantics; no client-generated row id). The
    -- versioned snapshot (recipe/engine/method/optionals/pan-stove/portion/step/
    -- gates/pause/started-at) lives in snapshot_json; schema_version is hoisted to
    -- a column so a reader can branch without parsing. started_at + updated_at are
    -- SERVER-authoritative (updated_at drives the 6h resume window + "left X ago").
    -- Holds recipe/step data only (no PII); hard-deleted with the account, like
    -- cook_sessions. Deliberately NOT near the video_matches block (deploy strip).
    CREATE TABLE IF NOT EXISTS cook_state (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      recipe_id TEXT NOT NULL,
      engine TEXT NOT NULL,
      schema_version INTEGER NOT NULL DEFAULT 1,
      snapshot_json TEXT NOT NULL,
      started_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cook_state_updated ON cook_state(updated_at);

    CREATE TABLE IF NOT EXISTS nutrition_cache (
      ingredient TEXT PRIMARY KEY,
      data_json TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS logins (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      method TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_logins_created ON logins(created_at);

    -- App opens (one row per browser session), incl. anonymous visitors, for the
    -- monthly-active-users metric. visitor_id is a stable per-device id; user_id
    -- is set when a token is present.
    CREATE TABLE IF NOT EXISTS app_visits (
      id TEXT PRIMARY KEY,
      visitor_id TEXT,
      user_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_visits_created ON app_visits(created_at);

    -- Lightweight product events (e.g. cook-card generated/shared) for the
    -- viral-loop metrics in the admin dashboard.
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      recipe TEXT,
      user_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type, created_at);

    -- Full searchable recipe catalog (bulk-imported from TheMealDB by tools/
    -- import-all-mealdb.mjs) so filters run against the whole DB, not a static
    -- 20-recipe file. meal_time is a JSON array (TEXT) for portability; data_json
    -- holds the full mapped recipe (steps, ingredients) for rendering/cooking.
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      name TEXT,
      cuisine TEXT,
      difficulty TEXT,
      meal_time TEXT,
      category TEXT,
      area TEXT,
      instructions TEXT,
      thumbnail TEXT,
      source TEXT,
      est_min INTEGER,
      is_music_sync INTEGER DEFAULT 0,
      imported_from TEXT,
      data_json TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_recipes_filter ON recipes(cuisine, difficulty);

    -- Fridge scans (demand flywheel). PRIVACY: only canonical ingredient IDS
    -- ever land here — no photos, no free text tied to identity. user_id is
    -- nullable and follows the account-deletion anonymize pattern (SET NULL).
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      detected_ids TEXT NOT NULL DEFAULT '[]',
      added_ids TEXT NOT NULL DEFAULT '[]',
      match_summary TEXT NOT NULL DEFAULT '{}',
      launched_recipe_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id, created_at);

    -- Recipe requests (§4.2 fridge-scanner spec): explicit user demand from AI
    -- concept previews. user_id nullable + deletion-anonymize like scans.
    -- EXPLICIT NON-GOAL: no automated generation-to-catalog — the human gate
    -- (founder stove-test via /new-recipe) stays; this table is its input queue.
    CREATE TABLE IF NOT EXISTS recipe_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      set_key TEXT NOT NULL,
      ingredient_ids TEXT NOT NULL DEFAULT '[]',
      concept_title TEXT,
      concept_json TEXT,
      status TEXT NOT NULL DEFAULT 'requested',
      shipped_recipe TEXT,
      seen_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_requests_user ON recipe_requests(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_requests_title ON recipe_requests(concept_title, status);

    -- Concept-preview cache (§4.1): one generation per canonical ingredient set
    -- (the generate-once discipline applied to previews). 7-day TTL at read time.
    -- §USAGE LIMITS (flag-gated; everyone exempt until launch). Unlocks are
    -- idempotent by PK (double-tap race-safe: INSERT OR IGNORE burns one).
    CREATE TABLE IF NOT EXISTS premium_unlocks (
      user_id TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      unlocked_at TEXT NOT NULL,
      PRIMARY KEY (user_id, recipe_id)
    );
    CREATE TABLE IF NOT EXISTS premium_waitlist (
      user_id TEXT PRIMARY KEY,
      email TEXT,
      trigger_kind TEXT,
      created_at TEXT NOT NULL
    );
    -- ANTI-ABUSE LEDGER: keyed by ONE-WAY sha256 identity hashes (lowercased
    -- email; second row for google_sub). NO plaintext identity, NO FK to users.
    -- This is the DELIBERATE EXCEPTION that survives account deletion — the
    -- delete-modal copy discloses it ("anonymous usage limits may persist").
    CREATE TABLE IF NOT EXISTS limit_ledger (
      identity_hash TEXT PRIMARY KEY,
      scan_times TEXT NOT NULL DEFAULT '[]',
      unlocks_used INTEGER NOT NULL DEFAULT 0,
      exempt INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    -- Concept requests (Scan 2.1): the Instagram-DM demand loop. PRIVACY:
    -- instagram_handle + message are personal contact data — rows are FULLY
    -- DELETED in the account-deletion transaction (requests, not analytics).
    CREATE TABLE IF NOT EXISTS concept_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      concept_json TEXT,
      message TEXT,
      instagram_handle TEXT,
      ingredient_set TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'new',
      admin_note TEXT,
      shipped_recipe TEXT,
      user_seen_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_crequests_status ON concept_requests(status);

    CREATE TABLE IF NOT EXISTS concept_cache (
      set_key TEXT PRIMARY KEY,
      concepts_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- Per-recipe display flag for cook counts. Counts keep accumulating in
    -- cook_sessions regardless; this only gates whether users SEE them (low
    -- numbers hurt trust). Default off for every recipe; flipped per-recipe
    -- from the admin "Cook Counts" tab once a recipe's numbers are strong.
    CREATE TABLE IF NOT EXISTS recipe_flags (
      recipe TEXT PRIMARY KEY,
      show_cook_count INTEGER NOT NULL DEFAULT 0
    );

    -- VIDEO-MATCH pipeline (tools/video-match.mjs): one row per imported/guided
    -- recipe, mapping its steps to timestamps in an OFFICIAL YouTube embed.
    -- steps_json = ordered [{ step_index, video_ts, confidence, method_conflict,
    -- note, wired }]; only wired=1 steps surface a "Watch this moment" button.
    -- steps_fingerprint = hash of the recipe's step texts at match time, so the
    -- nightly health check can detect a re-import that shifted step indices and
    -- invalidate a stale map. status: pilot | approved | review | dead.
    -- Deletion-irrelevant: no user data — never touched by account deletion.
    CREATE TABLE IF NOT EXISTS video_matches (
      recipe_id TEXT PRIMARY KEY,
      video_id TEXT,
      video_title TEXT,
      channel TEXT,
      view_count INTEGER,
      seed_source TEXT,           -- 'themealdb-link' | 'search' | 'manual-override'
      status TEXT NOT NULL DEFAULT 'review',
      steps_json TEXT NOT NULL DEFAULT '[]',
      steps_fingerprint TEXT,
      review_note TEXT,
      matched_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_video_matches_status ON video_matches(status);
  `);
  // Evolve pre-existing databases: CREATE TABLE IF NOT EXISTS won't add new
  // columns to a table created by an older schema. These are idempotent on both
  // SQLite and Postgres (errors for an already-present column are swallowed).
  await addColumnIfMissing("users", "google_sub", "TEXT");
  await addColumnIfMissing("users", "limits_exempt", "INTEGER DEFAULT 1");   // usage limits: exempt-by-default (validation phase)
  await addColumnIfMissing("users", "scan_tier", "TEXT");                     // SCAN 2.0 premium model hook (null | strong | max)
  await addColumnIfMissing("users", "name", "TEXT");
  await addColumnIfMissing("users", "avatar_url", "TEXT");
  // Cook-history / streak feature: per-session duration + cached streak columns.
  await addColumnIfMissing("cook_sessions", "duration_sec", "INTEGER");
  await addColumnIfMissing("users", "timezone", "TEXT");        // IANA tz for local-day streaks
  await addColumnIfMissing("users", "current_streak", "INTEGER DEFAULT 0");
  await addColumnIfMissing("users", "longest_streak", "INTEGER DEFAULT 0");
  // Cook-resume abandonment logging: cook_abandoned rides the events table but
  // needs {stepIdx, elapsedSec} beyond (type, recipe) — a nullable JSON column,
  // default null for every other event so the /event contract is unchanged.
  await addColumnIfMissing("events", "detail", "TEXT");
  // Concept-request provenance: 'concept' (AI-preview request) | 'scan_miss'
  // (no-match demand capture) — default keeps existing rows legible.
  await addColumnIfMissing("concept_requests", "source", "TEXT DEFAULT 'concept'");
  await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);`);
  await backfillDurations();
  await seedNutrition();
  await seedMusicCooks();
}

// Backfill duration_sec from payload_json.durationSec (portable across drivers;
// only touches rows that haven't been backfilled yet, so it's cheap after once).
async function backfillDurations() {
  const rows = (await db.all("SELECT id, payload_json FROM cook_sessions WHERE duration_sec IS NULL")) as { id: string; payload_json: string }[];
  for (const r of rows) {
    let sec: number | null = null;
    try { const p = JSON.parse(r.payload_json || "{}"); if (typeof p.durationSec === "number") sec = Math.round(p.durationSec); } catch { /* skip */ }
    if (sec != null) await db.run("UPDATE cook_sessions SET duration_sec = ? WHERE id = ?", [sec, r.id]);
  }
}

// The 4 hand-crafted music-sync cooks (authored in mvp/cues.js). They live in
// the recipes table as is_music_sync=1 rows so the catalog/filters can include
// them and the bulk MealDB importer skips (never overwrites) them. Tags mirror
// the app's framing; the client routes is_music_sync rows to the music cook flow.
const MUSIC_COOKS = [
  { id: "freebird-medium-rare-steak", name: "Medium-Rare Steak", cuisine: "american", difficulty: "intermediate", mealTime: ["dinner"], category: "Beef", emoji: "🥩" },
  { id: "scrambled-eggs", name: "Fluffy Scrambled Eggs", cuisine: "american", difficulty: "beginner", mealTime: ["breakfast"], category: "Breakfast", emoji: "🍳" },
  { id: "one-pot-garlic-parmesan-pasta", name: "Creamy One-Pot Pasta", cuisine: "italian", difficulty: "beginner", mealTime: ["lunch", "dinner"], category: "Pasta", emoji: "🍝" },
  { id: "crispy-chicken-thighs", name: "Crispy Chicken Thighs", cuisine: "american", difficulty: "beginner", mealTime: ["dinner", "lunch"], category: "Chicken", emoji: "🍗" },
  { id: "smash-burgers", name: "Smash Burgers", cuisine: "american", difficulty: "beginner", mealTime: ["dinner", "lunch"], category: "Beef", emoji: "🍔" },
  { id: "chicken-fried-rice", name: "Chicken Fried Rice", cuisine: "asian", difficulty: "beginner", mealTime: ["dinner", "lunch"], category: "Chicken", emoji: "🍚" },
  { id: "ground-beef-tacos", name: "Ground Beef Tacos", cuisine: "mexican", difficulty: "beginner", mealTime: ["dinner", "lunch"], category: "Beef", emoji: "🌮" },
  { id: "pancakes", name: "Fluffy Pancakes", cuisine: "american", difficulty: "beginner", mealTime: ["breakfast"], category: "Breakfast", emoji: "🥞" },
  { id: "teriyaki-chicken-bowl", name: "Teriyaki Chicken Bowl", cuisine: "asian", difficulty: "beginner", mealTime: ["dinner", "lunch"], category: "Chicken", emoji: "🍜" },
  { id: "loaded-quesadilla", name: "Loaded Quesadilla", cuisine: "mexican", difficulty: "beginner", mealTime: ["lunch", "dinner", "snack"], category: "Cheese", emoji: "🫓" },
  { id: "upgraded-ramen", name: "Upgraded Ramen", cuisine: "asian", difficulty: "beginner", mealTime: ["lunch", "dinner", "snack"], category: "Noodles", emoji: "🍜" },
  { id: "philly-cheesesteak", name: "Philly Cheesesteak", cuisine: "american", difficulty: "beginner", mealTime: ["lunch", "dinner"], category: "Beef", emoji: "🥖" },
];
async function seedMusicCooks() {
  const now = new Date().toISOString();
  for (const m of MUSIC_COOKS) {
    const data = JSON.stringify({ id: m.id, title: m.name, emoji: m.emoji, cuisine: m.cuisine, difficulty: m.difficulty, mealTime: m.mealTime, category: m.category, musicSynced: true, isMusicSync: true });
    // Upsert but PRESERVE is_music_sync=1 (idempotent; never clobbered by reseeds).
    await db.run(
      `INSERT INTO recipes (id, name, cuisine, difficulty, meal_time, category, area, instructions, thumbnail, source, est_min, is_music_sync, imported_from, data_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, '', '', '', '', ?, 1, 'authored', ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, cuisine = excluded.cuisine, difficulty = excluded.difficulty,
         meal_time = excluded.meal_time, category = excluded.category, data_json = excluded.data_json,
         is_music_sync = 1, imported_from = 'authored', updated_at = excluded.updated_at`,
      [m.id, m.name, m.cuisine, m.difficulty, JSON.stringify(m.mealTime), m.category, null, data, now]
    );
  }
}

// Add a column only if it doesn't already exist (no portable ADD COLUMN IF NOT
// EXISTS across SQLite + Postgres, so we try and ignore the "duplicate" error).
async function addColumnIfMissing(table: string, col: string, def: string) {
  try {
    await db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  } catch (e: any) {
    if (!/duplicate column|already exists/i.test(String(e?.message || e))) throw e;
  }
}

// Per-100g values for common raw ingredients (USDA-ballpark). Open Food Facts is
// a packaged-product DB and misses produce; this seed gives the proxy good
// coverage for the staples recipes actually use. Approximate, clearly labeled.
const S = (kcal: number, protein: number, fat: number, carbs: number) => ({ kcal, protein, fat, carbs });
const NUTRITION_SEED: Record<string, { kcal: number; protein: number; fat: number; carbs: number }> = {
  // proteins
  egg: S(143, 13, 10, 1), eggs: S(143, 13, 10, 1), "egg yolks": S(322, 16, 27, 4),
  beef: S(250, 26, 15, 0), "ground beef": S(250, 26, 17, 0), steak: S(271, 25, 19, 0), "shredded meat": S(200, 25, 11, 0),
  chicken: S(165, 31, 4, 0), "chicken breast": S(165, 31, 4, 0), "chicken breasts": S(165, 31, 4, 0), "chicken thighs": S(209, 26, 11, 0),
  bacon: S(541, 37, 42, 1), salmon: S(208, 20, 13, 0), squid: S(92, 16, 1, 3),
  "king prawns": S(99, 24, 0, 0), "raw king prawns": S(99, 24, 0, 0),
  // dairy + fats
  milk: S(61, 3, 3, 5), buttermilk: S(40, 3, 1, 5), butter: S(717, 1, 81, 0),
  cheese: S(402, 25, 33, 1), parmesan: S(431, 38, 29, 4), "parmesan cheese": S(431, 38, 29, 4),
  "sour cream": S(198, 2, 19, 4), "heavy cream": S(340, 2, 36, 3), "clotted cream": S(586, 2, 64, 2), cream: S(340, 2, 36, 3),
  "fromage frais": S(160, 8, 8, 4), mayonnaise: S(680, 1, 75, 1), hummus: S(177, 8, 10, 14),
  oil: S(884, 0, 100, 0), "olive oil": S(884, 0, 100, 0), "extra virgin olive oil": S(884, 0, 100, 0),
  "sunflower oil": S(884, 0, 100, 0), "vegetable oil": S(884, 0, 100, 0),
  // grains / starch
  flour: S(364, 10, 1, 76), "plain flour": S(364, 10, 1, 76), "all purpose flour": S(364, 10, 1, 76),
  "buckwheat flour": S(335, 13, 3, 71), "corn flour": S(381, 7, 4, 76), cornstarch: S(381, 0, 0, 91),
  rice: S(365, 7, 1, 80), "paella rice": S(365, 7, 1, 80),
  // pasta/noodles use COOKED per-100g (~157) not dry (~371): recipes list dry
  // weight, but the portion eaten is cooked. (Caveat: cooking adds water, not
  // calories, so on a dry-listed weight this reads lower than true eaten kcal.)
  pasta: S(157, 6, 1, 31), fettuccine: S(157, 6, 1, 31), linguine: S(157, 6, 1, 31),
  "linguine pasta": S(157, 6, 1, 31), spaghetti: S(157, 6, 1, 31), penne: S(157, 6, 1, 31),
  "penne rigate": S(157, 6, 1, 31), macaroni: S(157, 6, 1, 31), rigatoni: S(157, 6, 1, 31),
  tagliatelle: S(157, 6, 1, 31), fusilli: S(157, 6, 1, 31), noodles: S(138, 5, 2, 25), "egg noodles": S(138, 5, 2, 25),
  bread: S(265, 9, 3, 49), buns: S(280, 9, 4, 50), "porridge oats": S(389, 17, 7, 66),
  potato: S(77, 2, 0, 17), potatoes: S(77, 2, 0, 17), "red potatoes": S(77, 2, 0, 17), walnuts: S(654, 15, 65, 14),
  // vegetables
  onion: S(40, 1, 0, 9), "red onions": S(40, 1, 0, 9), challots: S(72, 3, 0, 17),
  garlic: S(149, 6, 1, 33), "garlic clove": S(149, 6, 1, 33), "ginger garlic paste": S(110, 4, 1, 22), ginger: S(80, 2, 1, 18),
  tomato: S(18, 1, 0, 4), tomatoes: S(18, 1, 0, 4), "cherry tomatoes": S(18, 1, 0, 4), "plum tomatoes": S(18, 1, 0, 4),
  "tinned tomatos": S(18, 1, 0, 4), "tomato puree": S(38, 2, 0, 8),
  cabbage: S(25, 1, 0, 6), lettuce: S(15, 1, 0, 3), callaloo: S(30, 3, 0, 5), pumpkin: S(26, 1, 0, 7),
  "egg plants": S(25, 1, 0, 6), eggplant: S(25, 1, 0, 6), aubergine: S(25, 1, 0, 6),
  "red pepper": S(31, 1, 0, 6), "green pepper": S(20, 1, 0, 5), "sugar snap peas": S(42, 3, 0, 7),
  "red chilli": S(40, 2, 0, 9), fennel: S(31, 1, 0, 7), "black olives": S(115, 1, 11, 6), "fried ripe bananas": S(150, 1, 0, 38),
  parsley: S(36, 3, 1, 6), "basil leaves": S(23, 3, 1, 3), basil: S(23, 3, 1, 3), "fresh basil": S(23, 3, 1, 3),
  cilantro: S(23, 2, 0, 4), coriander: S(23, 2, 0, 4), "bay leaf": S(313, 8, 8, 75),
  mint: S(44, 3, 1, 8), dill: S(43, 3, 1, 7), chives: S(30, 3, 1, 4), thyme: S(101, 6, 2, 24), rosemary: S(131, 3, 6, 21),
  // fruit
  lemon: S(29, 1, 0, 9), "lemon juice": S(22, 0, 0, 7), "lemon zest": S(47, 1, 1, 16), lime: S(30, 1, 0, 11),
  // sugars / sweet
  sugar: S(387, 0, 0, 100), "granulated sugar": S(387, 0, 0, 100), "caster sugar": S(387, 0, 0, 100),
  "vanilla sugar": S(390, 0, 0, 99), "icing sugar": S(389, 0, 0, 100), "powdered sugar": S(389, 0, 0, 100),
  "golden syrup": S(300, 0, 0, 79), "maple syrup": S(260, 0, 0, 67), honey: S(304, 0, 0, 82),
  "dulce de leche": S(315, 7, 7, 55), "raspberry jam": S(250, 0, 0, 62),
  "desiccated coconut": S(660, 7, 65, 24), "coconut milk": S(230, 2, 24, 6),
  raspberries: S(52, 1, 1, 12), blueberries: S(57, 1, 0, 14),
  // seasonings / liquids / leaveners (tiny gram amounts, low total impact)
  salt: S(0, 0, 0, 0), "black pepper": S(251, 10, 3, 64), pepper: S(251, 10, 3, 64),
  hotsauce: S(12, 1, 0, 2), "pico de gallo sauce": S(30, 1, 0, 6), "tamarind paste": S(239, 3, 1, 63),
  water: S(0, 0, 0, 0), "white wine": S(82, 0, 0, 3), "beef stock": S(7, 1, 0, 1), "seafood stock": S(7, 1, 0, 1),
  broth: S(7, 1, 0, 1), stock: S(7, 1, 0, 1), "chicken broth": S(7, 1, 0, 1), "vegetable broth": S(7, 1, 0, 1), "chicken stock": S(7, 1, 0, 1),
  yeast: S(105, 40, 2, 41), "baking powder": S(53, 0, 0, 28), "bicarbonate of soda": S(0, 0, 0, 0),
  allspice: S(263, 6, 9, 72), cardamom: S(311, 11, 7, 68), "cayenne pepper": S(318, 12, 17, 57),
  cumin: S(375, 18, 22, 44), "ground cumin": S(375, 18, 22, 44), "curry powder": S(325, 13, 14, 56),
  "garam masala": S(379, 15, 15, 45), nutmeg: S(525, 6, 36, 49), oregano: S(265, 9, 4, 69), paprika: S(282, 14, 13, 54),
  saffron: S(310, 11, 6, 65), turmeric: S(312, 10, 3, 67), "ground turmeric": S(312, 10, 3, 67),
};

async function seedNutrition() {
  const now = new Date().toISOString();
  // Seed is authoritative: upsert so it overwrites any stale/incorrect cached
  // value (e.g. earlier Open Food Facts misses) for these curated ingredients.
  for (const [name, v] of Object.entries(NUTRITION_SEED)) {
    await db.run(
      `INSERT INTO nutrition_cache (ingredient, data_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(ingredient) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`,
      [name, JSON.stringify({ ...v, source: "seed" }), now]
    );
  }
}
