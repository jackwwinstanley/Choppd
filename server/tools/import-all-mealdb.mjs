#!/usr/bin/env node
/*
 * Bulk-import the ENTIRE TheMealDB catalog into our `recipes` table so the
 * search filters run against the whole DB, not the static 20-recipe file.
 *
 *   cd ~/sizle/server && node tools/import-all-mealdb.mjs
 *
 * TheMealDB has no "all" endpoint, so we page by first letter (a–z), 300ms
 * apart. Each meal is tagged with cuisine / difficulty / mealTime by REUSING
 * the exact browser mapper (mvp/recipe-map.js) via a VM shim — one source of
 * truth for the derivation. Rows are upserted by id; our hand-crafted music
 * cooks (is_music_sync=1) are never overwritten. Logs added/updated/skipped.
 *
 * Runs against whatever the server is configured for: RDS Postgres when
 * DATABASE_URL is set (production), else local SQLite.
 */
import "dotenv/config";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initDb, db, migrate } from "../dist/db.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Reuse the browser recipe mapper in Node by running it in a window-shim sandbox.
function loadMapMeal() {
  const code = readFileSync(join(HERE, "../../mvp/recipe-map.js"), "utf8");
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  if (!sandbox.window.RecipeMap || !sandbox.window.RecipeMap.mapMeal) throw new Error("recipe-map.js did not expose window.RecipeMap.mapMeal");
  return sandbox.window.RecipeMap.mapMeal;
}

async function fetchLetter(ch) {
  try {
    const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?f=${ch}`);
    const data = await res.json();
    return data.meals || []; // null when a letter has no meals → []
  } catch (e) {
    console.error(`  ! fetch '${ch}' failed: ${e.message}`);
    return [];
  }
}

async function upsertRecipe(mapMeal, meal) {
  const m = mapMeal(meal);
  const id = m.id; // "mealdb-<idMeal>"
  // Never clobber a hand-crafted music cook.
  const existing = await db.get("SELECT is_music_sync FROM recipes WHERE id = ?", [id]);
  if (existing && Number(existing.is_music_sync) === 1) return "skipped";

  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO recipes (id, name, cuisine, difficulty, meal_time, category, area, instructions, thumbnail, source, est_min, is_music_sync, imported_from, data_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'mealdb', ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, cuisine = excluded.cuisine, difficulty = excluded.difficulty,
       meal_time = excluded.meal_time, category = excluded.category, area = excluded.area, instructions = excluded.instructions,
       thumbnail = excluded.thumbnail, source = excluded.source, est_min = excluded.est_min, data_json = excluded.data_json,
       updated_at = excluded.updated_at
     WHERE recipes.is_music_sync = 0`,
    [id, m.title, m.cuisine, m.difficulty, JSON.stringify(m.mealTime), m.category, m.area || "",
     meal.strInstructions || "", m.thumb || "", m.sourceUrl || "", m.estimatedTimeMin || null, JSON.stringify(m), now]
  );
  return existing ? "updated" : "added";
}

async function main() {
  await initDb();
  await migrate(); // ensures the recipes table + music-cook seed exist
  const mapMeal = loadMapMeal();

  const counts = { added: 0, updated: 0, skipped: 0 };
  const letters = "abcdefghijklmnopqrstuvwxyz".split("");
  console.log("Importing TheMealDB a–z …");
  for (const ch of letters) {
    const meals = await fetchLetter(ch);
    for (const meal of meals) {
      try { counts[await upsertRecipe(mapMeal, meal)]++; }
      catch (e) { console.error(`  ! upsert ${meal.idMeal} (${meal.strMeal}) failed: ${e.message}`); }
    }
    process.stdout.write(`  ${ch}:${meals.length} `);
    await sleep(300); // be polite to the free API
  }
  console.log("\n");

  // ---- report ----
  const [tot] = await db.all("SELECT count(*) AS n FROM recipes WHERE is_music_sync = 0");
  const [music] = await db.all("SELECT count(*) AS n FROM recipes WHERE is_music_sync = 1");
  console.log(`RESULT  added ${counts.added} · updated ${counts.updated} · skipped(music) ${counts.skipped}`);
  console.log(`Imported recipes in table: ${Number(tot.n)}   ·   music-sync rows preserved: ${Number(music.n)}`);
  console.log("\nBreakdown (cuisine × difficulty):");
  const rows = await db.all(
    "SELECT cuisine, difficulty, count(*) AS n FROM recipes WHERE is_music_sync = 0 GROUP BY cuisine, difficulty ORDER BY n DESC"
  );
  for (const r of rows) console.log(`  ${String(r.cuisine).padEnd(14)} ${String(r.difficulty).padEnd(14)} ${Number(r.n)}`);
  console.log("\nMusic cooks (should be 4, is_music_sync=1):");
  for (const r of await db.all("SELECT name, cuisine, difficulty FROM recipes WHERE is_music_sync = 1 ORDER BY name")) {
    console.log(`  ✓ ${String(r.name).padEnd(26)} ${r.cuisine} / ${r.difficulty}`);
  }
  process.exit(0);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
