/*
 * Free Bird (Lynyrd Skynyrd) -> Medium-Rare Steak
 * Hand-authored cue timeline (matches PLAN.md cue schema).
 *
 * Each cue:
 *   at        seconds from the moment "play" starts (cue clock = playback position)
 *   type      prep | action | flip | baste | rest | temp | tip | finish
 *   title     short headline for the big step card
 *   body      experienced-cook copy (terse)
 *   beginner  beginner copy (reassuring, explains why) — shown when isBeginner = true
 *   voice     what the voice prompt speaks (ducked over the music)
 *   haptic    null | "tap" | "double" | "strong"
 */
window.FREEBIRD_STEAK = {
  id: "freebird-medium-rare-steak",
  // youtubeId: official video for the free-tier embed. VERIFY/replace with the exact ID.
  song: { title: "Free Bird", artist: "Lynyrd Skynyrd", spotifyQuery: "Free Bird Lynyrd Skynyrd", youtubeId: "0LwcvjNJTuM", audioFile: "audio/steak-music.mp3", audioCredit: "Music: Alex-Productions (royalty-free)" },
  recipe: { title: "Medium-Rare Steak", technique: "Pan Sear", doneness: "Medium-rare", emoji: "🥩" },
  heroImage: "assets/recipes/steak/hero.jpg", // optional beauty shot (browse card + prep overview); separate from per-cue referenceImage
  // Optional pre-cook reminder (steak only): a 30-min walk-away timer for the room-temp rest.
  restReminder: { minutes: 30, label: "Let the steak come to room temp", tip: "Take it out of the fridge ~30 min before cooking so it sears evenly.", done: "Steak's at room temp 🔥 — let's sear it." },
  equipmentNeeded: ["Cast iron or stainless pan", "Tongs", "Paper towels", "Cutting board & knife", "Instant-read thermometer (optional)"],
  // Two cooking methods. "pan" inherits the cues/prep/optionalGroups defined below
  // (the default). "grill" carries its own: the long preheat lives in prep, side 1
  // runs longer, no butter baste, and optional 45° rotations for crosshatch marks.
  methods: [
    { id: "pan", label: "Pan-sear", emoji: "🍳", technique: "Pan Sear" },
    {
      id: "grill", label: "Grill", emoji: "🔥", technique: "Grill",
      prep: [
        "Best with a 1-inch-plus steak — ribeye or NY strip are forgiving for beginners.",
        "Pull the steak out 30 min early so it comes to room temperature.",
        "Pat it bone-dry and season generously with salt (and pepper) on both sides.",
        "Preheat the grill 10–15 min with the lid down until the grates are screaming hot (gas: high; charcoal: coals ashed-over and glowing).",
        "Build a 2-zone fire: one hot direct side, one cooler side to dodge flare-ups.",
        "Oil the grates right before cooking; keep tongs and a board ready.",
      ],
      optionalGroups: [
        { id: "grillMarks", emoji: "🔥", label: "Crosshatch grill marks", note: "Rotate the steak 45° partway through each side for diamond marks." },
      ],
      cues: [
        { at: 0, type: "tip", title: "Grates screaming hot", heat: "high",
          body: "Grill's preheated. Oil the grates — we cook over direct high heat.",
          beginner: "Your grill should be ripping hot after that 10–15 minute preheat. Fold a paper towel, dip it in oil, and swipe the grates with your tongs. We'll cook over the hot, direct-heat zone.",
          voice: "Grill's hot. Oil the grates, and get ready to lay the steak over direct heat.", haptic: "tap" },
        { at: 20, type: "action", title: "Lay it over direct heat", heat: "high",
          body: "Onto the hot zone, away from you. Then walk away — it doesn't need babysitting.",
          beginner: "Lay the steak onto the hottest part of the grill, setting it down away from you. Now leave it alone — moving it stops the sear marks from forming. Lid up for a steak this thick.",
          voice: "Lay the steak over the hot zone, away from you. Now don't touch it.", haptic: "double" },
        { at: 130, type: "action", title: "Quarter-turn for marks", heat: "high", opt: "grillMarks",
          body: "Rotate 45° on the SAME side for crosshatch marks.",
          beginner: "About halfway through this side, give the steak a 45-degree turn — keep it on the same face — to lay a second set of bars and get that diamond crosshatch.",
          voice: "Rotate the steak forty-five degrees, same side, for crosshatch marks.", haptic: "tap" },
        { at: 200, type: "tip", title: "Flare-up? Slide it", heat: "high",
          body: "Flames from dripping fat — slide to the cool zone, then back.",
          beginner: "If flames lick up (dripping fat causes flare-ups), slide the steak to the cooler side for a few seconds until they die down, then move it back. That cool zone is your escape valve on a grill.",
          voice: "If it flares up, slide it to the cooler side for a moment, then back.", haptic: null },
        { at: 240, type: "flip", title: "Flip it — once", heat: "high",
          body: "Side one deep-marked? One clean flip onto the hot zone.",
          beginner: "Lift a corner — side one should have deep, dark grill marks. Flip it once back onto the hot zone. Still pale? Give it another 30 to 60 seconds.",
          voice: "Time to flip. If side one's deeply marked, flip it once.", haptic: "strong",
          gate: { kind: "confirm", doneLabel: "I flipped it", notReadyCoach: "No rush — another 30 to 60 seconds for deep marks. Slide it off direct heat if it's charring, then flip.", checkCoach: "How are the marks? Tap “I flipped it” once it's over.", doneCoach: "Nice — second side searing now.", nudgeSec: 45 } },
        { at: 340, type: "action", title: "Quarter-turn again", heat: "high", opt: "grillMarks",
          body: "Rotate 45° on side two for matching marks.",
          beginner: "Same move on this side — a 45-degree turn partway through for a matching crosshatch.",
          voice: "Give it another forty-five-degree turn for marks on this side.", haptic: "tap" },
        { at: 410, type: "action", title: "Off the grill",
          body: "Pull at 125–130°F — it climbs while resting.",
          beginner: "Move the steak onto a board now — pull it about 5°F before target, around 125 to 130°F. It keeps cooking off the grill and climbs to a perfect medium-rare as it rests.",
          voice: "Take the steak off onto a board — pull it about five degrees early, around a hundred and twenty-five.", haptic: "double" },
        { at: 420, type: "temp", title: "Temp check 🌡️",
          body: "~125–130°F now → 130–135°F (medium-rare) after resting.",
          beginner: "On a thermometer the middle should read about 125 to 130°F (52–54°C) now — it climbs to 130 to 135°F, medium-rare, as it rests. No thermometer? Pressed in the center it should feel soft with a little spring, like the base of your thumb.",
          voice: "Aim for about a hundred and twenty-five to a hundred and thirty now — it rises to medium-rare as it rests.", haptic: "tap",
          gate: { kind: "confirm", doneLabel: "It's there", notReadyCoach: "Almost — back over direct heat for 30 to 60 seconds, then check again. You're close.", checkCoach: "Check again — tap “It's there” once it's around 125 to 130.", doneCoach: "Perfect — now it rests and climbs to medium-rare.", nudgeSec: 30 } },
        { at: 435, type: "rest", title: "Let it REST",
          body: "Rest 5+ minutes — do NOT cut yet.",
          beginner: "This is the step beginners skip: do NOT cut into it yet. Let it rest at least 5 minutes (tent loosely with foil) so the juices settle back in. Cut early and they spill onto the board, leaving the steak dry.",
          voice: "Now let it rest — at least five minutes. Don't cut into it; that's what keeps it juicy.", haptic: "strong",
          warning: "Cut in early and the juices bleed out — you'll get a grey, dry steak. Give it the full 5 minutes." },
        { at: 460, type: "baste", title: "Cowboy butter finish 🧈", opt: "cowboy butter",
          body: "Spoon warm cowboy butter over the rested steak — or serve it alongside.",
          beginner: "Optional level-up: melt butter with minced garlic, herbs, a squeeze of lemon and a pinch of chili, then spoon it over the rested steak — or serve on the side. Big flavor, no risk.",
          voice: "Spoon the cowboy butter over the rested steak, or serve it alongside.", haptic: "tap" },
        { at: 470, type: "finish", title: "Slice & serve 🎸",
          referenceImage: ["assets/recipes/steak/slice.jpg", "assets/recipes/steak/plate.jpg"], referenceImageFadeMs: 1800,
          body: "Slice against the grain. You grilled a medium-rare steak.",
          beginner: "Rest is done! Slice it against the grain — across the lines in the meat — for tender bites. You just grilled a medium-rare steak to Free Bird. Nice work.",
          voice: "Rest's done. Slice it against the grain and enjoy — you grilled a perfect medium-rare steak.", haptic: "double",
          custom: { beginner: "Rest is done! Slice it against the grain for tender bites. You just grilled a medium-rare steak to your own soundtrack. Nice work." } },
      ],
    },
  ],
  ingredients: [
    { name: "steak", measure: "1 (1-inch+)", noInline: true },
    { name: "oil", measure: "1 tbsp" },
    { name: "butter", measure: "2 tbsp" },
    { name: "garlic", measure: "3 cloves" },
    { name: "salt", measure: "to taste" },     // required — every steak needs seasoning
    { name: "pepper", measure: "to taste" },   // required
    { name: "thyme", measure: "3 sprigs", optional: true },
    // optional "level it up" finish — default OFF (defaultOff); checking it also unlocks the cowboy-butter cue (opt:"cowboy butter")
    { name: "cowboy butter", label: "Cowboy butter — garlic, herbs, lemon & chili in butter", measure: "to finish", optional: true, defaultOff: true },
  ],
  durationSec: 480, // ~8 min cook mapped onto the song
  bpm: 63,          // beat grid for Phase C musical seams

  // Servings scale INGREDIENT AMOUNTS only (portionScale = steaks ÷ base). Timing
  // must NOT scale — steaks sear simultaneously, doneness is per-steak internal
  // temp — so perUnit:0 + clamp:[1,1] pins portionFactor() at 1 (cues/duration
  // unchanged for any count). Mirrors the eggs/chicken portion config.
  portion: { label: "How many steaks?", unit: "steaks", base: 1, options: [1, 2, 3, 4], perUnit: 0, clamp: [1, 1] },

  // Optional add-ons the cook can keep (default) or skip on the prep screen.
  // Cues tagged with the matching `opt:` id are dropped when deselected.
  optionalGroups: [
    { id: "garlicButter", emoji: "🧄", label: "Garlic butter baste", note: "Finish in foaming butter with smashed garlic & thyme." },
  ],

  // Shown on the prep screen BEFORE the cook clock starts.
  prep: [
    "Best with a 1-inch-plus steak — ribeye or NY strip are forgiving for beginners.",
    "Pull the steak out 30 min early so it comes to room temperature.",
    "Pat it bone-dry with paper towel — dry = better crust.",
    "Season generously with salt (and pepper) on both sides.",
    "Have tongs, butter, and a plate or board ready before you start.",
  ],

  // Rich beginner prep-step guides for the wizard (one screen each).
  prepSteps: [
    { title: "Pick & temper your steak", instructions: "A 1-inch-plus ribeye or NY strip is the most forgiving cut. Take it out of the fridge about 30 minutes before cooking.", techniqueGuide: [
      "A cold-from-the-fridge steak cooks unevenly — grey and overdone outside before the middle warms up.",
      "Thinner than an inch? It'll overcook before it sears — go thicker if you can.",
      "It's tempered when the surface no longer feels fridge-cold to the touch.",
    ] },
    { title: "Pat it bone-dry", instructions: "Press paper towels firmly against both sides until no more moisture comes off.", techniqueGuide: [
      "Surface water steams instead of searing — and steam means no crust.",
      "Bone-dry meat browns fast and deep; that crust is where the flavour lives.",
      "Pat it again right before it goes in the pan.",
    ] },
    { title: "Season generously", instructions: "Salt both sides more than feels right — most of it falls off. Add pepper too if you like.", techniqueGuide: [
      "Sprinkle salt from a height (8–10 inches) so it lands evenly.",
      "Aim for roughly 3/4 teaspoon of kosher salt per side — be bold.",
      "Season just before cooking, then press it in lightly so it sticks.",
    ] },
    { title: "Heat your pan or grill", instructions: "Pan-searing? You'll heat the pan screaming-hot the moment we start. Grilling? It needs a 10–15 minute preheat — start it now.", techniqueGuide: [
      "Pan: your heaviest pan (cast iron is ideal), empty, on high for about 2 minutes.",
      "Grill: lid down for 10–15 minutes until the grates are screaming hot.",
      "Grill: build a 2-zone fire — one hot side, one cooler side to dodge flare-ups.",
    ] },
    { title: "Tools + your doneness target", instructions: "Have tongs, a resting board, and butter ready. Medium-rare finishes at 130–135°F — you'll pull it around 125–130°F.", techniqueGuide: [
      "Use tongs, never a fork — piercing leaks out the juices.",
      "It climbs about 5°F while it rests, so pull it a touch early.",
      "No thermometer? Medium-rare feels soft with a little spring — like the base of your thumb.",
    ] },
  ],

  cues: [
    {
      at: 0, type: "tip", title: "Heat the pan — HOT", heat: "high",
      body: "Heavy pan on high until it's screaming hot — about 2 minutes. Don't be gentle with it.",
      beginner: "Put your heaviest pan on high heat and let it sit empty for about 2 minutes. We want it really hot so the steak sizzles the second it lands. Careful — the handle and pan get very hot.",
      voice: "Let's go. Put your pan on high heat and let it get really hot for about two minutes.",
      haptic: "tap",
    },
    {
      at: 60, type: "action", title: "Add the oil", heat: "high",
      body: "A little high-smoke-point oil. Swirl until it shimmers.",
      beginner: "Add a thin layer of oil — something like avocado or canola, not olive oil. When it looks shimmery and almost smoking, it's ready.",
      voice: "Add a thin layer of oil. Wait until it shimmers.",
      haptic: "tap",
    },
    {
      at: 90, type: "action", title: "Lay the steak in", heat: "high",
      body: "Place it down away from you, then leave it alone. Staring at it won't sear it faster.",
      beginner: "Gently set the steak into the pan, laying it down away from you so the oil doesn't splash toward you. Now leave it completely alone — moving it stops the crust from forming.",
      voice: "Lay the steak into the pan, away from you. Now don't touch it.",
      haptic: "double",
    },
    {
      at: 180, type: "tip", title: "Building the crust", heat: "high",
      body: "Still searing side one. Resist the urge to peek.",
      beginner: "It's working. That loud sizzle is a good thing — it's building a brown, tasty crust. Let it keep going.",
      voice: "Nice. Leave it searing. That sizzle is building your crust.",
      haptic: null,
    },
    {
      at: 210, type: "flip", title: "Flip it — once", heat: "high",
      body: "One clean flip. The first side should be deep brown.",
      beginner: "Lift a corner — if it's deep golden brown, flip it over once. Just one flip. If it's still pale, give it another 30 seconds.",
      voice: "Time to flip. Lift a corner — if it's deep brown, flip it once.",
      haptic: "strong",
      // PHASE A: wait for the cook, not the clock
      gate: {
        kind: "confirm",
        doneLabel: "I flipped it",
        notReadyCoach: "No worries — give it another 30 seconds. You want a deep golden-brown crust, not grey. Then check again.",
        checkCoach: "How's that crust looking? Tap “I flipped it” once it's done.",
        doneCoach: "Beautiful. Searing the second side now.",
        nudgeSec: 30,
      },
    },
    {
      at: 270, type: "baste", title: "Butter, garlic, thyme", heat: "medium", opt: "garlicButter",
      body: "Drop heat to medium. Butter + smashed garlic + thyme.",
      beginner: "Turn the heat DOWN to medium so the butter doesn't burn, then add a knob of butter and, if you have them, a smashed garlic clove and some thyme. Tilt the pan slightly so the melted butter pools at the bottom.",
      voice: "Drop the heat to medium, then add a spoon of butter, plus garlic and thyme if you have them.",
      haptic: "tap",
      fadeTips: ["If the butter starts to burn, turn the heat down.", "Spoon the butter over the steak as it cooks."],
    },
    {
      at: 330, type: "baste", title: "Spoon-baste the top", heat: "medium", opt: "garlicButter",
      body: "Spoon the foaming butter over the steak, keep it moving.",
      beginner: "Use your spoon to scoop that foaming butter and pour it over the top of the steak again and again. This adds flavor and cooks the top evenly.",
      voice: "Spoon the butter over the top of the steak, again and again.",
      haptic: null,
      fadeTips: ["If the butter starts to burn, turn the heat down.", "Spoon the butter over the steak as it cooks."],
    },
    {
      at: 360, type: "baste", title: "Sear the edges", heat: "medium-high",
      body: "Tongs up — sear the fat edges, ~30–45s each.",
      beginner: "Hold the steak on its side with your tongs and sear the fatty edges, about 30 to 45 seconds each. This renders that strip of fat and finishes the crust the whole way around.",
      voice: "Stand the steak on its edges with your tongs and sear the fat, about thirty seconds each side.",
      haptic: "tap",
    },
    {
      at: 390, type: "tip", title: "Solo's kicking in 🔥", heat: "medium-high",
      body: "The guitars climb — so does the heat. Almost there.",
      beginner: "Hear the guitar solo taking off? You're in the home stretch — just a little longer to go.",
      voice: "The solo's kicking in, and so is the heat. Almost there.",
      haptic: "tap",
      // shown when the cook is playing their own Spotify track (no Free Bird refs)
      custom: {
        title: "Home stretch 🔥",
        body: "Almost there — keep the heat steady.",
        beginner: "You're in the home stretch now — just a little longer to go. Keep that heat steady.",
        voice: "Almost there now. Keep it steady.",
      },
    },
    {
      at: 410, type: "action", title: "Off the heat",
      body: "Pull at 125–130°F — it keeps cooking off-heat.",
      beginner: "Move the steak onto a board now — and pull it about 5°F BEFORE your target, around 125 to 130°F. It keeps cooking from its own heat and climbs to a perfect medium-rare while it rests.",
      voice: "Take the steak onto a board now — pull it about five degrees early, around a hundred and twenty-five.",
      haptic: "double",
    },
    {
      at: 420, type: "temp", title: "Temp check 🌡️",
      body: "~125–130°F now → 130–135°F (medium-rare) after resting.",
      beginner: "On a thermometer the middle should read about 125 to 130°F (52–54°C) right now — it climbs to 130 to 135°F, medium-rare, as it rests. No thermometer? Pressed in the center it should feel soft with a little spring, like the base of your thumb.",
      voice: "Aim for about a hundred and twenty-five to a hundred and thirty now — it rises to medium-rare as it rests.",
      haptic: "tap",
      // PHASE A: a safety/doneness checkpoint — don't move on until it's there
      gate: {
        kind: "confirm",
        doneLabel: "It's there",
        notReadyCoach: "Almost there — pop it back in the hot pan for another 30 to 60 seconds, then check again. You're close.",
        checkCoach: "Check again — tap “It's there” once it's around 125 to 130.",
        doneCoach: "Perfect — now it rests and climbs to medium-rare.",
        nudgeSec: 30,
      },
    },
    {
      at: 435, type: "rest", title: "Let it REST",
      body: "Rest 5+ minutes — do NOT cut yet.",
      beginner: "This is the step beginners skip: do NOT cut into it yet. Let it rest at least 5 minutes (tent loosely with foil) so the juices settle back in. Cut early and they spill onto the board, leaving the steak dry.",
      voice: "Now let it rest — at least five minutes. Don't cut into it; that's what keeps it juicy.",
      haptic: "strong",
      warning: "Cut in early and the juices bleed out — you'll get a grey, dry steak. Give it the full 5 minutes.",
    },
    {
      at: 460, type: "baste", title: "Cowboy butter finish 🧈", opt: "cowboy butter",
      body: "Spoon warm cowboy butter over the rested steak — or serve it alongside.",
      beginner: "Optional level-up: melt a knob of butter with minced garlic, chopped herbs, a squeeze of lemon and a pinch of chili, then spoon it over the rested steak — or serve it on the side for dipping. Big flavor, zero risk.",
      voice: "Spoon the cowboy butter over the rested steak, or serve it alongside.",
      haptic: "tap",
    },
    {
      at: 470, type: "finish", title: "Slice & serve 🎸",
      referenceImage: ["assets/recipes/steak/slice.jpg", "assets/recipes/steak/plate.jpg"], referenceImageFadeMs: 1800,
      body: "Slice against the grain. You made a medium-rare steak.",
      beginner: "Rest is done! Slice it against the grain — across the lines in the meat — for tender bites. You just cooked a medium-rare steak to Free Bird. Nice work.",
      voice: "Rest's done. Slice it against the grain, and enjoy. You just made a medium-rare steak.",
      haptic: "double",
      custom: {
        beginner: "Rest is done! Slice it against the grain — across the lines in the meat — for tender bites. You just cooked a medium-rare steak to your own soundtrack. Nice work.",
      },
    },
  ],
};

/*
 * Here Comes the Sun (suggested pairing) -> Fluffy Scrambled Eggs
 * A calm, ~3.5 min beginner breakfast cook. Song is a suggested pairing only
 * (playback is simulated / bring-your-own in the demo).
 */
window.SCRAMBLED_EGGS = {
  id: "scrambled-eggs",
  // youtubeId: official video for the free-tier embed. VERIFY/replace with the exact ID.
  song: { title: "Here Comes the Sun", artist: "The Beatles", spotifyQuery: "Here Comes the Sun The Beatles", youtubeId: "KQetemT1sWc", audioFile: "audio/eggs-music.mp3", audioCredit: "Music: SigmaMusicArt (royalty-free)" },
  recipe: { title: "Fluffy Scrambled Eggs", technique: "Soft Scramble", doneness: "Soft & creamy", emoji: "🍳" },
  heroImage: "assets/recipes/eggs/hero.jpg",
  // shown prominently on the prep overview, BEFORE the cook starts — the #1 beginner mistake
  cookWarning: "The #1 way to wreck scrambled eggs is overcooking them. Take them off the heat while they still look soft and a little underdone — they keep cooking on the way to the plate.",
  equipmentNeeded: ["Nonstick pan", "Whisk or fork", "Small bowl", "Rubber spatula"],
  ingredients: [
    { name: "eggs", measure: "3", noInline: true },
    { name: "butter", measure: "1 tbsp" },
    { name: "milk", measure: "1 tbsp" },
    { name: "salt", measure: "1 pinch", optional: true },
  ],
  durationSec: 210,
  bpm: 129,         // beat grid for Phase C musical seams

  // Ask portion before the cook; gently stretch timing for more eggs (more mass
  // = a bit longer to set). Kept modest via the clamp so it never gets wild.
  portion: { label: "How many eggs?", unit: "eggs", base: 3, options: [2, 3, 4, 6], perUnit: 0.08, clamp: [0.85, 1.3] },

  prep: [
    "Crack {n} eggs into a bowl.",
    "Whisk well until fully blended — no streaks of white. A splash of milk or cream is optional.",
    "Salt now — seasoning before cooking flavors them all the way through.",
    "Have butter, a spatula, and a non-stick pan ready.",
  ],

  prepSteps: [
    { title: "Crack your eggs", instructions: "Crack {n} eggs into a bowl — tap each one on a flat surface, not the edge of the bowl.", techniqueGuide: [
      "A flat-surface crack makes a cleaner break with fewer shell shards.",
      "Crack into a bowl first — never straight into the pan, in case of shell.",
      "A shell fragment fell in? Scoop it out with a larger piece of shell — it acts like a magnet.",
    ] },
    { title: "Whisk until smooth", instructions: "Beat with a fork or whisk just until the colour is uniform — about 30 seconds, no streaks of white. Don't over-beat.", techniqueGuide: [
      "Don't over-beat — the moment it's evenly blended, stop. Over-beating thins the eggs and makes the texture weepy.",
      "Streaks of white left in mean patchy, uneven texture in the pan.",
      "A splash of milk or cream makes them softer and richer.",
      "It should look pale yellow and a little frothy when it's ready.",
    ] },
    { title: "Season the eggs", instructions: "Add salt to the bowl and whisk it in.", techniqueGuide: [
      "Salting the raw eggs seasons them all the way through — better than salting at the end.",
      "About one pinch per two eggs.",
      "Hold the pepper for now if you like — it can go on at the end.",
    ] },
    { title: "Ready your pan & spatula", instructions: "Have a nonstick pan, a rubber spatula, butter, and a plate all within reach — soft eggs finish fast and won't wait.", techniqueGuide: [
      "Nonstick means nothing sticks and folding is easy.",
      "A rubber or silicone spatula won't scratch the pan.",
      "Get the plate out now — you'll be moving quickly at the end.",
    ] },
  ],

  cues: [
    {
      at: 0, type: "tip", title: "Butter in a cold pan", heat: "low",
      referenceImage: "assets/recipes/eggs/cue-0.png", // optional, eggs-only pilot; renders only if the file exists
      body: "Butter into the COLD non-stick pan, then set it to low.",
      beginner: "Put a knob of butter into your non-stick pan while it's still cold, THEN turn it to low. Letting the butter and pan warm up together means the eggs never hit a scorching surface — that's the secret to creamy, low-and-slow eggs. No browning.",
      voice: "Add the butter to a cold pan first, then turn it to low so they warm up together.",
      haptic: "tap",
    },
    {
      at: 25, type: "action", title: "Pour in the eggs", heat: "low",
      referenceImage: "assets/recipes/eggs/cue-1.png",
      body: "Pour the eggs into the melted butter. Keep the heat low — we're not making rubber here.",
      beginner: "Pour your whisked eggs into the melted butter. Leave them for a few seconds to start setting before you stir.",
      voice: "Pour in the eggs. Let them sit for just a few seconds.",
      haptic: "double",
    },
    {
      at: 55, type: "action", title: "Figure-8 stir", heat: "low",
      referenceImage: "assets/recipes/eggs/cue-2.png",
      body: "Stir slowly in a figure-8 — trace an '8' through the eggs with your spatula.",
      beginner: "Move your spatula through the eggs in a slow figure-8 — literally trace the shape of an '8', over and over, dragging the eggs around the pan. Keep it gentle and unhurried; that steady figure-8 builds soft, small, creamy curds. Don't whip it fast.",
      voice: "Stir slowly in a figure-8 — trace an eight through the eggs, gentle and steady.",
      haptic: "tap",
    },
    {
      at: 95, type: "tip", title: "Soft curds forming", heat: "low",
      referenceImage: "assets/recipes/eggs/cue-3.png",
      body: "Small, soft curds appear. Keep that gentle figure-8 going.",
      beginner: "See those soft curds forming? That's exactly right. Keep the heat low and keep tracing that slow figure-8 — gentle and steady, not fast.",
      voice: "Nice — soft curds are forming. Keep that gentle figure-8 going.",
      haptic: null,
    },
    {
      at: 135, type: "tip", title: "Still glossy & wet", heat: "low",
      referenceImage: "assets/recipes/eggs/cue-4.png",
      body: "Eggs should look glossy and slightly underdone.",
      beginner: "The eggs should still look a little wet and glossy — that's good. They'll keep cooking from their own heat once you stop.",
      voice: "Keep them glossy and a little wet. Almost there.",
      haptic: "tap",
    },
    {
      at: 165, type: "action", title: "Take them off early",
      referenceImage: "assets/recipes/eggs/cue-5.png",
      body: "Off the heat just before done — then one more fold.",
      beginner: "Take the pan completely off the heat now — just before they look fully cooked. Give them one more gentle fold; the residual heat finishes them in the next few seconds.",
      voice: "Take the eggs off the heat now, just before they look done. One more gentle fold.",
      haptic: "double",
    },
    {
      at: 178, type: "temp", title: "Just set?",
      referenceImage: "assets/recipes/eggs/cue-6.png", // ⭐ the doneness-gate reference — "this is what done looks like"
      body: "Soft, creamy, no runny raw egg in the middle. You've got this.",
      beginner: "Check them: soft and creamy, with no runny raw liquid left. If they're still wet and raw, put them back on low for a few more seconds.",
      voice: "They should be soft and creamy, with no runny raw egg.",
      haptic: "tap",
      gate: {
        kind: "confirm",
        doneLabel: "Just set",
        notReadyCoach: "No rush — back on low for a few seconds, then check again. No runny raw egg, but keep them creamy.",
        checkCoach: "How do they look? Tap “Just set” once there's no runny raw egg.",
        doneCoach: "Perfect — soft and creamy.",
        nudgeSec: 20,
      },
    },
    {
      at: 198, type: "finish", title: "Season & plate 🍳",
      referenceImage: "assets/recipes/eggs/cue-7.png",
      body: "Season, plate, and eat right away while soft.",
      beginner: "Season with a little salt and pepper, slide them onto a plate, and eat straight away while they're soft. You just made fluffy scrambled eggs — nice work!",
      voice: "Season with salt and pepper, plate up, and enjoy. You made fluffy scrambled eggs.",
      haptic: "double",
    },
  ],
};

/*
 * Bohemian Rhapsody (Queen) -> Creamy One-Pot Pasta (Garlic Parmesan). Free-tier.
 *
 * TWO PHASES. The simmer is too long and too dull to live under the song, so it
 * happens FIRST, silently — `prePhase` drives a tap-through (butter+garlic →
 * pasta+broth → bring to a simmer) then a 10-min countdown with an early-exit and
 * a doneness gate (screens.preCook). Only once the pasta's tender does the music
 * start, and PHASE 2 (`cues`) is mapped to Bohemian Rhapsody's real structure:
 * the piano intro/ballad = off-heat rest + slow cream + parmesan, the famous ROCK
 * DROP at 3:03 = taste & season hard, the opera-to-outro = adjust + plate + admire.
 * `custom` copy (no song refs) shows when a premium cook plays a different track;
 * `at` values are song positions, real cooking times stay in the copy.
 */
window.ONEPOT_PASTA = {
  id: "one-pot-garlic-parmesan-pasta",
  song: { title: "Bohemian Rhapsody", artist: "Queen", spotifyQuery: "Bohemian Rhapsody Queen", youtubeId: null, audioFile: "audio/pasta-music.mp3", audioCredit: "Music: Alex-Productions (royalty-free)" },
  recipe: { title: "Creamy One-Pot Pasta", technique: "One-Pot", doneness: "Tender & creamy", emoji: "🍝" },
  heroImage: "assets/recipes/pasta/hero.jpg",
  equipmentNeeded: ["Wide, deep pan or pot with high sides", "Box grater or microplane (for fresh cheese)", "Measuring cups", "Measuring spoons", "Cutting board", "Knife"],
  ingredients: [
    { name: "pasta", measure: "8 oz" },
    { name: "broth", measure: "2 cups" },
    { name: "cream", measure: "1/2 cup" },
    { name: "garlic", measure: "2 cloves" },
    { name: "parmesan", measure: "1 cup" },
    { name: "butter", measure: "2 tbsp" },
    { name: "basil", measure: "to garnish", optional: true },
    { name: "salt", measure: "to taste", optional: true },
    { name: "pepper", measure: "to taste", optional: true },
  ],
  durationSec: 355, // PHASE 2 only — the song is ~5:55. The simmer (Phase 1) is real-time and separate.
  // Honest total time shown on the card + prep (the song length alone is misleading).
  totalTimeMin: 20,
  timeBreakdown: "~12 min simmer + 6 min music-synced finish",
  bpm: 72,

  optionalGroups: [
    { id: "basil", emoji: "🌿", label: "Fresh basil finish", note: "Tear fresh basil over the top to serve." },
  ],
  portion: { label: "How many servings?", unit: "servings", base: 2, options: [1, 2, 3, 4], perUnit: 0.1, clamp: [0.85, 1.4] },
  servingNote: "Not sure how much pasta you have? The weight in oz is printed on the side of your box. 1 lb = 16 oz = about 4 cups dry.",

  prep: [
    "Grab a wide, deep pan or pot.",
    "Mince 2 garlic cloves; grate ~1/2 cup parmesan.",
    "Measure 8 oz short pasta, 2 cups broth, 1/2 cup cream.",
    "Have butter, salt, pepper (and basil) ready.",
  ],

  // PHASE 1 — silent, no song. A tap-through, then a simmer timer + doneness gate,
  // then the "drop the music" moment that launches the music-synced cook.
  prePhase: {
    title: "Get it simmering",
    intro: "No music yet — let's get the pasta going first. The song drops once it's tender.",
    steps: [
      { title: "Butter + garlic", heat: "medium", body: "Heat the pan and melt the butter (2 tbsp), then sauté the garlic (2 cloves) for about 60 seconds until fragrant — don't let it brown." },
      { title: "Pasta + broth in", heat: "medium-high", body: "Add the dry pasta (8 oz) and the broth (2 cups). Stir to combine." },
      { title: "Bring to a simmer", heat: "medium-high", body: "Bring it to a gentle simmer on medium-high heat — about 2–3 minutes." },
    ],
    timer: { sec: 600, label: "Simmer uncovered, stir every 2 minutes. Don't wander off — the pasta has trust issues.", earlyAfterSec: 420, earlyLabel: "Pasta's done early ▸" },
    gate: { question: "Is the pasta tender and the liquid mostly absorbed?", yesLabel: "✅ Yes — start the music 🎸", notYetLabel: "⏳ Not yet — 2 more minutes", notYetSec: 120 },
    transition: { title: "🎸 Drop it — Bohemian Rhapsody starts now", body: "Take the pan off the heat. Tap play and finish the sauce to the music.", button: "Play" },
  },

  // PHASE 2 — music-synced to Bohemian Rhapsody (5:55). `at` = seconds into the song.
  cues: [
    { // 0:00 piano intro — off the heat, rest
      at: 0, type: "tip", title: "Off the heat — rest", heat: "off",
      body: "Take the pan completely off the heat. Let it rest ~30s.",
      beginner: "Take the pan completely off the heat. Let it sit for 30 seconds — the residual heat keeps working while the piano intro plays. Don't rush this.",
      voice: "Take the pan completely off the heat. Let it rest for about thirty seconds while the piano intro plays.",
      haptic: "tap",
      custom: { beginner: "Take the pan completely off the heat. Let it sit for 30 seconds — the residual heat keeps working. Don't rush this.", voice: "Take the pan off the heat completely. Let it rest about thirty seconds." },
    },
    { // 0:49 ballad build — cream in, slow stir
      at: 49, type: "action", title: "Cream in — slow stir", heat: "off",
      body: "Off the heat, pour in the cream (1/2 cup) slowly, stirring in lazy circles.",
      beginner: "Pour in the cream (1/2 cup) slowly while stirring. Keep stirring in lazy circles — the ballad sets the pace. Don't rush or the sauce breaks.",
      voice: "Pour in the cream slowly, stirring in lazy circles. Let the ballad set the pace — don't rush, or the sauce breaks.",
      haptic: "double",
      custom: { beginner: "Pour in the cream (1/2 cup) slowly while stirring in lazy circles. Don't rush, or the sauce breaks.", voice: "Pour in the cream slowly, stirring in lazy circles. Don't rush it." },
    },
    { // 1:45 emotional peak of the ballad — parmesan in, melt slowly
      at: 105, type: "action", title: "Parmesan in — melt it slow", heat: "off",
      body: "Add the parmesan (1/2 cup) a handful at a time, stirring until glossy.",
      beginner: "Add the parmesan (1/2 cup) a handful at a time, stirring after each addition until fully melted. The sauce should be glossy and silky. Still on the ballad — keep the pace slow and steady.",
      voice: "Add the parmesan a handful at a time, stirring after each until it melts — glossy and silky. Keep the pace slow and steady.",
      haptic: "tap",
      custom: { beginner: "Add the parmesan (1/2 cup) a handful at a time, stirring after each addition until melted — glossy and silky. Keep the pace slow and steady.", voice: "Add the parmesan a handful at a time, stirring until glossy." },
    },
    { // 3:03 THE DROP — rock section explodes. Biggest cue in the recipe.
      at: 183, type: "action", title: "THE DROP — taste & season! 🎸", heat: "off",
      body: "The rock drop! Taste right now and season hard — salt + pepper to taste.",
      beginner: "HERE IT IS — the rock drop. Taste the sauce right now. Season hard with salt and pepper to taste. This is the moment — bold, decisive, no second-guessing.",
      voice: "Here it is — the rock drop! Taste the sauce right now, and season hard with salt and pepper. Be bold — no second-guessing.",
      haptic: "strong",
      custom: { title: "Taste & season! 🥄", beginner: "Taste the sauce right now. Season hard with salt and pepper to taste — bold and decisive, no second-guessing.", voice: "Taste the sauce now, and season hard with salt and pepper. Be bold." },
    },
    { // 3:27 opera-to-rock — adjust consistency
      at: 207, type: "tip", title: "Adjust the consistency", heat: "low",
      body: "Too thick? A splash of the reserved broth (1-2 tbsp). Too thin? Let it sit.",
      beginner: "Too thick? Stir in a splash of the reserved broth (1-2 tbsp, not the full 2 cups) to loosen it. Too thin? Let it sit — it thickens fast as it cools. Taste one more time and adjust.",
      voice: "Too thick? Loosen it with a splash of broth — just a tablespoon or two. Too thin? Let it sit, it thickens fast as it cools.",
      haptic: "tap",
    },
    { // 4:19 gentle outro returns — basil + plate
      at: 259, type: "baste", title: "Basil + plate", heat: "off",
      body: "Tear fresh basil (to garnish) over the top, then plate it up.",
      beginner: "Tear fresh basil (to garnish) over the top. Plate it now — twirl or spoon into a warm bowl. The outro starts — you made it.",
      voice: "Tear some fresh basil over the top, then plate it up — twirl it into a warm bowl. The outro's starting. You made it.",
      haptic: "tap",
      custom: { beginner: "Tear fresh basil over the top. Plate it now — twirl or spoon into a warm bowl. You made it.", voice: "Tear basil over the top, then plate it up. You made it." },
    },
    { // 5:00 outro — admire it. noCheckpoint so the song plays out to the end while they sit.
      at: 300, type: "tip", title: "Admire it 🍝", heat: "off", noCheckpoint: true,
      body: "Put the fork down for a second. Look at what you made. You earned it.",
      beginner: "Put the fork down for a second. Look at what you made. Creamy, glossy, perfectly seasoned one-pot pasta — cooked to Bohemian Rhapsody. Pour a drink. You earned it.",
      voice: "Put the fork down for a second and look at what you made — creamy, glossy, perfectly seasoned pasta, cooked to Bohemian Rhapsody. You earned it.",
      haptic: "double",
      custom: { beginner: "Put the fork down for a second. Look at what you made — creamy, glossy, perfectly seasoned one-pot pasta. Pour a drink. You earned it.", voice: "Put the fork down and look at what you made. You earned it." },
    },
    { // 5:54 song fades out — complete the cook
      at: 354, type: "finish", title: "Plated 🍝",
      body: "That's the cook. Enjoy it.",
      beginner: "And that's the cook — the song fades out as you finish. Creamy one-pot garlic parmesan pasta, start to finish with Bohemian Rhapsody.",
      voice: "That's the cook.",
      haptic: "tap",
    },
  ],
};

/*
 * Hotel California (Eagles) -> Crispy Pan-Fried Chicken Thighs. Free-tier.
 * The patient VERSES carry the key beginner lesson — don't touch it while the
 * fat renders — and the famous twin-guitar OUTRO at ~4:20 is the payoff: that's
 * when the skin has crisped and releases, so it's the flip. Then the 165°F
 * SAFETY gate + rest. `custom` copy (no song refs) shows when a premium cook
 * plays a different track. Audio mp3 isn't bundled yet (premium streams it);
 * `at` values are song positions, real cooking times stay in the copy.
 */
window.CRISPY_CHICKEN = {
  id: "crispy-chicken-thighs",
  song: { title: "Hotel California", artist: "Eagles", spotifyQuery: "Hotel California Eagles", youtubeId: null, audioFile: "audio/chicken-music.mp3", audioCredit: "Music: SigmaMusicArt (royalty-free)" },
  recipe: { title: "Crispy Chicken Thighs", technique: "Crispy Pan-Fry", doneness: "165°F, crispy skin", emoji: "🍗" },
  heroImage: "assets/recipes/chicken/hero.jpg",
  equipmentNeeded: ["Cast iron or stainless pan", "Tongs", "Paper towels", "Cutting board & knife", "Instant-read thermometer"],
  ingredients: [
    { name: "chicken thighs", measure: "4", noInline: true },
    { name: "oil", measure: "1 tbsp" },
    { name: "butter", measure: "2 tbsp" },
    { name: "salt", measure: "to taste", optional: true },
    { name: "pepper", measure: "to taste", optional: true },
  ],
  durationSec: 395, // ~6:30
  bpm: 75,

  portion: { label: "How many thighs?", unit: "thighs", base: 4, options: [2, 4, 6], perUnit: 0.04, clamp: [0.9, 1.15] },

  prep: [
    "Pat the thighs VERY dry with paper towel — dry skin = crispy skin.",
    "Season both sides: salt, pepper, garlic powder, paprika.",
    "Use a cast-iron or stainless pan (not non-stick).",
    "Have tongs and an instant-read thermometer ready if you can.",
  ],

  prepSteps: [
    { title: "Pat the thighs very dry", instructions: "Press paper towels firmly against the skin until no more moisture comes off.", techniqueGuide: [
      "Wet skin steams and stays rubbery — dry skin goes shatteringly crisp.",
      "Pat the skin side especially well; that's the side you're crisping.",
      "Don't rinse raw chicken — it just splashes bacteria around the sink.",
    ] },
    { title: "Season both sides", instructions: "Season both sides with salt, pepper, garlic powder, and paprika.", techniqueGuide: [
      "Sprinkle from a height so it lands evenly.",
      "Paprika adds colour and a gentle, smoky flavour.",
      "Lift any loose skin and season underneath it too, if you can.",
    ] },
    { title: "Clean up after raw chicken", instructions: "Wash your hands, the board, and the knife with hot soapy water before you touch anything else.", techniqueGuide: [
      "Raw chicken can carry bacteria — this is the one safety step never to skip.",
      "Don't let it touch other food, plates, or surfaces.",
      "A separate board kept just for raw meat is the safest habit.",
    ] },
    { title: "Set up your pan & thermometer", instructions: "Use a cast-iron or stainless pan (not nonstick), with tongs and an instant-read thermometer if you have one.", techniqueGuide: [
      "Nonstick can't crisp the skin well at this heat — cast iron or stainless does.",
      "Tongs let you flip without piercing the skin.",
      "The thermometer is how you KNOW it's safe — no guessing.",
    ] },
    { title: "Know the safe target", instructions: "Chicken is done and safe at 165°F / 74°C in the thickest part — no pink, juices run clear.", techniqueGuide: [
      "165°F is non-negotiable for safety — undercooked chicken can make you ill.",
      "Check the thickest part, away from the bone.",
      "No thermometer? Cut into the thickest part — no pink, clear juices. Better a minute longer than too soon.",
    ] },
  ],

  cues: [
    { // intro (12-string guitar)
      at: 0, type: "tip", title: "Cold pan, skin down", heat: "medium",
      body: "Thighs skin-down in a cold pan, then turn to medium.",
      beginner: "Lay the thighs skin-side down in a COLD pan, then turn the heat to medium. Starting cold lets the fat under the skin slowly render out — that's the secret to deeply crispy skin. Skin-on needs no oil.",
      voice: "Lay the thighs skin-side down in a cold pan, then turn it to medium. They render their own fat.",
      haptic: "double",
    },
    { // verse 1
      at: 45, type: "action", title: "Now leave them alone", heat: "medium",
      body: "Don't move them. Moving = no crisp. The urge to poke is strong — resist it.",
      beginner: "Now leave them completely alone. Don't poke, press, or peek — moving them stops the skin crisping. It releases on its own when it's ready.",
      voice: "Leave them alone now. Don't move them.",
      haptic: "tap",
    },
    { // the verses = the patient render ("still not done, keep waiting")
      at: 160, type: "tip", title: "Let it render", heat: "medium",
      body: "Steady sizzle = fat rendering. Nothing to do here but wait — that's the whole job.",
      beginner: "Hear that steady, gentle sizzle? That's the fat rendering and the skin slowly going golden. Let the verses roll by — every one is basically saying the same thing: not yet, keep waiting. If it's spitting violently, nudge the heat down a touch.",
      voice: "That steady sizzle is the fat rendering. Let the verses roll — just keep waiting.",
      haptic: null,
      custom: { beginner: "Hear that steady, gentle sizzle? That's the fat rendering and the skin slowly going golden. The hardest part is patience — just keep waiting, don't touch it. If it's spitting violently, nudge the heat down a touch.", voice: "That steady sizzle is the fat rendering. Keep waiting — don't touch it." },
    },
    { // building toward the outro (~3:50)
      at: 230, type: "tip", title: "Skin going deep golden", heat: "medium",
      body: "~8–10 min in. Nearly there — don't rush it.",
      beginner: "Around 8 to 10 minutes in, the skin should be going deep golden. Almost there — resist the urge to flip early; it'll tell you when it's ready.",
      voice: "Nearly there — the skin's going deep golden. Don't rush the flip.",
      haptic: "tap",
    },
    { // THE OUTRO (~4:20) twin guitars = the skin has earned it = flip
      at: 260, type: "flip", title: "Guitar outro — flip! 🎸", heat: "medium",
      body: "Skin deep golden + releases easily = flip. Sticks = wait.",
      beginner: "When those twin guitars take over — about 4 minutes in — the skin's earned it. Lift one with tongs: deeply golden and releases easily? Flip it. If it sticks, it's NOT ready — leave it another minute and let the solo carry you.",
      voice: "When the guitar outro kicks in, lift one — if the skin's deep golden and lets go easily, flip it. If it sticks, give it another minute.",
      haptic: "strong",
      gate: {
        kind: "confirm",
        doneLabel: "Crisp — flipped",
        notReadyCoach: "If it's sticking, the skin isn't crisp yet. Leave it another minute or two — it releases on its own when it's ready.",
        checkCoach: "How's the skin? Tap “Crisp — flipped” once it's deep golden and releases easily.",
        doneCoach: "Beautiful. Now cook it through on the second side.",
        nudgeSec: 45,
      },
      custom: { title: "Skin crisp? Flip 🍗", beginner: "About 4 minutes in, lift one with tongs: deeply golden and releases easily? Flip it. If it sticks, it's NOT ready — leave it another minute, then check again.", voice: "Lift one — if the skin's deep golden and lets go easily, flip it. If it sticks, give it another minute." },
    },
    { // outro continues
      at: 300, type: "action", title: "Cook it through", heat: "medium",
      body: "Skin up. 6–8 min more to cook through.",
      beginner: "Skin-side up now. Cook another 6 to 8 minutes to cook it all the way through — bone-in thighs take a little longer than you'd think.",
      voice: "Skin up now. Six to eight more minutes to cook it through.",
      haptic: "tap",
    },
    { // outro fading (~6:00)
      at: 355, type: "temp", title: "165°F check 🌡️", heat: "medium",
      body: "Thickest part must read 165°F / 74°C. No pink.",
      beginner: "Check the thickest part (avoid the bone) — it MUST read 165°F, or 74°C. Chicken has to be fully cooked through, with no pink and clear juices. No thermometer? Cut into the thickest part to check it's not pink.",
      voice: "The thickest part must reach 165 degrees. Chicken has to be cooked all the way through.",
      haptic: "tap",
      gate: {
        kind: "confirm",
        doneLabel: "165°F — done",
        notReadyCoach: "Not yet — chicken must hit 165°F to be safe. Give it another minute or two, then check again. Don't rush this one.",
        checkCoach: "Check again — tap “165°F — done” once the thickest part reads 165 and there's no pink.",
        doneCoach: "Perfect and safe. Let it rest a moment.",
        nudgeSec: 45,
      },
    },
    {
      at: 375, type: "rest", title: "Rest a few min",
      body: "Rest ~5 min so the juices settle.",
      beginner: "Let the thighs rest for about 5 minutes — the juices settle back in so they stay moist, and the skin stays crisp.",
      voice: "Let them rest about five minutes so the juices settle.",
      haptic: "strong",
    },
    {
      at: 388, type: "finish", title: "Serve 🍗",
      body: "Crispy-skin chicken thighs. Nice work.",
      beginner: "Serve them up crispy-side proud. You just pan-fried chicken thighs with shatteringly crisp skin, cooked safely through — to Hotel California, no less. Nice work, chef!",
      voice: "Serve them up. You made crispy pan-fried chicken thighs. Nice work.",
      haptic: "double",
      custom: { beginner: "Serve them up crispy-side proud. You just pan-fried chicken thighs with shatteringly crisp skin, cooked safely through. Nice work, chef!" },
    },
  ],
};

// all music-synced cooks (first = featured)
window.EXPERIENCES = [window.FREEBIRD_STEAK, window.SCRAMBLED_EGGS, window.ONEPOT_PASTA, window.CRISPY_CHICKEN];
