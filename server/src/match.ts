/*
 * Fridge-scan match engine — PURE, no I/O, fully unit-tested (match.test.ts).
 * The server is the single source of truth for matching; the client only
 * renders what this returns.
 */
import { canonicalize, STAPLE_IDS, AUTHORED_REQUIREMENTS } from "./scan-data.js";

export interface RecipeReq {
  recipeId: string;
  required: string[];        // canonical ids (plus "~name" pseudo-ids for unmapped items)
  optional: string[];
  staplesAssumed: boolean;
  totalIngredients: number;  // for the "quickest win on top" sort
}

export interface MatchResult {
  recipeId: string;
  status: "ready" | "almost" | "missing";
  missing: string[];         // canonical ids / "~name" labels the cook still needs
  present: string[];         // required ids the cook ALREADY has (the "you've got …" copy)
  optionalHave: string[];
}

/**
 * Derive a RecipeReq from an imported recipe's structured ingredient list
 * (TheMealDB rows: [{ name, measure, optional }]). Unmapped non-staple
 * ingredients become "~<name>" pseudo-ids — always missing (they keep the
 * recipe honest in "almost" lists and read naturally as shopping items).
 * Recipes with more than 2 unmapped ingredients return null: we can't assess
 * them reliably, so they're excluded from scan results entirely (v1 rule).
 */
export function deriveRequirements(recipeId: string, ingredients: Array<{ name: string; optional?: boolean }>): RecipeReq | null {
  const authored = AUTHORED_REQUIREMENTS[recipeId];
  if (authored) {
    return {
      recipeId,
      required: authored.required,
      optional: authored.optional,
      staplesAssumed: true,
      totalIngredients: authored.required.length + authored.optional.length,
    };
  }
  const required: string[] = [];
  const optional: string[] = [];
  let unmapped = 0;
  for (const ing of ingredients || []) {
    const id = canonicalize(ing.name);
    if (id && STAPLE_IDS.has(id)) continue;                 // staples ride the toggle
    const bucket = ing.optional ? optional : required;
    if (id) { if (!bucket.includes(id)) bucket.push(id); }
    else if (!ing.optional) {
      unmapped++;
      if (unmapped > 2) return null;                        // too fuzzy to assess
      const label = "~" + String(ing.name || "").trim();
      if (!bucket.includes(label)) bucket.push(label);
    }
  }
  if (!required.length) return null;                        // nothing assessable
  return { recipeId, required, optional, staplesAssumed: true, totalIngredients: required.length + optional.length };
}

/**
 * matchRecipes(detectedIds, recipeReqs, { assumeStaples }) →
 *   ready   = all required present (staples auto-satisfied when the toggle is on)
 *   almost  = missing 1–2 required
 *   missing = missing 3+
 * Sort: ready first (fewest total ingredients — quickest win on top),
 * then almost (fewest missing). Deterministic (ties by recipeId).
 */
export function matchRecipes(
  detectedIds: string[],
  recipeReqs: RecipeReq[],
  opts: { assumeStaples?: boolean } = {}
): MatchResult[] {
  const assume = opts.assumeStaples !== false;   // default ON
  const have = new Set(detectedIds || []);
  if (assume) for (const s of STAPLE_IDS) have.add(s);

  const results: MatchResult[] = [];
  for (const r of recipeReqs || []) {
    const missing = r.required.filter((id) => !have.has(id));
    const present = r.required.filter((id) => have.has(id));
    const optionalHave = r.optional.filter((id) => have.has(id));
    const status: MatchResult["status"] = missing.length === 0 ? "ready" : missing.length <= 2 ? "almost" : "missing";
    results.push({ recipeId: r.recipeId, status, missing, present, optionalHave });
  }

  const order = { ready: 0, almost: 1, missing: 2 } as const;
  const totals = new Map(recipeReqs.map((r) => [r.recipeId, r.totalIngredients]));
  results.sort((a, b) => {
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    if (a.status === "ready") {
      const t = (totals.get(a.recipeId) || 0) - (totals.get(b.recipeId) || 0);
      if (t) return t;
    } else {
      const d = a.missing.length - b.missing.length;
      if (d) return d;
    }
    return a.recipeId < b.recipeId ? -1 : 1;
  });
  return results;
}
