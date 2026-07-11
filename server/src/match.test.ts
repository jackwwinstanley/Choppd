/* Unit tests for the fridge-scan match engine. Run: npm run test:match */
import { matchRecipes, deriveRequirements, type RecipeReq } from "./match.js";
import { canonicalize, AUTHORED_REQUIREMENTS } from "./scan-data.js";

let pass = 0, fail = 0;
function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; return; }
  fail++; console.error(`✗ ${name}\n   got  ${g}\n   want ${w}`);
}

const reqs: RecipeReq[] = [
  { recipeId: "eggs", required: ["egg", "milk"], optional: [], staplesAssumed: true, totalIngredients: 2 },
  { recipeId: "steak", required: ["steak"], optional: ["garlic", "thyme"], staplesAssumed: true, totalIngredients: 3 },
  { recipeId: "pasta", required: ["pasta", "broth", "heavy_cream", "parmesan", "garlic"], optional: ["basil"], staplesAssumed: true, totalIngredients: 6 },
  { recipeId: "salt_only", required: ["salt"], optional: [], staplesAssumed: true, totalIngredients: 1 },
];

// ---- status boundaries -------------------------------------------------------
{
  const m = matchRecipes(["egg", "milk"], reqs);
  eq("ready: all required present", m.find((x) => x.recipeId === "eggs")!.status, "ready");
  eq("almost: missing 1", m.find((x) => x.recipeId === "steak")!.status, "almost");
  eq("almost boundary carries the list", m.find((x) => x.recipeId === "steak")!.missing, ["steak"]);
  eq("missing: 3+ short", m.find((x) => x.recipeId === "pasta")!.status, "missing");
}
{
  const m = matchRecipes(["pasta", "broth", "heavy_cream"], reqs);
  eq("almost: missing exactly 2", m.find((x) => x.recipeId === "pasta")!.status, "almost");
  eq("missing list is the shopping list", m.find((x) => x.recipeId === "pasta")!.missing, ["parmesan", "garlic"]);
}

// ---- present[] powers the flagship-only scan "one-away" copy ------------------
// ("You've got <present>. You're one <missing> from …"). NOTE: the LIBRARY_VISIBLE
// flag filters the match POOL in scan.ts (imported rows excluded from the reqs
// list) — matchRecipes itself is pool-agnostic, so these cases stay valid whether
// the library is hidden or shown; they just run against a flagship-only reqs list.
{
  const eggs = matchRecipes(["milk"], reqs).find((x) => x.recipeId === "eggs")!;
  eq("one-away status", eggs.status, "almost");
  eq("present = required they HAVE (the 'you've got' list)", eggs.present, ["milk"]);
  eq("missing = the one item to buy", eggs.missing, ["egg"]);
  const stk = matchRecipes(["steak"], reqs).find((x) => x.recipeId === "steak")!;
  eq("ready → present carries the full required set", stk.present, ["steak"]);
}

// ---- staples toggle ----------------------------------------------------------
{
  const on = matchRecipes([], reqs, { assumeStaples: true });
  eq("staples ON satisfies a staple-only recipe", on.find((x) => x.recipeId === "salt_only")!.status, "ready");
  const off = matchRecipes([], reqs, { assumeStaples: false });
  eq("staples OFF leaves it missing", off.find((x) => x.recipeId === "salt_only")!.status, "almost"); // 1 missing
  eq("default is ON", matchRecipes([], reqs).find((x) => x.recipeId === "salt_only")!.status, "ready");
}

// ---- optionalHave -------------------------------------------------------------
{
  const m = matchRecipes(["steak", "garlic"], reqs);
  const s = m.find((x) => x.recipeId === "steak")!;
  eq("ready with optionals reported", [s.status, s.optionalHave], ["ready", ["garlic"]]);
}

// ---- sort order ---------------------------------------------------------------
{
  const m = matchRecipes(["egg", "milk", "steak", "pasta", "broth", "heavy_cream", "parmesan"], reqs);
  eq("ready sorted by fewest total ingredients (quickest win first)",
    m.filter((x) => x.status === "ready").map((x) => x.recipeId), ["salt_only", "eggs", "steak"]);
  eq("then almost by fewest missing", m.filter((x) => x.status === "almost").map((x) => x.recipeId), ["pasta"]);
}
{
  const m = matchRecipes([], reqs, { assumeStaples: false });
  eq("deterministic tie-break by recipeId",
    m.filter((x) => x.missing.length === 1).map((x) => x.recipeId), ["salt_only", "steak"]);
}

// ---- empty input --------------------------------------------------------------
eq("empty everything", matchRecipes([], []), []);
eq("empty detected still ranks (staples ready)", matchRecipes([], reqs)[0].recipeId, "salt_only");

// ---- canonicalize + deriveRequirements ----------------------------------------
eq("alias direct", canonicalize("Chicken Legs"), "chicken_thigh");
eq("alias plural strip", canonicalize("Carrots"), "carrot");
eq("contains-alias", canonicalize("2 large free-range Eggs"), "egg");
eq("staple mapped", canonicalize("Olive Oil"), "cooking_oil");
eq("unknown → null", canonicalize("Dragon fruit foam"), null);
eq("no absurd substring ('boiling' ≠ oil)", canonicalize("boiling"), null);
{
  const r = deriveRequirements("x", [
    { name: "Chicken Legs" }, { name: "Water" }, { name: "Carrots" }, { name: "Leek" }, { name: "Weird Root" },
  ])!;
  eq("staples dropped from required", r.required.includes("water"), false);
  eq("mapped ids present", r.required.slice(0, 3), ["chicken_thigh", "carrot", "leek"]);
  eq("unmapped become ~pseudo ids", r.required.filter((x) => x.startsWith("~")), ["~Weird Root"]);
}
eq(">2 unmapped → excluded", deriveRequirements("x", [{ name: "Foo" }, { name: "Bar" }, { name: "Baz" }, { name: "Egg" }]), null);
eq("authored override wins", deriveRequirements("scrambled-eggs", [])!.required, ["egg", "milk"]);
{
  const r = deriveRequirements("x", [{ name: "Egg" }, { name: "Weird Root" }])!;
  const m = matchRecipes(["egg"], [r]);
  eq("pseudo-id is always missing (honest almost)", [m[0].status, m[0].missing], ["almost", ["~Weird Root"]]);
}

// ═══ ACTIVATION ASSERTION (upgraded-ramen, 2026-07-10): the whole point of the
// activation recipe is ONE required item — a fridge with just a ramen packet must
// say "Cook now" (status "ready"). Exercises the real canonicalize + AUTHORED set.
{
  eq("packet canonicalizes (brand-free alias)", canonicalize("instant noodles"), "instant_ramen");
  eq("packet canonicalizes (ramen packet)", canonicalize("ramen packet"), "instant_ramen");
  const ramenReq = AUTHORED_REQUIREMENTS["upgraded-ramen"];
  eq("ramen has exactly ONE required item (activation design)", ramenReq.required, ["instant_ramen"]);
  const reqs = [{ recipeId: "upgraded-ramen", required: ramenReq.required, optional: ramenReq.optional, staplesAssumed: true, totalIngredients: ramenReq.required.length + ramenReq.optional.length }];
  const packetAlone = matchRecipes(["instant_ramen"], reqs, { assumeStaples: true });
  eq("ACTIVATION: packet alone → Cook now (ready)", packetAlone[0].status, "ready");
  eq("ACTIVATION: packet alone → nothing missing", packetAlone[0].missing, []);
  const raid = matchRecipes(["instant_ramen", "egg", "green_onion", "sriracha"], reqs, { assumeStaples: true });
  eq("fridge-raid extras surface as optionalHave", [raid[0].status, raid[0].optionalHave], ["ready", ["egg", "green_onion", "sriracha"]]);
}

// ═══ PHILLY CHEESESTEAK (2026-07-10): required trio (beef+roll+cheese) → Cook now;
// minus the cheese → Almost, missing exactly cheese_slices. Beef REUSES the `steak` id.
{
  eq("shaved beef canonicalizes to steak (reused id)", canonicalize("shaved beef"), "steak");
  eq("hoagie canonicalizes", canonicalize("sub roll"), "hoagie_roll");
  eq("provolone canonicalizes to cheese_slices (not shredded_cheese)", canonicalize("provolone"), "cheese_slices");
  eq("american cheese still → american_cheese (no cheese_slices alias theft)", canonicalize("american cheese"), "american_cheese");
  eq("mushroom reuses the existing singular id", canonicalize("baby bella"), "mushroom");
  const req = AUTHORED_REQUIREMENTS["philly-cheesesteak"];
  const reqs = [{ recipeId: "philly-cheesesteak", required: req.required, optional: req.optional, staplesAssumed: true, totalIngredients: req.required.length + req.optional.length }];
  const trio = matchRecipes(["steak", "hoagie_roll", "cheese_slices"], reqs, { assumeStaples: true });
  eq("required trio → Cook now (ready)", trio[0].status, "ready");
  const noCheese = matchRecipes(["steak", "hoagie_roll"], reqs, { assumeStaples: true });
  eq("minus cheese → Almost, missing cheese_slices", [noCheese[0].status, noCheese[0].missing], ["almost", ["cheese_slices"]]);
  const witAll = matchRecipes(["steak", "hoagie_roll", "cheese_slices", "onion", "bell_pepper", "mushroom"], reqs, { assumeStaples: true });
  eq("veg surfaces as optionalHave (wit)", [witAll[0].status, witAll[0].optionalHave], ["ready", ["onion", "bell_pepper", "mushroom"]]);
}

// ═══ COOK-NOW GUARANTEE MATRIX (2026-07-08): for every authored recipe, the
// exact required set (+staples) MUST be "ready"; required-minus-one MUST be
// "almost" missing exactly that item. The guarantee is an assertion, not a hope.
let mFail = 0;
for (const [rid, req] of Object.entries(AUTHORED_REQUIREMENTS)) {
  const reqs = [{ recipeId: rid, required: req.required, optional: req.optional, staplesAssumed: true, totalIngredients: req.required.length + req.optional.length }];
  const ready = matchRecipes(req.required, reqs, { assumeStaples: true });
  if (ready[0].status !== "ready") { mFail++; console.error(`✗ ${rid}: exact set → ${ready[0].status}, missing ${ready[0].missing}`); }
  for (let i = 0; i < req.required.length; i++) {
    if (req.required.length === 1) break;
    const minus = req.required.filter((_, j) => j !== i);
    const m = matchRecipes(minus, reqs, { assumeStaples: true });
    if (!(m[0].status === "almost" && m[0].missing.length === 1 && m[0].missing[0] === req.required[i])) {
      mFail++; console.error(`✗ ${rid}: minus ${req.required[i]} → ${m[0].status}/${m[0].missing}`);
    }
  }
}
console.log(mFail ? `cook-now matrix: ${mFail} FAILED` : "cook-now guarantee matrix: all authored recipes ready-on-exact-set, almost-on-minus-one ✓");
fail += mFail;

console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `all ${pass} match tests passed`);
process.exit(fail ? 1 : 0);


