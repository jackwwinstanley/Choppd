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
  song: { title: "Free Bird", artist: "Lynyrd Skynyrd", spotifyQuery: "Free Bird Lynyrd Skynyrd", videoId: null, /* optional: future YouTubeMusicBackend (youtubeId = the free-tier embed) */ youtubeId: "0LwcvjNJTuM", audioFile: "audio/steak-music.mp3", audioCredit: "Music: Alex-Productions (royalty-free)" },
  recipe: { title: "Medium-Rare Steak", technique: "Pan Sear", doneness: "Medium-rare", emoji: "🥩" },
  heroImage: "assets/recipes/steak/hero.jpg", // optional beauty shot (browse card + prep overview); separate from per-cue referenceImage
  equipmentNeeded: ["Cast iron or stainless pan", "Tongs", "Paper towels", "Cutting board & knife", "Instant-read thermometer (optional)"],
  // Two cooking methods. "pan" inherits the cues/prep/optionalGroups defined below
  // (the default). "grill" carries its own: the long preheat lives in prep, side 1
  // runs longer, no butter baste, and optional 45° rotations for crosshatch marks.
  methods: [
    { id: "pan", label: "Pan-sear", emoji: "🍳", technique: "Pan Sear" },
    {
      id: "grill", label: "Grill", emoji: "🔥", technique: "Grill",
      // Grill-appropriate kit — no pan, no stovetop. (Board & knife stay: the
      // finish cue slices against the grain.)
      equipmentNeeded: ["Grill (gas or charcoal)", "Tongs", "Paper towels (for patting dry)", "Instant-read thermometer (optional)", "Plate for resting", "Cutting board & knife"],
      // Grill ingredients: no oil (nothing gets oiled on the grill); butter is an
      // OPTIONAL finish (dropped from the finish cue if unchecked).
      ingredients: [
        { name: "steak", measure: "1 (1-inch+)", noInline: true },
        { name: "butter", label: "Butter — for finishing", measure: "1 tbsp", optional: true },
        { name: "salt", measure: "to taste" },
        { name: "pepper", measure: "to taste" },
        // (no loose garlic/thyme on the grill — they only exist inside the cowboy butter, which has its own entry)
        { name: "cowboy butter", label: "Cowboy butter — garlic, herbs, lemon & chili in butter", measure: "to finish", optional: true, defaultOff: true },
      ],
      // Grill wizard = pick + tools only. The working prep (preheat → pat dry →
      // season) lives in the grill pre-phase (steakGrillPrePhase in app.js),
      // because it happens WHILE the 9-minute preheat timer runs.
      prepSteps: [
        { title: "Pick your steak", referenceImage: "assets/recipes/steak/steak-prep-1.webp", voice: "Grab a thick steak — an inch or more. Ribeye or strip is the most forgiving; thick means you can't easily overshoot it.", instructions: "A 1-inch-plus ribeye or NY strip is the most forgiving cut — thick enough that you can't easily overshoot it.", techniqueGuide: [
          "Thinner than an inch? It'll overcook before it sears — go thicker if you can.",
          "Ribeye is richer and more marbled; NY strip is leaner with a cleaner bite. Both work.",
        ] },
        { title: "Tools + your doneness target", referenceImage: "assets/recipes/steak/steak-prep-4-grill.webp", voice: "Get tongs, paper towels, and a resting plate next to the grill. You'll pull the steak a touch early — it climbs while it rests.", instructions: "Have tongs, paper towels, and a plate for resting by the grill. Medium-rare finishes at 130–135°F — you'll pull it around 125–130°F.", techniqueGuide: [
          "Use tongs, never a fork — piercing leaks out the juices.",
          "It climbs about 5°F while it rests, so pull it a touch early.",
          "No thermometer? Medium-rare feels soft with a little spring — like the base of your thumb.",
        ] },
      ],
      optionalGroups: [
        { id: "grillMarks", emoji: "🔥", label: "Crosshatch grill marks", note: "Rotate the steak 45° partway through each side for diamond marks." },
      ],
      cues: [
        { at: 0, type: "tip", title: "Grates screaming hot", heat: "high",
          referenceImage: "assets/recipes/steak/steakcue1grill.png",
          body: "Grill's preheated — we cook over direct high heat. Quick scrape of the grates if they need it.",
          beginner: "Your grill's ripping hot from the preheat. Give the grates a quick scrape with your brush or tongs if there's anything stuck on — clean, screaming-hot grates are what give you sear lines instead of a boiled-looking steak.",
          voice: "Grill's hot. Give the grates a quick scrape, and get ready to lay the steak over direct heat.", haptic: "tap" },
        { at: 20, type: "action", title: "Lay it over direct heat", heat: "high",
          referenceImage: "assets/recipes/steak/steakcue2grill.png",
          body: "Lay it over the hot zone, away from you. Then walk away — it won't sear faster with you watching.",
          beginner: "Lay the steak onto the hottest part of the grill, setting it down away from you. Now leave it alone — moving it stops the sear marks from forming. Lid up for a steak this thick.",
          voice: "Lay the steak over the hot zone, away from you. Now don't touch it.", haptic: "double" },
        { at: 130, type: "action", title: "Quarter-turn for marks", heat: "high", opt: "grillMarks",
          referenceImage: "assets/recipes/steak/steakcue3grill.png",
          body: "Rotate 45° on the SAME side for crosshatch marks.",
          beginner: "About halfway through this side, give the steak a 45-degree turn — same face down — to lay a second set of bars for that diamond crosshatch. Pure show, and it works.",
          voice: "Rotate the steak forty-five degrees, same side, for crosshatch marks.", haptic: "tap" },
        { at: 200, type: "tip", title: "Flare-up? Slide it", heat: "high",
          referenceImage: "assets/recipes/steak/steakcue4grill.png",
          body: "Flames from dripping fat — slide to the cool zone, then back.",
          beginner: "Flames licking up are normal — dripping fat causes flare-ups. Slide the steak to the cooler side for a few seconds until they die down, then move it back. That cool zone is your escape hatch.",
          voice: "If it flares up, slide it to the cooler side for a moment, then back.", haptic: null },
        { at: 240, type: "flip", title: "Flip it — once", heat: "high",
          referenceImage: "assets/recipes/steak/steakcue5grill.png",
          body: "Side one deep-marked? One clean flip onto the hot zone.",
          beginner: "Lift a corner — side one should have deep, dark grill marks. Flip it once back onto the hot zone. Still pale? Give it another 30 to 60 seconds.",
          voice: "Time to flip. If side one's deeply marked, flip it once.", haptic: "strong",
          gate: { kind: "confirm", doneLabel: "I flipped it", notReadyCoach: "No rush — another 30 to 60 seconds for deep marks. Slide it off direct heat if it's charring, then flip.", checkCoach: "How are the marks? Tap “I flipped it” once it's over.", doneCoach: "Nice — second side searing now.", nudgeSec: 45 } },
        { at: 340, type: "action", title: "Quarter-turn again", heat: "high", opt: "grillMarks",
          referenceImage: "assets/recipes/steak/steakcue6grill.png",
          body: "Rotate 45° on side two for matching marks.",
          beginner: "Same move on this side — a 45-degree turn partway through for a matching crosshatch.",
          voice: "Give it another forty-five-degree turn for marks on this side.", haptic: "tap" },
        { at: 410, type: "action", title: "Off the grill",
          referenceImage: "assets/recipes/steak/steakcue10pan.png",
          body: "Pull at 125–130°F — it climbs while resting.",
          beginner: "Move the steak onto a board now — pull it about 5°F before target, around 125 to 130°F. It keeps cooking off the grill and climbs to a perfect medium-rare as it rests.",
          voice: "Take the steak off onto a board — pull it about five degrees early, around a hundred and twenty-five.", haptic: "double" },
        { at: 420, type: "temp", title: "Temp check 🌡️",
          referenceImage: "assets/recipes/steak/steakcue11pan.png",
          body: "~125–130°F now → 130–135°F (medium-rare) after resting.",
          beginner: "On a thermometer the middle should read about 125 to 130°F (52–54°C) now — it climbs to 130 to 135°F, medium-rare, as it rests. No thermometer? Pressed in the center it should feel soft with a little spring, like the base of your thumb.",
          voice: "Aim for about a hundred and twenty-five to a hundred and thirty now — it rises to medium-rare as it rests.", haptic: "tap",
          gate: { kind: "confirm", doneLabel: "It's there", notReadyCoach: "Almost — back over direct heat for 30 to 60 seconds, then check again. You're close.", checkCoach: "Check again — tap “It's there” once it's around 125 to 130.", doneCoach: "Perfect — now it rests and climbs to medium-rare.", nudgeSec: 30 } },
        // Reworked: the rest instruction moved to the FINISH cue below — this cue now
        // carries the action that precedes it (grill off, steak onto its resting plate).
        { at: 435, type: "action", title: "Kill the heat — plate it",
          referenceImage: "assets/recipes/steak/steakcue12pan.png",
          body: "Burners off — close the propane valve on gas. Steak onto its resting plate.",
          beginner: "Shut the grill down — burners off, and close the propane valve if you're on gas (charcoal: lid and vents closed when you're done). Then move the steak onto the plate it'll rest on.",
          voice: "Kill the burners — close the valve if you're on gas — and move the steak onto its resting plate.", haptic: "strong" },
        { at: 460, type: "baste", title: "Cowboy butter finish 🧈", opt: "cowboy butter",
          referenceImage: "assets/recipes/steak/steakcue13pan.png",
          body: "Going cowboy? Spoon it over once the rest is done — or serve it alongside.",
          beginner: "Optional flex: melt butter with minced garlic, herbs, a squeeze of lemon and a pinch of chili. Once the rest is done, spoon it over the steak — or serve alongside to dip. Thirty seconds of work, restaurant-level flavor.",
          voice: "Get the cowboy butter ready — it goes over the steak once the rest is done, or serve it alongside.", haptic: "tap" },
        // TODO: finish achievement (see pan cue) once an achievement system exists.
        // Carries the rest (moved from the cue above) + the optional butter finish —
        // steakGrillCues() in app.js strips the butter lines if butter was unchecked.
        { at: 470, type: "finish", title: "Rest 5 — then slice 🎸",
          referenceImage: "assets/recipes/steak/steakcue14pan.png",
          body: "Off the grill, onto its plate — now it rests, 5 minutes. Drop the butter on top while it waits, then slice against the grain.",
          beginner: "Steak's off the grill and on its plate — now the hardest part: 5 minutes of doing nothing. Drop the butter on top while it rests — it melts into the steak. Do NOT cut early; that's what keeps it juicy. Then slice against the grain — across the lines in the meat. A steakhouse steak you grilled yourself, for about fifteen bucks. They wanted forty-five and a reservation. First of many.",
          voice: "Off the grill and onto the plate — now it rests, five minutes. Drop the butter on top while it waits; it melts right in. Then slice against the grain. You just grilled a steakhouse steak for about fifteen bucks.", haptic: "double",
          warning: "Cut in early and the juices run out onto the plate — grey, dry steak. Give it the full 5 minutes.",
          custom: { beginner: "Steak's on its plate — now it rests, 5 minutes, no cutting. Drop the butter on top while it waits — it melts right in. Then slice against the grain for tender bites. About fifteen bucks — the steakhouse wanted forty-five. First of many." } },
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
  totalTimeMin: 17, // honest end-to-end estimate: ~8 min cook + ~9 min preheat (expMins prefers this over durationSec)
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
    "Go for a 1-inch-plus ribeye or NY strip — thick and forgiving, hard to mess up.",
    "Pat it bone-dry with paper towel. Wet steak steams; dry steak sears.",
    "Salt both sides generously — more than feels right, most of it falls off.",
    "Tongs, butter, and a board ready before you start. This moves fast once it's on.",
  ],

  // Rich beginner prep-step guides for the wizard (one screen each).
  prepSteps: [
    { title: "Pick your steak", referenceImage: "assets/recipes/steak/steak-prep-1.webp", voice: "Grab a thick steak — an inch or more. Ribeye or strip is the most forgiving; thick means you can't easily overshoot it.", instructions: "A 1-inch-plus ribeye or NY strip is the most forgiving cut — thick enough that you can't easily overshoot it.", techniqueGuide: [
      "Thinner than an inch? It'll overcook before it sears — go thicker if you can.",
      "Ribeye is richer and more marbled; NY strip is leaner with a cleaner bite. Both work.",
    ] },
    { title: "Pat it bone-dry", referenceImage: "assets/recipes/steak/steak-prep-2.webp", voice: "Press paper towels firmly into both sides until nothing more comes off. Boring step, biggest payoff — dry steak is what sears.", instructions: "Press paper towels firmly against both sides until no more moisture comes off. Boring step, biggest payoff.", techniqueGuide: [
      "Surface water steams instead of searing — and steam means no crust.",
      "Bone-dry meat browns fast and deep; that crust is where the flavour lives.",
      "Pat it again right before it goes in the pan.",
    ] },
    { title: "Season generously", referenceImage: "assets/recipes/steak/steak-prep-3.webp", voice: "Salt both sides — more than feels right — and add pepper if you like. Press it in so it sticks.", instructions: "Salt both sides more than feels right — most of it falls off in the pan anyway. Add pepper too if you like.", techniqueGuide: [
      "Sprinkle salt from a height (8–10 inches) so it lands evenly.",
      "More than feels right is usually just right — be bold.",
      "Season just before cooking, then press it in lightly so it sticks.",
    ] },
    { title: "Know your heat setup", voice: "Nothing goes on the heat yet — the first step of the cook handles that. Just have your heaviest pan ready; cast iron is the champion.", instructions: "Nothing goes on the heat yet — the first cue handles that. Just know the plan: your heaviest pan (cast iron is ideal), empty, cranked to high the moment the music starts.", techniqueGuide: [
      "Don't heat anything now — the cook's first step does it, with you watching.",
      "Heavier pan = steadier heat = better crust. Cast iron is the champion.",
      "Make sure the pan is bone dry before it ever hits the burner.",
    ] },
    { title: "Tools + your doneness target", referenceImage: "assets/recipes/steak/steak-prep-4.webp", voice: "Get tongs, a resting board, and butter within reach. You'll pull the steak a touch early — it keeps climbing while it rests.", instructions: "Have tongs, a resting board, and butter ready. Medium-rare finishes at 130–135°F — you'll pull it around 125–130°F.", techniqueGuide: [
      "Use tongs, never a fork — piercing leaks out the juices.",
      "It climbs about 5°F while it rests, so pull it a touch early.",
      "No thermometer? Medium-rare feels soft with a little spring — like the base of your thumb.",
    ] },
  ],

  cues: [
    {
      at: 0, type: "tip", title: "Heat the pan — HOT", heat: "high",
      referenceImage: "assets/recipes/steak/steakcue1pan.png",
      body: "Heaviest pan you own, high heat, about 2 minutes. It needs to be screaming hot before the steak lands.",
      beginner: "Grab your heaviest pan — cast iron if you've got it — and rip the heat to high. Let it sit empty about 2 minutes until it's screaming hot. A hot pan is the whole difference between a seared steak and a sad grey one. Careful, the handle gets hot too.",
      voice: "Heaviest pan on high heat. Let it get screaming hot — about two minutes.",
      haptic: "tap",
    },
    {
      at: 60, type: "action", title: "Add the oil", heat: "high",
      referenceImage: "assets/recipes/steak/steakcue2pan.png",
      body: "Thin layer of high-smoke-point oil. Swirl until it shimmers — skip olive oil, it'll burn.",
      beginner: "Add a thin layer of oil — avocado or canola, something that can take the heat. Skip olive oil; at this temp it just burns bitter. When it's shimmering and almost smoking, you're ready. Pan not fully preheated? This step waits for you. Parked here a while (especially electric)? Slide the pan off the burner for a few seconds first so the oil doesn't smoke on contact.",
      voice: "Add a thin layer of oil. Wait until it shimmers.",
      haptic: "tap",
    },
    {
      at: 90, type: "action", title: "Lay the steak in", heat: "high",
      referenceImage: "assets/recipes/steak/steakcue3pan.png",
      body: "Lay it in away from you. Then hands off — moving it kills the crust.",
      beginner: "Set the steak into the pan, laying it down away from you so the oil doesn't spit at you. Then leave it completely alone — every time you nudge it, you wipe out the crust it's building.",
      voice: "Lay the steak into the pan, away from you. Now don't touch it.",
      haptic: "double",
    },
    {
      at: 180, type: "tip", title: "Building the crust", heat: "high",
      referenceImage: "assets/recipes/steak/steakcue4pan.png",
      body: "Still searing side one. That loud sizzle is the crust forming — leave it.",
      beginner: "That aggressive sizzle? That's a crust forming — the exact thing the steakhouse charges a premium for. Don't poke it, don't flip early. Let it do its thing.",
      voice: "That sizzle is your crust forming. Leave it alone and let it build.",
      haptic: null,
    },
    {
      at: 210, type: "flip", title: "Flip it — once", heat: "high",
      referenceImage: "assets/recipes/steak/steakcue5pan.png",
      body: "One clean flip. Side one should be deep, dark brown.",
      beginner: "Lift a corner and look. Deep, dark brown? Flip it — once, that's it. Still pale? Not ready — another 30 seconds, then check again.",
      voice: "Time to flip. Lift a corner — if it's deep brown, flip it once.",
      haptic: "strong",
      // PHASE A: wait for the cook, not the clock
      gate: {
        kind: "confirm",
        doneLabel: "I flipped it",
        notReadyCoach: "No rush — another 30 seconds. You want deep golden-brown, not grey. Check again after.",
        checkCoach: "How's the crust? Tap “I flipped it” once it's over.",
        doneCoach: "Beautiful — second side's searing now.",
        nudgeSec: 30,
      },
    },
    {
      at: 270, type: "baste", title: "Butter, garlic, thyme", heat: "medium", opt: "garlicButter",
      referenceImage: "assets/recipes/steak/steakcue6pan.png",
      body: "Drop the heat to medium. Add butter, smashed garlic, thyme.",
      beginner: "Turn the heat DOWN to medium first — butter burns fast on high. Then add a knob of butter and, if you've got them, a smashed garlic clove and a sprig of thyme. Tilt the pan so the butter pools in one corner. This is the move that makes people think you know what you're doing.",
      voice: "Drop the heat to medium, then add a spoon of butter, plus garlic and thyme if you have them.",
      haptic: "tap",
      fadeTips: ["If the butter starts to burn, turn the heat down.", "Spoon the butter over the steak as it cooks."],
    },
    {
      at: 330, type: "baste", title: "Spoon-baste the top", heat: "medium", opt: "garlicButter",
      referenceImage: "assets/recipes/steak/steakcue7pan.png",
      body: "Spoon the foaming butter over the top, over and over.",
      beginner: "Tilt the pan, scoop that foaming butter with a spoon, and pour it over the top of the steak — again and again. It cooks the top gently and soaks in all that garlic-thyme flavor.",
      voice: "Spoon the butter over the top of the steak, again and again.",
      haptic: null,
      fadeTips: ["If the butter starts to burn, turn the heat down.", "Spoon the butter over the steak as it cooks."],
    },
    {
      at: 360, type: "baste", title: "Sear the edges", heat: "medium-high",
      referenceImage: "assets/recipes/steak/steakcue8pan.png",
      body: "Tongs up — hold it on its edges and sear the fat, ~30–45s each.",
      beginner: "Grab your tongs, stand the steak up on its fatty edge, and hold it there 30 to 45 seconds — then the other edges. Renders that strip of fat into something worth eating instead of chewing around.",
      voice: "Stand the steak on its edges with your tongs and sear the fat, about thirty seconds each side.",
      haptic: "tap",
    },
    {
      at: 390, type: "tip", title: "Solo's kicking in 🔥", heat: "medium-high",
      referenceImage: "assets/recipes/steak/steakcue8pan.png",
      body: "Guitar solo's taking off — you're in the home stretch. Almost there.",
      beginner: "Right on cue: the solo kicks in as you hit the home stretch. That's the whole point of cooking to the song — it tells you where you are. Just a little longer.",
      voice: "The solo's kicking in right as you hit the home stretch. Almost there.",
      haptic: "tap",
      // shown when the cook is playing their own Spotify track (no Free Bird refs)
      custom: {
        title: "Home stretch 🔥",
        body: "Home stretch — keep the heat steady.",
        beginner: "You're in the home stretch now — keep the heat steady, just a little longer.",
        voice: "Almost there. Keep it steady.",
      },
    },
    {
      at: 410, type: "action", title: "Off the heat",
      referenceImage: "assets/recipes/steak/steakcue10pan.png",
      body: "Onto a board at 125–130°F — it keeps climbing off the heat.",
      beginner: "Move it onto a board now — pull it about 5°F BEFORE target, around 125 to 130°F. It keeps cooking on its own and climbs to a perfect medium-rare as it rests. Pull it 'done' and you've overshot.",
      voice: "Take the steak onto a board now — pull it about five degrees early, around a hundred and twenty-five.",
      haptic: "double",
    },
    {
      at: 420, type: "temp", title: "Temp check 🌡️",
      referenceImage: "assets/recipes/steak/steakcue11pan.png",
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
      referenceImage: "assets/recipes/steak/steakcue12pan.png",
      body: "Rest it 5+ minutes. Do NOT cut into it yet — this is the part everyone skips.",
      beginner: "Hardest 5 minutes of the cook: doing nothing. Do NOT cut into it yet — let it rest at least 5 minutes, tented loosely with foil, so the juices settle back into the meat instead of bleeding onto the board. Pour something, set the table, let it ride. Cutting early is how a great steak turns dry.",
      voice: "Now let it rest — at least five minutes. Don't cut into it; that's what keeps it juicy.",
      haptic: "strong",
      warning: "Cut in early and the juices run out onto the board — grey, dry steak. Give it the full 5 minutes.",
    },
    {
      at: 460, type: "baste", title: "Cowboy butter finish 🧈", opt: "cowboy butter",
      referenceImage: "assets/recipes/steak/steakcue13pan.png",
      body: "Spoon warm cowboy butter over the rested steak — or serve it alongside.",
      beginner: "Optional flex: melt butter with minced garlic, chopped herbs, a squeeze of lemon and a pinch of chili, then spoon it over the rested steak — or leave it alongside to dip. Thirty seconds of work, restaurant-level flavor.",
      voice: "Spoon the cowboy butter over the rested steak, or serve it alongside.",
      haptic: "tap",
    },
    {
      // TODO: wire finish achievement ("Steak Whisperer"; first-ever cook → "Didn't Order Takeout") once an achievement system exists.
      at: 470, type: "finish", title: "Slice & serve 🎸",
      referenceImage: "assets/recipes/steak/steakcue14pan.png",
      body: "Slice against the grain — across the lines in the meat. That's a medium-rare steak you cooked.",
      beginner: "Rest's up. Slice it against the grain — across the lines running through the meat — so every bite's tender. That's a medium-rare steak, cooked by you, for about fifteen bucks. The steakhouse wanted forty-five and a reservation. First of many.",
      voice: "Rest's done. Slice it against the grain and dig in. You just made a steakhouse steak for about fifteen bucks.",
      haptic: "double",
      custom: {
        beginner: "Rest's up. Slice against the grain for tender bites. That's a medium-rare steak you cooked yourself, for about fifteen bucks — the steakhouse wanted forty-five. First of many.",
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
  song: { title: "Here Comes the Sun", artist: "The Beatles", spotifyQuery: "Here Comes the Sun The Beatles", videoId: null, /* optional: future YouTubeMusicBackend (youtubeId = the free-tier embed) */ youtubeId: "KQetemT1sWc", audioFile: "audio/eggs-music.mp3", audioCredit: "Music: SigmaMusicArt (royalty-free)" },
  recipe: { title: "Fluffy Scrambled Eggs", technique: "Soft Scramble", doneness: "Soft & creamy", emoji: "🍳" },
  heroImage: "assets/recipes/eggs/hero.jpg",
  // shown prominently on the prep overview, BEFORE the cook starts — the #1 beginner mistake
  cookWarning: "The one surefire way to wreck scrambled eggs is overcooking them. Take them off while they still look a little underdone — they keep cooking on the way to the plate. Underdone is the target here, not a mistake.",
  equipmentNeeded: ["Nonstick pan", "Whisk or fork", "Small bowl", "Rubber spatula"],
  ingredients: [
    { name: "eggs", measure: "3", noInline: true },
    { name: "butter", measure: "1 tbsp" },
    { name: "milk", measure: "1 tbsp" },
    { name: "salt", measure: "1 pinch" },
    { name: "pepper", label: "Black pepper", measure: "to taste", optional: true }, // the finish cue seasons with pepper — it belongs on the list
  ],
  durationSec: 210,
  bpm: 129,         // beat grid for Phase C musical seams
  // Honest end-to-end estimate shown on the card + prep. durationSec (210s) is just the
  // song-synced cook clock, which pauses at every checkpoint; add prep + the preheat and
  // it's ~8 min start to finish. (expMins prefers totalTimeMin.)
  totalTimeMin: 8,
  timeBreakdown: "~3 min prep + preheat, ~5 min cook",

  // PRE-MUSIC preheat phase (screens.preCook). Preheat the pan HIGH, water-drop
  // test, then drop to MEDIUM-HIGH for the music-synced cook. Timer duration is set by
  // stove type (gas vs electric) in eggsPrePhase(); the fat goes in during the
  // cook (on medium-high), never here. High to preheat, medium-high to cook.
  prePhase: {
    title: "Preheat the pan",
    intro: "Eggs cook fast, so we get the pan hot first. Preheat on HIGH, then bring it down to medium-high for the eggs — hot enough to set them, then we drop it lower for the fold.",
    startLabel: "Start preheating ⏱",
    steps: [
      { title: "Pan on HIGH — empty", heat: "high", referenceImage: "assets/recipes/eggs/eggs-p1-c1.webp", body: "Put your empty pan on the burner and turn it to HIGH. Nothing in it yet — no butter, no oil, no eggs. Just the pan and the heat, getting acquainted.", voice: "Put your empty pan on the burner and turn it all the way up to high. Nothing in it yet — no butter, no oil, no eggs. Just let it get hot." },
    ],
    timer: { label: "Preheating the pan", earlyLabel: "Test it now ▸", phaseLabel: "preheat", note: "Keep the pan empty while it heats — nothing in it yet. Electric burners take their time, so hang tight if it's a wait. When the timer's up, we'll do a quick water-drop test before dropping the heat." },
    gate: { question: "Is the pan hot enough?", phaseLabel: "pan check", referenceImage: "assets/recipes/eggs/eggs-p1-gate.webp", lead: "Wet your fingertips and flick a few water drops onto the pan.\n\n✅ Ready: the drops ball up and dance around the pan like tiny marbles, then disappear. That's the sign.\n\n❌ Not ready: the drops just sit there and fizzle flat. Give it another 30–60 seconds and flick again.\n\n⏸ Ready before YOU are? Drop the dial to medium and take your time — an empty pan shouldn't sit screaming on high, and it stays plenty hot at medium. No need to re-test; just nudge it back up when you tap start.\n\n(Keep your hand back — the pan is hot.)", voice: "Flick a few drops of water on the pan — it's ready when the drops ball up and dance around like tiny marbles. If they just sit and fizzle, give it another thirty to sixty seconds.", yesLabel: "It sizzled — pan's ready ▸", notYetLabel: "Not yet — heat a little longer", notYetSec: 60, notYetTimerLabel: "A little longer on high" },
    transition: { title: "Drop the heat — let's cook 🍳", body: "Nice and hot. Tap to start — the first step brings the heat down to medium-high and adds your fat: hot enough to set the eggs fast, then we drop it lower for the fold. (Not quite ready? Park the pan at medium or slide it off — it holds.)", voice: "Nice and hot. Tap to start — we bring the heat down to medium-high and add your fat, then the eggs go in.", button: "Start cooking", emoji: "🍳" },
  },

  // Ask portion before the cook; gently stretch timing for more eggs (more mass
  // = a bit longer to set). Kept modest via the clamp so it never gets wild.
  portion: { label: "How many eggs?", unit: "eggs", base: 3, options: [2, 3, 4, 6], perUnit: 0.08, clamp: [0.85, 1.3] },

  prep: [
    "Crack {n} eggs into a bowl.",
    "Beat in the milk and salt until fully blended — no streaks of white. Don't over-beat.",
    "Your butter (or chosen fat) goes in the PAN, not the bowl — added later, once the pan's hot and brought down to medium-high.",
    "Have a spatula, a non-stick pan, and a plate ready. We preheat the pan on high, then drop to medium-high for the eggs.",
  ],

  prepSteps: [
    { title: "Crack your eggs", referenceImage: "assets/recipes/eggs/eggs-prep-1.webp", voice: "Crack your eggs into a bowl — tap each one on a flat surface, not the edge, and you'll get fewer shell bits.", instructions: "Crack {n} eggs into a bowl — tap each one on a flat surface, not the edge of the bowl.", techniqueGuide: [
      "A flat-surface crack makes a cleaner break with fewer shell shards.",
      "Crack into a bowl first — never straight into the pan, in case of shell.",
      "A shell fragment fell in? Scoop it out with a larger piece of shell — it acts like a magnet.",
    ] },
    { title: "Beat in the milk + salt", referenceImage: "assets/recipes/eggs/eggs-prep-2.webp", voice: "Beat in the milk and salt just until the colour is even — no streaks of white, and don't over-beat.", instructions: "Add the milk and salt to the eggs, then beat with a fork or whisk just until the colour is uniform — about 30 seconds, no streaks of white. Don't over-beat.", techniqueGuide: [
      "Milk goes in the bowl with the eggs — it makes them softer and richer.",
      "Salting the raw eggs in the bowl seasons them all the way through — better than salting at the end.",
      "Don't over-beat — the second it's evenly blended, stop. Keep going and you thin the eggs out and they turn weepy. Nobody wants weepy eggs.",
      "Streaks of white left in mean patchy, uneven texture in the pan.",
      "Hold the pepper for now if you like — it can go on at the end.",
    ] },
    { title: "Ready your pan, fat & spatula", referenceImage: "assets/recipes/eggs/eggs-prep-3.webp", voice: "Set out a nonstick pan, a rubber spatula, and a plate. Your fat goes in the pan later — not the bowl.", instructions: "Have a nonstick pan, a rubber spatula, your butter, and a plate within reach. The butter goes in the PAN (not the bowl) — added once the pan's hot and brought down to medium-high.", techniqueGuide: [
      "We preheat the pan on HIGH, then drop it to medium-high for the eggs — high to preheat, medium-high to set, lower for the fold.",
      "Nonstick means nothing sticks and folding is easy.",
      "A rubber or silicone spatula won't scratch the pan.",
      "Get the plate out now — soft eggs finish fast and won't wait.",
    ] },
  ],

  cues: [
    {
      at: 0, type: "action", title: "Set medium-high + butter in", heat: "medium-high",
      referenceImage: "assets/recipes/eggs/cue-0.png?v=2", // optional, eggs-only pilot; renders only if the file exists
      body: "Set the heat to MEDIUM-HIGH. Add the butter and let it melt and coat the pan. (Parked at medium? Nudge the dial UP; pan off the burner? Back on first.)",
      beginner: "The pan's hot from preheating — set the dial to MEDIUM-HIGH now, wherever it ended up (parked at medium? that means nudging UP; pan off the burner? put it back on first). Add the butter; it melts fast and coats the pan. This is hot enough to actually set the eggs — we'll drop it lower once they've whitened and you start folding.",
      voice: "Set the heat to medium-high, then add the butter and let it melt.",
      haptic: "double", fat: true,
    },
    {
      at: 25, type: "action", title: "Pour in the eggs", heat: "medium-high",
      referenceImage: "assets/recipes/eggs/cue-1.png",
      body: "Pour the eggs into the melted butter. Now leave them alone — no stirring yet. We're not making rubber.",
      beginner: "Pour your whisked eggs into the melted butter. Not ready to pour? Slide the pan off the burner while you get set — if the fat's gone dark brown, wipe it out, add fresh, and carry on. Once they're in, leave them completely alone — no stirring. We want them to start setting first. We're not making rubber.",
      voice: "Pour in the eggs. Now leave them alone — don't stir yet. We're not making rubber.",
      haptic: "double", fat: true,
    },
    {
      at: 55, type: "action", title: "Let them set — don't stir", heat: "medium-high",
      referenceImage: "assets/recipes/eggs/cue-set.png",
      body: "Wait — don't stir. Let the bottom and edges turn from clear to solid white — usually 30–60 seconds — then tap continue.",
      beginner: "Hands off — I know it feels like nothing's happening. It is, for a few seconds. Let the eggs sit on the medium-high heat until the bottom and edges turn from runny and clear to solid white — usually 30–60 seconds. That white base is what you're waiting for — once you see it, tap continue. Already past white — edges browning or fully firm? You're ahead, not ruined: drop the heat now, tap continue, and keep the folding short.",
      voice: "Let them sit — no stirring. When the edges turn solid white — usually thirty to sixty seconds — tap continue.",
      haptic: "tap",
      gate: {
        kind: "confirm",
        doneLabel: "They've set — solid white",
        notReadyCoach: "Not white yet? Give them a few more seconds on medium-high — still no stirring.",
        checkCoach: "Are the bottom and edges solid white (not runny)? Tap once they've set.",
        doneCoach: "Perfect — now drop the heat and start the figure eight.",
        nudgeSec: 25,
      },
    },
    {
      at: 80, type: "action", title: "Figure-8 stir", heat: "medium-low",
      referenceImage: "assets/recipes/eggs/cue-2.png?v=2",
      body: "Now turn the heat down to MEDIUM-LOW and stir slowly in a figure-8 — trace an '8' through the eggs with your spatula.",
      beginner: "Now that they've set, turn the heat down to MEDIUM-LOW and start moving: drag your spatula through the eggs in a slow figure-8 — literally trace the shape of an '8', over and over, folding the eggs gently around the pan. Lower heat + that steady figure-8 builds soft, small, creamy curds. Keep it gentle and unhurried — don't whip it fast. Parked on this step a while and they already look done? Slide the pan off the heat now — you're ahead, not behind.",
      voice: "Turn the heat down to medium-low, then start the figure eight — trace an eight through the eggs, gentle and steady.",
      haptic: "tap",
    },
    {
      at: 110, type: "tip", title: "Soft curds forming", heat: "medium-low", noCheckpoint: true,   // a tip, not a gate — parking here left eggs on live heat
      referenceImage: "assets/recipes/eggs/cue-3.png?v=2",
      body: "Small, soft curds appear. Keep that gentle figure-8 going.",
      beginner: "See those soft curds forming? That's exactly right. Keep the heat at medium-low and keep tracing that slow figure-8 — gentle and steady, not fast.",
      voice: "Nice — soft curds are forming. Keep that gentle figure eight going.",
      haptic: null,
    },
    {
      at: 145, type: "tip", title: "Still glossy & wet", heat: "medium-low", noCheckpoint: true,   // same: the warning reads in passing, the clock keeps rolling
      referenceImage: "assets/recipes/eggs/cue-4.png?v=2",
      body: "Eggs should look glossy and a little underdone — wetter than feels right. Trust it.",
      beginner: "The eggs should still look a little wet and glossy — yes, even though your gut says cook them longer. Your gut's wrong here. They keep cooking from their own heat once you stop.",
      voice: "Keep them glossy and a little wet. Looks underdone — that's the point. Almost there.",
      warning: "Pull them while they still look underdone — on this heat they tip into rubbery fast, and you can't un-cook an egg.",
      haptic: "tap",
    },
    {
      at: 160, type: "action", title: "Take them off early", heat: "off",
      referenceImage: "assets/recipes/eggs/cue-5.png?v=2",
      body: "Off the heat just before done — slide the pan off AND turn the burner off. One more fold.",
      beginner: "Take the pan completely off the heat now — physically slide it off the burner onto the counter or a folded towel, and turn the burner off too. Sliding is what saves the eggs (the burner stays hot for minutes either way), and the off dial means you're not walking away from a live burner later. Then one more gentle fold — the residual heat finishes them in the next few seconds.",
      voice: "Slide the pan off the burner and turn the burner off. One more gentle fold — the pan's own heat finishes them.",
      haptic: "double",
    },
    {
      at: 185, type: "temp", title: "Just set?",
      referenceImage: "assets/recipes/eggs/cue-6.png?v=2", // ⭐ the doneness-gate reference — "this is what done looks like"
      body: "Poke at them. Soft, creamy, still a little glossy, no runny raw egg in the middle? Pull them — they keep cooking off the heat. You've got this.",
      beginner: "Poke at them. They should be soft, creamy, and still a little glossy — no runny raw liquid left. If they're still wet and raw in the middle, back on low for a few seconds, then check again. Pull them before they feel fully done — they finish off the burner. You've got this.",
      voice: "They should be soft, creamy, and a little glossy — no runny raw egg. Pull them now; they finish off the burner.",
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
      // TODO: wire eggs completion achievement (first-ever cook → "Didn't Order Takeout";
      // repeat egg cook → "Certified Egg Guy") once an achievement system exists.
      at: 205, type: "finish", title: "Season & plate 🍳",
      // (music stop is GLOBAL now — every finish cue hard-stops the song in the engine)
      referenceImage: "assets/recipes/eggs/cue-7.png",
      body: "Salt, a little pepper if you want it, plate up, and eat now while they're soft.",
      beginner: "A little more salt, some pepper if you like, slide them onto a plate, and eat straight away while they're soft. That's soft, restaurant-style scrambled eggs — made by you, for about a buck. The deli would've charged you six. Nice work. First of many.",
      voice: "Season with salt and pepper, plate up, and eat while they're soft. You just made scrambled eggs from scratch — nice work.",
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
  song: { title: "Bohemian Rhapsody", artist: "Queen", spotifyQuery: "Bohemian Rhapsody Queen", videoId: null, /* optional: future YouTubeMusicBackend (youtubeId = the free-tier embed) */ youtubeId: null, audioFile: "audio/pasta-music.mp3", audioCredit: "Music: Alex-Productions (royalty-free)" },
  recipe: { title: "Creamy One-Pot Pasta", technique: "One-Pot", doneness: "Tender & creamy", emoji: "🍝" },
  heroImage: "assets/recipes/pasta/onepot-p2-c8.webp", // plated finish shot — continuous with the in-cook reference imagery
  equipmentNeeded: ["Wide, deep pan or pot with high sides", "Box grater or microplane (for fresh cheese)", "Measuring cups", "Measuring spoons", "Knife + cutting board (for the garlic)"],
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
  totalTimeMin: 28,
  timeBreakdown: "~3–5 min to a rolling boil + ~10 min simmer + 6 min music finish (plus a short rest)",
  bpm: 72,

  optionalGroups: [
    { id: "basil", emoji: "🌿", label: "Fresh basil finish", note: "Tear fresh basil over the top to serve." },
  ],
  portion: { label: "How many servings?", unit: "servings", base: 2, options: [1, 2, 3, 4], perUnit: 0.1, clamp: [0.85, 1.4] },
  servingNote: "Not sure how much pasta you have? The weight in oz is printed on the side of your box. 1 lb = 16 oz = about 4 cups dry.",

  prep: [
    "Grab a wide, deep pan or pot.",
    "Mince your garlic; grate your parmesan.",
    "Measure out your pasta, liquid, and cream.",
    "Have butter, salt, pepper (and basil) ready.",
  ],

  // PHASE 1 — silent, no song. A tap-through, then a simmer timer + doneness gate,
  // then the "drop the music" moment that launches the music-synced cook.
  prePhase: {
    title: "Get it simmering",
    intro: "No music yet — get the pasta going first. The song earns its entrance once the pasta's tender.",
    // NOTE: display steps come from the pastaPrePhase() transform in app.js (stove/
    // liquid/serving-aware) — that function is the source of truth; this base set is
    // a synced reference only.
    steps: [
      { title: "Melt the butter — MAX heat", heat: "high", body: "Crank the burner to its highest setting and melt the butter — butter only, no garlic yet." },
      { title: "Add the garlic", heat: "high", body: "Stir the garlic in for 30–45 seconds, just until fragrant — then straight to the liquid before it browns." },
      { title: "Pasta + liquid in", heat: "high", body: "Add the dry pasta and your liquid. Stir, and keep it on high." },
      { title: "Bring it to a rolling boil", heat: "high", body: "Keep it on high until it's properly rolling — this cooks off the extra liquid up front." },
      { title: "Drop to a simmer", heat: "medium-low", body: "Drop to a gentle simmer, uncovered, for your pasta box's cook time." },
    ],
    timer: { sec: 600, label: "Simmer uncovered, stir every 2 minutes — it sticks the second you leave. Cheese grated and cream measured? Get them within arm's reach for the music phase.", earlyAfterSec: 420, earlyLabel: "Pasta's done early ▸" },
    gate: { question: "Is the pasta tender and the liquid mostly absorbed?", referenceImage: "assets/recipes/pasta/onepot-p1-gate.webp", lead: "Fish out a piece and bite it.\n\n✅ Ready: soft with a slight chew, no chalky white core — and the liquid's cooked down to a glossy sauce that clings instead of pooling.\n\n❌ Not ready: a firm or chalky bite, or watery liquid sloshing around. Give it two more minutes and bite again.\n\n(Deliberating? Totally fine to slide the pot off the burner while you decide — it re-warms in seconds.)", voice: "Bite a piece — if the pasta's tender and the liquid's cooked down into a glossy sauce, you're ready. If not, give it a couple more minutes.", yesLabel: "✅ Yes — start the music 🎸", notYetLabel: "⏳ Not yet — 2 more minutes", notYetSec: 120 },
    transition: { title: "🎸 Drop it — Bohemian Rhapsody starts now", body: "Slide the pot off to a cold spot and turn the burner off. Tap play and finish the sauce to the music.", voice: "That's the pasta cooked. Slide the pot off the burner — don't just turn the dial off — and tap play. We finish the sauce to the music.", button: "Play" },
  },

  // PHASE 2 — music-synced to Bohemian Rhapsody (5:55). `at` = seconds into the song.
  cues: [
    { // 0:00 piano intro — off the heat, rest. NOTE: display copy comes from the
      // pastaCues() transform in app.js (stove-aware) — keep this base in sync with it.
      at: 0, type: "tip", title: "Off the heat — rest", heat: "off",
      referenceImage: "assets/recipes/pasta/onepot-p2-c1.webp",
      body: "Slide the pot to a cold spot on the stove and turn the burner off. Let it rest while the intro plays.",
      beginner: "Take the pot completely off the heat — physically slide it off the burner to a cold spot on the stove and turn the burner off. The dial alone isn't enough; the burner stays hot for minutes. Let it rest while the piano intro plays; the residual heat keeps working.",
      voice: "Slide the pot off the burner to a cold spot — don't just turn the dial off; the burner stays hot for minutes. Let it rest while the intro plays.",
      haptic: "tap",
      custom: { beginner: "Take the pot completely off the heat — physically slide it off the burner to a cold spot and turn the burner off. The dial alone isn't enough; the burner stays hot for minutes. Let it rest a moment.", voice: "Slide the pot off the burner — don't just turn the dial off. Let it rest a moment while the music settles in." },
    },
    { // 0:49 ballad build — cream in, slow stir
      at: 49, type: "action", title: "Cream in — slow stir", heat: "off",
      referenceImage: "assets/recipes/pasta/onepot-p2-c2.webp",
      body: "Off the heat, pour in the cream (1/2 cup) slowly, stirring in lazy circles.",
      beginner: "Pour in the cream (1/2 cup) slowly while stirring. Keep stirring in lazy circles — the ballad sets the pace. Don't rush or the sauce breaks.",
      voice: "Pour in the cream slowly, stirring in lazy circles. Let the ballad set the pace — don't rush, or the sauce breaks.",
      haptic: "double",
      custom: { beginner: "Pour in the cream (1/2 cup) slowly while stirring in lazy circles. Don't rush, or the sauce breaks.", voice: "Pour in the cream slowly, stirring in lazy circles. Don't rush it." },
    },
    { // 1:45 emotional peak of the ballad — parmesan in, melt slowly
      at: 105, type: "action", title: "Parmesan in — melt it slow", heat: "off",
      referenceImage: "assets/recipes/pasta/onepot-p2-c3.webp",
      body: "Add the parmesan (1/2 cup) a handful at a time, stirring until glossy.",
      beginner: "Add the parmesan (1/2 cup) a handful at a time, stirring after each until it melts — dump it all in at once and it clumps into a sad cheese rope. The sauce should go glossy and silky. Keep the pace slow and steady.",
      voice: "Add the parmesan a handful at a time, stirring after each until it melts — glossy and silky. Keep the pace slow and steady.",
      haptic: "tap",
      custom: { beginner: "Add the parmesan (1/2 cup) a handful at a time, stirring after each addition until melted — glossy and silky. Keep the pace slow and steady.", voice: "Add the parmesan a handful at a time, stirring until glossy." },
    },
    { // 3:03 THE DROP — rock section explodes. Biggest cue in the recipe.
      at: 183, type: "action", title: "THE DROP — taste & season! 🎸", heat: "off",
      referenceImage: "assets/recipes/pasta/onepot-p2-c4.webp",
      body: "The rock drop! Taste right now and season hard — salt + pepper to taste.",
      beginner: "This is the drop the whole cook's been building to. Taste the sauce right now, then season hard — salt and pepper, more than feels polite. Restaurants call this 'finishing'; you're just making it taste like something.",
      voice: "Here it is — the rock drop! Taste the sauce right now, and season hard with salt and pepper. Be bold — no second-guessing.",
      haptic: "strong",
      custom: { title: "Taste & season! 🥄", beginner: "Taste the sauce right now, then season hard — salt and pepper, more than feels polite. Restaurants call this 'finishing'; you're just making it taste like something.", voice: "Taste the sauce now, and season hard with salt and pepper. Be bold." },
    },
    { // 3:27 opera-to-rock — adjust consistency
      at: 207, type: "tip", title: "Adjust the consistency", heat: "low",
      referenceImage: "assets/recipes/pasta/onepot-p2-c5.webp",
      body: "Too thick? A splash of the reserved broth (1-2 tbsp). Too thin? Let it sit.",
      beginner: "Too thick? Loosen it with a splash of the reserved broth — a tablespoon or two, not the whole cup. Too thin? Just let it sit; it tightens up fast as it cools. Taste it one more time. This is the part a restaurant charges you an extra twelve bucks for and calls 'finishing the sauce.'",
      voice: "Too thick? Loosen it with a splash of broth — just a tablespoon or two. Too thin? Let it sit, it thickens fast as it cools.",
      haptic: "tap",
    },
    { // 4:19 gentle outro returns — basil + plate
      at: 259, type: "baste", title: "Basil + plate", heat: "off",
      referenceImage: "assets/recipes/pasta/onepot-p2-c6.webp",
      body: "Tear fresh basil (to garnish) over the top, then plate it up.",
      beginner: "Tear fresh basil (to garnish) over the top. Plate it now — twirl or spoon into a warm bowl. The outro starts — you made it.",
      voice: "Tear some fresh basil over the top, then plate it up — twirl it into a warm bowl. The outro's starting. You made it.",
      haptic: "tap",
      custom: { beginner: "Tear fresh basil over the top. Plate it now — twirl or spoon into a warm bowl. You made it.", voice: "Tear basil over the top, then plate it up. You made it." },
    },
    { // 5:00 outro — admire it. noCheckpoint so the song plays out to the end while they sit.
      at: 300, type: "tip", title: "Admire it 🍝", heat: "off", noCheckpoint: true, finishButton: true,
      referenceImage: "assets/recipes/pasta/onepot-p2-c7.webp",
      body: "Put the fork down for a second. Look at what you made. You earned it.",
      beginner: "Fork down for a second. Look at what you actually made — creamy, glossy, seasoned like you meant it, cooked start to finish to one song. Pour something. Then dig in.",
      voice: "Put the fork down for a second and look at what you made — creamy, glossy, perfectly seasoned pasta, cooked to Bohemian Rhapsody. You earned it.",
      haptic: "double",
      custom: { beginner: "Fork down for a second. Look at what you actually made — creamy, glossy, seasoned like you meant it, cooked start to finish to one song. Pour something. Then dig in.", voice: "Put the fork down and look at what you made. You earned it." },
    },
    { // 5:54 song fades out — complete the cook
      at: 354, type: "finish", title: "Plated 🍝",
      referenceImage: "assets/recipes/pasta/onepot-p2-c8.webp",
      body: "One pan, no takeout, no delivery fee. That's dinner — go eat it.",
      beginner: "And that's the cook — creamy one-pot garlic parmesan pasta, start to finish, in one pan you actually have to wash. The DoorDash version of this shows up lukewarm for like twenty-three bucks; you just made it hot for about four. First of many. Go eat.",
      voice: "That's the cook. One pan, no delivery fee — go eat.",
      haptic: "tap",
      custom: { beginner: "And that's the cook — creamy one-pot garlic parmesan pasta, start to finish, in one pan you actually have to wash. The DoorDash version shows up lukewarm for like twenty-three bucks; you just made it hot for about four, to your own soundtrack. First of many. Go eat." },
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
  song: { title: "Hotel California", artist: "Eagles", spotifyQuery: "Hotel California Eagles", videoId: null, /* optional: future YouTubeMusicBackend (youtubeId = the free-tier embed) */ youtubeId: null, audioFile: "audio/chicken-music.mp3", audioCredit: "Music: SigmaMusicArt (royalty-free)" },
  recipe: { title: "Crispy Chicken Thighs", technique: "Crispy Pan-Fry", doneness: "Crispy skin, 175–185°F", emoji: "🍗" },
  heroImage: "assets/recipes/chicken/hero.jpg",
  equipmentNeeded: ["Cast iron or stainless pan", "Tongs", "Paper towels", "Cutting board & knife", "Instant-read thermometer"],
  ingredients: [
    { name: "chicken thighs", label: "bone-in, skin-on chicken thighs", measure: "4", noInline: true },
    { name: "oil", measure: "1 tbsp" },
    { name: "butter", measure: "2 tbsp" },
    { name: "salt", measure: "to taste", optional: true },
    { name: "pepper", measure: "to taste", optional: true },
  ],
  durationSec: 395, // ~6:30
  bpm: 75,

  portion: { label: "How many thighs?", unit: "thighs", base: 4, options: [2, 4, 6], perUnit: 0.04, clamp: [0.9, 1.15] },

  prep: [
    "Use bone-in, skin-on chicken thighs — the skin crisps up and the bone keeps the meat juicy.",
    "Pat the thighs VERY dry with paper towel — dry skin = crispy skin.",
    "Season both sides: salt, pepper, garlic powder, paprika.",
    "Use a cast-iron or stainless pan (not non-stick).",
    "Have tongs and an instant-read thermometer ready if you can.",
  ],

  prepSteps: [
    { title: "Pat the thighs very dry", instructions: "Start with bone-in, skin-on thighs. Press paper towels firmly against the skin until no more moisture comes off.", techniqueGuide: [
      "Bone-in, skin-on is the cut here — the skin renders to a crisp shell and the bone keeps the meat juicy and adds flavour.",
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
    { title: "Know the doneness target", instructions: "165°F / 74°C is the safe minimum — but bone-in thighs are best pulled at 175–185°F, where the dark meat turns tender and juicy.", techniqueGuide: [
      "165°F (74°C) is the food-safety floor for all chicken — never serve below it.",
      "Thighs are dark meat: they're at their best around 175–185°F, not 165°F like breast. The connective tissue melts and they go succulent instead of rubbery — and they can't dry out the way breast does.",
      "Check the thickest part right next to the bone (without touching it) — that spot is the last to come up to temp.",
      "No thermometer? Cut in by the bone — no pink, juices run clear. Better a minute longer than too soon.",
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
      body: "Skin up. 6–8 min more — aim for 175–185°F.",
      beginner: "Skin-side up now. Cook another 6 to 8 minutes to bring them all the way through — bone-in thighs take a little longer, and you're going past the 165°F safe mark up to 175–185°F so the dark meat goes tender, not rubbery. The meat closest to the bone is the last to finish.",
      voice: "Skin up now. Six to eight more minutes — take these bone-in thighs up toward 175 to 185 degrees so they're tender.",
      haptic: "tap",
    },
    { // outro fading (~6:00)
      at: 355, type: "temp", title: "Temp check 🌡️", heat: "medium",
      body: "By the bone: 165°F is safe, 175–185°F is best. No pink.",
      beginner: "Check the thickest part, right next to the bone but not touching it — that's the last spot to cook. 165°F / 74°C is safe to eat; for bone-in thighs keep going to 175–185°F, where the dark meat turns tender and juicy. No pink, juices run clear. No thermometer? Cut in by the bone to check it's not pink.",
      voice: "Check the thickest part next to the bone. 165 is safe, but take these thighs up to 175 to 185 so they're tender.",
      haptic: "tap",
      gate: {
        kind: "confirm",
        doneLabel: "Up to temp — done",
        notReadyCoach: "Not yet — it has to clear 165°F to be safe, and bone-in thighs are best at 175–185°F. Give it another minute or two, checking near the bone, then try again. Don't rush this one.",
        checkCoach: "Check again — tap “Up to temp — done” once the thickest part by the bone reads at least 165°F (175–185°F is ideal) with no pink.",
        doneCoach: "Perfect — safe and tender. Let it rest a moment.",
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
