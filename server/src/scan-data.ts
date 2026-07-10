/*
 * Fridge-scan canonical ingredient vocabulary + authored-recipe requirements.
 *
 * FOUNDER REVIEW REQUIRED: this file is the generated DRAFT (Phase A1/A2 of the
 * fridge-scan spec) — ids, aliases, staples and the four authored-recipe
 * mappings are meant to be hand-edited here. IDs are snake_case, singular,
 * brand-free. `staple: true` marks assume-by-default basics that the
 * "I've got the basics" toggle auto-satisfies.
 *
 * The vocabulary is used in three places (single source of truth):
 *   1. the vision prompt (model may ONLY return these ids),
 *   2. the match engine (deriving imported-recipe requirements from their
 *      structured ingredient lists by alias match),
 *   3. the client's add-ingredient autocomplete (served via /api/scan/vocab).
 */

export type VocabCategory = "produce" | "dairy_eggs" | "meat_seafood" | "sauces_condiments" | "pantry" | "frozen" | "drinks";
// category: FOUNDER-PASS DRAFT (2026-07-07) — review like the original vocabulary.
// New-entry template: { id, label, aliases, category } — format-checker asserts it.
export interface VocabEntry { id: string; label: string; aliases: string[]; staple?: boolean; category: VocabCategory }

export const VOCAB: VocabEntry[] = [
  // ---- staples (auto-satisfied when "I've got the basics" is on) ----
  { id: "salt", category: "pantry", label: "Salt", aliases: ["sea salt", "kosher salt", "table salt"], staple: true },
  { id: "black_pepper", category: "pantry", label: "Black pepper", aliases: ["pepper", "peppercorns", "ground pepper"], staple: true },
  { id: "garlic_powder", category: "pantry", label: "Garlic powder", aliases: ["granulated garlic"] },
  { id: "paprika", category: "pantry", label: "Paprika", aliases: ["smoked paprika", "sweet paprika"] },
  { id: "cooking_oil", category: "pantry", label: "Cooking oil", aliases: ["oil", "vegetable oil", "canola oil", "sunflower oil", "avocado oil", "olive oil", "extra virgin olive oil"], staple: true },
  { id: "butter", category: "dairy_eggs", label: "Butter", aliases: ["unsalted butter", "salted butter"], staple: true },
  { id: "water", category: "drinks", label: "Water", aliases: ["cold water", "warm water", "boiling water"], staple: true },

  // ---- proteins ----
  { id: "chicken_breast", category: "meat_seafood", label: "Chicken breast", aliases: ["chicken breasts", "chicken fillet", "chicken fillets"] },
  { id: "chicken_thigh", category: "meat_seafood", label: "Chicken thighs", aliases: ["chicken thighs", "bone-in chicken", "chicken legs", "chicken leg", "chicken drumsticks", "whole chicken", "chicken"] },
  { id: "steak", category: "meat_seafood", label: "Steak", aliases: ["ribeye", "rib-eye", "ny strip", "sirloin", "beef steak", "rump steak", "beef fillet", "shaved beef", "shaved steak", "beef shaved steak", "thin sliced beef", "steak slices"] },   // philly cheesesteak REUSES this id (shaved-beef aliases added)
  { id: "ground_beef", category: "meat_seafood", label: "Ground beef", aliases: ["beef mince", "minced beef", "ground meat", "hamburger meat", "ground chuck", "80/20 beef", "ground hamburger"] },
  { id: "american_cheese", category: "dairy_eggs", label: "American cheese", aliases: ["american cheese slices", "cheese slices", "singles", "sliced cheese"] },
  { id: "beef", category: "meat_seafood", label: "Beef (stew/roast cuts)", aliases: ["beef brisket", "stewing beef", "chuck", "beef shin", "braising steak", "beef ribs"] },
  { id: "pork", category: "meat_seafood", label: "Pork", aliases: ["pork chops", "pork loin", "pork shoulder", "pork belly", "pork tenderloin"] },
  { id: "bacon", category: "meat_seafood", label: "Bacon", aliases: ["streaky bacon", "bacon rashers", "pancetta"] },
  { id: "sausage", category: "meat_seafood", label: "Sausage", aliases: ["sausages", "chorizo", "italian sausage", "bratwurst"] },
  { id: "ham", category: "meat_seafood", label: "Ham", aliases: ["cooked ham", "prosciutto", "deli ham"] },
  { id: "lamb", category: "meat_seafood", label: "Lamb", aliases: ["lamb chops", "lamb shoulder", "lamb leg", "lamb mince", "ground lamb"] },
  { id: "salmon", category: "meat_seafood", label: "Salmon", aliases: ["salmon fillet", "salmon fillets", "smoked salmon"] },
  { id: "white_fish", category: "meat_seafood", label: "White fish", aliases: ["cod", "haddock", "tilapia", "sea bass", "halibut", "fish fillet", "fish fillets", "sardines", "mackerel"] },
  { id: "shrimp", category: "meat_seafood", label: "Shrimp / prawns", aliases: ["prawns", "king prawns", "shrimps"] },
  { id: "tuna", category: "meat_seafood", label: "Tuna (canned)", aliases: ["canned tuna", "tinned tuna"] },
  { id: "egg", category: "dairy_eggs", label: "Eggs", aliases: ["eggs", "free-range eggs", "egg yolk", "egg white", "egg yolks", "egg whites"] },
  { id: "tofu", category: "meat_seafood", label: "Tofu", aliases: ["firm tofu", "silken tofu", "bean curd"] },

  // ---- dairy ----
  { id: "milk", category: "dairy_eggs", label: "Milk", aliases: ["whole milk", "semi-skimmed milk", "skim milk", "2% milk"] },
  { id: "heavy_cream", category: "dairy_eggs", label: "Heavy cream", aliases: ["double cream", "whipping cream", "cream", "single cream"] },
  { id: "parmesan", category: "dairy_eggs", label: "Parmesan", aliases: ["parmigiano", "parmigiano-reggiano", "grana padano", "pecorino"] },
  { id: "cheddar", category: "dairy_eggs", label: "Cheddar / hard cheese", aliases: ["cheddar cheese", "gouda", "gruyere", "monterey jack", "cheese"] },
  { id: "mozzarella", category: "dairy_eggs", label: "Mozzarella", aliases: ["fresh mozzarella", "mozzarella cheese"] },
  { id: "cream_cheese", category: "dairy_eggs", label: "Cream cheese", aliases: ["soft cheese", "mascarpone", "ricotta"] },
  { id: "yogurt", category: "dairy_eggs", label: "Yogurt", aliases: ["greek yogurt", "natural yogurt", "plain yogurt", "yoghurt"] },
  { id: "sour_cream", category: "dairy_eggs", label: "Sour cream", aliases: ["creme fraiche", "crème fraîche"] },

  // ---- vegetables ----
  { id: "onion", category: "produce", label: "Onion", aliases: ["onions", "yellow onion", "red onion", "white onion", "shallot", "shallots"] },
  { id: "garlic", category: "produce", label: "Garlic", aliases: ["garlic cloves", "garlic clove", "minced garlic"] },
  { id: "tomato", category: "produce", label: "Tomatoes", aliases: ["tomatoes", "cherry tomatoes", "plum tomatoes", "vine tomatoes"] },
  { id: "canned_tomato", category: "sauces_condiments", label: "Canned tomatoes", aliases: ["chopped tomatoes", "tinned tomatoes", "tomato passata", "passata", "crushed tomatoes", "tomato puree", "tomato paste"] },
  { id: "carrot", category: "produce", label: "Carrots", aliases: ["carrots", "baby carrots"] },
  { id: "celery", category: "produce", label: "Celery", aliases: ["celery sticks", "celery stalks"] },
  { id: "bell_pepper", category: "produce", label: "Bell pepper", aliases: ["red pepper", "green pepper", "yellow pepper", "capsicum", "peppers", "bell peppers"] },
  { id: "chili", category: "produce", label: "Chili / hot pepper", aliases: ["chilli", "red chili", "jalapeno", "jalapeño", "serrano", "chili flakes", "red pepper flakes"] },
  { id: "mushroom", category: "produce", label: "Mushrooms", aliases: ["mushrooms", "button mushrooms", "chestnut mushrooms", "portobello", "shiitake"] },
  { id: "spinach", category: "produce", label: "Spinach", aliases: ["baby spinach", "frozen spinach"] },
  { id: "lettuce", category: "produce", label: "Lettuce / salad greens", aliases: ["romaine", "iceberg", "mixed salad", "salad leaves", "arugula", "rocket"] },
  { id: "cucumber", category: "produce", label: "Cucumber", aliases: ["cucumbers"] },
  { id: "broccoli", category: "produce", label: "Broccoli", aliases: ["broccoli florets", "tenderstem broccoli", "frozen broccoli"] },
  { id: "cauliflower", category: "produce", label: "Cauliflower", aliases: ["cauliflower florets"] },
  { id: "zucchini", category: "produce", label: "Zucchini / courgette", aliases: ["courgette", "courgettes", "zucchinis"] },
  { id: "eggplant", category: "produce", label: "Eggplant / aubergine", aliases: ["aubergine", "aubergines"] },
  { id: "potato", category: "produce", label: "Potatoes", aliases: ["potatoes", "baby potatoes", "russet", "yukon gold", "new potatoes"] },
  { id: "sweet_potato", category: "produce", label: "Sweet potato", aliases: ["sweet potatoes", "yams"] },
  { id: "peas", category: "frozen", label: "Peas", aliases: ["frozen peas", "garden peas", "petit pois"] },
  { id: "corn", category: "produce", label: "Corn", aliases: ["sweetcorn", "corn on the cob", "canned corn", "frozen corn"] },
  { id: "green_bean", category: "produce", label: "Green beans", aliases: ["green beans", "string beans", "haricots verts"] },
  { id: "cabbage", category: "produce", label: "Cabbage", aliases: ["red cabbage", "savoy cabbage", "napa cabbage"] },
  { id: "leek", category: "produce", label: "Leek", aliases: ["leeks"] },
  { id: "ginger", category: "produce", label: "Ginger", aliases: ["fresh ginger", "ginger root", "grated ginger"] },
  { id: "spring_onion", category: "produce", label: "Spring onions", aliases: ["scallions", "green onions", "green onion", "scallion"] },
  { id: "avocado", category: "produce", label: "Avocado", aliases: ["avocados"] },

  // ---- fruit ----
  { id: "lemon", category: "produce", label: "Lemon", aliases: ["lemons", "lemon juice", "lemon zest"] },
  { id: "lime", category: "produce", label: "Lime", aliases: ["limes", "lime juice"] },
  { id: "apple", category: "produce", label: "Apples", aliases: ["apples", "granny smith"] },
  { id: "banana", category: "produce", label: "Bananas", aliases: ["bananas"] },
  { id: "orange", category: "produce", label: "Oranges", aliases: ["oranges", "orange juice", "orange zest"] },
  { id: "berries", category: "produce", label: "Berries", aliases: ["strawberries", "blueberries", "raspberries", "blackberries", "mixed berries"] },

  // ---- pantry / dry / canned ----
  { id: "pasta", category: "pantry", label: "Pasta", aliases: ["penne", "rigatoni", "fusilli", "spaghetti", "linguine", "farfalle", "rotini", "macaroni", "fettuccine", "noodles", "egg noodles"] },
  { id: "rice", category: "pantry", label: "Rice", aliases: ["basmati", "jasmine rice", "long grain rice", "arborio", "white rice", "brown rice"] },
  { id: "bread", category: "pantry", label: "Bread", aliases: ["sliced bread", "baguette", "sourdough", "buns", "rolls", "pita", "naan"] },
  { id: "tortilla", category: "pantry", label: "Tortillas / wraps", aliases: ["tortillas", "wraps", "flour tortillas", "corn tortillas"] },
  { id: "flour", category: "pantry", label: "Flour", aliases: ["all-purpose flour", "plain flour", "self-raising flour", "bread flour"] },
  { id: "sugar", category: "pantry", label: "Sugar", aliases: ["granulated sugar", "caster sugar", "icing sugar", "powdered sugar"] },   // "brown sugar" moved to its own brown_sugar id (teriyaki) so it scores distinctly from white sugar
  { id: "broth", category: "sauces_condiments", label: "Broth / stock", aliases: ["chicken broth", "chicken stock", "beef stock", "vegetable stock", "vegetable broth", "stock cube", "bouillon", "bouillon cube"] },
  { id: "beans", category: "pantry", label: "Beans (canned/dry)", aliases: ["black beans", "kidney beans", "cannellini", "pinto beans", "baked beans", "butter beans"] },
  { id: "chickpeas", category: "pantry", label: "Chickpeas", aliases: ["garbanzo beans", "canned chickpeas"] },
  { id: "lentils", category: "pantry", label: "Lentils", aliases: ["red lentils", "green lentils", "puy lentils"] },
  { id: "coconut_milk", category: "pantry", label: "Coconut milk", aliases: ["coconut cream", "canned coconut milk"] },
  { id: "soy_sauce", category: "sauces_condiments", label: "Soy sauce", aliases: ["tamari", "light soy sauce", "dark soy sauce"] },
  { id: "vinegar", category: "sauces_condiments", label: "Vinegar", aliases: ["white vinegar", "apple cider vinegar", "balsamic", "balsamic vinegar", "rice vinegar", "red wine vinegar"] },
  { id: "honey", category: "sauces_condiments", label: "Honey", aliases: ["runny honey"] },   // "maple syrup" moved to its own maple_syrup id (pancakes topping) so it scores distinctly
  { id: "mustard", category: "sauces_condiments", label: "Mustard", aliases: ["dijon", "dijon mustard", "wholegrain mustard", "yellow mustard"] },
  { id: "mayonnaise", category: "sauces_condiments", label: "Mayonnaise", aliases: ["mayo"] },
  { id: "ketchup", category: "sauces_condiments", label: "Ketchup", aliases: ["tomato ketchup"] },
  { id: "pickle", category: "sauces_condiments", label: "Pickles", aliases: ["dill pickles", "pickle chips", "pickle slices", "gherkins"] },
  { id: "curry_paste", category: "sauces_condiments", label: "Curry paste / powder", aliases: ["curry powder", "red curry paste", "green curry paste", "garam masala", "tikka paste"] },
  { id: "burger_bun", category: "pantry", label: "Burger buns", aliases: ["hamburger buns", "buns", "brioche buns", "potato rolls", "burger rolls"] },
  { id: "oats", category: "pantry", label: "Oats", aliases: ["rolled oats", "porridge oats", "oatmeal"] },
  { id: "nuts", category: "pantry", label: "Nuts", aliases: ["almonds", "walnuts", "cashews", "peanuts", "pine nuts", "pecans"] },
  { id: "peanut_butter", category: "pantry", label: "Peanut butter", aliases: ["nut butter", "almond butter"] },
  { id: "chocolate", category: "pantry", label: "Chocolate", aliases: ["dark chocolate", "chocolate chips", "milk chocolate", "cocoa powder", "cocoa"] },

  // ---- herbs (fresh) ----
  { id: "basil", category: "produce", label: "Basil", aliases: ["fresh basil", "basil leaves"] },
  { id: "parsley", category: "produce", label: "Parsley", aliases: ["fresh parsley", "flat-leaf parsley"] },
  { id: "cilantro", category: "produce", label: "Cilantro / coriander", aliases: ["coriander", "fresh coriander", "coriander leaves"] },
  { id: "thyme", category: "produce", label: "Thyme", aliases: ["fresh thyme", "thyme sprigs"] },
  { id: "rosemary", category: "produce", label: "Rosemary", aliases: ["fresh rosemary"] },
];

// Fast lookup: every alias + label + id (lowercased) → id
const ALIAS_INDEX = new Map<string, string>();
// Chicken Fried Rice additions (2026-07): soy_sauce already existed — reused.
VOCAB.push(
  { id: "cooked_rice", category: "pantry", label: "Cooked rice", aliases: ["rice", "leftover rice", "day-old rice", "white rice", "brown rice", "cooked white rice", "steamed rice", "microwave rice"] },
  { id: "frozen_peas_carrots", category: "produce", label: "Frozen peas & carrots", aliases: ["peas and carrots", "frozen peas and carrots", "peas & carrots", "mixed veg", "frozen mixed vegetables", "frozen vegetables"] },
  { id: "green_onion", category: "produce", label: "Green onions", aliases: ["green onion", "scallions", "spring onions", "scallion"] },
  { id: "sesame_oil", category: "pantry", label: "Sesame oil", aliases: ["toasted sesame oil", "sesame oil"] },
  { id: "sriracha", category: "pantry", label: "Sriracha", aliases: ["sriracha", "hot sauce", "chili sauce"] },
  // ground beef tacos (ground_beef, tortilla, lettuce, tomato, onion already exist)
  { id: "taco_seasoning", category: "sauces_condiments", label: "Taco seasoning", aliases: ["taco seasoning", "taco seasoning packet", "taco mix", "seasoning packet"] },
  { id: "chili_powder", category: "sauces_condiments", label: "Chili powder", aliases: ["chili powder", "chilli powder"] },
  { id: "cumin", category: "sauces_condiments", label: "Cumin", aliases: ["cumin", "ground cumin", "cumin powder"] },
  { id: "tomato_paste", category: "pantry", label: "Tomato paste", aliases: ["tomato paste", "tomato puree", "tomato concentrate"] },
  { id: "shredded_cheese", category: "dairy_eggs", label: "Shredded cheese", aliases: ["shredded cheese", "cheddar", "mexican blend cheese", "shredded cheddar", "grated cheese", "monterey jack", "colby jack", "pepper jack"] },
  { id: "oregano", category: "pantry", label: "Oregano", aliases: ["oregano", "dried oregano", "oregano leaves"] },
  // pancakes (flour, sugar, egg, milk, butter already exist). baking_powder must NOT alias
  // "baking soda" — they're chemically different and swapping them ruins the recipe.
  { id: "baking_powder", category: "pantry", label: "Baking powder", aliases: ["baking powder", "raising agent"] },
  { id: "vanilla", category: "pantry", label: "Vanilla", aliases: ["vanilla", "vanilla extract", "vanilla essence"] },
  { id: "maple_syrup", category: "sauces_condiments", label: "Maple syrup", aliases: ["maple syrup", "pancake syrup"] },
  // teriyaki chicken bowl (chicken_breast, cooked_rice, soy_sauce, garlic, sesame_oil, green_onion,
  // vinegar, broccoli, honey already exist). brown_sugar is DISTINCT from white sugar (see above).
  { id: "brown_sugar", category: "pantry", label: "Brown sugar", aliases: ["brown sugar", "light brown sugar", "dark brown sugar", "demerara"] },
  { id: "cornstarch", category: "pantry", label: "Cornstarch", aliases: ["cornstarch", "corn starch", "cornflour", "corn flour"] },
  { id: "ground_ginger", category: "sauces_condiments", label: "Ginger", aliases: ["ground ginger", "ginger", "fresh ginger", "ginger powder"] },
  // loaded quesadilla (tortilla, shredded_cheese, ground_beef already exist — REUSE `tortilla` rather
  // than a new flour_tortilla id, which would collide with tortilla's "flour tortillas" alias).
  { id: "cooked_chicken", category: "meat_seafood", label: "Cooked chicken", aliases: ["cooked chicken", "leftover chicken", "rotisserie chicken", "grilled chicken", "shredded chicken"] },
  { id: "salsa", category: "sauces_condiments", label: "Salsa", aliases: ["salsa", "pico de gallo", "taco sauce"] },
  { id: "guacamole", category: "sauces_condiments", label: "Guacamole", aliases: ["guacamole", "guac"] },
  // upgraded ramen (egg, garlic, green_onion, frozen_peas_carrots, soy_sauce, brown_sugar, sriracha
  // all exist). ONE new vocab id — brand-free per the standing rule (no Maruchan/Nissin/Shin).
  { id: "instant_ramen", category: "pantry", label: "Instant ramen", aliases: ["instant ramen", "ramen", "ramen noodles", "instant noodles", "ramen packet", "cup noodles", "noodle packet"] },
  // philly cheesesteak (beef REUSES `steak` above; onion + bell_pepper already exist). THREE new ids.
  // cheese_slices is deliberately DISTINCT from shredded_cheese — different form factor, different recipe.
  { id: "hoagie_roll", category: "pantry", label: "Hoagie rolls", aliases: ["hoagie roll", "hoagie", "sub roll", "hero roll", "sandwich roll", "long roll", "baguette"] },
  { id: "cheese_slices", category: "dairy_eggs", label: "Cheese slices", aliases: ["provolone", "cheese slices", "sliced cheese", "white american", "american cheese", "swiss cheese slices"] },
  { id: "mushrooms", category: "produce", label: "Mushrooms", aliases: ["mushrooms", "baby bella", "cremini", "button mushrooms", "sliced mushrooms"] },
);

for (const v of VOCAB) {
  ALIAS_INDEX.set(v.id.replace(/_/g, " "), v.id);
  ALIAS_INDEX.set(v.label.toLowerCase(), v.id);
  for (const a of v.aliases) ALIAS_INDEX.set(a.toLowerCase(), v.id);
}
export const STAPLE_IDS = new Set(VOCAB.filter((v) => v.staple).map((v) => v.id));
export const VOCAB_IDS = new Set(VOCAB.map((v) => v.id));

/** Map a free-text ingredient name to a canonical id, or null. Tries the exact
 * lowercased name, a naive singular, and a contains-alias pass (longest first). */
const SORTED_ALIASES = [...ALIAS_INDEX.keys()].sort((a, b) => b.length - a.length);
export function canonicalize(name: string): string | null {
  const n = String(name || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-zà-ÿ\- ]+/g, " ").replace(/\s+/g, " ").trim();
  if (!n) return null;
  const direct = ALIAS_INDEX.get(n) || ALIAS_INDEX.get(n.replace(/s$/, "")) || ALIAS_INDEX.get(n.replace(/es$/, ""));
  if (direct) return direct;
  for (const a of SORTED_ALIASES) {
    if (a.length < 4) continue;   // avoid absurd substring hits ("oil" in "boiling")
    if (new RegExp(`(^| )${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(n)) return ALIAS_INDEX.get(a)!;
  }
  return null;
}

/*
 * Curated requirements for the 4 authored music cooks (their structured
 * ingredient lists live client-side in cues.js, so the required/optional split
 * is hand-authored here — FOUNDER REVIEW, keep in sync when recipes change).
 * `required`/`optional` are vocabulary ids; staples (salt/pepper/oil/butter/
 * water) ride the staples toggle instead of being listed.
 */
export const AUTHORED_REQUIREMENTS: Record<string, { required: string[]; optional: string[] }> = {
  "freebird-medium-rare-steak": { required: ["steak"], optional: ["garlic", "thyme"] },
  "scrambled-eggs": { required: ["egg", "milk"], optional: [] },
  // broth moved to OPTIONAL (cook-now guarantee audit 2026-07-08): the water+butter
  // liquid path cooks the recipe with staples only, so broth can't gate readiness.
  "one-pot-garlic-parmesan-pasta": { required: ["pasta", "heavy_cream", "parmesan", "garlic"], optional: ["broth", "basil", "chicken_breast", "peas"] },
  "crispy-chicken-thighs": { required: ["chicken_thigh"], optional: ["garlic_powder", "paprika"] },
  "smash-burgers": { required: ["ground_beef", "burger_bun", "american_cheese"], optional: ["pickle", "lettuce", "tomato", "onion", "mayonnaise", "mustard"] },
  "chicken-fried-rice": { required: ["chicken_breast", "cooked_rice", "egg", "soy_sauce"], optional: ["frozen_peas_carrots", "green_onion", "garlic", "sesame_oil", "sriracha"] },
  // required = the two the dish can't exist without (beef + something to hold it); seasoning is
  // OPTIONAL in scan terms (salt/pepper alone technically cooks it) so it surfaces as "almost".
  "ground-beef-tacos": { required: ["ground_beef", "tortilla"], optional: ["taco_seasoning", "chili_powder", "cumin", "garlic_powder", "paprika", "oregano", "tomato_paste", "shredded_cheese", "lettuce", "tomato", "onion"] },
  // required = the four the batter can't exist without (flour + leavening + egg + milk); sugar/
  // vanilla are flavor, maple_syrup is a topping → OPTIONAL so it surfaces as "almost". butter is a
  // staple (rides the basics toggle, like the eggs pan-fat) so it's NOT listed here.
  "pancakes": { required: ["flour", "baking_powder", "egg", "milk"], optional: ["sugar", "vanilla", "maple_syrup"] },
  // required = teriyaki can't exist without the protein + starch + the sweet-soy-thickener trio
  // (chicken + rice + soy + brown sugar + cornstarch). honey subs for brown sugar (a fridge with
  // honey-but-no-brown-sugar surfaces as "almost" — honest: one sub note away). Everything else optional.
  "teriyaki-chicken-bowl": { required: ["chicken_breast", "cooked_rice", "soy_sauce", "brown_sugar", "cornstarch"], optional: ["vinegar", "garlic", "ground_ginger", "broccoli", "honey", "sesame_oil", "green_onion"] },
  // required = the two a quesadilla can't exist without (tortilla + cheese); butter is a staple.
  // protein + dips are the "loaded" extras → optional (a fridge with just tortillas + cheese cooks it).
  "loaded-quesadilla": { required: ["tortilla", "shredded_cheese"], optional: ["cooked_chicken", "ground_beef", "salsa", "guacamole"] },
  // THE ACTIVATION RECIPE — one required item by design: any fridge with a ramen packet gets
  // "Cook now." Everything else is a fridge-raid bonus → optional (butter/water ride staples).
  "upgraded-ramen": { required: ["instant_ramen"], optional: ["egg", "garlic", "green_onion", "frozen_peas_carrots", "soy_sauce", "brown_sugar", "sriracha"] },
  // required = the three a cheesesteak can't exist without (beef + roll + cheese). beef REUSES `steak`.
  // Veg is the "wit" — optional (a witout cheesesteak is legit). Butter/oil ride staples.
  "philly-cheesesteak": { required: ["steak", "hoagie_roll", "cheese_slices"], optional: ["onion", "bell_pepper", "mushrooms"] },
};
