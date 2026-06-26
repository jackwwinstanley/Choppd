/* ============================================================
   recipe-map.js — JS port of tools/import_themealdb.py mapping.
   Lets live TheMealDB search results get the SAME conservative
   timing + safe-internal-temp doneness gates as the imported
   catalog. Exposes window.RecipeMap.mapMeal(meal).
   Keep in sync with import_themealdb.py.
   ============================================================ */
(function () {
  "use strict";

  const UNIT_SEC = { hour: 3600, hr: 3600, minute: 60, min: 60, second: 1, sec: 1 };

  const VERB_SECONDS = [
    ["preheat", 600], ["marinate", 1800], ["refrigerate", 1800], ["chill", 900],
    ["rest", 600], ["cool", 600], ["set aside", 60],
    ["bake", 1500], ["roast", 1500], ["oven", 1500],
    ["simmer", 720], ["boil", 600], ["poach", 600], ["stew", 1500], ["braise", 1800],
    ["deep fry", 480], ["fry", 360], ["saute", 360], ["sauté", 360], ["sweat", 360],
    ["soften", 360], ["brown", 360], ["sear", 300], ["grill", 480], ["cook", 600],
    ["chop", 120], ["slice", 120], ["dice", 120], ["mince", 120], ["grate", 120],
    ["peel", 90], ["cut", 120], ["crush", 60], ["smash", 60],
    ["whisk", 90], ["beat", 90], ["blend", 90], ["mix", 90], ["combine", 90],
    ["stir", 90], ["season", 45], ["toss", 60], ["coat", 90], ["sprinkle", 30],
    ["drain", 45], ["serve", 30], ["garnish", 45], ["plate", 30], ["arrange", 60],
    ["transfer", 45], ["remove", 45],
  ];

  const PROTEIN_WORDS = ["chicken", "turkey", "beef", "steak", "pork", "bacon", "sausage",
    "lamb", "mutton", "goat", "mince", "meat", "fish", "salmon", "cod",
    "haddock", "tuna", "prawn", "shrimp", "seafood", "egg"];
  const COOK_VERBS = ["cook", "fry", "bake", "grill", "roast", "simmer", "boil", "poach",
    "saute", "sauté", "brown", "sear", "stew", "braise"];

  const EMOJI = {
    Breakfast: "🍳", Chicken: "🍗", Pasta: "🍝", Beef: "🥩", Vegetarian: "🥗",
    Vegan: "🌱", Seafood: "🦐", Dessert: "🍰", Pork: "🥓", Lamb: "🍖",
    Side: "🥘", Starter: "🥣", Miscellaneous: "🍽️", Goat: "🍲",
  };

  const roundUp = (sec, step = 15) => Math.ceil(sec / step) * step;

  function splitSteps(instructions) {
    const text = (instructions || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    let chunks = text.split("\n").map((c) => c.trim()).filter(Boolean);
    if (chunks.length <= 1) chunks = text.split(/(?<=[.!?])\s+/);
    const steps = [];
    for (let c of chunks) {
      c = c.replace(/^\s*(STEP\s*\d+[:.)]?|\d+[:.)]|[-*•])\s*/i, "").trim();
      if (!c) continue;
      if (c.length > 170) {
        for (let s of c.split(/(?<=[.!?])\s+/)) { s = s.trim(); if (s) steps.push(s); }
      } else steps.push(c);
    }
    return steps.filter((s) => s.length > 1).map((s) => (/[.!?]$/.test(s) ? s : s + "."));
  }

  function parseExplicitTime(text) {
    let best = null;
    const re = /(\d+)(?:\s*(?:-|–|to)\s*(\d+))?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
      let u = m[3].toLowerCase().replace(/s$/, "");
      const mult = UNIT_SEC[u] || 60;
      const val = Math.max(parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) : 0) * mult;
      best = best === null ? val : Math.max(best, val);
    }
    return best;
  }

  function estimateSeconds(text) {
    const t = text.toLowerCase();
    for (const [verb, sec] of VERB_SECONDS) if (t.indexOf(verb) !== -1) return sec;
    return 150;
  }

  function safeTemp(category, text, ingredients) {
    const c = (category || "").toLowerCase();
    const blob = (text + " " + ingredients.map((i) => i.name).join(" ")).toLowerCase();
    const has = (arr) => arr.some((w) => blob.indexOf(w) !== -1);
    if (c.indexOf("chicken") !== -1 || has(["chicken", "turkey", "poultry"])) return [165, 74];
    if (["beef", "pork", "lamb", "goat"].some((w) => c.indexOf(w) !== -1) ||
        has(["beef", "pork", "lamb", "mince", "sausage", "bacon", "goat", "mutton", "steak", "meat"])) return [160, 71];
    if (c.indexOf("seafood") !== -1 || has(["fish", "salmon", "cod", "haddock", "tuna", "prawn", "shrimp"])) return [145, 63];
    return null;
  }

  function human(sec) {
    const m = Math.floor(sec / 60), s = sec % 60;
    if (m && s) return `~${m}m ${s}s`;
    if (m) return `~${m} min`;
    return `~${s}s`;
  }

  function enrichSteps(rawSteps, category, ingredients) {
    const protBlob = (ingredients.map((i) => i.name).join(" ") + " " + category).toLowerCase();
    const hasProtein = PROTEIN_WORDS.some((p) => protBlob.indexOf(p) !== -1);
    return rawSteps.map((s) => {
      const t = s.toLowerCase();
      const base = parseExplicitTime(s) || estimateSeconds(s);
      const typical = roundUp(base * 1.15);
      const step = {
        text: s,
        timing: { minSec: roundUp(base), typicalSec: typical, maxSec: roundUp(base * 1.4) },
        guide: human(typical),
        active: !["rest", "cool", "chill", "refrigerate", "marinate", "set aside"].some((w) => t.indexOf(w) !== -1),
      };
      const isCook = COOK_VERBS.some((v) => t.indexOf(v) !== -1);
      const doneness = hasProtein && isCook &&
        (t.indexOf("until") !== -1 || PROTEIN_WORDS.some((p) => t.indexOf(p) !== -1) || t.indexOf("through") !== -1 || t.indexOf("pink") !== -1);
      if (doneness) {
        step.doneness = true; step.safetyCritical = true;
        const temp = safeTemp(category, s, ingredients);
        if (temp) {
          step.gate = {
            kind: "confirm", doneLabel: "Cooked through",
            prompt: `Is it fully cooked? Aim for ${temp[0]}°F / ${temp[1]}°C inside.`,
            safeTempF: temp[0], safeTempC: temp[1],
            notReadyCoach: `Not yet — keep cooking and check again. It's safe at ${temp[0]}°F / ${temp[1]}°C inside. When unsure, cook a little longer; better safe than undercooked.`,
          };
        } else {
          step.gate = {
            kind: "confirm", doneLabel: "Cooked through",
            prompt: "Is it fully cooked through (no raw centre)?",
            notReadyCoach: "Not yet — give it more time and check again. When in doubt, cook a little longer.",
          };
        }
      }
      return step;
    });
  }

  const HARD_TECH = ["knead", "prove", "proof", "ferment", "temper", "caramel", "deglaze",
    "sous vide", "confit", "laminate", "emulsif", "blind bake", "double boiler", "reduce by", "stiff peak", "overnight"];
  const OPTIONAL_MEASURE = ["to taste", "garnish", "to serve", "for serving", "optional",
    "pinch", "dash", "to decorate", "decoration", "sprinkle", "drizzle"];
  const OPTIONAL_NAMES = ["salt", "black pepper", "white pepper", "ground pepper", "peppercorn",
    "parsley", "coriander", "cilantro", "chives", "dill", "mint", "basil", "oregano", "thyme",
    "rosemary", "paprika", "garnish", "sesame seed", "chilli flakes", "chili flakes",
    "red pepper flakes", "cayenne", "bay lea", "spring onion", "nutmeg"];
  const PEPPER_VEG = ["bell pepper", "red pepper", "green pepper", "yellow pepper", "sweet pepper"];

  function isOptional(name, measure) {
    const n = name.trim().toLowerCase(), m = measure.trim().toLowerCase();
    if (OPTIONAL_MEASURE.some((k) => m.indexOf(k) !== -1)) return true;
    if (PEPPER_VEG.some((v) => n.indexOf(v) !== -1)) return false;
    return OPTIONAL_NAMES.some((k) => n.indexOf(k) !== -1);
  }

  function difficulty(steps, ingredients) {
    const sc = steps.length, ic = ingredients.length;
    const text = steps.map((s) => s.text.toLowerCase()).join(" ");
    const hardTech = HARD_TECH.some((k) => text.indexOf(k) !== -1);
    if (sc >= 15 || ic >= 16 || hardTech) return "hard";
    if (sc <= 8 && ic <= 10) return "easy";
    return "medium";
  }

  // ---- discovery tags: cuisine bucket + meal times --------------------------
  // JS port of cuisine_of / meal_times_of in tools/import_themealdb.py — keep in
  // sync so live search results filter the same way as the pre-imported catalog.
  const AREA_TO_CUISINE = {
    italian: "italian", mexican: "mexican",
    japanese: "japanese", chinese: "other", vietnamese: "other", filipino: "other", malaysian: "other",
    thai: "thai", indian: "indian", bangladeshi: "indian", pakistani: "indian", french: "french",
    greek: "mediterranean", spanish: "mediterranean", turkish: "mediterranean", moroccan: "mediterranean",
    tunisian: "mediterranean", algerian: "mediterranean", egyptian: "mediterranean", croatian: "mediterranean", portuguese: "mediterranean",
    american: "american", "united states": "american", canadian: "american",
  };
  const CUISINE_KEYWORDS = [
    ["indian", ["curry", "biryani", "tandoori", "masala", "dal", "bengali", "paneer", "tikka"]],
    ["italian", ["pasta", "linguine", "spaghetti", "risotto", "pizza", "alfredo", "carbonara", "lasagne", "lasagna", "gnocchi"]],
    ["mexican", ["taco", "enchilada", "pozole", "burrito", "quesadilla", "fajita", "nachos"]],
    ["japanese", ["sushi", "ramen", "tempura", "teriyaki", "miso", "katsu", "udon"]],
    ["thai", ["pad thai", "tom yum", "green curry", "thai"]],
    ["mediterranean", ["hummus", "falafel", "tahini", "halloumi", "tzatziki", "tagine", "couscous"]],
    ["american", ["burger", "bbq", "barbecue", "mac and cheese", "pancake", "cornbread", "meatloaf"]],
  ];
  function cuisineOf(area, category, title) {
    const a = (area || "").trim().toLowerCase();
    if (AREA_TO_CUISINE[a]) return AREA_TO_CUISINE[a];
    const blob = ((title || "") + " " + (category || "")).toLowerCase();
    for (const [bucket, kws] of CUISINE_KEYWORDS) if (kws.some((k) => blob.indexOf(k) !== -1)) return bucket;
    return "other";
  }
  const CATEGORY_MEALTIMES = {
    Breakfast: ["breakfast"], Dessert: ["any"],
    Pasta: ["lunch", "dinner"], Vegetarian: ["lunch", "dinner"], Vegan: ["lunch", "dinner"],
    Side: ["lunch", "dinner"], Starter: ["lunch", "dinner"],
    Beef: ["dinner", "lunch"], Chicken: ["dinner", "lunch"], Seafood: ["dinner", "lunch"], Pork: ["dinner", "lunch"], Lamb: ["dinner"],
  };
  function mealTimesOf(category, title) {
    const mt = CATEGORY_MEALTIMES[(category || "").trim()];
    if (mt) return mt.slice();
    const t = (title || "").toLowerCase();
    if (["breakfast", "pancake", "omelet", "omelette", "smoothie", "oats", "porridge", "toast", "waffle"].some((k) => t.indexOf(k) !== -1)) return ["breakfast"];
    return ["dinner", "lunch"];
  }

  function ingredientsOf(meal) {
    const out = [];
    for (let i = 1; i <= 20; i++) {
      const name = (meal["strIngredient" + i] || "").trim();
      const meas = (meal["strMeasure" + i] || "").trim();
      if (name) out.push({ name, measure: meas, optional: isOptional(name, meas) });
    }
    return out;
  }

  function mapMeal(meal) {
    const cat = meal.strCategory || "Miscellaneous";
    const ings = ingredientsOf(meal);
    const steps = enrichSteps(splitSteps(meal.strInstructions || ""), cat, ings);
    const tags = (meal.strTags || "").split(",").map((t) => t.trim()).filter(Boolean);
    const activeSec = steps.reduce((a, s) => a + s.timing.typicalSec, 0);
    return {
      id: "mealdb-" + meal.idMeal,
      source: "TheMealDB", sourceId: meal.idMeal,
      title: meal.strMeal, category: cat, area: meal.strArea || "",
      emoji: EMOJI[cat] || "🍽️", thumb: meal.strMealThumb || "",
      tags: tags.concat([meal.strArea, cat].filter(Boolean)),
      difficulty: difficulty(steps, ings),
      cuisine: cuisineOf(meal.strArea, cat, meal.strMeal),
      mealTime: mealTimesOf(cat, meal.strMeal),
      ingredients: ings,
      stepCount: steps.length,
      estimatedTimeMin: Math.round(activeSec / 60),
      hasSafetyGate: steps.some((s) => s.safetyCritical),
      steps,
      youtube: meal.strYoutube || "", sourceUrl: meal.strSource || "",
      musicSynced: false, rightsStatus: "themealdb-attribution",
    };
  }

  window.RecipeMap = { mapMeal };
})();
