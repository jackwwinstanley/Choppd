/*
 * SKILL GRAPH — the server-authoritative crediting map (the graduation system,
 * Phase 1: dark instrumentation). Design + rationale: docs/design/skill-graduation.md.
 *
 * ANTI-TAMPER (design §5): the client sends ONLY { recipeId, gatesConfirmed } on a
 * completed cook — never skillIds. The server owns which skills a recipe evidences
 * (this table), so a client can't forge its own competence. The flagship recipes'
 * cue ladders live only in mvp/cues.js; this map is the crediting projection of the
 * founder-audit table (design §9) — the machine form of the DRAFT tags pending
 * sign-off. Correcting a tag later is a one-line edit here; since skill_events is
 * append-only and pre-tester data is dev-only noise, no history is rewritten.
 *
 * CREDIT RULES (design §2, implemented in skills.ts):
 *  - A COMPLETED cook credits +1 to each skill in `skills` (rows written on the
 *    receipts-POST completion hook). Abandoned cooks post nothing.
 *  - Gate-bearing skills (`gated` — the doc names `searing` + `doneness`) only
 *    credit when the cook's gate was CONFIRMED. Flagship completion structurally
 *    requires every gate (gates block advancement), so gatesConfirmed is true on
 *    any genuine finish; the check stays for correctness + the both-directions test.
 *
 * METHOD/OPT PRECISION (design flag F11): Phase 1 credits the UNION by recipeId
 * (method-agnostic). The client knows cookMethod + optionals, so method-precise
 * crediting is a one-field refinement (POST carries `method`) if the founder wants it.
 */

export type SkillId =
  | "heat_control"
  | "searing"
  | "doneness"
  | "knife_basics"
  | "seasoning"
  | "pan_sauces"
  | "egg_cookery"
  | "multitasking"
  | "batch_rhythm"
  | "boil_craft";

export interface RecipeSkillTags {
  skills: SkillId[];        // every skill a completed cook evidences (the union)
  gated: SkillId[];         // subset that only credits on a confirmed gate (⊆ skills)
}

// The §9 founder-audit table, in code. `gated` mirrors credit-rule 2 (searing +
// doneness). Flags (F#) are the design-doc §9 ambiguities — resolved there, not here.
export const SKILL_TAGS: Record<string, RecipeSkillTags> = {
  // Founder-audited + signed off (2026-07-11). Deltas from draft: steak −seasoning
  // (plain pre-sear salt, not technique — F12 narrow); pancakes −egg_cookery (batter
  // is a step, not egg technique — F12 logic, overriding the §2 illustrative example);
  // fried-rice +multitasking (component in/out/recombine = the philly/teriyaki
  // sequencing skill). Every remaining tag survives the "technique-not-step" test.
  "freebird-medium-rare-steak": { skills: ["heat_control", "searing", "doneness"], gated: ["searing", "doneness"] },
  "scrambled-eggs":             { skills: ["heat_control", "egg_cookery", "doneness"], gated: ["doneness"] },
  "one-pot-garlic-parmesan-pasta": { skills: ["boil_craft", "pan_sauces", "doneness", "seasoning"], gated: ["doneness"] },
  "crispy-chicken-thighs":      { skills: ["heat_control", "searing", "doneness"], gated: ["searing", "doneness"] },
  "smash-burgers":              { skills: ["searing", "doneness", "batch_rhythm"], gated: ["searing", "doneness"] },
  "chicken-fried-rice":         { skills: ["searing", "heat_control", "doneness", "knife_basics", "egg_cookery", "seasoning", "multitasking"], gated: ["searing", "doneness"] },
  "ground-beef-tacos":          { skills: ["heat_control", "doneness", "seasoning", "pan_sauces", "knife_basics"], gated: ["doneness"] },
  "pancakes":                   { skills: ["heat_control", "doneness", "batch_rhythm"], gated: ["doneness"] },
  "teriyaki-chicken-bowl":      { skills: ["heat_control", "searing", "doneness", "knife_basics", "pan_sauces", "multitasking"], gated: ["searing", "doneness"] },
  "loaded-quesadilla":          { skills: ["heat_control", "doneness"], gated: ["doneness"] },
  "upgraded-ramen":             { skills: ["heat_control", "boil_craft", "pan_sauces", "egg_cookery", "doneness"], gated: ["doneness"] },
  "philly-cheesesteak":         { skills: ["heat_control", "searing", "knife_basics", "seasoning", "doneness", "multitasking"], gated: ["searing", "doneness"] },
};

// Resolve a completed cook into the rows to write: one per evidenced skill, with
// gate_confirmed decided per credit-rule 2. Unknown recipe → [] (writes nothing).
export function creditRows(recipeId: string, gatesConfirmed: boolean): { skillId: SkillId; gateConfirmed: boolean }[] {
  const tags = SKILL_TAGS[recipeId];
  if (!tags) return [];
  const gatedSet = new Set(tags.gated);
  return tags.skills.map((skillId) => ({
    skillId,
    // gate-bearing skills inherit the cook's gate status; non-gated skills always credit
    gateConfirmed: gatedSet.has(skillId) ? gatesConfirmed : true,
  }));
}
