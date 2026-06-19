#!/usr/bin/env python3
"""
SearTune — recipe ingestion from TheMealDB (free, no API key for basic use).

Fetches beginner-friendly recipes across a few categories, maps them to the
SearTune recipe schema (see RECIPE_INGESTION_SPEC.md), splits the prose
instructions into glanceable steps, and writes mvp/recipes.json.

ATTRIBUTION: TheMealDB is free to use *with attribution*. The output carries a
top-level attribution string and per-recipe source/YouTube links; the app shows
these in the UI. Imported recipes are flagged musicSynced:false — they run in
"guided" (tap-through) mode because TheMealDB has no reliable timing data.

Usage:  python3 tools/import_themealdb.py
"""
import json, re, ssl, sys, time, urllib.request
from datetime import datetime, timezone
from pathlib import Path

API = "https://www.themealdb.com/api/json/v1/1"
OUT = Path(__file__).resolve().parent.parent / "mvp" / "recipes.json"

# macOS python.org builds often lack root certs; use certifi if present.
try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    SSL_CTX = ssl._create_unverified_context()  # read-only public API, dev tool

# beginner-friendly categories -> how many to pull from each
CATEGORY_PLAN = {
    "Breakfast": 3,
    "Chicken": 3,
    "Pasta": 3,
    "Beef": 3,
    "Vegetarian": 3,
    "Seafood": 2,
    "Dessert": 3,
}

EMOJI = {
    "Breakfast": "🍳", "Chicken": "🍗", "Pasta": "🍝", "Beef": "🥩",
    "Vegetarian": "🥗", "Vegan": "🌱", "Seafood": "🦐", "Dessert": "🍰",
    "Pork": "🥓", "Lamb": "🍖", "Side": "🥘", "Starter": "🥣",
    "Miscellaneous": "🍽️", "Goat": "🍲", "Lamb ": "🍖",
}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "SearTune-Importer/1.0"})
    with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as r:
        return json.load(r)


def split_steps(instructions: str):
    """Turn a prose instruction blob into short, glanceable steps."""
    text = instructions.replace("\r\n", "\n").replace("\r", "\n")
    # primary split on newlines
    chunks = [c.strip() for c in text.split("\n") if c.strip()]
    if len(chunks) <= 1:
        # fall back to sentence split
        chunks = re.split(r"(?<=[.!?])\s+", text)
    steps = []
    for c in chunks:
        c = re.sub(r"^\s*(STEP\s*\d+[:.)]?|\d+[:.)]|[-*•])\s*", "", c, flags=re.I).strip()
        if not c:
            continue
        # break very long chunks into sentences so cards stay glanceable
        if len(c) > 170:
            for s in re.split(r"(?<=[.!?])\s+", c):
                s = s.strip()
                if s:
                    steps.append(s)
        else:
            steps.append(c)
    # tidy: ensure each ends with punctuation
    return [s if s[-1] in ".!?" else s + "." for s in steps if len(s) > 1]


# ---- conservative timing + safety estimation -----------------------------

UNIT_SEC = {"hour": 3600, "hr": 3600, "minute": 60, "min": 60, "second": 1, "sec": 1}

# base seconds per cooking action when no explicit time is given (conservative)
VERB_SECONDS = [
    ("preheat", 600), ("marinate", 1800), ("refrigerate", 1800), ("chill", 900),
    ("rest", 600), ("cool", 600), ("set aside", 60),
    ("bake", 1500), ("roast", 1500), ("oven", 1500),
    ("simmer", 720), ("boil", 600), ("poach", 600), ("stew", 1500), ("braise", 1800),
    ("deep fry", 480), ("fry", 360), ("saute", 360), ("sauté", 360), ("sweat", 360),
    ("soften", 360), ("brown", 360), ("sear", 300), ("grill", 480), ("cook", 600),
    ("chop", 120), ("slice", 120), ("dice", 120), ("mince", 120), ("grate", 120),
    ("peel", 90), ("cut", 120), ("crush", 60), ("smash", 60),
    ("whisk", 90), ("beat", 90), ("blend", 90), ("mix", 90), ("combine", 90),
    ("stir", 90), ("season", 45), ("toss", 60), ("coat", 90), ("sprinkle", 30),
    ("drain", 45), ("serve", 30), ("garnish", 45), ("plate", 30), ("arrange", 60),
    ("transfer", 45), ("remove", 45),
]

PROTEIN_WORDS = ("chicken", "turkey", "beef", "steak", "pork", "bacon", "sausage",
                 "lamb", "mutton", "goat", "mince", "meat", "fish", "salmon", "cod",
                 "haddock", "tuna", "prawn", "shrimp", "seafood", "egg")

COOK_VERBS = ("cook", "fry", "bake", "grill", "roast", "simmer", "boil", "poach",
              "saute", "sauté", "brown", "sear", "stew", "braise")


def _round_up(sec, step=15):
    return int((sec + step - 1) // step * step)


def parse_explicit_time(text):
    """Largest explicit duration in the text (upper bound of any range), in seconds."""
    best = None
    pat = r"(\d+)(?:\s*(?:-|–|to)\s*(\d+))?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)"
    for n1, n2, unit in re.findall(pat, text, flags=re.I):
        u = unit.lower().rstrip("s")
        u = {"hr": "hr", "min": "min", "sec": "sec", "hour": "hour",
             "minute": "minute", "second": "second"}.get(u, u)
        mult = UNIT_SEC.get(u, 60)
        val = max(int(n1), int(n2) if n2 else 0) * mult  # take upper bound of a range
        best = val if best is None else max(best, val)
    return best


def estimate_seconds(text):
    t = text.lower()
    for verb, sec in VERB_SECONDS:
        if verb in t:
            return sec
    return 150  # default for an unclassified step


def safe_temp(category, text, ingredients):
    """Conservative safe internal temp (F, C) or None if not protein-critical."""
    c = (category or "").lower()
    blob = (text + " " + " ".join(i["name"] for i in ingredients)).lower()
    if "chicken" in c or any(w in blob for w in ("chicken", "turkey", "poultry")):
        return (165, 74)
    if any(w in c for w in ("beef", "pork", "lamb", "goat")) or \
       any(w in blob for w in ("beef", "pork", "lamb", "mince", "sausage", "bacon", "goat", "mutton", "steak", "meat")):
        return (160, 71)  # conservative for ground/mixed meats and beginners
    if "seafood" in c or any(w in blob for w in ("fish", "salmon", "cod", "haddock", "tuna", "prawn", "shrimp")):
        return (145, 63)
    return None


def enrich_steps(raw_steps, category, ingredients):
    has_protein = any(p in (" ".join(i["name"] for i in ingredients) + " " + category).lower()
                      for p in PROTEIN_WORDS)
    out = []
    for s in raw_steps:
        t = s.lower()
        base = parse_explicit_time(s) or estimate_seconds(s)
        typical = _round_up(base * 1.15)          # conservative buffer
        step = {
            "text": s,
            "timing": {"minSec": _round_up(base), "typicalSec": typical, "maxSec": _round_up(base * 1.4)},
            "guide": _human(typical),
            "active": not any(w in t for w in ("rest", "cool", "chill", "refrigerate", "marinate", "set aside")),
        }
        is_cook = any(v in t for v in COOK_VERBS)
        doneness = has_protein and is_cook and (
            "until" in t or any(p in t for p in PROTEIN_WORDS) or "through" in t or "pink" in t
        )
        if doneness:
            temp = safe_temp(category, s, ingredients)
            step["doneness"] = True
            step["safetyCritical"] = True
            if temp:
                f, c = temp
                step["gate"] = {
                    "kind": "confirm",
                    "doneLabel": "Cooked through",
                    "prompt": f"Is it fully cooked? Aim for {f}°F / {c}°C inside.",
                    "safeTempF": f, "safeTempC": c,
                    "notReadyCoach": f"Not yet — keep cooking and check again. It's safe at {f}°F / {c}°C inside. When unsure, cook a little longer; better safe than undercooked.",
                }
            else:
                step["gate"] = {
                    "kind": "confirm",
                    "doneLabel": "Cooked through",
                    "prompt": "Is it fully cooked through (no raw centre)?",
                    "notReadyCoach": "Not yet — give it more time and check again. When in doubt, cook a little longer.",
                }
        out.append(step)
    return out


def _human(sec):
    m, s = divmod(int(sec), 60)
    if m and s:
        return f"~{m}m {s}s"
    if m:
        return f"~{m} min"
    return f"~{s}s"


def ingredients_of(meal):
    out = []
    for i in range(1, 21):
        name = (meal.get(f"strIngredient{i}") or "").strip()
        meas = (meal.get(f"strMeasure{i}") or "").strip()
        if name:
            out.append({"name": name, "measure": meas})
    return out


def map_meal(meal):
    cat = meal.get("strCategory") or "Miscellaneous"
    ings = ingredients_of(meal)
    steps = enrich_steps(split_steps(meal.get("strInstructions") or ""), cat, ings)
    tags = [t.strip() for t in (meal.get("strTags") or "").split(",") if t.strip()]
    active_sec = sum(s["timing"]["typicalSec"] for s in steps)
    return {
        "id": "mealdb-" + meal["idMeal"],
        "source": "TheMealDB",
        "sourceId": meal["idMeal"],
        "title": meal["strMeal"],
        "category": cat,
        "area": meal.get("strArea") or "",
        "emoji": EMOJI.get(cat, "🍽️"),
        "thumb": meal.get("strMealThumb") or "",
        "tags": tags + [t for t in [meal.get("strArea"), cat] if t],
        "ingredients": ings,
        "stepCount": len(steps),
        "estimatedTimeMin": round(active_sec / 60),
        "timingNote": "Times are conservative estimates from TheMealDB text. Doneness steps require confirming a safe internal temperature, not just a timer.",
        "hasSafetyGate": any(s.get("safetyCritical") for s in steps),
        "steps": steps,
        "youtube": meal.get("strYoutube") or "",
        "sourceUrl": meal.get("strSource") or "",
        "musicSynced": False,          # guided tap-through, not a synced cook
        "rightsStatus": "themealdb-attribution",
    }


def main():
    recipes, seen = [], set()
    for cat, n in CATEGORY_PLAN.items():
        try:
            listing = get(f"{API}/filter.php?c={urllib.parse.quote(cat)}") or {}
        except Exception as e:
            print(f"  ! failed to list {cat}: {e}", file=sys.stderr)
            continue
        meals = (listing.get("meals") or [])[: n * 2]  # buffer in case some fail
        added = 0
        for stub in meals:
            if added >= n:
                break
            mid = stub["idMeal"]
            if mid in seen:
                continue
            try:
                full = get(f"{API}/lookup.php?i={mid}")["meals"][0]
            except Exception as e:
                print(f"  ! lookup {mid} failed: {e}", file=sys.stderr)
                continue
            mapped = map_meal(full)
            if mapped["stepCount"] < 2 or not mapped["ingredients"]:
                continue  # skip too-thin records
            recipes.append(mapped)
            seen.add(mid)
            added += 1
            print(f"  + [{cat}] {mapped['title']}  ({mapped['stepCount']} steps)")
            time.sleep(0.15)  # be polite to the free API

    payload = {
        "source": "TheMealDB",
        "attribution": "Recipe data from TheMealDB — https://www.themealdb.com (free, with attribution)",
        "attributionUrl": "https://www.themealdb.com",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "count": len(recipes),
        "recipes": recipes,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"\nWrote {len(recipes)} recipes -> {OUT}")


if __name__ == "__main__":
    import urllib.parse  # noqa: E402 (used in main)
    main()
