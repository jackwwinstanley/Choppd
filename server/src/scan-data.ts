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

export interface VocabEntry { id: string; label: string; aliases: string[]; staple?: boolean }

export const VOCAB: VocabEntry[] = [
  // ---- staples (auto-satisfied when "I've got the basics" is on) ----
  { id: "salt", label: "Salt", aliases: ["sea salt", "kosher salt", "table salt"], staple: true },
  { id: "black_pepper", label: "Black pepper", aliases: ["pepper", "peppercorns", "ground pepper"], staple: true },
  { id: "cooking_oil", label: "Cooking oil", aliases: ["oil", "vegetable oil", "canola oil", "sunflower oil", "avocado oil", "olive oil", "extra virgin olive oil"], staple: true },
  { id: "butter", label: "Butter", aliases: ["unsalted butter", "salted butter"], staple: true },
  { id: "water", label: "Water", aliases: ["cold water", "warm water", "boiling water"], staple: true },

  // ---- proteins ----
  { id: "chicken_breast", label: "Chicken breast", aliases: ["chicken breasts", "chicken fillet", "chicken fillets"] },
  { id: "chicken_thigh", label: "Chicken thighs", aliases: ["chicken thighs", "bone-in chicken", "chicken legs", "chicken leg", "chicken drumsticks", "whole chicken", "chicken"] },
  { id: "steak", label: "Steak", aliases: ["ribeye", "rib-eye", "ny strip", "sirloin", "beef steak", "rump steak", "beef fillet"] },
  { id: "ground_beef", label: "Ground beef", aliases: ["beef mince", "minced beef", "ground meat", "hamburger meat"] },
  { id: "beef", label: "Beef (stew/roast cuts)", aliases: ["beef brisket", "stewing beef", "chuck", "beef shin", "braising steak", "beef ribs"] },
  { id: "pork", label: "Pork", aliases: ["pork chops", "pork loin", "pork shoulder", "pork belly", "pork tenderloin"] },
  { id: "bacon", label: "Bacon", aliases: ["streaky bacon", "bacon rashers", "pancetta"] },
  { id: "sausage", label: "Sausage", aliases: ["sausages", "chorizo", "italian sausage", "bratwurst"] },
  { id: "ham", label: "Ham", aliases: ["cooked ham", "prosciutto", "deli ham"] },
  { id: "lamb", label: "Lamb", aliases: ["lamb chops", "lamb shoulder", "lamb leg", "lamb mince", "ground lamb"] },
  { id: "salmon", label: "Salmon", aliases: ["salmon fillet", "salmon fillets", "smoked salmon"] },
  { id: "white_fish", label: "White fish", aliases: ["cod", "haddock", "tilapia", "sea bass", "halibut", "fish fillet", "fish fillets", "sardines", "mackerel"] },
  { id: "shrimp", label: "Shrimp / prawns", aliases: ["prawns", "king prawns", "shrimps"] },
  { id: "tuna", label: "Tuna (canned)", aliases: ["canned tuna", "tinned tuna"] },
  { id: "egg", label: "Eggs", aliases: ["eggs", "free-range eggs", "egg yolk", "egg white", "egg yolks", "egg whites"] },
  { id: "tofu", label: "Tofu", aliases: ["firm tofu", "silken tofu", "bean curd"] },

  // ---- dairy ----
  { id: "milk", label: "Milk", aliases: ["whole milk", "semi-skimmed milk", "skim milk", "2% milk"] },
  { id: "heavy_cream", label: "Heavy cream", aliases: ["double cream", "whipping cream", "cream", "single cream"] },
  { id: "parmesan", label: "Parmesan", aliases: ["parmigiano", "parmigiano-reggiano", "grana padano", "pecorino"] },
  { id: "cheddar", label: "Cheddar / hard cheese", aliases: ["cheddar cheese", "gouda", "gruyere", "monterey jack", "cheese"] },
  { id: "mozzarella", label: "Mozzarella", aliases: ["fresh mozzarella", "mozzarella cheese"] },
  { id: "cream_cheese", label: "Cream cheese", aliases: ["soft cheese", "mascarpone", "ricotta"] },
  { id: "yogurt", label: "Yogurt", aliases: ["greek yogurt", "natural yogurt", "plain yogurt", "yoghurt"] },
  { id: "sour_cream", label: "Sour cream", aliases: ["creme fraiche", "crème fraîche"] },

  // ---- vegetables ----
  { id: "onion", label: "Onion", aliases: ["onions", "yellow onion", "red onion", "white onion", "shallot", "shallots"] },
  { id: "garlic", label: "Garlic", aliases: ["garlic cloves", "garlic clove", "minced garlic"] },
  { id: "tomato", label: "Tomatoes", aliases: ["tomatoes", "cherry tomatoes", "plum tomatoes", "vine tomatoes"] },
  { id: "canned_tomato", label: "Canned tomatoes", aliases: ["chopped tomatoes", "tinned tomatoes", "tomato passata", "passata", "crushed tomatoes", "tomato puree", "tomato paste"] },
  { id: "carrot", label: "Carrots", aliases: ["carrots", "baby carrots"] },
  { id: "celery", label: "Celery", aliases: ["celery sticks", "celery stalks"] },
  { id: "bell_pepper", label: "Bell pepper", aliases: ["red pepper", "green pepper", "yellow pepper", "capsicum", "peppers", "bell peppers"] },
  { id: "chili", label: "Chili / hot pepper", aliases: ["chilli", "red chili", "jalapeno", "jalapeño", "serrano", "chili flakes", "red pepper flakes"] },
  { id: "mushroom", label: "Mushrooms", aliases: ["mushrooms", "button mushrooms", "chestnut mushrooms", "portobello", "shiitake"] },
  { id: "spinach", label: "Spinach", aliases: ["baby spinach", "frozen spinach"] },
  { id: "lettuce", label: "Lettuce / salad greens", aliases: ["romaine", "iceberg", "mixed salad", "salad leaves", "arugula", "rocket"] },
  { id: "cucumber", label: "Cucumber", aliases: ["cucumbers"] },
  { id: "broccoli", label: "Broccoli", aliases: ["broccoli florets", "tenderstem broccoli"] },
  { id: "cauliflower", label: "Cauliflower", aliases: ["cauliflower florets"] },
  { id: "zucchini", label: "Zucchini / courgette", aliases: ["courgette", "courgettes", "zucchinis"] },
  { id: "eggplant", label: "Eggplant / aubergine", aliases: ["aubergine", "aubergines"] },
  { id: "potato", label: "Potatoes", aliases: ["potatoes", "baby potatoes", "russet", "yukon gold", "new potatoes"] },
  { id: "sweet_potato", label: "Sweet potato", aliases: ["sweet potatoes", "yams"] },
  { id: "peas", label: "Peas", aliases: ["frozen peas", "garden peas", "petit pois"] },
  { id: "corn", label: "Corn", aliases: ["sweetcorn", "corn on the cob", "canned corn", "frozen corn"] },
  { id: "green_bean", label: "Green beans", aliases: ["green beans", "string beans", "haricots verts"] },
  { id: "cabbage", label: "Cabbage", aliases: ["red cabbage", "savoy cabbage", "napa cabbage"] },
  { id: "leek", label: "Leek", aliases: ["leeks"] },
  { id: "ginger", label: "Ginger", aliases: ["fresh ginger", "ginger root", "grated ginger"] },
  { id: "spring_onion", label: "Spring onions", aliases: ["scallions", "green onions", "green onion", "scallion"] },
  { id: "avocado", label: "Avocado", aliases: ["avocados"] },

  // ---- fruit ----
  { id: "lemon", label: "Lemon", aliases: ["lemons", "lemon juice", "lemon zest"] },
  { id: "lime", label: "Lime", aliases: ["limes", "lime juice"] },
  { id: "apple", label: "Apples", aliases: ["apples", "granny smith"] },
  { id: "banana", label: "Bananas", aliases: ["bananas"] },
  { id: "orange", label: "Oranges", aliases: ["oranges", "orange juice", "orange zest"] },
  { id: "berries", label: "Berries", aliases: ["strawberries", "blueberries", "raspberries", "blackberries", "mixed berries"] },

  // ---- pantry / dry / canned ----
  { id: "pasta", label: "Pasta", aliases: ["penne", "rigatoni", "fusilli", "spaghetti", "linguine", "farfalle", "rotini", "macaroni", "fettuccine", "noodles", "egg noodles"] },
  { id: "rice", label: "Rice", aliases: ["basmati", "jasmine rice", "long grain rice", "arborio", "white rice", "brown rice"] },
  { id: "bread", label: "Bread", aliases: ["sliced bread", "baguette", "sourdough", "buns", "rolls", "pita", "naan"] },
  { id: "tortilla", label: "Tortillas / wraps", aliases: ["tortillas", "wraps", "flour tortillas", "corn tortillas"] },
  { id: "flour", label: "Flour", aliases: ["all-purpose flour", "plain flour", "self-raising flour", "bread flour"] },
  { id: "sugar", label: "Sugar", aliases: ["granulated sugar", "caster sugar", "brown sugar", "icing sugar", "powdered sugar"] },
  { id: "broth", label: "Broth / stock", aliases: ["chicken broth", "chicken stock", "beef stock", "vegetable stock", "vegetable broth", "stock cube", "bouillon", "bouillon cube"] },
  { id: "beans", label: "Beans (canned/dry)", aliases: ["black beans", "kidney beans", "cannellini", "pinto beans", "baked beans", "butter beans"] },
  { id: "chickpeas", label: "Chickpeas", aliases: ["garbanzo beans", "canned chickpeas"] },
  { id: "lentils", label: "Lentils", aliases: ["red lentils", "green lentils", "puy lentils"] },
  { id: "coconut_milk", label: "Coconut milk", aliases: ["coconut cream", "canned coconut milk"] },
  { id: "soy_sauce", label: "Soy sauce", aliases: ["tamari", "light soy sauce", "dark soy sauce"] },
  { id: "vinegar", label: "Vinegar", aliases: ["white vinegar", "apple cider vinegar", "balsamic", "balsamic vinegar", "rice vinegar", "red wine vinegar"] },
  { id: "honey", label: "Honey", aliases: ["runny honey", "maple syrup"] },
  { id: "mustard", label: "Mustard", aliases: ["dijon", "dijon mustard", "wholegrain mustard", "yellow mustard"] },
  { id: "mayonnaise", label: "Mayonnaise", aliases: ["mayo"] },
  { id: "ketchup", label: "Ketchup", aliases: ["tomato ketchup"] },
  { id: "curry_paste", label: "Curry paste / powder", aliases: ["curry powder", "red curry paste", "green curry paste", "garam masala", "tikka paste"] },
  { id: "oats", label: "Oats", aliases: ["rolled oats", "porridge oats", "oatmeal"] },
  { id: "nuts", label: "Nuts", aliases: ["almonds", "walnuts", "cashews", "peanuts", "pine nuts", "pecans"] },
  { id: "peanut_butter", label: "Peanut butter", aliases: ["nut butter", "almond butter"] },
  { id: "chocolate", label: "Chocolate", aliases: ["dark chocolate", "chocolate chips", "milk chocolate", "cocoa powder", "cocoa"] },

  // ---- herbs (fresh) ----
  { id: "basil", label: "Basil", aliases: ["fresh basil", "basil leaves"] },
  { id: "parsley", label: "Parsley", aliases: ["fresh parsley", "flat-leaf parsley"] },
  { id: "cilantro", label: "Cilantro / coriander", aliases: ["coriander", "fresh coriander", "coriander leaves"] },
  { id: "thyme", label: "Thyme", aliases: ["fresh thyme", "thyme sprigs"] },
  { id: "rosemary", label: "Rosemary", aliases: ["fresh rosemary"] },
];

// Fast lookup: every alias + label + id (lowercased) → id
const ALIAS_INDEX = new Map<string, string>();
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
  "one-pot-garlic-parmesan-pasta": { required: ["pasta", "broth", "heavy_cream", "parmesan", "garlic"], optional: ["basil", "chicken_breast", "peas"] },
  "crispy-chicken-thighs": { required: ["chicken_thigh"], optional: ["garlic", "thyme"] },
};
