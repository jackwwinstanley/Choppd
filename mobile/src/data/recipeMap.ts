// JS→TS port of mvp/recipe-map.js — maps a live TheMealDB meal to a guided
// recipe with conservative timing + safe-internal-temp doneness gates.

export type Ingredient = { name: string; measure: string; optional: boolean };
export type RGate = { kind: "confirm"; doneLabel: string; prompt: string; safeTempF?: number; safeTempC?: number; notReadyCoach: string };
export type RStep = {
  text: string;
  timing: { minSec: number; typicalSec: number; maxSec: number };
  guide: string;
  active: boolean;
  doneness?: boolean;
  safetyCritical?: boolean;
  gate?: RGate;
};
export type Recipe = {
  id: string; source: "TheMealDB"; title: string; category: string; area: string;
  emoji: string; thumb: string; difficulty: "easy" | "medium" | "hard";
  ingredients: Ingredient[]; stepCount: number; estimatedTimeMin: number;
  hasSafetyGate: boolean; steps: RStep[]; youtube: string; sourceUrl: string;
};

const UNIT_SEC: Record<string, number> = { hour: 3600, hr: 3600, minute: 60, min: 60, second: 1, sec: 1 };
const VERB_SECONDS: [string, number][] = [
  ["preheat", 600], ["marinate", 1800], ["refrigerate", 1800], ["chill", 900], ["rest", 600], ["cool", 600], ["set aside", 60],
  ["bake", 1500], ["roast", 1500], ["oven", 1500], ["simmer", 720], ["boil", 600], ["poach", 600], ["stew", 1500], ["braise", 1800],
  ["deep fry", 480], ["fry", 360], ["saute", 360], ["sauté", 360], ["sweat", 360], ["soften", 360], ["brown", 360], ["sear", 300], ["grill", 480], ["cook", 600],
  ["chop", 120], ["slice", 120], ["dice", 120], ["mince", 120], ["grate", 120], ["peel", 90], ["cut", 120], ["crush", 60], ["smash", 60],
  ["whisk", 90], ["beat", 90], ["blend", 90], ["mix", 90], ["combine", 90], ["stir", 90], ["season", 45], ["toss", 60], ["coat", 90], ["sprinkle", 30],
  ["drain", 45], ["serve", 30], ["garnish", 45], ["plate", 30], ["arrange", 60], ["transfer", 45], ["remove", 45],
];
const PROTEIN = ["chicken", "turkey", "beef", "steak", "pork", "bacon", "sausage", "lamb", "mutton", "goat", "mince", "meat", "fish", "salmon", "cod", "haddock", "tuna", "prawn", "shrimp", "seafood", "egg"];
const COOK_VERBS = ["cook", "fry", "bake", "grill", "roast", "simmer", "boil", "poach", "saute", "sauté", "brown", "sear", "stew", "braise"];
const HARD_TECH = ["knead", "prove", "proof", "ferment", "temper", "caramel", "deglaze", "sous vide", "confit", "laminate", "emulsif", "blind bake", "double boiler", "reduce by", "stiff peak", "overnight"];
const OPT_MEASURE = ["to taste", "garnish", "to serve", "for serving", "optional", "pinch", "dash", "to decorate", "decoration", "sprinkle", "drizzle"];
const OPT_NAMES = ["salt", "black pepper", "white pepper", "ground pepper", "peppercorn", "parsley", "coriander", "cilantro", "chives", "dill", "mint", "basil", "oregano", "thyme", "rosemary", "paprika", "garnish", "sesame seed", "chilli flakes", "chili flakes", "red pepper flakes", "cayenne", "bay lea", "spring onion", "nutmeg"];
const PEPPER_VEG = ["bell pepper", "red pepper", "green pepper", "yellow pepper", "sweet pepper"];
const EMOJI: Record<string, string> = { Breakfast: "🍳", Chicken: "🍗", Pasta: "🍝", Beef: "🥩", Vegetarian: "🥗", Vegan: "🌱", Seafood: "🦐", Dessert: "🍰", Pork: "🥓", Lamb: "🍖", Side: "🥘", Starter: "🥣", Miscellaneous: "🍽️", Goat: "🍲" };

const roundUp = (s: number, step = 15) => Math.ceil(s / step) * step;
const human = (s: number) => { const m = Math.floor(s / 60), x = s % 60; return m && x ? `~${m}m ${x}s` : m ? `~${m} min` : `~${x}s`; };

// sentence split without lookbehind (Hermes-safe)
function sentences(s: string): string[] {
  const out: string[] = [];
  const re = /[^.!?]*[.!?]+|\S[^.!?]*$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) { const t = m[0].trim(); if (t) out.push(t); }
  return out.length ? out : [s.trim()];
}
function splitSteps(text: string): string[] {
  const t = (text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let chunks = t.split("\n").map((c) => c.trim()).filter(Boolean);
  if (chunks.length <= 1) chunks = sentences(t);
  const out: string[] = [];
  for (let c of chunks) {
    c = c.replace(/^\s*(STEP\s*\d+[:.)]?|\d+[:.)]|[-*•])\s*/i, "").trim();
    if (!c) continue;
    if (c.length > 170) for (const s of sentences(c)) { const x = s.trim(); if (x) out.push(x); }
    else out.push(c);
  }
  return out.filter((s) => s.length > 1).map((s) => (/[.!?]$/.test(s) ? s : s + "."));
}
function parseTime(text: string): number | null {
  let best: number | null = null;
  const re = /(\d+)(?:\s*(?:-|–|to)\s*(\d+))?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const u = m[3].toLowerCase().replace(/s$/, "");
    const mult = UNIT_SEC[u] || 60;
    best = Math.max(best ?? 0, Math.max(parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) : 0) * mult);
  }
  return best;
}
function estimate(text: string): number { const t = text.toLowerCase(); for (const [v, s] of VERB_SECONDS) if (t.includes(v)) return s; return 150; }
function safeTemp(cat: string, text: string, ings: Ingredient[]): [number, number] | null {
  const c = (cat || "").toLowerCase();
  const blob = (text + " " + ings.map((i) => i.name).join(" ")).toLowerCase();
  const has = (a: string[]) => a.some((w) => blob.includes(w));
  if (c.includes("chicken") || has(["chicken", "turkey", "poultry"])) return [165, 74];
  if (["beef", "pork", "lamb", "goat"].some((w) => c.includes(w)) || has(["beef", "pork", "lamb", "mince", "sausage", "bacon", "goat", "mutton", "steak", "meat"])) return [160, 71];
  if (c.includes("seafood") || has(["fish", "salmon", "cod", "haddock", "tuna", "prawn", "shrimp"])) return [145, 63];
  return null;
}
function isOptional(name: string, measure: string): boolean {
  const n = name.trim().toLowerCase(), m = measure.trim().toLowerCase();
  if (OPT_MEASURE.some((k) => m.includes(k))) return true;
  if (PEPPER_VEG.some((v) => n.includes(v))) return false;
  return OPT_NAMES.some((k) => n.includes(k));
}
function difficulty(steps: RStep[], ings: Ingredient[]): Recipe["difficulty"] {
  const sc = steps.length, ic = ings.length;
  const text = steps.map((s) => s.text.toLowerCase()).join(" ");
  if (sc >= 15 || ic >= 16 || HARD_TECH.some((k) => text.includes(k))) return "hard";
  if (sc <= 8 && ic <= 10) return "easy";
  return "medium";
}
function ingredientsOf(meal: any): Ingredient[] {
  const out: Ingredient[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal["strIngredient" + i] || "").trim();
    const meas = (meal["strMeasure" + i] || "").trim();
    if (name) out.push({ name, measure: meas, optional: isOptional(name, meas) });
  }
  return out;
}
function enrich(raw: string[], cat: string, ings: Ingredient[]): RStep[] {
  const protBlob = (ings.map((i) => i.name).join(" ") + " " + cat).toLowerCase();
  const hasProtein = PROTEIN.some((p) => protBlob.includes(p));
  return raw.map((s) => {
    const t = s.toLowerCase();
    const base = parseTime(s) ?? estimate(s);
    const typicalSec = roundUp(base * 1.15);
    const step: RStep = {
      text: s, timing: { minSec: roundUp(base), typicalSec, maxSec: roundUp(base * 1.4) }, guide: human(typicalSec),
      active: !["rest", "cool", "chill", "refrigerate", "marinate", "set aside"].some((w) => t.includes(w)),
    };
    const isCook = COOK_VERBS.some((v) => t.includes(v));
    if (hasProtein && isCook && (t.includes("until") || PROTEIN.some((p) => t.includes(p)) || t.includes("through") || t.includes("pink"))) {
      step.doneness = true; step.safetyCritical = true;
      const temp = safeTemp(cat, s, ings);
      step.gate = temp
        ? { kind: "confirm", doneLabel: "Cooked through", prompt: `Is it fully cooked? Aim for ${temp[0]}°F / ${temp[1]}°C inside.`, safeTempF: temp[0], safeTempC: temp[1], notReadyCoach: `Not yet — keep cooking and check again. Safe at ${temp[0]}°F / ${temp[1]}°C. When unsure, cook a little longer.` }
        : { kind: "confirm", doneLabel: "Cooked through", prompt: "Is it fully cooked through (no raw centre)?", notReadyCoach: "Not yet — give it more time and check again." };
    }
    return step;
  });
}

export function mapMeal(meal: any): Recipe {
  const cat = meal.strCategory || "Miscellaneous";
  const ings = ingredientsOf(meal);
  const steps = enrich(splitSteps(meal.strInstructions || ""), cat, ings);
  const activeSec = steps.reduce((a, s) => a + s.timing.typicalSec, 0);
  return {
    id: "mealdb-" + meal.idMeal, source: "TheMealDB", title: meal.strMeal, category: cat, area: meal.strArea || "",
    emoji: EMOJI[cat] || "🍽️", thumb: meal.strMealThumb || "", difficulty: difficulty(steps, ings),
    ingredients: ings, stepCount: steps.length, estimatedTimeMin: Math.round(activeSec / 60),
    hasSafetyGate: steps.some((s) => s.safetyCritical), steps, youtube: meal.strYoutube || "", sourceUrl: meal.strSource || "",
  };
}

export const ATTRIBUTION = "Recipe data from TheMealDB — themealdb.com";
export async function searchMeals(q: string): Promise<Recipe[]> {
  const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(q)}`);
  const data = await res.json();
  return (data.meals || []).map(mapMeal).filter((r: Recipe) => r.stepCount >= 1);
}
