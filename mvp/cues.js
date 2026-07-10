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
          beginner: "⏱️ Rest five minutes on the plate — NO cutting\n🧈 Drop the butter on top while it waits — melts right in\n👀 Then slice AGAINST the grain (across the lines)\n🎸 The steakhouse wanted forty-five and a reservation. First of many.",
          voice: "Off the grill and onto the plate — now it rests, five minutes. Drop the butter on top while it waits; it melts right in. Then slice against the grain. You just grilled a steakhouse steak for about fifteen bucks.", haptic: "double",
          warning: "Cut in early and the juices run out onto the plate — grey, dry steak. Give it the full 5 minutes.",
          custom: { beginner: "⏱️ Rest five minutes on the plate — NO cutting\n🧈 Drop the butter on top while it waits — melts right in\n👀 Then slice AGAINST the grain for tender bites\n🎸 The steakhouse wanted forty-five. First of many." } },
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
      body: "🍳 Heaviest pan, EMPTY, on HIGH\n⏱️ Gas ~2 min · ⚡ electric 3–4 — the coil lags\n👀 Screaming hot before the steak lands",
      beginner: "🍳 Heaviest pan (cast iron wins), EMPTY, on HIGH\n⏱️ Gas ~2 min · ⚡ electric 3–4 min — coils lag\n🔥 Screaming hot = seared steak; lukewarm = sad grey one\n⚠️ The handle gets hot too",
      voice: "Heaviest pan on high heat, empty. About two minutes on gas — closer to four on electric. It needs to be screaming hot.",
      haptic: "tap",
    },
    {
      at: 60, type: "action", title: "Add the oil", heat: "high",
      referenceImage: "assets/recipes/steak/steakcue2pan.png",
      body: "Thin layer of high-smoke-point oil. Swirl until it shimmers — skip olive oil, it'll burn.",
      beginner: "🫒 Add a thin layer — avocado or canola, NOT olive (burns bitter)\n👀 Shimmering, almost smoking = ready\n⏱️ Pan not ready? This step WAITS for you — don't rush it\n⚠️ Parked a while on electric? Pan off the coil a few seconds first",
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
      body: "Rest it 5+ minutes. Do NOT cut into it yet — and turn that burner OFF.",
      beginner: "⚠️ Turn the burner OFF — on electric, slide the pan away too\n⏱️ Rest five minutes, tented loose with foil — NO cutting\n👀 Let the juices settle back in instead of bleeding out\n🍷 Pour something. Don't touch it. I know you want to.",
      voice: "Burner off — then let it rest at least five minutes. Don't cut into it; that's what keeps it juicy.",
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
  recipe: { title: "Fluffy Scrambled Eggs", technique: "Soft Scramble", doneness: "Fluffy soft curds", emoji: "🍳" },
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
    "Your fat goes in the PAN, not the bowl — added later, once the pan's hot and brought down to medium-high.",
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
      beginner: "✋ Hands off — it feels like nothing's happening. It is.\n👀 Wait for bottom + edges: clear → solid WHITE (30–60s)\n✅ See white? Tap continue\n⚠️ Past white — browning or firm? Drop the heat, continue, keep the folding short",
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
      beginner: "🔥 Turn the heat down to MEDIUM-LOW\n🥄 Trace a slow figure-8, over and over — fold, don't whip\n👀 Low + steady = big soft folds breaking into fluffy curds\n⚠️ Look done already? Pan off the heat — you're ahead, not behind",
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
      at: 145, type: "tip", title: "Fluffy folds, still wet", heat: "medium-low", noCheckpoint: true,   // same: the warning reads in passing, the clock keeps rolling
      referenceImage: "assets/recipes/eggs/cue-4.png?v=2",
      body: "Big soft folds, still a little wet — wetter than feels right. Trust it.",
      beginner: "You should see pillowy folds breaking into fluffy curds, still a little wet — yes, even though your gut says cook them longer. Your gut's wrong here. They keep cooking from their own heat once you stop.",
      voice: "Big soft folds, still a little wet — looks underdone, and that's the point. Almost there.",
      warning: "Pull them while they still look underdone — on this heat they tip into rubbery fast, and you can't un-cook an egg.",
      haptic: "tap",
    },
    {
      at: 160, type: "action", title: "Take them off early", heat: "off",
      referenceImage: "assets/recipes/eggs/cue-5.png?v=2",
      body: "Off the heat just before done — slide the pan off AND turn the burner off. One more fold.",
      beginner: "🍳 SLIDE the pan off — onto the counter or a folded towel\n⚠️ Turn the burner OFF too — sliding saves the eggs, the dial saves you later\n🥄 Give one more gentle fold — the pan's own heat finishes them",
      voice: "Slide the pan off the burner and turn the burner off. One more gentle fold — the pan's own heat finishes them.",
      haptic: "double",
    },
    {
      at: 185, type: "temp", title: "Just set?",
      referenceImage: "assets/recipes/eggs/cue-6.png?v=2", // ⭐ the doneness-gate reference — "this is what done looks like"
      body: "Poke at them. Fluffy broken curds — pillowy soft pieces, no runny raw egg in the middle? Pull them — they keep cooking off the heat. You've got this.",
      beginner: "Poke at them. You want fluffy, broken-up curds — pillowy soft pieces, no runny raw liquid left. If they're still wet and raw in the middle, back on low for a few seconds, then check again. Pull them before they feel fully done — they finish off the burner. You've got this.",
      voice: "You want fluffy broken curds — pillowy soft pieces with no runny raw egg. Pull them now; they finish off the burner.",
      haptic: "tap",
      gate: {
        kind: "confirm",
        doneLabel: "Just set",
        notReadyCoach: "No rush — back on low for a few seconds, then check again. No runny raw egg, but keep the curds soft.",
        checkCoach: "How do they look? Tap “Just set” once there's no runny raw egg.",
        doneCoach: "Perfect — fluffy, soft curds.",
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
  timeBreakdown: "~3 min prep + up to 7 min (gas) or 12 (electric) to a rolling boil + ~10 min simmer + 6 min music finish",
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
      at: 207, type: "tip", title: "Adjust the consistency", heat: "off",
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
 * Crispy Pan-Fried Chicken Thighs. No-music/guided (de-synced 2026-07; the old Hotel California stand-in was dropped). Smash Burgers now carries chicken-music.mp3 as its phase-2 track.
 * The patient VERSES carry the key beginner lesson — don't touch it while the
 * fat renders — and the famous twin-guitar OUTRO at ~4:20 is the payoff: that's
 * when the skin has crisped and releases, so it's the flip. Then the 165°F
 * SAFETY gate + rest. `custom` copy (no song refs) shows when a premium cook
 * plays a different track. Audio mp3 isn't bundled yet (premium streams it);
 * `at` values are song positions, real cooking times stay in the copy.
 */
window.CRISPY_CHICKEN = {
  id: "crispy-chicken-thighs",
  // MUSIC SYNC REMOVED (2026-07-08): guided/timer-driven, no track. The song
  // block is kept for display only — audioFile/youtubeId null routes the cook
  // through the graceful no-music path (cues fire on the clock, muffle/duck no-op).
  noMusic: true,
  song: { title: "No soundtrack — cook at your pace", artist: "", spotifyQuery: "", videoId: null, youtubeId: null, audioFile: null, audioCredit: null },
  recipe: { title: "Crispy Chicken Thighs", technique: "Crispy Pan-Fry", doneness: "Crispy skin, 175–185°F", emoji: "🍗" },
  heroImage: "assets/recipes/chicken/hero.jpg",
  equipmentNeeded: ["Cast iron or stainless pan", "Tongs", "Paper towels", "Cutting board & knife", "Instant-read thermometer"],
  // Two methods (mirrors the steak pan/grill mechanism): "pan" inherits the
  // top-level cues (hot-start with oil); "grill" carries its own two-zone cues.
  methods: [
    { id: "pan", label: "Pan-fry", emoji: "🍳", technique: "Crispy Pan-Fry" },
    {
      id: "grill", label: "Grill", emoji: "🔥", technique: "Grill",
      equipmentNeeded: ["Grill (gas or charcoal)", "Tongs", "Paper towels", "Cutting board & knife", "Instant-read thermometer", "Plate for resting", "Oil + folded paper towel (for the grate)"],
      ingredients: [
        { name: "chicken thighs", label: "bone-in, skin-on chicken thighs", measure: "4", noInline: true },
        { name: "salt", measure: "to taste" },
        { name: "pepper", measure: "to taste" },
        { name: "garlic powder", measure: "1 tsp", optional: true },
        { name: "paprika", measure: "1 tsp", optional: true },
        // grate oil, not a pan fat — a film wiped on the grate so the skin won't stick
        { name: "oil", label: "Neutral oil — for the grate", measure: "1 tsp" },
      ],
      // Wizard = the working prep; the two-zone preheat runs in the background
      // (chickenGrillPrePhase in app.js) while these steps happen.
      prepSteps: [
        { title: "Pat the thighs very dry", voice: "Press paper towels firmly into the skin until nothing more comes off — dry skin is what goes crispy.", referenceImage: "assets/recipes/chicken/chicken-prep-1.webp", instructions: "Bone-in, skin-on thighs. Press paper towels firmly against the skin until no more moisture comes off.", techniqueGuide: [
          "Wet skin steams and stays rubbery — dry skin goes shatteringly crisp on the grill.",
          "Pat the skin side especially well; that's the side you sear first.",
          "Don't rinse raw chicken — it just splashes bacteria around the sink.",
        ] },
        { title: "Season both sides", voice: "Season both sides with salt and pepper — add garlic powder and paprika too if you have them.", referenceImage: "assets/recipes/chicken/chicken-prep-2.webp", instructions: "Season both sides with salt and pepper — plus garlic powder and paprika if you have them.", techniqueGuide: [
          "Sprinkle from a height so it lands evenly.",
          "Paprika adds colour and a gentle, smoky flavour that suits the grill.",
        ] },
        { title: "Clean up after raw chicken", voice: "Wash your hands, the board, and the knife with hot soapy water before you touch anything else — this is the one safety step never to skip.", referenceImage: "assets/recipes/chicken/chicken-prep-3.webp", instructions: "Wash your hands, the board, and the knife with hot soapy water before you touch anything else.", techniqueGuide: [
          "Raw chicken can carry bacteria — this is the one safety step never to skip.",
          "Keep the raw-meat tongs separate from the plate you'll serve on.",
        ] },
        { title: "Know the doneness target", voice: "The thermometer goes in the thickest part right next to the bone — safe at one sixty-five, best around one seventy-five to one eighty-five.", referenceImage: "assets/recipes/chicken/chicken-prep-5.webp", instructions: "165°F / 74°C is the safe minimum — bone-in thighs are best pulled at 175–185°F, where the dark meat turns tender.", techniqueGuide: [
          "165°F (74°C) is the food-safety floor for all chicken — never serve below it.",
          "Thighs are dark meat: best around 175–185°F, where the connective tissue melts and they go succulent.",
          "Check the thickest part right next to the bone (without touching it) — the last spot to come up to temp.",
        ] },
      ],
      // ── GRILL cues: real times, two-zone. Clock runs continuously except at gates. ──
      cues: [
        { at: 0, type: "action", title: "Skin down over DIRECT high", heat: "high",
          referenceImage: "assets/recipes/chicken/chicken-grill-sear.webp",
          body: "Skin-side down over the DIRECT hot zone, away from you. Lid up. Then leave them.",
          beginner: "🔥 Lay thighs skin-DOWN over the DIRECT high zone — away from you\n🚫 Keep the lid UP for the sear — and don't move them\n👀 They release when the skin's seared; forcing early tears it\n⏱️ About five to six minutes this side",
          voice: "Lay the thighs skin-side down over the direct high heat, away from you, and leave them to sear.",
          haptic: "double" },
        { at: 120, type: "tip", title: "Flare-up? Slide to indirect", heat: "high", noCheckpoint: true,
          referenceImage: "assets/recipes/steak/steakcue4grill.png",
          body: "Dripping fat makes flames lick up — slide the thighs to the INDIRECT side for a few seconds until they die down, then back.",
          beginner: "Rendering fat drips onto the flames and they flare up — normal. If flames start licking the skin, slide the thighs over to the indirect (off) side for a few seconds until it settles, then back over direct. That cool zone is your escape hatch — keep the lid up so you can watch.",
          voice: "Flames licking up? Slide the thighs to the indirect side for a moment until they settle, then back.",
          haptic: null },
        { at: 330, type: "flip", title: "Seared? Move to indirect, skin UP", heat: "medium",
          referenceImage: "assets/recipes/chicken/chicken-grill-move.webp",
          body: "Skin deep golden, grill-marked, releases freely? Move to the INDIRECT side, skin UP, lid DOWN.",
          beginner: "🍗 Lift a corner: deep golden, grill-marked, lets go freely = seared\n➡️ Move to the INDIRECT (off) side, skin UP\n🚫 Close the lid — it finishes by trapped heat, not flame\n⏳ Sticks or pale? Another minute over direct",
          voice: "Once the skin's deep golden and releases freely, move the thighs to the indirect side, skin up, and close the lid.",
          haptic: "strong",
          gate: { kind: "confirm", doneLabel: "Moved — lid down",
            notReadyCoach: "Sticking or still pale? Give it another minute over direct — but if you're past seven minutes, move it to indirect anyway before the skin chars.",
            checkCoach: "Deep golden and releasing? Tap “Moved — lid down” once they're over on the indirect side.",
            doneCoach: "Lid down — now it finishes gently over indirect heat.", nudgeSec: 45 } },
        { at: 360, type: "action", title: "Finish over indirect, lid down", heat: "medium",
          referenceImage: "assets/recipes/chicken/chicken-grill-indirect.webp",
          body: "Lid CLOSED. ~10–12 min to cook through — bone-in takes real time. Resist peeking.",
          beginner: "Lid closed, thighs skin-up on the indirect side. The trapped heat cooks them through like an oven — about 10 to 12 minutes for bone-in. Every peek dumps the heat you're building, so leave it shut until the check.",
          voice: "Lid closed, cook them through on the indirect side, ten to twelve minutes. Every peek dumps the heat — I know you want to look, but don't.",
          haptic: "tap" },
        { at: 1050, type: "temp", title: "Temp check 🌡️", heat: "medium",
          referenceImage: "assets/recipes/chicken/chicken-c355-temp.webp",
          body: "By the bone: 165°F is safe, 175–185°F is best. No pink.",
          beginner: "🌡️ Open the lid and probe the thickest part, next to the bone (not touching)\n✅ 165°F / 74°C = safe · 175–185°F = tender — under? Back to indirect, lid down, a few more minutes\n⚠️ No thermometer? Cut in by the bone AFTER the rest — no pink, clear juices",
          voice: "Probe the thickest part next to the bone — one sixty-five is the safety floor, but these thighs are best at one seventy-five to one eighty-five.",
          haptic: "tap",
          gate: { kind: "confirm", doneLabel: "Up to temp — done",
            notReadyCoach: "Not yet — back to the indirect side, lid down, a few more minutes, then check near the bone again. Don't rush this one.",
            checkCoach: "Check again — tap “Up to temp — done” once the thickest part by the bone is at temperature with no pink.",
            doneCoach: "Perfect — pull them to a plate to rest.", nudgeSec: 60 } },
        { at: 1062, type: "action", title: "Off the grill — to a plate", heat: "off", noCheckpoint: true,
          referenceImage: "assets/recipes/chicken/chicken-c375-rest.webp",
          body: "Pull the thighs onto a plate, skin up, and turn the burners down (charcoal: close the lid and vents).",
          beginner: "Move the thighs onto a clean plate, skin up. Turn the grill burners right DOWN, not off — a gas grill wants a few minutes to burn off the grease; shut it fully once you've eaten. (Charcoal: close the lid and vents.) The thighs rest off the heat now, not over the flame.",
          voice: "Pull the thighs onto a plate, skin up, and turn the burners down.",
          haptic: "double" },
        { at: 1075, type: "rest", title: "Rest 5 min", heat: "off",
          referenceImage: "assets/recipes/chicken/chicken-c375-rest.webp",
          warning: "Cut in early and the juices pour out — grey, dry chicken. Give it the full 5 minutes.",
          body: "Rest 5 minutes — the juices settle back in and the skin stays crisp.",
          beginner: "Rest the thighs 5 minutes on their plate — the hardest five of the cook. The juices settle back in so the meat stays moist, and they climb a few degrees on their own; that's the carryover finishing the job.",
          voice: "Rest them five minutes — the hardest five of the cook, while the juices settle back in.",
          haptic: "strong",
          gate: { kind: "confirm", doneLabel: "Rested — time to serve",
            notReadyCoach: "Not long enough yet? Good instinct — the juices need the full five minutes to settle back in.",
            checkCoach: "Five minutes up? No thermometer earlier? Cut in by the bone now — no pink and clear juices means serve; still pink means back over indirect, lid down, two to three minutes.",
            doneCoach: "Perfect — crisp skin, juicy meat. You're done.", nudgeSec: 300 } },
        { at: 1095, type: "finish", title: "Serve 🍗",
          referenceImage: "assets/recipes/chicken/chicken-c388-serve.webp",
          body: "Grill-crisped thighs, cooked by you, for about five bucks — the chicken joint wanted twenty-five and a wait. First of many.",
          beginner: "Serve them up skin proud. Bone-in thighs, grill-crisped and cooked safely through by YOU, for about five bucks — the chicken joint wanted twenty-five plus a wait. First of many.",
          voice: "Serve them up — grilled crispy thighs, cooked by you, for about five bucks when the chicken place wanted twenty-five. First of many.",
          haptic: "double" },
      ],
    },
  ],
  ingredients: [
    { name: "chicken thighs", label: "bone-in, skin-on chicken thighs", measure: "4", noInline: true },
    // hot-start method: a film of neutral oil is the anti-stick (a hot pan needs it — the cold start relied on gradual render to release)
    { name: "oil", label: "Neutral oil (high smoke point)", measure: "1 tbsp" },
    { name: "salt", measure: "to taste" },
    { name: "pepper", measure: "to taste" },
    { name: "garlic powder", measure: "1 tsp", optional: true },
    { name: "paprika", measure: "1 tsp", optional: true },
  ],
  durationSec: 1100, // CLOCK LENGTH ONLY — decoupled from any track (music sync removed). Covers the longer grill ladder; the pan finish fires at ~820.
  bpm: 75,
  totalTimeMin: 25,   // ~4 min prep + ~2.5 min preheat (gas) + ~7 min side one + ~5.5 min side two + 5 min rest
  timeBreakdown: "~4 min prep + heat the pan + ~7 min sear side + ~5–6 min second side + 5 min rest",

  portion: { label: "How many thighs?", unit: "thighs", base: 4, options: [2, 4, 6], perUnit: 0.04, clamp: [0.9, 1.15] },

  prep: [
    "Use bone-in, skin-on chicken thighs — the skin crisps up and the bone keeps the meat juicy.",
    "Pat the thighs VERY dry with paper towel — dry skin = crispy skin.",
    "Season both sides: salt and pepper — plus garlic powder and paprika if you have them.",
    "Use a cast-iron or stainless pan (not non-stick), and a little neutral oil.",
    "Have tongs and an instant-read thermometer ready if you can.",
  ],

  prepSteps: [
    { title: "Pat the thighs very dry", voice: "Press paper towels firmly into the skin until nothing more comes off — dry skin is what goes crispy.", referenceImage: "assets/recipes/chicken/chicken-prep-1.webp", instructions: "Start with bone-in, skin-on thighs. Press paper towels firmly against the skin until no more moisture comes off.", techniqueGuide: [
      "Bone-in, skin-on is the cut here — the skin renders to a crisp shell and the bone keeps the meat juicy and adds flavour.",
      "Wet skin steams and stays rubbery — dry skin goes shatteringly crisp.",
      "Pat the skin side especially well; that's the side you're crisping.",
      "Don't rinse raw chicken — it just splashes bacteria around the sink.",
    ] },
    { title: "Season both sides", voice: "Season both sides with salt and pepper — add garlic powder and paprika too if you have them.", referenceImage: "assets/recipes/chicken/chicken-prep-2.webp", instructions: "Season both sides with salt and pepper — plus garlic powder and paprika if you have them.", techniqueGuide: [
      "Sprinkle from a height so it lands evenly.",
      "Paprika adds colour and a gentle, smoky flavour.",
      "Lift any loose skin and season underneath it too, if you can.",
    ] },
    { title: "Clean up after raw chicken", voice: "Wash your hands, the board, and the knife with hot soapy water before you touch anything else — this is the one safety step never to skip.", referenceImage: "assets/recipes/chicken/chicken-prep-3.webp", instructions: "Wash your hands, the board, and the knife with hot soapy water before you touch anything else.", techniqueGuide: [
      "Raw chicken can carry bacteria — this is the one safety step never to skip.",
      "Don't let it touch other food, plates, or surfaces.",
      "A separate board kept just for raw meat is the safest habit.",
    ] },
    { title: "Set up your pan, oil & thermometer", voice: "Get a cast iron or stainless pan out — not nonstick — with a little neutral oil, tongs, and a thermometer if you have one.", referenceImage: "assets/recipes/chicken/chicken-prep-4.webp", instructions: "Use a cast-iron or stainless pan (not nonstick), a little neutral oil, tongs, and an instant-read thermometer if you have one.", techniqueGuide: [
      "Nonstick can't crisp the skin well at this heat — cast iron or stainless does.",
      "A neutral high-smoke-point oil (canola, vegetable, avocado) is the anti-stick for a hot start — not olive oil.",
      "Tongs let you flip without piercing the skin.",
      "The thermometer is how you KNOW it's safe — no guessing.",
    ] },
    { title: "Know the doneness target", voice: "The thermometer goes in the thickest part right next to the bone — safe at one sixty-five, best around one seventy-five to one eighty-five.", referenceImage: "assets/recipes/chicken/chicken-prep-5.webp", instructions: "165°F / 74°C is the safe minimum — but bone-in thighs are best pulled at 175–185°F, where the dark meat turns tender and juicy.", techniqueGuide: [
      "165°F (74°C) is the food-safety floor for all chicken — never serve below it.",
      "Thighs are dark meat: they're at their best around 175–185°F, not 165°F like breast. The connective tissue melts and they go succulent instead of rubbery — and they can't dry out the way breast does.",
      "Check the thickest part right next to the bone (without touching it) — that spot is the last to come up to temp.",
      "No thermometer? Cut in by the bone — no pink, juices run clear. Better a minute longer than too soon.",
    ] },
  ],

  // ── PAN cues (method "pan" inherits these): HOT START with oil, real times. ──
  // The high-heat preheat is a pre-phase (chickenPanPrePhase in app.js); the cook
  // clock below starts the moment the thighs go skin-down into the hot oil.
  cues: [
    { at: 0, type: "action", title: "Skin down into the hot oil", heat: "medium-high",
      referenceImage: "assets/recipes/chicken/chicken-c0-cold-pan.webp",
      warning: "Set each thigh's near edge down FIRST with tongs, then lower away from you — or hot oil splashes back. Smoking already? Pull the pan off the heat first.",
      body: "Lay the thighs skin-down into the shimmering oil, away from you. Don't move them.",
      beginner: "🔥 Skin-DOWN into the shimmering oil, away from you\n🧴 The oil's the anti-stick — they release when seared, don't force them\n👀 Deep golden + lets go freely = ready to flip (~7 min)",
      voice: "Lay the thighs skin-side down into the hot oil, away from you — they'll release on their own once the skin is seared.",
      haptic: "double" },
    { at: 30, type: "action", title: "Now leave them alone", heat: "medium-high", noCheckpoint: true,
      referenceImage: "assets/recipes/chicken/chicken-c0-cold-pan.webp",
      body: "Don't move them — I know you want to peek. Don't. They let go on their own once seared.",
      beginner: "Now leave them completely alone — I know the urge to poke is real. In a hot, oiled pan the skin sears and RELEASES itself; lift early and you tear it right off. Hands off; it tells you when.",
      voice: "Leave them alone — I know you want to poke them, but they release on their own once the skin is seared.",
      haptic: "tap" },
    { at: 180, type: "tip", title: "Searing — deep golden coming", heat: "medium", noCheckpoint: true,
      referenceImage: "assets/recipes/chicken/chicken-c160-render.webp",
      body: "Steady sizzle = searing and rendering. Ease to medium if it's spitting hard — good moment to wash the raw-chicken board.",
      beginner: "That steady sizzle is the skin searing and the fat rendering out. If it's spitting hard or smelling toasty, ease the heat to medium. Nothing to do but wait — wash up the raw-chicken board while it works.",
      voice: "That steady sizzle is the skin searing — ease to medium if it's spitting hard, and wash up the raw-chicken board while it works.",
      haptic: null },
    { at: 330, type: "tip", title: "Edges going deep golden", heat: "medium", noCheckpoint: true,
      referenceImage: "assets/recipes/chicken/chicken-c230-golden.webp",
      body: "Edges go deep golden first — the flip window's close. Too dark too fast? Drop the heat a notch.",
      beginner: "The skin's heading toward deep golden — the edges show it first. Almost there; don't flip early, it'll tell you when it's ready. Going dark too fast or smelling toasty? Drop the heat a notch. And if you're past about nine minutes on this side, take the flip check now, even if the edges aren't perfect.",
      voice: "Nearly there — the skin's going deep golden. Don't rush the flip.",
      haptic: "tap" },
    { at: 420, type: "flip", title: "Deep golden? Flip 🍗", heat: "medium",
      referenceImage: "assets/recipes/chicken/chicken-c260-release.webp",
      warning: "Hot oil and rendered fat in the pan — spoon most of it off into a heatproof mug before flipping, and flip AWAY from you so it can't spit.",
      body: "Skin deep golden + releases freely = flip. Sticks = wait.",
      beginner: "🥄 Spoon most of the hot fat into a heatproof mug first\n🍗 Lift a corner: deep golden + lets go freely = flip AWAY from you\n⏳ Sticks? Not seared yet — another minute, then check",
      voice: "Spoon most of the hot fat off into a heatproof mug first — then lift one, and if it's deep golden and releases freely, flip it away from you.",
      haptic: "strong",
      gate: { kind: "confirm", doneLabel: "Crisp — flipped",
        notReadyCoach: "If it's sticking, the skin isn't seared yet. Leave it another minute — it releases on its own when it's ready.",
        checkCoach: "How's the skin? Tap “Crisp — flipped” once it's deep golden and lets go freely.",
        doneCoach: "Beautiful. Now cook it through on the second side.", nudgeSec: 45 } },
    { at: 450, type: "action", title: "Cook it through", heat: "medium",
      referenceImage: "assets/recipes/chicken/chicken-c300-skin-up.webp",
      body: "Skin up. ~5–7 min more — aim for 175–185°F.",
      beginner: "Skin-side up now. Cook another 5 to 7 minutes to bring them all the way through — bone-in thighs go past the 165°F safe mark up to 175–185°F so the dark meat turns tender, not rubbery. The meat closest to the bone finishes last.",
      voice: "Skin up now — five to seven more minutes, taking these bone-in thighs up toward one seventy-five to one eighty-five so they're tender.",
      haptic: "tap" },
    { at: 780, type: "temp", title: "Temp check 🌡️", heat: "medium",
      referenceImage: "assets/recipes/chicken/chicken-c355-temp.webp",
      body: "By the bone: 165°F is safe, 175–185°F is best. No pink.",
      beginner: "🌡️ Slide the pan OFF the burner while you check\n👀 Probe the thickest part, next to the bone (not touching)\n🔥 165°F / 74°C = safe · 175–185°F = tender — under? Back on a couple minutes\n⚠️ No thermometer? Cut in by the bone AFTER the rest — no pink, clear juices",
      voice: "Check the thickest part next to the bone — one sixty-five is the safety floor, but these thighs are best at one seventy-five to one eighty-five.",
      haptic: "tap",
      gate: { kind: "confirm", doneLabel: "Up to temp — done",
        notReadyCoach: "Not yet — give it another minute or two and check near the bone again. Don't rush this one; it has to clear the safety floor.",
        checkCoach: "Check again — tap “Up to temp — done” once the thickest part by the bone is at temperature with no pink.",
        doneCoach: "Perfect — burner off next, then they rest.", nudgeSec: 45 } },
    { at: 792, type: "action", title: "Burner OFF — thighs to a plate", heat: "off", noCheckpoint: true,
      referenceImage: "assets/recipes/chicken/chicken-c375-rest.webp",
      body: "Turn the burner OFF, slide the pan away, and move the thighs to a plate or board — skin up.",
      beginner: "Turn the burner off and slide the pan off it — on electric the coil stays hot for minutes either way. Move the thighs to a plate or board, skin up, so they stop cooking and the skin stays crisp.",
      voice: "Turn the burner off and slide the pan away, then move the thighs to a plate — skin up.",
      haptic: "double" },
    { at: 805, type: "rest", title: "Rest 5 min", heat: "off",
      referenceImage: "assets/recipes/chicken/chicken-c375-rest.webp",
      warning: "Cut in early and the juices pour out — grey, dry chicken and soggy skin. Give it the full 5 minutes.",
      body: "Rest 5 minutes — the juices settle back in and the skin stays crisp.",
      beginner: "Rest the thighs 5 minutes on their plate — the hardest part of the cook is doing nothing. The juices settle back in so the meat stays moist, and they climb a few degrees on their own; that's the carryover finishing the job.",
      voice: "Rest them five minutes — the hardest part of the cook is doing nothing while the juices settle back in.",
      haptic: "strong",
      gate: { kind: "confirm", doneLabel: "Rested — time to serve",
        notReadyCoach: "Not long enough yet? Good instinct — the juices need the full five minutes to settle back in.",
        checkCoach: "Five minutes up? No thermometer earlier? Cut in by the bone now — no pink and clear juices means serve; still pink means back on medium for two to three minutes.",
        doneCoach: "Perfect — crisp skin, juicy meat. You're done.", nudgeSec: 300 } },
    { at: 825, type: "finish", title: "Serve 🍗",
      referenceImage: "assets/recipes/chicken/chicken-c388-serve.webp",
      body: "Crispy-skin thighs, cooked by you, for about five bucks — the fried-chicken app wanted twenty-five and a wait. First of many.",
      beginner: "Serve them up crispy-side proud. Four thighs with shatteringly crisp skin, cooked safely through by YOU, for about five bucks — the fried-chicken app wanted twenty-five plus a delivery wait. First of many.",
      voice: "Serve them up — crispy chicken thighs, cooked by you, for about five bucks when the fried-chicken app wanted twenty-five. First of many.",
      haptic: "double",
      custom: { beginner: "Serve them up crispy-side proud. Four thighs with shatteringly crisp skin, cooked safely through by YOU, for about five bucks — the fried-chicken app wanted twenty-five plus a delivery wait. First of many." },
    },
  ],
};

// all music-synced cooks (first = featured)
window.SMASH_BURGERS = {
  id: "smash-burgers",
  // PHASE-2 MUSIC: silence + guided cues through round one, then the track starts at the
  // "Round two — run it back" cue (musicStartAt = 190, that cue's at-time) and plays to the
  // finish. Before 190 the graceful no-music path runs (cues/voice/timers). filePos = clamp(
  // songPos - musicStartAt + songStartOffset, 0, dur) offsets the file so it starts from the
  // top at t=190; songStartOffset default 0 (future: bump so the ~262s solo lands on the
  // round-two wait 225-300 — see CHOREOGRAPHY FLAG below). youtubeId null → embed hidden,
  // no layout gap; setting it later flips the badge + branding + embed on with ZERO code.
  noMusic: false,
  song: { title: "Hotel California", artist: "Eagles", spotifyQuery: "Hotel California Eagles", videoId: null, youtubeId: null, audioFile: "audio/chicken-music.mp3", audioCredit: "Music: SigmaMusicArt (royalty-free)", musicStartAt: 190, songStartOffset: 0, phase2Blurb: "🎵 Synced to Hotel California — it kicks in for round two, the solo playing while your crust forms." },
  // CHOREOGRAPHY FLAG (future video link, decide nothing now): playback starts at cook-clock
  // 190 and the cook ends ~380, so only ~190s of the ~391s song plays — from the TOP that's
  // intro+verses; the famous solo (~262s in) lands past the cook's end. When the video links,
  // either accept intro/verses or set songStartOffset so the solo lands on the round-two wait
  // (225-300). songStartOffset support is built now (default 0) → that decision is data-only.
  recipe: { title: "Smash Burgers", technique: "Smash & Sear", doneness: "Lacy crispy edges, juicy middle", emoji: "🍔" },
  heroImage: "assets/recipes/smash/hero.webp",
  // ENGINE pan gate: dry ripping-hot pan only — nonstick GRAYS OUT with honest copy.
  cookNeeds: { pans: ["cast-iron", "stainless"], panReason: "a ripping-hot dry pan — a dry surface is what makes the beef grip and crust", panBlockedCopy: "Not this time — smash burgers need a ripping-hot dry pan, and nonstick can't take that heat (the coating breaks down and the crust never forms). Cast iron or stainless only for this one." },
  equipmentNeeded: ["Cast iron or stainless pan", "Stiff metal spatula", "Paper towel (your smash shield)", "Plate for the balls", "Foil to tent finished burgers"],
  durationSec: 380,
  bpm: null,
  totalTimeMin: 20,
  timeBreakdown: "~10 min prep (balls, buns, toppings) + 3–5 min pan preheat + ~6–7 min cooking in rounds",
  cookWarning: "The one way to wreck a smash burger is a pan that isn't hot enough — you get a grey steamed patty instead of a crispy brown crust. Preheat like you mean it, and open a window first: real crust makes real smoke.",
  portion: { label: "How many burgers?", unit: "burgers", base: 2, options: [1, 2, 3, 4], perUnit: 0, clamp: [1, 1] },
  servingNote: "Half a pound of beef makes 2 burgers — every burger cooks in its own quick round, so timing never changes.",
  methods: [
    { id: "double", label: "Double Stack", emoji: "🍔🍔", technique: "Two thin patties, cheese melted between", note: "The restaurant move: double the crust, cheese glues the stack. Barely harder — you smash two small balls instead of one." },
    { id: "single", label: "Single Patty", emoji: "🍔", technique: "One patty, one smash, done", note: "The simplest possible burger. Same crust, one smash." },
  ],
  ingredients: [
    { name: "ground beef", label: "Ground beef, 80/20", measure: "½ lb", noInline: true },
    { name: "burger buns", label: "Burger buns", measure: "2" },
    { name: "american cheese", label: "American cheese slices", measure: "2 slices" },
    { name: "salt", measure: "to taste" },
    { name: "pepper", measure: "to taste" },
    { name: "butter", label: "Butter — for the buns", measure: "1 tbsp" },
    { name: "pickles", measure: "to taste", optional: true },
    { name: "lettuce", measure: "to taste", optional: true },
    { name: "tomato", measure: "to taste", optional: true },
    { name: "onion", measure: "to taste", optional: true },
    { name: "mayonnaise", label: "Mayo — for the 30-sec sauce", measure: "⅓ cup", optional: true },
    { name: "mustard", label: "Yellow mustard — for the sauce", measure: "1 tsp", optional: true },
  ],
  prep: [
    "Ball the beef (loosely!) and keep it COLD in the fridge until it hits the pan.",
    "Fold a paper-towel square — your smash shield (or a flattened sandwich bag).",
    "Slice/shred toppings and mix the sauce now — no time once the pan's hot.",
    "Toast the buttered buns first, in the not-yet-ripping pan.",
    "Open a window / fan on — real crust makes real smoke.",
    "Stage everything within arm's reach — pit-crew mode.",
  ],
  prepSteps: [
    { title: "Open a window / fan ON", referenceImage: "assets/recipes/smash/prep-vent.webp",
      instructions: "Real talk: this gets smoky. That smoke is the crust forming — it's the good kind. Fan on, window open, smoke alarm appeased in advance.",
      voice: "This one gets smoky, and that smoke is the crust forming. Turn your fan on and crack a window before you start." },
    { title: "Ball the beef — loosely, keep it cold", referenceImage: "assets/recipes/smash/prep-balls.webp",
      instructions: "Divide the beef into 4 equal pieces (~2 oz each — golf-ball size). Roll LOOSELY into balls — don't pack them tight. Two balls = one burger. Back in the fridge until the second they hit the pan. ❄️ Cold beef = juicy burger — the fat stays put until it meets the heat. (Room-temp rules are for steak. Not here.)",
      voice: "Divide the beef into four equal golf-ball-sized pieces and roll them loosely — don't pack them tight. Then put them back in the fridge; cold beef makes a juicier burger.",
      techniqueGuide: ["Loose balls = more craggy surface = more crust.", "Two 2 oz balls per burger on the double; the fridge keeps the fat firm until the smash."],
      methodAlt: { single: {
        instructions: "Divide the beef into 2 equal pieces (~4 oz each). Roll LOOSELY into balls — don't pack them tight. One ball = one burger. Back in the fridge until the second they hit the pan. ❄️ Cold beef = juicy burger — the fat stays put until it meets the heat. (Room-temp rules are for steak. Not here.)",
        voice: "Divide the beef into two equal pieces and roll them loosely into balls — don't pack them tight. Then back in the fridge; cold beef makes a juicier burger.",
        techniqueGuide: ["Loose balls = more craggy surface = more crust.", "One 4 oz ball per burger; the fridge keeps the fat firm until the smash."] } } },
    { title: "Fold your smash shield", referenceImage: "assets/recipes/smash/prep-shield.webp",
      instructions: "Fold a square of paper towel into a small pad — your smash shield, one per patty you're pressing at a time. It keeps the beef off the spatula, not off the pan (that stick is the point). A sandwich or ziploc bag laid flat works too. No paper at all? Press with the flat bottom of a small pot or a second pan — or just the spatula; if beef sticks to it, scrape it back down and keep pressing, it's only cosmetic. Parchment works if you happen to have it.",
      voice: "Fold a square of paper towel into a small pad — that's your smash shield. A flattened sandwich bag works too, or just press with the bottom of a small pot. It keeps the beef off the spatula, not off the pan." },
    { title: "Toppings + sauce ready", referenceImage: "assets/recipes/smash/prep-toppings.webp",
      instructions: "Slice or shred anything you're using, and mix the sauce if you're making it — a third cup mayo plus a teaspoon of yellow mustard, stirred. Once the pan's hot there is NO time to chop.",
      voice: "Slice or shred your toppings now, and mix the sauce if you want one — mayo and a little yellow mustard. Once the pan's hot there's no time to chop." },
    { title: "Toast the buns NOW", referenceImage: "assets/recipes/smash/prep-buns.webp",
      instructions: "Butter the cut sides and toast them face-down in the not-yet-ripping pan over medium until golden, then set them on a plate. Buns first, burgers second — the burger will not wait for the bun.",
      voice: "Butter the buns and toast them face-down in the pan over medium until golden, then set them aside. Buns first — the burger won't wait for the bun." },
    { title: "Stage it — pit-crew mode", referenceImage: "assets/recipes/smash/prep-stage.webp",
      instructions: "Spatula, your paper-towel smash pads, cheese unwrapped, buns dressed with sauce and toppings, foil for the finished burgers — and the beef still in the fridge. Everything within arm's reach.",
      voice: "Lay everything out within arm's reach: spatula, your smash pads, unwrapped cheese, dressed buns, foil. Beef stays in the fridge till the last second." },
  ],
  // PAN cook clock (380s). Round-tagged cues drop at portion 1 (see smashCues in app.js);
  // methodAlt carries the single-patty variants. Terminal burner-off is its own cue so a
  // 1-burger cook is never left on high.
  cues: [
    { at: 0, type: "action", title: "Balls in — then SMASH", heat: "high",
      referenceImage: "assets/recipes/smash/cue-smash.webp",
      body: "Two cold balls into the pan, a few inches apart. Lay a paper-towel pad on each, then smash straight down — hard, thinner than feels right and wider than the bun — and hold the press 10 seconds. Lean back; it spits hot fat.",
      beginner: "🥩 2 cold balls into the pan, apart from each other\n🧻 Paper-towel pad on top of each (or the flat of a pot)\n⚠️ Lean back before you smash — it spits hot fat\n💪 SMASH straight down with the spatula — hard, thin, wider than the bun\n🤚 Hold the press 10 seconds",
      voice: "Two cold balls into the pan, a few inches apart. Paper-towel pad on top, then smash straight down with your spatula — hard. Thinner than feels right, wider than the bun. Hold the press for ten seconds and keep your face back.",
      haptic: "double",
      methodAlt: { single: {
        body: "One cold ball per burger into the pan. Paper-towel pad on top, then smash straight down — hard, thinner than feels right and wider than the bun — and hold 10 seconds. Lean back; it spits hot fat.",
        beginner: "🥩 1 cold ball per burger into the pan\n🧻 Paper-towel pad on top (or the flat of a pot)\n⚠️ Lean back before you smash — it spits hot fat\n💪 SMASH straight down — hard, thin, wider than the bun\n🤚 Hold 10 seconds",
        voice: "One cold ball into the pan. Paper-towel pad on top, then smash straight down — hard. Thinner than feels right, wider than the bun. Hold it ten seconds and keep your face back." } } },
    { at: 20, type: "action", title: "Peel + season", heat: "high",
      referenceImage: "assets/recipes/smash/cue-season.webp",
      body: "Peel the pad off slowly and season the wet tops generously with salt and pepper. Then leave them completely alone — the pan's doing the work.",
      beginner: "🧻 Peel the pad off slowly\n🧂 Salt + pepper on the wet tops — be generous\n✋ Then DON'T TOUCH. The pan is doing the work",
      voice: "Peel the pad off slowly, season the tops well with salt and pepper — and then leave them completely alone. The pan is doing the work now." },
    // DEMOTED to a noCheckpoint TIP (was a flip-ready GATE that fired ~105s before the actual
    // flip at:150 — an on-pace cook looped its not-ready coach or flipped early). It now rides the
    // clock as a watch-for; the flip CONFIRM lives on the flip cue itself (at:150), per the
    // eggs-cue-3 rule (a cue's gate matches that cue's action).
    { at: 45, type: "tip", title: "Watch the edges — don't poke", heat: "high", noCheckpoint: true,
      referenceImage: "assets/recipes/smash/cue-lacy-edges.webp",
      body: "Edges going lacy and crispy? That's the crust building — don't flip yet, let it keep searing. Smell the sear; that's the whole point of a smash.",
      beginner: "👀 Edges going lacy + crispy? That's the crust building\n✋ Don't flip yet — the crust needs the full sear\n🔥 Smell the sear — that's the whole point of smash",
      voice: "See the edges going lacy and crispy? That's the crust building. Don't flip yet — let it keep searing." },
    // Now the flip CHECKPOINT: the sensory flip-ready confirm co-located with the flip action —
    // deep-brown crust you can see + the patty releasing clean instead of tearing (§4 gate coaches).
    { at: 150, type: "action", title: "SCRAPE and flip", heat: "high",
      referenceImage: "assets/recipes/smash/cue-scrape-flip.webp",
      body: "Spatula flat and low, 45 degrees into the pan — scrape hard under the patty so all the brown crust comes with it. It releases clean when the crust's ready; if it tears, give it a few more seconds. Then flip in one motion.",
      beginner: "🔪 Spatula flat + LOW, 45° into the pan — scrape UNDER the crust\n🥞 Get ALL the brown — it belongs to the burger, not the pan\n👀 Releases clean = ready · tears = a few more seconds\n🔄 Flip in one motion",
      voice: "Get the spatula flat and low, forty-five degrees into the pan, and scrape hard under the patty — all of that brown crust belongs to the burger, not the pan. Then flip it in one motion.",
      gate: { kind: "confirm", doneLabel: "Deep brown — flipped", prompt: "Did it release with a deep-brown crust — no tearing, all that brown came off with the patty?", notReadyCoach: "Still tearing or sticking? Give it another thirty seconds — the crust comes off clean when it's ready, not before.", doneCoach: "That's the crust. Cheese on, fast — side two's quick.", nudgeSec: 40 } },
    { at: 165, type: "action", title: "Cheese ON — stack — OUT", heat: "high",
      referenceImage: "assets/recipes/smash/cue-cheese-stack.webp",
      body: "Cheese on one patty the second it's flipped, then stack the other patty on top of the cheese. Side two is fast — 30 to 45 seconds — then slide the stack onto its bun and tent with foil.",
      beginner: "🧀 Cheese on one patty the SECOND it's flipped\n🍔 Other patty goes on top of the cheese\n⏱️ 30–45 seconds max — side two is fast\n🚚 Slide the stack onto its bun, tent with foil",
      voice: "Cheese on one patty the second it lands, then stack the other patty right on top of the cheese. Side two only needs thirty seconds — then slide the whole stack onto its bun.",
      methodAlt: { single: {
        body: "Cheese on the patty the second it's flipped. Side two is fast — 30 to 45 seconds — then slide it onto its bun and tent with foil.",
        beginner: "🧀 Cheese on the SECOND it's flipped\n⏱️ 30–45 seconds — side two is fast\n🚚 Slide it onto its bun, tent with foil",
        voice: "Cheese on the second it's flipped. Side two only needs thirty seconds — then slide it straight onto its bun." } },
      gate: { kind: "confirm", doneLabel: "Burger one is on its bun", notReadyCoach: "Cheese not melty? Ten more seconds — the patty heat does it.", doneCoach: "That's the move — keep the rhythm going.", nudgeSec: 40 } },
    { at: 190, type: "action", title: "Round two — run it back", heat: "high", round: 2, referenceImage: "assets/recipes/smash/cue-smash.webp",
      body: "Round two — next cold balls into the same spots, pad on, smash hard, hold 10 seconds, then peel and season. Same as round one.",
      beginner: "🥩 Next cold balls in — same spots\n💪 Pad on, SMASH, hold 10\n🧂 Peel + season — you know the drill",
      voice: "Round two. Next cold balls in, pad on, smash hard, hold ten seconds, peel and season. You know the drill now — that's the whole skill." },
    { at: 235, type: "action", title: "Edges again — patience again", heat: "high", round: 2, referenceImage: "assets/recipes/smash/cue-lacy-edges.webp",
      body: "Wait for those lacy brown edges again — hands off until you see them.",
      beginner: "👀 Lacy brown edges = go\n✋ Hands off until then",
      voice: "Same as before — wait for those lacy brown edges, hands off until you see them.",
      gate: { kind: "confirm", doneLabel: "Lacy — flipping", notReadyCoach: "Thirty more seconds. The crust decides, not the clock.", doneCoach: "Scrape, flip, cheese, stack — bring it home." } },
    { at: 300, type: "action", title: "Scrape, flip, cheese — last one", heat: "high", round: 2,
      referenceImage: "assets/recipes/smash/cue-cheese-stack.webp",
      body: "Scrape and flip the last burger, add cheese, stack, give it 30 seconds, then slide it onto its bun.",
      beginner: "🔄 Scrape + flip the last burger\n🧀 Cheese, stack, 30 seconds\n🚚 Onto its bun",
      voice: "Scrape and flip the last one, cheese, stack, thirty seconds, and slide it onto its bun. Burner off next." },
    { at: 335, type: "action", title: "Burner OFF — pan off the heat", heat: "off",
      referenceImage: "assets/recipes/smash/cue-burner-off.webp",
      body: "Turn the burner off and slide the pan off the heat — cast iron holds heat for ages. Get every burger onto its bun, tented with foil.",
      beginner: "🔴 Burner OFF\n➡️ Slide the pan off the heat — cast iron holds heat for ages\n🚚 Every burger on its bun, tented with foil",
      voice: "Turn the burner off and slide the pan off the heat — cast iron stays hot for minutes. Every burger's on its bun now." },
    { at: 355, type: "temp", title: "Doneness check — the easy one", heat: "off",
      referenceImage: "assets/recipes/smash/cue-doneness.webp",
      body: "Smashed-thin patties cook through by the time the crust forms. If you're unsure, peek inside one — juicy grey-brown, no wet pink middle. Cheese melted means you're there.",
      beginner: "✅ Smashed-thin patties cook through by the time the crust forms — that's the trick\n👀 Any doubt: peek inside one — no pink jelly-wet middle, just juicy grey-brown\n🧀 Cheese melted = you're there",
      voice: "Here's the smash burger secret — the patties are so thin they cook through by the time the crust forms. If you're ever unsure, peek inside one: juicy, not wet and pink. Cheese melted means you're there.",
      gate: { kind: "confirm", doneLabel: "Cooked through — building", notReadyCoach: "Middle looks wet? Turn the burner back to high, give the pan thirty seconds, then back in for twenty seconds a side — thin patties recover fast.", doneCoach: "Build it while it's hot." } },
    { at: 375, type: "finish", title: "Build it — eat it NOW 🍔", heat: "off",
      referenceImage: "assets/recipes/smash/cue-finish.webp",
      body: "Sauce on the bottom bun, then pickles, lettuce, the patty stack, and the top bun. Eat it now — resting turns the crispy edges soggy within a minute.",
      beginner: "🥪 Sauce on the bottom bun, pickles, lettuce → patty stack → top bun\n🚫 Eat it now — resting makes this WORSE: the crispy edges go soggy within a minute\n📸 One photo, then eat while it's loud",
      voice: "Build it — sauce on the bottom bun, pickles and lettuce, patty stack, top bun. And no resting: unlike your steak, this one gets worse by the minute. A smash burger this good costs about three bucks — the burger app wanted eighteen. First of many." },
  ],
};

// ── CHICKEN FRIED RICE — guided (music-READY but silent) ───────────────────────
// Authored per docs/recipes/chicken-fried-rice.md as a noMusic EXPERIENCE (synced
// engine + prep wizard + gates), song:null-placeholder + music_ready:true. Cues carry
// natural landing beats (chicken sear, veg sauté, egg scramble, final toss) so wiring
// a track later is data-only. The `at` ladder = cumulative typical step durations.
window.CHICKEN_FRIED_RICE = {
  id: "chicken-fried-rice",
  noMusic: true,
  music_ready: true,
  song: { title: "No soundtrack — cook at your pace", artist: "", spotifyQuery: "", videoId: null, youtubeId: null, audioFile: null, audioCredit: null },
  recipe: { title: "Chicken Fried Rice", technique: "Stir-Fry", doneness: "Juicy chicken, fluffy egg, toasty rice", emoji: "🍚" },
  // Guided cook clock (noMusic): the cue `at`-ladder is the cook TIMELINE, not a song sync —
  // nothing plays. durationSec spans the cook cues (finish at 710 + a short tail); totalTimeMin
  // is the honest end-to-end (prep + preheat + cook ladder). The oil heat is a separate, skippable
  // pre-phase (screens.preCook via friedricePrePhase()), so the cook clock starts at the FIRST
  // CHICKEN CUE (at:0). PHASE LABELS (display eyebrow, forward-filled in the cook engine): the
  // first cue of each ladder segment carries `phaseLabel` — "Phase 2 · The Chicken" (the 4-cue
  // chicken segment) and "Phase 3 · Bring it together" (veg → finish). Phase 1 is the preheat
  // pre-phase (its own phaseLabel in the preCook top bar). bpm null — no soundtrack.
  bpm: null,
  durationSec: 730,
  totalTimeMin: 20,
  timeBreakdown: "~5 min prep + ~2–4 min oil heat + ~12 min cooking",
  heroImage: "assets/recipes/friedrice/hero.webp",
  equipmentNeeded: ["Large nonstick pan or wok", "Spatula", "Small bowl", "Plate for the chicken"],
  // All pans allowed (fried rice isn't pan-restricted); recommend nonstick in the gate copy.
  cookNeeds: { pans: ["nonstick", "cast-iron", "stainless"], panReason: "Nonstick or a seasoned wok is easiest here — egg and rice love to stick. Stainless works if you're confident with enough oil and a hot pan." },
  cookWarning: "The one thing that turns fried rice to mush is wet, fresh, hot rice. Cold day-old rice fries up light and separate — fresh rice steams into a clump. If your rice is fresh, spread it on a tray and cool it first (there's a step for that).",
  ingredients: [
    { name: "cooked rice", label: "Cooked rice — cold day-old is best", measure: "3 cups", noInline: false },
    { name: "chicken breast", label: "Chicken breast", measure: "3/4 lb (2 breasts), diced small", noInline: true },
    { name: "eggs", label: "Eggs", measure: "2 large" },
    { name: "soy sauce", label: "Soy sauce — low-sodium if you have it", measure: "3 tbsp" },
    { name: "frozen peas and carrots", label: "Frozen peas & carrots", measure: "1 cup (straight from frozen)", optional: true, defaultOff: false },
    { name: "green onions", label: "Green onions", measure: "3, sliced", optional: true, defaultOff: false },
    { name: "garlic", label: "Garlic", measure: "2 cloves, minced", optional: true, defaultOff: false },
    { name: "cooking oil", label: "Cooking oil", measure: "1 tbsp" },
    { name: "sesame oil", label: "Sesame oil — optional, big flavor", measure: "1 tsp", optional: true, defaultOff: true },
    { name: "sriracha", label: "Sriracha — for serving", measure: "to taste", optional: true, defaultOff: true },
  ],
  prepSteps: [
    { title: "Sort your rice — the make-or-break step", guide: "Cold day-old rice = light and separate. Fresh/warm rice = mush.", voice: "Cold day-old rice fries up light and separate. If yours is cold, just break up the clumps with your fingers.", referenceImage: "assets/recipes/friedrice/friedrice-prep-1.webp", instructions: "Cold day-old rice is best — break up any clumps with your fingers.", techniqueGuide: [
      "❄️ Cold leftover rice? Perfect — break up any clumps with your fingers.",
      "🔥 Only have fresh or warm rice? Spread it thin on a tray, pop it in the freezer ten minutes while you prep — that dries it out enough.",
      "📦 Microwave pouches work too — cook, then cool a few minutes.",
    ] },
    { title: "Dice the chicken small", guide: "¾ lb ≈ 2 breasts. Small half-inch cubes cook fast and even.", voice: "Cut the chicken into small half-inch cubes — smaller than you think — so it cooks fast and evenly.", referenceImage: "assets/recipes/friedrice/friedrice-prep-2.webp", instructions: "Cut into small half-inch cubes; even sizes cook at the same rate.", techniqueGuide: [
      "🔪 Cut into small half-inch cubes — smaller than you think.",
      "👀 Even sizes mean everything cooks at the same time.",
      "🧼 Wash your hands and the board after raw chicken.",
    ] },
    { title: "Crack and beat the eggs", guide: "Two eggs in a small bowl, beaten and ready to pour.", voice: "Crack two eggs into a small bowl and beat them with a fork until the yolk and white are one colour.", referenceImage: "assets/recipes/friedrice/friedrice-prep-3.webp", instructions: "Beat two eggs in a small bowl until one colour, ready to pour.", techniqueGuide: [
      "🥚 Crack two eggs into a bowl.",
      "🥄 Beat with a fork until the yolk and white are one colour.",
    ] },
    { title: "Prep the flavour crew", guide: "Mince the garlic, slice the green onions, measure the soy.", voice: "Mince the garlic, slice the green onions, and measure the soy sauce so it's all ready to pour.", referenceImage: "assets/recipes/friedrice/friedrice-prep-4.webp", instructions: "Mince garlic, slice green onions, measure the soy — leave the frozen veg frozen.", techniqueGuide: [
      "🧄 Mince two cloves of garlic, or a squeeze of the jar stuff.",
      "🌱 Slice three green onions into thin rounds.",
      "🥣 Measure three tablespoons of soy sauce so it's ready to pour.",
      "❄️ Leave the frozen peas and carrots frozen — they go in straight from the bag.",
    ] },
    { title: "Stage it all by the stove", guide: "Rice, chicken, eggs, veg, soy, oil — all within reach. Fried rice waits for no one.", voice: "Line everything up within arm's reach — fried rice cooks fast, so you won't have time to hunt for things once the pan's hot.", referenceImage: "assets/recipes/friedrice/friedrice-prep-5.webp", instructions: "Everything within reach, an empty plate for the cooked chicken, spatula in hand.", techniqueGuide: [
      "🍚 Everything in arm's reach.",
      "🍳 An empty plate ready for the cooked chicken.",
      "🥄 Spatula in hand.",
    ] },
  ],
  // ── PRE-COOK preheat (screens.preCook, driven by friedricePrePhase() in app.js) ──
  // Fried rice oil heats WITH the pan (not a dry preheat): oil in, then medium-high until it
  // shimmers. The shimmer IS the gate; the timer is just a backup clock, stove-split in
  // friedricePrePhase() (gas ~60s / electric ~120s — electric coils lag). skippable for anyone
  // whose pan's already hot — Skip routes straight into the first chicken cue (pan assumed hot).
  // (timer.sec is injected per-stove by friedricePrePhase(); left out here on purpose.)
  prePhase: {
    title: "Heat the oil",
    intro: "Fried rice cooks fast, so get the oil hot first. Oil in, medium-high, and wait for the shimmer — that's your green light before the chicken goes in.",
    startLabel: "Start heating ⏱",
    steps: [
      { title: "Oil in — medium-high", heat: "medium-high", referenceImage: "assets/recipes/friedrice/friedrice-c1.webp", body: "Add 1 tbsp cooking oil to the pan and set the heat to medium-high. Swirl it once to coat the bottom, then let it heat — nothing else in yet.", voice: "Add a tablespoon of oil to the pan over medium-high heat, and give it a moment until it shimmers and flows easily." },
    ],
    timer: { label: "Heating the oil", earlyLabel: "It's shimmering ▸", phaseLabel: "preheat", note: "The shimmer is the real signal — this timer's just a backup clock. When the oil thins out and flows like water, tilt-test it with the button below." },
    gate: { question: "Is the oil shimmering?", phaseLabel: "oil check", referenceImage: "assets/recipes/friedrice/friedrice-c1.webp", lead: "Tilt the pan and watch the oil.\n\n✅ Ready: it shimmers and flows easily — thin and glossy, running across the pan like water.\n\n❌ Not ready: it still looks flat and thick, barely moving. Give it another 20–30 seconds and tilt again.\n\n⚠️ Wisping smoke? Too hot — pull the pan off the heat a few seconds before the chicken goes in.", voice: "Tilt the pan — if the oil shimmers and flows easily like thin water, it's ready. If it still looks flat and thick, give it another twenty to thirty seconds.", yesLabel: "It's shimmering — let's cook ▸", notYetLabel: "Not yet — heat a little longer", notYetSec: 25, notYetTimerLabel: "A little longer on the oil" },
    transition: { title: "Oil's hot — chicken time 🍗", body: "Nice and shimmery. Tap to start — the diced chicken goes straight into the hot oil. (Not quite there? Slide the pan off for a moment — it holds its heat.)", voice: "Oil's hot and shimmering. Tap to start — the chicken goes straight in.", button: "Start cooking", emoji: "🍗" },
    skippable: true,
    skipWarning: "Skipping means the chicken hits a cool pan and steams grey instead of browning — only skip if your pan's already hot.",
  },
  cues: [
    // ── PHASE 2 · THE CHICKEN — 4 cues (the phaseLabel eyebrow forward-fills across the segment) ──
    // 2a: SPREAD IT, THEN HANDS OFF. idx 0 never parks (engine rule) → shown for its ~90s brown
    // window, then 2b fires + parks. The teach: beginners stir constantly; browning needs contact.
    { at: 0, type: "action", title: "Chicken in — spread it out 🍗", heat: "medium-high", phaseLabel: "Phase 2 · The Chicken", referenceImage: "assets/recipes/friedrice/friedrice-p2-c1.webp",
      body: "Add the chicken and spread it flat in a single layer. Then leave it alone to brown — about a minute and a half before the first stir.",
      beginner: "🍗 Chicken in — spread it out FLAT, one layer\n✋ Now don't touch it — let it sit ~90 sec\n👀 Browning happens when you leave it alone\n⚠️ Crowded pan = grey steamed chicken",
      voice: "Add the chicken and spread it out flat in one layer — then hands off. Let it sit and brown for about ninety seconds.", haptic: "double" },
    // 2b: FIRST STIR — two-state diagnosis (browned = right / pale grey = pan too cold, the fix).
    { at: 90, type: "action", title: "First stir — check the brown 🥄", heat: "medium-high", referenceImage: "assets/recipes/friedrice/friedrice-p2-c2.webp",
      body: "Give it a first stir and flip the pieces. Golden-brown down sides are exactly right; pale grey means the pan needs to be hotter — leave it longer between stirs.",
      beginner: "🥄 First stir — flip the pieces over\n👀 Browned gold on the down side? That's flavor, not burning\n🔥 Pale grey instead? Pan wasn't hot enough — leave it longer between stirs",
      voice: "Give it a first stir and flip the pieces. If the down sides are golden brown, that's exactly right — that's flavor.", haptic: "tap" },
    // 2c: STIR OCCASIONALLY UNTIL NO PINK OUTSIDE (~3 min, the gap to the gate).
    { at: 135, type: "action", title: "Stir till no pink 🥄", heat: "medium-high", referenceImage: "assets/recipes/friedrice/friedrice-p2-c3.webp",
      body: "Stir every forty-five seconds or so and cook until no pink shows on the outside — about three more minutes. Season with a pinch of salt and pepper.",
      beginner: "🥄 Stir every ~45 sec now\n👀 Cook till no pink shows anywhere outside, ~3 more min\n🧂 Pinch of salt + pepper in",
      voice: "Stir every forty-five seconds or so, and cook until no pink shows on the outside — about three more minutes. Add a pinch of salt and pepper.", haptic: "tap" },
    // 2d: THE SAFETY GATE — the 165°F cut-the-biggest-piece check (copy kept verbatim). The
    // set-aside instruction folds into doneCoach, spoken on continue as the handoff into Phase 3.
    // Reuses the existing doneness image slot (friedrice-c2). Moving the gate off cue-0 onto its
    // own cue is what makes it actually FIRE (the engine skips the first cue's checkpoint).
    { at: 315, type: "action", title: "Cooked through? 🌡️", heat: "medium-high", referenceImage: "assets/recipes/friedrice/friedrice-c2.webp",
      body: "Check the biggest piece is cooked through before it comes out — no pink anywhere inside.",
      beginner: "🌡️ Time to check it's done\n🔪 Cut into the biggest piece\n👀 White all the way through, no pink = cooked\n🍽️ Then scoop it onto a plate — it comes back at the end",
      voice: "Time to check the chicken's cooked through. Cut into the biggest piece — it should be white all the way, with no pink.", haptic: "double",
      gate: { kind: "confirm", doneLabel: "No pink — it's cooked", prompt: "Cut into the biggest piece — is it white all the way through, no pink or shiny raw bits?", safeTempF: 165, safeTempC: 74, notReadyCoach: "Still pink inside? Give it another minute or two and check the biggest piece again — chicken's the one thing worth being sure about.", doneCoach: "Perfect — scoop it onto a plate and set it aside. It comes back in at the end. Leave the oil and browned bits in the pan." } },
    // ── PHASE 3 · BRING IT TOGETHER — chicken's out; veg → garlic → egg → rice → soy → finish ──
    { at: 345, type: "action", title: "Fry the veg 🥕", heat: "medium-high", phaseLabel: "Phase 3 · Bring it together", opt: "frozen peas and carrots", referenceImage: "assets/recipes/friedrice/friedrice-c4.webp",
      body: "Add the frozen peas and carrots (and green onions if using) straight into the hot pan. Stir for about a minute until they're thawed and hot.",
      beginner: "🥕 Frozen veg straight in — no thawing\n🌱 Green onions too, if using\n🥄 Stir about a minute till hot",
      voice: "Add the frozen peas and carrots straight into the hot pan, plus the green onions if you're using them, and stir for about a minute until they're hot.", haptic: "tap" },
    { at: 415, type: "action", title: "Garlic in 🧄", heat: "medium-high", opt: "garlic", referenceImage: "assets/recipes/friedrice/friedrice-c5.webp",
      body: "Add the minced garlic and stir for about 30 seconds, just until you can smell it. Don't let it brown.",
      beginner: "🧄 Garlic in\n👃 Stir about thirty seconds — till you smell it\n⚠️ Don't let it brown — burnt garlic is bitter",
      voice: "Add the garlic and stir for about thirty seconds, just until you can smell it — don't let it brown.", haptic: "tap" },
    { at: 450, type: "action", title: "Scramble the eggs 🥚", heat: "medium-high", referenceImage: "assets/recipes/friedrice/friedrice-c6.webp",
      body: "Push everything to one side of the pan. Pour the beaten eggs into the empty side and stir them gently until they're just set — soft, not dry.",
      beginner: "👉 Push veg to one side\n🥚 Eggs into the empty side\n🥄 Stir gently till just set — soft, not dry\n⏱️ About forty-five seconds",
      voice: "Push everything to one side, pour the beaten eggs into the empty side, and stir them gently until they're just set — soft, not dry.", haptic: "double",
      gate: { kind: "confirm", doneLabel: "Eggs are just set", prompt: "Are the eggs soft, fluffy, and just set — no wet raw liquid left?", notReadyCoach: "Still wet and runny? A few more gentle stirs — they set fast, so don't walk away." } },
    { at: 500, type: "action", title: "Rice + chicken back in 🍚", heat: "medium-high", referenceImage: "assets/recipes/friedrice/friedrice-c7.webp",
      body: "Add the rice and the chicken back in. Break up any rice clumps and stir everything together until it's evenly mixed and hot.",
      beginner: "🍚 Rice + chicken back in\n🥄 Break up clumps, stir it all together\n🔥 Stir till evenly mixed + steaming",
      voice: "Add the rice and the chicken back in, break up any clumps, and stir everything together until it's evenly mixed and hot.", haptic: "tap" },
    { at: 590, type: "action", title: "Sauce it 🥣", heat: "medium-high", referenceImage: "assets/recipes/friedrice/friedrice-c8.webp",
      body: "Drizzle the soy sauce evenly over everything (and the sesame oil if using). Toss and flip the rice so it all soaks up the sauce, about 2 minutes.",
      beginner: "🥣 Soy sauce drizzled all over\n🌰 Sesame oil too, if using\n🥄 Toss + flip about two minutes so it all soaks in\n👀 Rice dry, not soupy? Splash more soy to taste",
      voice: "Drizzle the soy sauce evenly over everything, add the sesame oil if you're using it, and toss the rice for about two minutes so it all soaks up the sauce.", haptic: "tap" },
    { at: 710, type: "finish", title: "Taste & serve 🍚", heat: "off", referenceImage: "assets/recipes/friedrice/friedrice-c9.webp",
      body: "Try a spoonful. Want it saltier? A splash more soy. Serve it hot, with sriracha on the side if you like a kick.",
      beginner: "🥄 Taste it\n🧂 Not salty enough? Splash more soy\n🍚 Serve hot — sriracha on the side if you want heat",
      voice: "Taste a spoonful — if it needs more, add a splash of soy. Serve it hot, with sriracha on the side if you like a little heat. That's a full takeout dinner you just made for a couple of bucks. Nice work.", haptic: "double" },
  ],
};

// ── GROUND BEEF TACOS — guided (music-READY but silent) ────────────────────────
// Authored per docs/recipes/ground-beef-tacos.md as a noMusic EXPERIENCE (methods +
// prep wizard + gates), song:null-placeholder + music_ready:true. First recipe to
// branch on SEASONING (packet vs homemade) rather than technique — methodAlt on the
// season cue + prep step; both paths converge at the same brown→simmer cook. The
// `at`-ladder = cumulative typical step durations. Landing beats (the brown, the
// sauce-thicken, the assembly) let a track wire in later, data-only.
window.GROUND_BEEF_TACOS = {
  id: "ground-beef-tacos",
  noMusic: true,
  music_ready: true,
  song: { title: "No soundtrack — cook at your pace", artist: "", spotifyQuery: "", videoId: null, youtubeId: null, audioFile: null, audioCredit: null },
  recipe: { title: "Ground Beef Tacos", technique: "Brown & Simmer", doneness: "Juicy, saucy taco meat — never dry", emoji: "🌮" },
  // Guided cook clock (noMusic): the cue `at`-ladder is the cook TIMELINE, not a song sync. The
  // pan heat is now a separate, skippable phase-1 preheat (screens.preCook), so the cook clock
  // starts at the FIRST BROWN CUE (at:0). durationSec spans the cook cues (finish at 840 + a short
  // tail); totalTimeMin is the honest end-to-end (prep + preheat + cook, incl. build). bpm null.
  bpm: null,
  durationSec: 860,
  totalTimeMin: 24,
  timeBreakdown: "~8 min prep (chop + measure) + ~2 min pan heat + ~14 min cooking",
  heroImage: "assets/recipes/tacos/hero.webp",
  equipmentNeeded: ["Skillet or pan", "Spatula or wooden spoon", "Small bowl"],
  // All pans allowed, no recommendation — browning ground beef is forgiving.
  cookNeeds: { pans: ["nonstick", "cast-iron", "stainless"], panReason: "Browning ground beef is forgiving — nonstick, stainless, or cast iron all work fine. Use whatever you've got." },
  cookWarning: "The one way to ruin taco meat is drying it out. After you season it, you add a splash of liquid and let it simmer into a juicy, slightly saucy filling — pull it while it's still moist, not when the pan's gone dry.",
  portion: { label: "How many servings?", unit: "servings", base: 4, options: [2, 4, 6, 8], perUnit: 0, clamp: [1, 1] },
  servingNote: "Taco bar move: set out sour cream, guac, salsa, jalapeños and lime and let everyone build their own — half the fun is the assembly.",
  // SEASONING CHOICE (methods) — packet (default/easy) vs homemade. Both converge at the same
  // cook; only the seasoning prep step + the season cue's copy + the seasoning ingredients differ
  // (methodAlt / opt-by-method). NOT per-method cue arrays — shared cues, method overlay.
  methods: [
    { id: "packet", label: "Seasoning packet", emoji: "🧂", technique: "Easy mode", note: "The easy move — one packet from any store, done. No spice rack required." },
    { id: "homemade", label: "Build from spices", emoji: "🌶️", technique: "From scratch", note: "Cheaper long-run and you control it — chili powder, cumin, garlic powder, oregano & paprika and you're set." },
  ],
  ingredients: [
    { name: "ground beef", label: "Ground beef — 90% lean", measure: "1 lb", noInline: true },
    { name: "cooking oil", label: "Cooking oil", measure: "1 tbsp" },
    { name: "taco seasoning", label: "Taco seasoning packet", measure: "1 packet (~2 tbsp)", opt: "packet", noInline: true },
    { name: "chili powder", label: "Chili powder", measure: "2 tsp", opt: "homemade" },
    { name: "cumin", label: "Cumin", measure: "2 tsp", opt: "homemade" },
    { name: "paprika", label: "Paprika", measure: "1 tsp", opt: "homemade" },
    { name: "garlic powder", label: "Garlic powder", measure: "1/2 tsp", opt: "homemade" },
    { name: "oregano", label: "Oregano", measure: "1/2 tsp", opt: "homemade" },
    { name: "salt", label: "Salt", measure: "a pinch", opt: "homemade" },
    { name: "pepper", label: "Black pepper", measure: "a pinch", opt: "homemade" },
    { name: "tomato paste", label: "Tomato paste", measure: "2 tbsp", optional: true, defaultOff: false },
    { name: "tortillas", label: "Tortillas or taco shells", measure: "8", noInline: true },
    { name: "shredded cheese", label: "Shredded cheese", measure: "to taste", optional: true, defaultOff: false },
    { name: "lettuce", label: "Lettuce — shredded", measure: "to taste", optional: true, defaultOff: false },
    { name: "tomato", label: "Tomato — chopped", measure: "1, chopped", optional: true, defaultOff: false },
    { name: "onion", label: "Onion — chopped", measure: "1/2, chopped", optional: true, defaultOff: true },
    { name: "lime", label: "Lime — for serving", measure: "to taste", optional: true, defaultOff: true },
    { name: "hot sauce", label: "Hot sauce — for serving", measure: "to taste", optional: true, defaultOff: true },
  ],
  prepSteps: [
    { title: "Warm your shells first", guide: "Warm tortillas = soft, foldable, won't crack. Cold = they break.", voice: "Warm your tortillas first — soft ones need twenty to thirty seconds a side in a dry pan, hard shells crisp in a hot oven, then cover with a towel.", referenceImage: "assets/recipes/tacos/tacos-prep-1.webp", instructions: "Warm your tortillas or shells first — they'll wait for the meat, not the other way around.", techniqueGuide: [
      "🔥 Soft tortillas: twenty to thirty seconds per side in a dry pan, or thirty seconds wrapped in a damp paper towel in the microwave.",
      "🥫 Hard shells: four to six minutes in a 325°F oven till crisp.",
      "🧺 Stack and cover with a towel to keep them warm.",
    ] },
    // SEASONING — method split (packet is the base, homemade overrides fully per §1b). Authored
    // separately per method, never shared.
    { title: "Grab your seasoning", guide: "One packet is your whole spice step.", voice: "Grab your taco seasoning packet — that's your whole spice step. Told you it was easy.", referenceImage: "assets/recipes/tacos/tacos-prep-2.webp", instructions: "Grab your taco seasoning packet — that's your whole spice step. Told you it was easy.", techniqueGuide: [
      "🧂 One store-bought taco seasoning packet — any brand.",
      "📏 About two tablespoons if you're measuring loose.",
      "✅ That's the whole step. Told you it was easy.",
    ], methodAlt: { homemade: {
      title: "Mix your spice blend", guide: "Your packet, from scratch — five spices in a bowl.", voice: "Mix your spices in a small bowl — chili powder, cumin, paprika, garlic powder, oregano, and a pinch of salt and pepper. That's your packet, from scratch.", referenceImage: "assets/recipes/tacos/tacos-prep-2-homemade.webp", instructions: "Mix your spices in a small bowl: chili powder, cumin, paprika, garlic powder, oregano, plus a pinch of salt and pepper. That's your packet, from scratch.", techniqueGuide: [
        "🌶️ Chili powder and cumin do most of the work.",
        "🧄 Garlic powder, paprika and oregano round it out.",
        "🧂 A pinch of salt and pepper — stir it together.",
      ] } } },
    { title: "Chop your toppings", guide: "Shred the lettuce, chop the tomato and onion, grate cheese if it's not pre-shredded.", voice: "Shred the lettuce, chop the tomato and onion, and grate the cheese if it isn't pre-shredded. Only prep what you're using.", referenceImage: "assets/recipes/tacos/tacos-prep-3.webp", instructions: "Shred the lettuce, chop the tomato and onion, and grate the cheese if it's not pre-shredded.", techniqueGuide: [
      "🥬 Shred the lettuce.",
      "🍅 Chop the tomato.",
      "🧅 Chop the onion, if you're using it.",
      "🧀 Cheese ready to go.",
    ] },
    { title: "Stage it by the stove", guide: "Beef, oil, seasoning, tomato paste, a cup of water nearby, warm shells, toppings out. Ready.", voice: "Line it all up by the stove — beef, oil, seasoning, tomato paste, a cup of water for the simmer, your warm shells, and the toppings. Then you're ready.", referenceImage: "assets/recipes/tacos/tacos-prep-4.webp", instructions: "Get it all by the stove: beef, oil, seasoning, tomato paste, water, warm shells, and your toppings.", techniqueGuide: [
      "🥩 Beef out of the fridge.",
      "🥣 Seasoning ready — plus tomato paste, if you're using it.",
      "💧 Water within reach for the simmer.",
    ] },
  ],
  // ── PRE-COOK preheat (screens.preCook via the static EXP.prePhase). Oil in, medium-high, until
  // it shimmers — extracted from the old "Heat the pan" cue so it's a skippable phase-1 preheat
  // like the other flagships. No gas/electric hard-timer split (handoff): the shimmer IS the gate,
  // the timer is a single generous backup + an early "it's shimmering" button. Skip → the first
  // BROWN cue (pan assumed hot). Uses tacos-c1.webp (the oil-shimmer slot).
  prePhase: {
    title: "Heat the pan",
    intro: "Tacos start with a hot pan — get the oil shimmering before the beef goes in, so it browns instead of steaming.",
    startLabel: "Start heating ⏱",
    steps: [
      { title: "Oil in — medium-high", heat: "medium-high", referenceImage: "assets/recipes/tacos/tacos-c1.webp", body: "Add 1 tbsp cooking oil to the pan and set the heat to medium-high. Swirl it once to coat the bottom, then let it heat — nothing else in yet.", voice: "Add a tablespoon of oil to the pan over medium-high heat, and give it a moment until it shimmers." },
    ],
    timer: { sec: 120, earlyAfterSec: 45, label: "Heating the oil", earlyLabel: "It's shimmering ▸", phaseLabel: "preheat", note: "The shimmer is the real signal — this timer's just a generous backup clock. Gas heats oil fast; an electric coil takes longer, so hang tight. When it thins out and flows like water, tilt-test it with the button below." },
    gate: { question: "Is the oil shimmering?", phaseLabel: "oil check", referenceImage: "assets/recipes/tacos/tacos-c1.webp", lead: "Tilt the pan and watch the oil.\n\n✅ Ready: it shimmers and flows easily — thin and glossy, running across the pan like water.\n\n❌ Not ready: it still looks flat and thick, barely moving. Give it another 20–30 seconds and tilt again.\n\n⚠️ Wisping smoke? Too hot — pull the pan off the heat a few seconds before the beef goes in.", voice: "Tilt the pan — if the oil shimmers and flows easily like thin water, it's ready. If it still looks flat and thick, give it another twenty to thirty seconds.", yesLabel: "It's shimmering — let's cook ▸", notYetLabel: "Not yet — heat a little longer", notYetSec: 25, notYetTimerLabel: "A little longer on the oil" },
    transition: { title: "Oil's hot — beef time 🥩", body: "Nice and shimmery. Tap to start — the ground beef goes straight into the hot oil. (Not quite there? Slide the pan off for a moment — it holds its heat.)", voice: "Oil's hot and shimmering. Tap to start — the beef goes straight in.", button: "Start cooking", emoji: "🥩" },
    skippable: true,
    skipWarning: "Skipping means the beef hits a cool pan and steams grey instead of browning — only skip if your pan's already hot.",
  },
  cues: [
    // Brown = index 0 (auto-shows, never parks). The 160°F safety confirm CANNOT live here — the
    // engine never checkpoints the first cue — so it's its OWN cue at index 1 and actually fires.
    { at: 0, type: "action", title: "Brown the beef 🥩", heat: "medium-high", referenceImage: "assets/recipes/tacos/tacos-c2.webp",
      body: "Add the ground beef. Break it up into small crumbles with your spatula and cook, stirring here and there, until it goes from red to brown — about 5–6 minutes.",
      beginner: "🥩 Beef in\n🥄 Break it into small crumbles\n👀 Cook till red → brown, ~5–6 min\n🔥 Some browned bits = flavor",
      voice: "Add the ground beef and break it into small crumbles with your spatula. Cook, stirring now and then, until it goes from red to brown.", haptic: "double" },
    { at: 300, type: "action", title: "Cooked through? 🌡️", heat: "medium-high", referenceImage: "assets/recipes/tacos/tacos-c2.webp",
      body: "Check the beef is browned all the way through before you go on — no pink or red raw bits left anywhere.",
      beginner: "🌡️ Time to check it's done\n🔪 Cut into a bigger clump\n👀 All brown, no pink or red = cooked",
      voice: "Time to check the beef's cooked through. Cut into a bigger piece — it should be browned all the way, with no pink or red left.", haptic: "double",
      gate: { kind: "confirm", doneLabel: "No pink left — it's browned", prompt: "Is the beef fully browned with no pink or red raw bits left?", safeTempF: 160, safeTempC: 71, notReadyCoach: "Still some pink? Keep breaking it up and cooking another minute or two — ground beef needs to be cooked all the way through.", doneCoach: "Cooked through. If there's a pool of grease, tip most of it out next — leave a little for flavor." } },
    { at: 330, type: "action", title: "Drain the fat 🥩", heat: "medium-high", referenceImage: "assets/recipes/tacos/tacos-c3.webp",
      body: "If there's a pool of grease, slide the pan off the heat and carefully tip most of it out — hold the beef back with your spatula and pour the grease into an old can or cup, never down the drain. Leave a little for flavor; skip if your beef was lean.",
      beginner: "➡️ Slide the pan off the heat first\n🥩 Pool of grease? Tip most out into a can — never the drain\n🥄 Leave a little — that's flavor\n✅ Lean beef, barely any? Skip this",
      voice: "If there's a pool of grease, slide the pan off the heat and carefully tip most of it out into an old can — hold the beef back with your spatula. Leave a little for flavor, and skip it if your beef was lean.", haptic: "tap" },
    { at: 360, type: "action", title: "Season it 🧂", heat: "medium", referenceImage: "assets/recipes/tacos/tacos-c4.webp",
      body: "Sprinkle the taco seasoning over the beef and stir for about a minute so every bit gets coated. This toasts the spices and wakes them up.",
      beginner: "🧂 Seasoning packet over the beef\n🥄 Stir ~1 min till fully coated\n👃 You'll smell it bloom",
      voice: "Sprinkle the taco seasoning over the beef and stir for about a minute, until every bit is coated and you can smell the spices.", haptic: "tap",
      methodAlt: { homemade: {
        body: "Add your spice blend over the beef and stir for about a minute so every bit gets coated. This toasts the spices and wakes them up.",
        beginner: "🌶️ Your spice blend over the beef\n🥄 Stir ~1 min till fully coated\n👃 You'll smell it bloom",
        voice: "Add your spice blend over the beef and stir for about a minute, until every bit is coated and you can smell the spices." } } },
    { at: 430, type: "action", title: "Make it saucy 🍅", heat: "medium", referenceImage: "assets/recipes/tacos/tacos-c5.webp",
      body: "Stir in the tomato paste if you're using it, then add a splash of water — about half a cup. Stir into a loose, saucy filling.",
      beginner: "🍅 Tomato paste in (if using)\n💧 Splash of water (~½ cup)\n🥄 Stir into a loose, saucy filling\n⚠️ No tomato paste? Just the water works",
      voice: "Stir in the tomato paste if you're using it, then add about half a cup of water and stir it into a loose, saucy filling.", haptic: "tap" },
    { at: 480, type: "action", title: "Simmer to juicy 🔥", heat: "medium-low", referenceImage: "assets/recipes/tacos/tacos-c6.webp",
      body: "Drop the heat to medium-low and let it bubble gently for 3–4 minutes, until the liquid cooks down and the meat is juicy and lightly saucy — not dry, not watery.",
      beginner: "🔥 Drop to medium-low\n⏱️ Gentle bubble 3–4 min\n👀 Done = juicy + lightly saucy, not dry\n🔴 Juicy? Burner OFF + slide the pan off — a coil keeps drying it",
      voice: "Drop the heat to medium-low and let it bubble gently for three to four minutes, until the liquid cooks down and the meat is juicy and lightly saucy — not dry, not watery.", haptic: "double",
      gate: { kind: "confirm", doneLabel: "Juicy + saucy — not dry", prompt: "Has the liquid cooked down to a juicy, lightly saucy filling — moist but not soupy?", notReadyCoach: "Still watery? Give it another minute uncovered. Gone dry? Splash in a little more water — the meat should look glossy and moist.", doneCoach: "That's it — turn the burner off and slide the pan off the heat; a coil stays hot for minutes and would keep drying the meat. Now build while it's warm." } },
    { at: 720, type: "action", title: "Build your tacos 🌮", heat: "off", referenceImage: "assets/recipes/tacos/tacos-c7.webp",
      body: "Spoon the meat into your warm shells, then pile on cheese, lettuce, tomato, onion — whatever you're using. This is the fun part.",
      beginner: "🌮 Meat into warm shells\n🧀 Cheese, lettuce, tomato, onion\n🥄 Build each one how you like it",
      voice: "Spoon the meat into your warm shells, then pile on the cheese, lettuce, tomato, and onion — whatever you're using. This is the fun part.", haptic: "tap" },
    { at: 840, type: "finish", title: "Dig in 🌮", heat: "off", referenceImage: "assets/recipes/tacos/tacos-c8.webp",
      body: "Grab one, add hot sauce or a squeeze of lime if you've got it, and dig in while everything's warm.",
      beginner: "🌮 Grab one\n🌶️ Hot sauce or lime if you've got it\n🍽️ Eat while warm",
      voice: "Grab one, add hot sauce or a squeeze of lime if you've got it, and dig in while everything's warm. That's taco night for about three bucks a head — the taco truck wanted thirteen. First of many.", haptic: "double" },
  ],
};

// ── FLUFFY PANCAKES — guided (music-READY but silent), the first BATCH recipe ───
// Authored per docs/recipes/pancakes.md as a noMusic EXPERIENCE. Phase 1 = a skippable
// preheat (screens.preCook via pancakesPrePhase(), stove-split gas 120 / electric 240) that
// runs AFTER the prep wizard while the batter rests. Phase 2 fully teaches pancake #1 (pour →
// bubble-watch → THE FLIP gate → second side → report-card calibration gate); Phase 3 is ONE
// long repeat cue (noCheckpoint + finishButton) the cook lives in until the batter's gone —
// rotating fadeTips, no forced taps, early "Done" or auto-finish at 860. song null-placeholder.
window.PANCAKES = {
  id: "pancakes",
  noMusic: true,
  music_ready: true,
  song: { title: "No soundtrack — cook at your pace", artist: "", spotifyQuery: "", videoId: null, youtubeId: null, audioFile: null, audioCredit: null },
  recipe: { title: "Fluffy Pancakes", technique: "Griddle & Flip", doneness: "Golden both sides, fluffy middle", emoji: "🥞" },
  bpm: null,
  durationSec: 320,   // the TIMED ladder ends at the last checkpoint (the repeat cue at :320); after that the clock PARKS and the batch is open-ended — no phantom finish timer
  totalTimeMin: 13,
  timeBreakdown: "~5 min mixing + ~2–4 min preheat + pancake #1 taught, then repeat at your own pace",
  heroImage: "assets/recipes/pancakes/hero.webp",
  equipmentNeeded: ["Nonstick pan or griddle", "Spatula", "Large bowl", "Whisk or fork", "1/4 measuring cup", "Paper towel"],
  cookNeeds: { pans: ["nonstick", "cast-iron", "stainless"], panReason: "Nonstick or a griddle is easiest — pancakes release clean. Cast iron works great once it's buttered; stainless is hard mode." },
  cookWarning: "The one way to wreck pancakes is flipping too early — a glossy wet top means it's not ready, and an early flip smears batter everywhere. Wait for the bubbles. They tell you.",
  portion: { label: "How many pancakes?", unit: "pancakes", base: 8, options: [4, 8, 12], perUnit: 0, clamp: [1, 1] },
  servingNote: "8 pancakes feeds 2–3 people. Amounts scale — the cook rhythm stays the same, you just repeat more (or fewer) times.",
  ingredients: [
    { name: "flour", label: "All-purpose flour", measure: "1 1/2 cups" },
    { name: "baking powder", label: "Baking powder — NOT baking soda", measure: "1 tbsp" },
    { name: "sugar", label: "Sugar", measure: "3 tbsp", optional: true, defaultOff: false },
    { name: "salt", label: "Salt — just a pinch", measure: "1 pinch", noInline: true },
    { name: "egg", label: "Egg", measure: "1 large" },
    { name: "milk", label: "Milk — any kind", measure: "1 1/3 cups" },
    { name: "vanilla", label: "Vanilla — the level-up", measure: "1 tsp", optional: true, defaultOff: true },
    { name: "butter", label: "Butter — for the pan, a little at a time", measure: "~2 tsp", noInline: true },
    { name: "maple syrup", label: "Maple syrup + toppings", measure: "to serve", optional: true, defaultOff: false, noInline: true },
  ],
  prepSteps: [
    { title: "Whisk the dry team", guide: "Flour, baking powder, sugar, pinch of salt — whisked together in a big bowl.", voice: "Whisk the flour, baking powder, sugar and a pinch of salt together in a big bowl — about ten seconds, so the baking powder spreads evenly. Baking powder, not soda.", referenceImage: "assets/recipes/pancakes/prep-1.webp", instructions: "Flour, baking powder, sugar and a pinch of salt whisked together in a large bowl.", techniqueGuide: [
      "🥣 Flour + baking powder + sugar + pinch of salt in a large bowl.",
      "🥄 Whisk ~10 sec so the baking powder spreads evenly.",
      "⚠️ Baking POWDER, not soda — check the tub. (3 tsp = 1 tbsp)",
    ] },
    { title: "Add the wet team", guide: "Egg, milk (and vanilla if you're using it) into the same bowl.", voice: "Crack the egg into the same bowl and pour in the milk — and the vanilla too, if you're using it.", referenceImage: "assets/recipes/pancakes/prep-2.webp", instructions: "Crack the egg in and pour the milk into the same bowl (vanilla too, if you're using it).", techniqueGuide: [
      "🥚 Crack the egg in, pour the milk in.",
      "🌟 Vanilla in now if you're using it.",
    ] },
    { title: "Mix — and STOP early (the fluff secret)", guide: "Whisk just until no dry flour is visible — 20–30 seconds, lumps are fine.", voice: "Whisk just until the dry flour disappears — twenty to thirty seconds. Small lumps are good; they cook out. Don't overmix, or the pancakes turn out flat.", referenceImage: "assets/recipes/pancakes/prep-3.webp", instructions: "Whisk just until no dry flour is visible — 20–30 seconds. Lumps are fine.", techniqueGuide: [
      "🥄 Whisk ~20–30 sec, just till the dry flour disappears.",
      "✅ Small lumps = GOOD. They cook out.",
      "⚠️ Silky-smooth batter = overmixed = flat, chewy pancakes. Stop early.",
    ] },
    { title: "Stage the station", guide: "Pan out, butter + paper towel ready, ¼ cup measure in the batter bowl, a plate for the stack.", voice: "Get your station ready — pan on the stove, butter and a paper towel within reach, your quarter-cup measure sitting in the batter, and a plate for the stack.", referenceImage: "assets/recipes/pancakes/prep-4.webp", instructions: "Pan on the stove (nothing on yet), butter + paper towel within reach, ¼ cup measure in the batter, a plate ready for the stack.", techniqueGuide: [
      "🍳 Pan on the stove (nothing on yet).",
      "🧈 Butter + a sheet of paper towel within reach.",
      "🥄 ¼ cup measure sitting in the batter.",
      "🍽️ Plate ready for the stack (+ a clean towel to cover it).",
    ] },
  ],
  // ── PHASE 1 preheat (screens.preCook via pancakesPrePhase() — stove-split gas 120 / electric
  // 240; timer.sec injected there). AFTER prep so the batter rests during. The drop-test gate is
  // three-state (ready / not-yet / too-hot — pancakes fail hot more than cold). Skippable.
  prePhase: {
    title: "Phase 1 — Heat the pan",
    intro: "Your batter rests while the pan heats — that rest is where the fluff comes from. Pancakes want a MEDIUM pan, not a screaming one.",
    startLabel: "Start preheating ⏱",
    steps: [
      { title: "Pan on MEDIUM — butter in, then wipe", heat: "medium", referenceImage: "assets/recipes/pancakes/p1-c1.webp", body: "Set the pan to medium heat, melt about ½ tsp butter and swirl to coat — then wipe MOST of it off with a paper towel. That wipe is the fix for the dodgy first pancake.", voice: "Set the pan to medium and melt a little butter — then wipe most of it off with a paper towel. That wipe is what saves your first pancake." },
    ],
    timer: { label: "Heating to pancake temp", phaseLabel: "preheat", note: "The drop test below is the real signal — this clock is just the backup." },
    gate: { question: "Is the pan pancake-ready?", phaseLabel: "pan check", referenceImage: "assets/recipes/pancakes/p1-c1.webp", lead: "Flick a single drop of batter (or water) onto the pan.\n\n✅ Ready: it sizzles gently and sets within a couple of seconds — a calm, steady sizzle.\n\n❌ Nothing yet: it just sits there — give it another 30–60 seconds.\n\n⚠️ Too hot: violent spatter or instant browning — this is the electric-coil trap. Pull the pan OFF the heat, drop the dial a notch, and let it cool. Medium wins this one.", voice: "Flick a drop of batter on the pan. A gentle, steady sizzle means it's ready. Nothing means wait. Violent spatter means it's too hot, so pull the pan off and back the dial down.", yesLabel: "Gentle sizzle — ready ▸", notYetLabel: "Nothing yet — keep heating", notYetSec: 45, notYetTimerLabel: "A little longer", tooHotLabel: "Too hot — spattering 🔥", tooHotSec: 30, tooHotTimerLabel: "Pan OFF the heat — cooling down" },
    transition: { title: "Pour pancake #1 🥞", body: "First one's the lesson. The rest are reps.", voice: "First one's the lesson — the rest are just reps. Tap to pour your first pancake.", button: "Start cooking", emoji: "🥞" },
    skippable: true,
    skipWarning: "Skipping the preheat means pancake #1 hits a cold pan and comes out pale and greasy — only skip if your pan's already hot.",
  },
  cues: [
    { at: 0, type: "action", title: "Pour pancake #1 🥞", heat: "medium", phaseLabel: "Phase 2 — Pancake #1: the lesson", referenceImage: "assets/recipes/pancakes/p2-c1.webp",
      body: "Scoop a quarter cup of batter and pour it into the middle of the pan — it spreads itself into a circle. Then leave it alone.",
      beginner: "🥄 Scoop ¼ cup batter\n🎯 Pour into the middle — it spreads itself into a circle\n✋ Then leave it alone",
      voice: "Scoop a quarter cup of batter and pour it into the middle of the pan. It spreads itself. Now leave it alone.", haptic: "double" },
    { at: 30, type: "tip", title: "Watch the bubbles 👀", heat: "medium", noCheckpoint: true, referenceImage: "assets/recipes/pancakes/p2-c2.webp",
      body: "Bubbles will start rising to the surface — about 2–3 minutes on a good medium pan. This is the pancake talking to you; no poking yet. But trust your nose: if you smell it browning or the edges darken fast, your pan's hot — lift a corner and flip early.",
      beginner: "👀 Bubbles rise to the surface — ~2–3 min on a good medium pan\n✋ No poking while it sets\n👃 Smell browning / edges darkening fast? Pan's hot — peek + flip early",
      voice: "Bubbles will start rising to the surface over the next couple of minutes. That's the pancake talking to you, so no poking yet. But if you smell it browning, don't wait — flip it early.", haptic: "tap" },
    { at: 150, type: "flip", title: "THE FLIP 🥞", heat: "medium", referenceImage: "assets/recipes/pancakes/p2-c3.webp",
      body: "Bubbles across the WHOLE surface + edges look dry, not glossy? Slide the spatula fully under and flip from the wrist — one smooth motion.",
      beginner: "👀 Ready = bubbles popping across the WHOLE top + edges look dry\n🥄 Spatula ALL the way under\n🤚 Flip from the wrist — smooth, not high\n⚠️ Glossy wet middle = not yet, 20–30 more sec\n➡️ Flipped? Second side's the quick one — 30–60 sec, watch it",
      voice: "When bubbles cover the whole surface and the edges look dry, slide the spatula all the way under and flip it from the wrist — one smooth motion.", haptic: "strong",
      gate: { kind: "confirm", doneLabel: "Flipped it 🥞", notReadyCoach: "Bubbles only at the edges and the middle still glossy? Give it twenty to thirty more seconds — the bubbles will spread to the middle when it's ready.", doneCoach: "Golden underneath? That's exactly it. Second side is faster — under a minute.", checkCoach: "Bubbles across the whole top yet? Tap Flipped it once it's turned.", nudgeSec: 30 } },
    { at: 210, type: "action", title: "Second side — under a minute", heat: "medium", referenceImage: "assets/recipes/pancakes/p2-c4.webp",
      body: "The second side always cooks faster — 30 to 60 seconds. Lift the edge to peek; golden means done. Then onto the plate, covered with the towel.",
      beginner: "⏱️ 30–60 sec — the second side always cooks faster\n👀 Peek: lift the edge, golden = done\n🍽️ Onto the plate, cover with the towel",
      voice: "The second side only needs thirty to sixty seconds. Lift the edge to peek — golden means done. Onto the plate and cover it.", haptic: "tap" },
    { at: 270, type: "temp", title: "Pancake #1 report card 📋", heat: "medium", referenceImage: "assets/recipes/pancakes/p2-c5.webp",
      body: "Golden both sides, fluffy middle? You've got the rhythm. Pale = the pan needs another minute between pours. Dark = drop the heat a notch.",
      beginner: "✅ Golden + fluffy = you've got it\n🟡 Pale + greasy = pan too cool, wait longer before the next pour\n🟤 Too dark = heat down a notch\n👀 First one's the calibration — adjust now",
      voice: "How did number one come out? Golden and fluffy means you've got the rhythm. Pale means let the pan reheat a bit. Too dark means drop the heat a notch.", haptic: "double",
      gate: { kind: "confirm", doneLabel: "Got the rhythm ▸", notReadyCoach: "First pancake's always the test-drive — nobody's is pretty. Pale? Pan's too cool, wait longer before the next pour. Too dark? Drop the heat a notch. The rest of the stack inherits the fix.", doneCoach: "Locked in — from here it's just reps.", checkCoach: "Golden both sides, fluffy middle? If not, nudge the heat, then tap Got the rhythm.", nudgeSec: 30 } },
    // TERMINAL repeat cue — the LAST cue on the ladder. When it fires the clock PARKS (no timed
    // finish cue after it, no phantom 17-min timer); fadeTips keep rotating and the persistent
    // "Done, rate it" button is the only way forward. Tapping it speaks finishVoice (the payoff
    // line — reuses the old finish-cue clip, byte-for-byte) then routes into the rating flow.
    { at: 320, type: "action", title: "The stack — repeat till the batter's gone", heat: "medium", phaseLabel: "Phase 3 — The stack", noCheckpoint: true, finishButton: true,
      finishLabel: "Done, rate it 🥞",
      finishVoice: "Burner off, if it isn't already. Stack them up, butter on top, syrup over the edge. That's a twelve dollar diner stack for about a buck fifty — and yours is fresher. Nice work.",
      referenceImage: ["assets/recipes/pancakes/p3-c1.webp", "assets/recipes/pancakes/p3-c2.webp"],
      body: "Now it's reps — and each one's quicker than #1 now the pan's dialed in: pour, bubbles, flip, out, about 90 seconds each. A fresh smear of butter every 2–3 pancakes (wipe it back again), and stack them under the towel so they stay warm. The rest of the batch is about 10 minutes — go at your own pace, there's no clock here. When the batter's gone, turn the burner OFF and pull the pan off it — on electric the coil stays hot for minutes — then tap Done, rate it.",
      beginner: "🥞 Pour → bubbles → flip → out. Quicker than #1 now — ~90 sec each\n🧈 Fresh smear of butter every 2–3 pancakes (wipe it back again)\n🍽️ Stack under the towel — they stay warm together\n🔥 Batter gone? Burner OFF + pan off the coil, then tap Done, rate it",
      voice: "Now it's reps — and quicker than the first, now the pan's dialed in. Pour, wait for the bubbles, flip, out. Fresh butter every couple of pancakes, keep the stack covered. When the batter's gone, cut the heat and pull the pan off it — that's the last thing.", haptic: "tap",
      fadeTips: [
        "Bubbles across the whole top — that's always the flip signal.",
        "Every 2–3 pancakes: fresh smear of butter, then wipe it back — keeps them from sticking.",
        "Batter thickened up? It happens as it sits — a splash of milk loosens it.",
        "Browning faster than the first few? The pan's creeping up — nudge the dial down.",
        "No clock here — the last pancake decides when you're done, not a timer.",
        "Two pans going at once is the pro move if you're feeding people.",
        "Chocolate chips? Drop them on the wet side right after you pour.",
      ] },
  ],
};

// ── TERIYAKI CHICKEN BOWL — guided (music-READY but silent) ────────────────────
// Authored per docs/recipes/teriyaki-chicken-bowl.md as a noMusic EXPERIENCE. Skillet-only,
// cubed chicken, 6-item sauce whisked at prep. Phase 1 = a skippable preheat (screens.preCook via
// teriyakiPrePhase(), stove-split gas 60 / electric 150, three-state shimmer gate incl. a smoking
// branch). Phase 2 = sear the chicken, with the app's first PARALLEL-TIMING teach: the broccoli
// tip at :45 (noCheckpoint + opt:"broccoli") fires INSIDE the chicken's hands-off window and drops
// cleanly when broccoli is unchecked (engine opt-filter, at-values are absolute — no ladder shift).
// Phase 3 = the glaze (marquee gate: shiny + spatula-trail, with the gluey→water rescue) + the bowl.
// song null-placeholder (NOT literal null → EXP.song.* reads are guarded). Enemy: the ~$14 takeout bowl.
window.TERIYAKI_BOWL = {
  id: "teriyaki-chicken-bowl",
  noMusic: true,
  music_ready: true,
  song: { title: "No soundtrack — cook at your pace", artist: "", spotifyQuery: "", videoId: null, youtubeId: null, audioFile: null, audioCredit: null },
  recipe: { title: "Teriyaki Chicken Bowl", technique: "Sear & Glaze", doneness: "Juicy chicken in a shiny glaze over rice", emoji: "🍜" },
  bpm: null,
  durationSec: 610,
  totalTimeMin: 20,
  timeBreakdown: "~8 min prep (rice sorted, chicken cubed, sauce whisked) + ~2 min preheat + ~10 min cooking",
  heroImage: "assets/recipes/teriyaki/hero.webp",
  equipmentNeeded: ["Large skillet or pan", "Spatula", "Small bowl + whisk (or fork)", "Microwave-safe bowl (for the broccoli)"],
  cookNeeds: { pans: ["nonstick", "cast-iron", "stainless"], panReason: "Nonstick is easiest — the glaze wipes right out. Stainless and cast iron work great; the glaze may grip a little more at cleanup." },
  cookWarning: "The glaze goes from perfect to gluey fast — once the sauce hits the pan you stir CONSTANTLY, and the moment it turns shiny and coats the chicken, it's done. Walking away during the glaze is the one way to wreck this.",
  portion: { label: "How many bowls?", unit: "bowls", base: 2, options: [1, 2, 4], perUnit: 0, clamp: [1, 1] },
  servingNote: "The ingredient list scales with the picker — the cook rhythm doesn't change. 4 bowls just means a bigger pan and an extra minute on the sear.",
  ingredients: [
    { name: "chicken breast", label: "Chicken breast", measure: "1/2 lb (1 breast), cubed bite-size", noInline: true },
    { name: "cooked rice", label: "Cooked rice — white, brown, or pouch", measure: "2 cups (= 1 pouch, or ~3/4 cup dry)", noInline: true },
    { name: "cooking oil", label: "Cooking oil", measure: "1 tbsp" },
    { name: "soy sauce", label: "Soy sauce — low-sodium if you have it", measure: "2 tbsp" },
    { name: "brown sugar", label: "Brown sugar — or honey, same amount", measure: "2 tbsp, packed" },
    { name: "cornstarch", label: "Cornstarch — the glaze-maker", measure: "1 1/2 tsp" },
    { name: "vinegar", label: "Rice or apple cider vinegar", measure: "1 tbsp", optional: true, defaultOff: false },
    { name: "garlic", label: "Garlic", measure: "1 clove, minced", optional: true, defaultOff: false },
    { name: "ground ginger", label: "Ground ginger", measure: "1/4 tsp", optional: true, defaultOff: false },
    { name: "broccoli", label: "Broccoli — frozen is perfect", measure: "1 cup florets", optional: true, defaultOff: false },
    { name: "water", label: "Water — for the sauce", measure: "2 tbsp", noInline: true },
    { name: "sesame oil", label: "Sesame oil — level-up", measure: "1/4 tsp", optional: true, defaultOff: true },
    { name: "green onion", label: "Green onion — garnish", measure: "1, sliced", optional: true, defaultOff: true },
  ],
  levelUp: "Sriracha or red pepper flakes in the sauce = spicy teriyaki. Sesame seeds on top = the takeout look.",
  prepSteps: [
    { title: "Sort your rice", guide: "The bowl needs 2 cups cooked rice — sorted before anything touches heat.", voice: "Sort out your rice first — the bowl needs two cups cooked, which is one microwave pouch or about three quarters of a cup dry. If you're cooking it fresh, get the pot going now, it takes about fifteen minutes.", referenceImage: "assets/recipes/teriyaki/prep-1.webp", instructions: "The bowl needs 2 cups cooked rice (= 1 microwave pouch, or ~¾ cup dry). Sort it before anything touches heat.", techniqueGuide: [
      "📦 Microwave pouch? Zero-effort move — heat it during the glaze.",
      "❄️ Leftover rice? Perfect — reheats in the microwave at the end.",
      "🍚 Cooking fresh? Get the pot going NOW — white rice ~15 min (brown ~40); the chicken takes 10.",
    ] },
    { title: "Cube the chicken bite-size", guide: "½-inch-ish cubes — even sizes cook at the same speed.", voice: "Cut the chicken — about half a pound, one breast — into even bite-size cubes so they cook at the same speed. A pinch of pepper is all you need; skip the salt, the soy sauce brings plenty. Wash your hands and board after.", referenceImage: "assets/recipes/teriyaki/prep-2.webp", instructions: "Cut the chicken (about ½ lb, one breast) into even ½-inch cubes. Pinch of pepper only — the soy brings the salt. Wash hands + board after raw chicken.", techniqueGuide: [
      "🔪 Cut into bite-size cubes, smaller than you think.",
      "🧂 Pinch of pepper — skip the salt, the soy sauce brings plenty.",
      "🧼 Wash hands + board after raw chicken.",
    ] },
    { title: "Whisk the sauce", guide: "Soy, brown sugar, 2 tbsp water, cornstarch (+ vinegar, ginger, garlic if using) — whisked till no cornstarch lumps.", voice: "Whisk the sauce in one small bowl — soy, brown sugar, a couple tablespoons of water and cornstarch, plus the vinegar, ginger and garlic if you're using them. Whisk until the cornstarch fully disappears; lumps now mean a lumpy glaze later.", referenceImage: "assets/recipes/teriyaki/prep-3.webp", instructions: "Whisk soy, brown sugar, 2 tbsp water and cornstarch (plus vinegar, ginger and garlic if you're using them) in one small bowl until the cornstarch fully dissolves — no lumps.", techniqueGuide: [
      "🥣 Into one small bowl: soy, brown sugar, 2 tbsp water, cornstarch — plus vinegar, ginger + garlic if you're using them.",
      "🥄 Whisk till the cornstarch fully disappears — lumps = lumpy glaze.",
      "🍯 No brown sugar? Honey, same amount. No rice vinegar? Apple cider — or skip it for a slightly sweeter glaze.",
    ] },
    { title: "Broccoli on deck", opt: "broccoli", guide: "Florets into a microwave-safe bowl with a splash of water — don't cook it yet, it goes in DURING the chicken.", voice: "Get the broccoli on deck — florets in a microwave-safe bowl with a splash of water and a lid or plate on top. Don't start it yet; the cook tells you exactly when.", referenceImage: "assets/recipes/teriyaki/prep-4.webp", instructions: "Broccoli florets into a microwave-safe bowl with a splash of water and a lid/plate. Don't cook it yet — it goes in DURING the chicken.", techniqueGuide: [
      "🥦 Florets in a microwave-safe bowl (frozen = straight from the bag).",
      "💧 Splash of water, plate or lid on top.",
      "⏸️ Don't start it — the cook tells you when.",
    ] },
    { title: "Stage it by the stove", guide: "Chicken, sauce bowl, oil, spatula — arm's reach. The glaze phase moves fast.", voice: "Stage everything by the stove — chicken, the sauce bowl, oil and your spatula all within arm's reach. The glaze phase moves fast, so you want it all set before the pan gets hot.", referenceImage: "assets/recipes/teriyaki/prep-5.webp", instructions: "Chicken, sauce bowl, oil, spatula — all within arm's reach. Bowls out for the build. The glaze phase moves fast.", techniqueGuide: [
      "🍗 Chicken ready.",
      "🥣 Sauce whisked + within reach.",
      "🥄 Spatula in hand.",
      "🍽️ Bowls out for the build.",
    ] },
  ],
  // ── PHASE 1 preheat (screens.preCook via teriyakiPrePhase() — stove-split gas 60 / electric 150;
  // timer.sec injected there). Oil-shimmer gate, three-state (ready / not-yet / smoking → cooldown).
  // AFTER prep per founder rule. Skippable with an honest warning.
  prePhase: {
    title: "Phase 1 — Heat the pan",
    intro: "Hot pan = seared chicken with golden edges. Cool pan = grey steamed cubes. Two minutes here pays for itself.",
    startLabel: "Start preheating ⏱",
    steps: [
      { title: "Oil in, medium-high", heat: "medium-high", referenceImage: "assets/recipes/teriyaki/p1-c1.webp", body: "Set the pan to medium-high and add 1 tbsp oil. It's ready when the oil shimmers and flows easily as you tilt the pan.", voice: "Add a tablespoon of oil over medium-high heat, and wait until it shimmers and flows easily when you tilt the pan." },
    ],
    timer: { label: "Heating to sear temp", phaseLabel: "preheat", note: "The shimmer is the real signal — this clock is just the backup." },
    gate: { question: "Is the oil shimmering?", phaseLabel: "oil check", referenceImage: "assets/recipes/teriyaki/p1-c1.webp", lead: "Tilt the pan.\n\n✅ Ready: the oil shimmers and flows fast and thin, like water.\n\n❌ Not ready: it moves slow and thick — give it another 20–30 seconds.\n\n⚠️ Smoking: past ready — pull the pan off the heat for 30 seconds, then back on a notch lower.", voice: "Tilt the pan. If the oil shimmers and flows thin like water, you're ready. Slow and thick means wait. Smoking means pull it off for a moment.", yesLabel: "Shimmering — ready ▸", notYetLabel: "Not yet — keep heating", notYetSec: 30, notYetTimerLabel: "A little longer", tooHotLabel: "Smoking — too hot 🔥", tooHotSec: 30, tooHotTimerLabel: "Off the heat — cooling a moment" },
    transition: { title: "Chicken time 🍗", body: "Sear first. Glaze second. Bowl third.", voice: "Sear first, glaze second, bowl third. Tap to start cooking.", button: "Start cooking", emoji: "🍗" },
    skippable: true,
    skipWarning: "Skipping the preheat means the chicken steams grey instead of searing golden — only skip if the pan's already hot.",
  },
  cues: [
    { at: 0, type: "action", title: "Chicken in — spread it out", heat: "medium-high", phaseLabel: "Phase 2 — Sear the chicken", referenceImage: "assets/recipes/teriyaki/p2-c1.webp",
      body: "Add the chicken and spread it flat in one layer, then leave it alone for about 90 seconds before the first stir — that contact time is where the golden edges come from.",
      beginner: "🍗 Chicken in, spread FLAT in one layer\n✋ Leave it ~90 sec before the first stir\n👀 Contact time = golden edges\n🧼 Wash up — you just handled raw chicken",
      voice: "Add the chicken and spread it flat in one layer. Leave it about ninety seconds before the first stir — that contact time is where the golden edges come from.", haptic: "double" },
    { at: 45, type: "tip", title: "Broccoli: microwave NOW", heat: "medium-high", noCheckpoint: true, opt: "broccoli", referenceImage: "assets/recipes/teriyaki/p2-c2.webp",
      body: "Start the broccoli in the microwave now — 5 minutes, covered. It finishes while the chicken cooks, so it costs you nothing. Keep the pan as your focus.",
      beginner: "🥦 Start the microwave: 5 min, covered\n⏱️ It finishes while the chicken cooks — that's the whole trick\n🍳 Pan stays your focus",
      voice: "Start the broccoli in the microwave now — five minutes, covered. It finishes right as the chicken does, and that's the whole trick. The pan stays your focus.", haptic: "tap" },
    { at: 90, type: "action", title: "Stir + keep it moving", heat: "medium-high", noCheckpoint: true, referenceImage: "assets/recipes/teriyaki/p2-c3.webp",
      body: "First stir — if you see golden sides, that's perfect. Now keep it moving, a stir every 45 seconds or so, cooking until no pink shows anywhere on the outside.",
      beginner: "🥄 First stir — golden sides showing? Perfect\n⏱️ Keep it moving — a stir every ~45 sec\n👀 Cook till no pink shows anywhere outside",
      voice: "First stir — if you see golden sides, that's perfect. Now keep it moving, a stir every forty-five seconds or so, until no pink shows on the outside.", haptic: "tap" },
    { at: 330, type: "temp", title: "Chicken check 🌡️", heat: "medium-high", doneness: true, safetyCritical: true, referenceImage: "assets/recipes/teriyaki/p2-c4.webp",
      body: "Slide the pan off the heat, then cut the biggest cube — white all the way through, no pink or shine? That's done. Thermometer: 165°F / 74°C.",
      beginner: "🍳 Slide the pan off the heat while you check\n🔪 Cut the biggest cube open\n✅ White + opaque all through = done\n🌡️ Thermometer says 165°F / 74°C\n⚠️ Any pink or shine = back on a minute",
      voice: "Slide the pan off the heat, then cut the biggest cube open. White all the way through with no pink means it's done — a hundred and sixty-five degrees if you're using a thermometer.", haptic: "double",
      gate: { kind: "confirm", doneLabel: "No pink — it's cooked", prompt: "Is the biggest cube white all the way through — no pink, no shiny raw bits?", safeTempF: 165, safeTempC: 74, notReadyCoach: "Still pink in the middle? Back on the heat a minute or two, then check the biggest cube again — chicken's the one thing worth being sure about.", checkCoach: "Cut the biggest cube — white all through? Tap when there's no pink.", doneCoach: "Cooked through — slide it back on and drop to medium, the sauce is next.", nudgeSec: 45 } },
    { at: 375, type: "action", title: "Sauce in — stir CONSTANTLY", heat: "medium", phaseLabel: "Phase 3 — The glaze + the bowl", noCheckpoint: true, referenceImage: "assets/recipes/teriyaki/p3-c1.webp",
      body: "Give the sauce one last whisk, then pour it all in and stir constantly — do not stop, do not walk away. It thickens in 1–2 minutes.",
      beginner: "🥣 Give the sauce ONE last whisk, then pour it all in\n🥄 Stir constantly — do not stop, do not walk away\n👀 It thickens in 1–2 min",
      voice: "Give the sauce one last whisk, pour it all in, and stir constantly — it thickens fast, don't walk away.", haptic: "strong" },
    { at: 465, type: "action", title: "The glaze check ✨", heat: "medium", referenceImage: "assets/recipes/teriyaki/p3-c2.webp",
      body: "Shiny, thickened, coating every piece — and your spatula leaves a trail on the pan floor? That's the glaze. Slide the pan OFF the heat right away — on an electric coil the dial isn't enough, it keeps cooking. Gone gluey instead? A splash of water off the heat brings it back.",
      beginner: "✨ Shiny + coats every piece = done\n🥄 Spatula drags a clean trail on the pan = done\n🍳 SLIDE the pan off the heat — the dial isn't enough on electric\n⚠️ Gluey + clumpy? A splash of water off the heat rescues it",
      voice: "When it's shiny, thickened, and coating every piece — and your spatula leaves a trail across the pan — that's the glaze. Slide the pan off the heat right away; the dial alone isn't enough. If it's gone gluey, a splash of water off the heat brings it back.", haptic: "strong",
      gate: { kind: "confirm", doneLabel: "Glazed + off the heat ✨", prompt: "Is the sauce shiny and clinging to the chicken — thick enough that the spatula leaves a trail?", notReadyCoach: "Still watery? Keep stirring on medium — it turns fast, under two minutes, and the shine is the signal. Gone gluey and clumpy instead? Slide it off the heat, stir in a splash of water, and it comes right back.", doneCoach: "That shine is the whole restaurant trick — pan off the heat, bowl time.", checkCoach: "Shiny and coating the chicken, spatula leaving a trail? Slide it off the heat and tap when it's there.", nudgeSec: 30 } },
    { at: 525, type: "action", title: "Build the bowls", heat: "off", referenceImage: "assets/recipes/teriyaki/p3-c3.webp",
      body: "Rice into the bowls, your broccoli beside it if you steamed some, glazed chicken on top — and scrape every drop of glaze from the pan. Green onion or a drizzle of sesame oil if you're using them. Broccoli still cold or raw? Zap it another 3–4 minutes — the bowl waits.",
      beginner: "🍚 Rice in the bowls (reheat if needed)\n🥦 Broccoli beside it if you steamed some — still cold? zap 3–4 min more\n🍗 Glazed chicken on top + every drop of glaze\n🌱 Green onion / a drizzle of sesame oil if using",
      voice: "Rice into the bowls, your broccoli beside it if you steamed some, glazed chicken on top — and scrape every drop of glaze from the pan. That's the good stuff.", haptic: "double",
      fadeTips: [
        "Pouch rice? Kick it off back at the glaze — two minutes and it's hot for the build.",
        "The glaze on the rice is the reason bowls beat plates.",
        "A shake of sesame seeds on top = the takeout look.",
      ] },
    { at: 610, type: "finish", title: "Bowl up 🍜", heat: "off", referenceImage: "assets/recipes/teriyaki/p3-c4.webp",
      body: "Warm bowl, shiny glaze, zero delivery fee. Eat.",
      beginner: "🍜 Warm bowl\n✨ Shiny glaze\n🍽️ Zero delivery fee — eat while it's hot",
      voice: "That's a fourteen dollar takeout teriyaki bowl for about three bucks — and you didn't tip anybody. Nice work.", haptic: "double" },
  ],
};

// ── LOADED QUESADILLA — guided (music-READY but silent) ────────────────────────
// Authored per docs handoff as a noMusic EXPERIENCE. Fold-method single tortilla, medium-heat game
// (the whole lesson: heat too high = burnt jacket, cold cheese). Phase 1 = a skippable EMPTY-pan
// preheat (screens.preCook via quesadillaPrePhase(), stove-split gas 60 / electric 165) — butter
// never sits in a heating pan; it goes in as cue 0. THE LOADED TOGGLE: `protein` ingredient
// (defaultOff → cheese-only is the default); the load cue at :75 carries opt:"protein" and the
// protein prep step opt:"protein", both drop cleanly when off. Shipped BUTTER-primary (oil noted as
// a swap in the label/cue — the fat-picker + oil voice variant is a deferred enhancement). song
// null-placeholder object (NOT literal null → EXP.song.* reads are guarded). Enemy: $9 delivery.
window.LOADED_QUESADILLA = {
  id: "loaded-quesadilla",
  noMusic: true,
  music_ready: true,
  song: { title: "No soundtrack — cook at your pace", artist: "", spotifyQuery: "", videoId: null, youtubeId: null, audioFile: null, audioCredit: null },
  recipe: { title: "Loaded Quesadilla", technique: "Fold & Flip", doneness: "Golden-crisp, melted through", emoji: "🫓" },
  bpm: null,
  durationSec: 490,
  totalTimeMin: 14,
  timeBreakdown: "~4 min prep + ~2 min preheat + ~7 min in the pan (plus a short rest)",
  heroImage: "assets/recipes/quesadilla/hero.webp",
  equipmentNeeded: ["Nonstick pan", "Wide spatula", "Cutting board", "Pizza cutter or sharp knife"],
  cookNeeds: { pans: ["nonstick", "cast-iron", "stainless"], panReason: "Nonstick is easiest — the quesadilla releases clean and any escaped cheese wipes right out. Cast iron browns beautifully; stainless works, just watch it doesn't stick." },
  cookWarning: "The one way to wreck a quesadilla: heat too high. The outside burns before the cheese melts. Medium heat, patience — that's the whole trick.",
  portion: { label: "How many quesadillas?", unit: "quesadillas", base: 1, options: [1, 2, 3], perUnit: 0, clamp: [1, 1] },
  servingNote: "We cook them one at a time — round two goes faster because the pan's already hot.",
  ingredients: [
    { name: "tortilla", label: "Flour tortilla (10-inch)", measure: "1", noInline: true },
    { name: "cheese", label: "Shredded cheese — cheddar, Mexican blend, whatever's there", measure: "1/2 cup (≈ two big handfuls)", noInline: true },
    { name: "butter", label: "Butter — or a little neutral oil (more forgiving)", measure: "1 tsp" },
    { name: "protein", label: "Cooked protein — leftover chicken, taco beef, whatever", measure: "1/4 cup, chopped small", optional: true, defaultOff: true, noInline: true },
    { name: "dip", label: "Salsa or guac — for dipping", measure: "a few spoonfuls", optional: true, defaultOff: false, noInline: true },
  ],
  prepSteps: [
    { title: "Get your stuff together", guide: "Cheese out, tortilla out, butter within reach, wide spatula ready.", voice: "Boring step, biggest payoff — get it all out first: cheese, tortilla, butter, and your wide spatula. Once the pan's hot this moves fast.", referenceImage: "assets/recipes/quesadilla/prep-c1.webp", instructions: "Boring step, biggest payoff. Once the pan's hot this moves fast — you don't want to be digging through the fridge mid-cook.", techniqueGuide: [
      "🧀 Cheese out — half a cup per quesadilla (≈ two big handfuls)",
      "🫓 Tortilla out, butter (or oil) within reach",
      "🥄 Wide spatula ready — it does the fold AND the flip",
    ] },
    { title: "Loading it up? Prep the protein", opt: "protein", guide: "Chop or shred your COOKED protein small — fingernail-size. Already-cooked only.", voice: "If you're loading it up, chop or shred your already-cooked protein small — fingernail-size pieces, so the fold doesn't fight back. Cooked protein only; raw meat never goes in.", referenceImage: "assets/recipes/quesadilla/prep-c2.webp", instructions: "Cheese-only tonight? Skip ahead — no shame, that's the classic.\n\nLoading it: chop or shred your COOKED protein small — think fingernail-size pieces. Big chunks make the fold fight back.", techniqueGuide: [
      "🔪 Chop small — big chunks = lumpy fold + spills",
      "⚠️ Already-cooked protein ONLY — raw meat never goes in, the cook is too short to make it safe",
      "🌡️ Fridge-cold is fine, small pieces warm through",
    ] },
    { title: "Stage the landing zone", guide: "Cutting board + pizza cutter beside the stove. Out of the pan → straight to the board.", voice: "Stage your landing zone — cutting board and pizza cutter right next to the stove. When this comes out of the pan it goes straight to the board.", referenceImage: "assets/recipes/quesadilla/prep-c3.webp", instructions: "Cutting board and pizza cutter (or knife) next to the stove. When this comes out of the pan it goes straight to the board — not onto a plate, not onto the counter.", techniqueGuide: [
      "🛬 Board + cutter beside the stove now",
      "👀 Dip out of the fridge if you're dipping",
    ] },
  ],
  // ── PHASE 1 preheat (screens.preCook via quesadillaPrePhase() — EMPTY pan on MEDIUM; stove-split
  // gas 60 / electric 165 injected there). Butter goes in as cue 0, never sits in a heating pan.
  // Water-drop sizzle gate, three-state (ready / not-yet / too-hot → cooldown). Skippable (round two).
  prePhase: {
    title: "Phase 1 — Preheat the pan",
    intro: "Quesadillas are a medium-heat game. Too hot and the tortilla burns before the cheese melts — we heat the empty pan first, butter goes in right before the action.",
    startLabel: "Start preheating ⏱",
    steps: [
      { title: "Pan on MEDIUM — empty", heat: "medium", referenceImage: "assets/recipes/quesadilla/preheat-c1.webp", body: "Empty pan on the burner, dial to MEDIUM. Nothing in it yet — no butter, no tortilla. Let it warm up: gas about a minute, electric two to three.", voice: "Put your empty pan on the burner at medium heat. Nothing in it yet. Let it warm up." },
    ],
    timer: { label: "Preheating the pan", phaseLabel: "preheat", note: "Medium heat, not high. The timer is a backup — the water test below is the real check.", tips: [
      "Cheese-only is the classic. Loaded is the flex. Both are correct.",
      "Delivery would just be hitting 'confirm order' about now. You're already ahead.",
      "Two big handfuls of cheese shredded and waiting? That's the hard part done.",
    ] },
    gate: { question: "Is the pan ready?", phaseLabel: "pan check", referenceImage: "assets/recipes/quesadilla/preheat-c1.webp", lead: "Wet your fingertips and flick a couple of water drops onto the pan.\n\n✅ Ready: the drops sizzle right away and steam off within a second or two.\n\n❌ Not ready: they just sit there, quiet and flat. Give it another 30–45 seconds and flick again.\n\n⚠️ Too hot: the drops instantly vanish with a violent crackle. This is medium heat — pull the pan off the burner for 30 seconds, then back on a notch lower.", voice: "Flick a couple of water drops on the pan. A quick sizzle and steam means it's ready. Silence means give it a bit longer.", yesLabel: "It sizzled — ready ▸", notYetLabel: "Not yet — heat a little longer", notYetSec: 40, notYetTimerLabel: "A little longer…", tooHotLabel: "Too hot — pull it off 🔥", tooHotSec: 30, tooHotTimerLabel: "Off the heat — cooling a moment" },
    transition: { title: "Pan's ready — let's build 🫓", body: "Butter or oil first, then it all moves in one direction. You've got this.", voice: "Pan is ready. Your butter or oil goes in first, then we build. Here we go.", button: "Start cooking", emoji: "🫓" },
    skippable: true,
    skipWarning: "Skipping the preheat means the tortilla hits a cold pan and steams instead of crisping — only skip if your pan's already hot from a previous round.",
  },
  cues: [
    { at: 0, type: "action", title: "Butter in — swirl it", heat: "medium", phaseLabel: "Phase 2 — Build it", referenceImage: "assets/recipes/quesadilla/cook-c1.webp",
      body: "Drop the butter in and swirl to coat. It should melt and bubble gently — the second it's melted, move to the tortilla. Butter browns fast. (A little oil works too, and it's more forgiving.)",
      beginner: "🧈 Butter in, swirl to coat the pan\n🫧 Melts + bubbles gently = good; browning = move NOW\n💧 Using oil? Same move — swirl to coat\n🧯 Gone brown + smells sharp? Wipe the pan, fresh butter, carry on",
      voice: "Drop the butter in and swirl it around. As soon as it melts, we move — butter browns fast.", haptic: "double" },
    { at: 30, type: "action", title: "Tortilla in — flat", heat: "medium", referenceImage: "assets/recipes/quesadilla/cook-c2.webp",
      body: "Lay the tortilla flat in the pan and press it down gently. You want a soft, polite sizzle — and if the edges start browning within seconds, it's too hot, so drop the heat a notch. It's toasting from now on, so keep the build moving — or slide the pan off the heat if you need a minute.",
      beginner: "🫓 Tortilla flat in the pan, press it down gently\n👂 Soft sizzle = right · edges browning fast = too hot, drop a notch\n⏳ It's toasting now — keep moving, or slide the pan off if you pause",
      voice: "Lay the tortilla flat in the pan. You want a soft sizzle — and if the edges brown within seconds, it's too hot, so drop it a notch. It's toasting from now on, so keep the build moving.", haptic: "tap",
      gate: { kind: "confirm", doneLabel: "It's in", doneCoach: "Now the cheese — one half only.", checkCoach: "Tortilla laid flat and sizzling softly? Tap when it's in.", nudgeSec: 20 } },
    { at: 55, type: "action", title: "Cheese on ONE half", heat: "medium", referenceImage: "assets/recipes/quesadilla/cook-c3.webp",
      body: "Spread the cheese over HALF the tortilla only — even layer, and leave a finger-width border at the edge so it doesn't ooze out when you fold.",
      beginner: "🧀 Cheese on ONE half only — the other half is the lid\n👀 Even layer, finger-width border at the edge\n⚠️ Overfill and it leaks — the border is the seal",
      voice: "Spread the cheese over one half of the tortilla. Even layer, and leave a little border at the edge so nothing leaks out.", haptic: "tap",
      gate: { kind: "confirm", doneLabel: "Cheese is on", doneCoach: "Loading it? Protein's the next step. Cheese-only? Straight to the fold.", checkCoach: "Cheese on one half, border left at the edge? Tap when it's spread.", nudgeSec: 25 } },
    { at: 75, type: "action", title: "Load it up", heat: "medium", opt: "protein", noCheckpoint: true, referenceImage: "assets/recipes/quesadilla/cook-c4.webp",
      body: "Scatter the protein over the cheese, then pinch a little extra cheese on top. Cheese on both sides of the filling is the glue — it's what holds a loaded quesadilla together.",
      beginner: "🍗 Scatter the protein over the cheese\n🧀 Pinch a little more cheese on top — that's the glue\n👀 Keep it inside the border",
      voice: "Scatter the protein over the cheese, then pinch a little more cheese on top. The cheese is the glue.", haptic: "tap" },
    { at: 95, type: "action", title: "The fold", heat: "medium", referenceImage: "assets/recipes/quesadilla/cook-c5.webp",
      body: "Slide your spatula under the EMPTY half and fold it over the cheese. Press down gently for a couple of seconds so it starts to seal.",
      beginner: "🥄 Spatula under the EMPTY half\n🫓 Fold it over the filling — like closing a book\n👇 Press gently a couple of seconds to seal",
      voice: "Slide your spatula under the empty half and fold it over the filling. Press down gently for a couple of seconds.", haptic: "strong",
      gate: { kind: "confirm", doneLabel: "Folded", notReadyCoach: "Filling sliding out? Nudge it back in with the spatula and tuck the edge — no drama, it happens.", doneCoach: "Now the hard part: leaving it alone. Two to three minutes a side.", checkCoach: "Folded over and pressed gently? Tap once it's closed.", nudgeSec: 25 } },
    { at: 150, type: "tip", title: "Now we wait", heat: "medium", phaseLabel: "Phase 3 — Crisp & flip", noCheckpoint: true, referenceImage: "assets/recipes/quesadilla/cook-c5.webp",
      body: "Hands off another minute or two — the pan is doing the work. Perfect time to put the cheese away. Future you says thanks.",
      beginner: "✋ Hands off another minute or two — the pan's doing the work\n🧀 Put the cheese away — future you says thanks\n👃 It'll start to smell like a taco place",
      voice: "Hands off for a couple of minutes. The pan is doing the work. Put the cheese away — future you says thanks.", haptic: "tap" },
    { at: 240, type: "flip", title: "Peek, then THE FLIP", heat: "medium", referenceImage: "assets/recipes/quesadilla/cook-c6.webp",
      body: "Lift the edge and peek underneath: golden-brown spots, not pale, not black — usually 2–3 minutes. Golden? Spatula under the OPEN side and flip it toward the crease, so the fold catches anything that slides. Commit to it — this is the money move.",
      beginner: "👀 Peek under: golden-brown spots = go (usually 2–3 min)\n🥄 Spatula under the OPEN side, not the fold\n🔄 Flip TOWARD the crease — the fold catches any escapees\n⚠️ Pale? 30–45 more sec · already dark? flip now + drop to med-low",
      voice: "Lift the edge and peek. Golden brown spots underneath means flip it. Spatula under the open side, and flip toward the crease so nothing spills.", haptic: "strong",
      gate: { kind: "confirm", doneLabel: "Flipped it 🔄", notReadyCoach: "Still pale underneath? Thirty to forty-five more seconds, golden not blond. Already dark? Flip it now and drop to medium-low. Filling escaped? Scoop it back and press the fold shut — happens to everyone.", checkCoach: "How's the underside — golden-brown spots yet? Tap once you've flipped it.", doneCoach: "Side two goes a little faster — the pan's fully hot now.", nudgeSec: 40 } },
    { at: 300, type: "tip", title: "Side two — almost there", heat: "medium", noCheckpoint: true, referenceImage: "assets/recipes/quesadilla/cook-c7.webp",
      body: "Another minute or two. You'll know it's close when the cheese at the crease looks glossy and melted, and the kitchen smells like the good part of a taco place.",
      beginner: "⏱️ Another minute or two on side two\n🧀 Crease cheese glossy + melted = close\n👃 Smells like the good part of a taco place",
      voice: "Another minute or two. When the cheese at the crease looks glossy and melted, we're close.", haptic: "tap" },
    { at: 375, type: "temp", title: "Golden on both sides?", heat: "medium", referenceImage: "assets/recipes/quesadilla/cook-c8.webp",
      body: "Lift it with the spatula and check: golden-brown and crisp on BOTH sides, cheese fully melted at the crease — no dry, un-melted shreds. That's done.",
      beginner: "👀 Both sides golden-brown and crisp\n🧀 Crease cheese glossy and fully melted — no dry shreds\n⚠️ Golden outside but cheese not melted? Heat to MED-LOW, one more minute a side",
      voice: "Lift it and check both sides. Golden brown and crisp, with the cheese fully melted at the crease — that's done.", haptic: "double",
      gate: { kind: "confirm", doneLabel: "It's golden — done", notReadyCoach: "Cheese not melted but the outside's browning? Drop to medium-low and give it another minute a side — low and slow melts, high just burns.", checkCoach: "Golden and crisp both sides, crease cheese melted? Tap when it's there.", doneCoach: "Off the heat and onto the board — now let it set.", nudgeSec: 30 } },
    { at: 400, type: "rest", title: "Off the heat — rest it", heat: "off", referenceImage: "assets/recipes/quesadilla/cook-c9.webp",
      body: "Slide it onto the cutting board and slide the pan off the burner onto a folded towel — the dial off isn't enough, the burner stays hot. Now: 1–2 minutes of nothing.",
      beginner: "🛬 Onto the cutting board\n🍳 Slide the PAN off the burner too — dial off isn't enough\n⏱️ 1–2 min of nothing — the cheese needs to set",
      warning: "Cut it now and molten cheese pours out the side — you're left with a sad, empty tortilla. Give it the full minute or two; the cheese needs a second to set.",
      voice: "Slide it onto the cutting board, and slide the pan off the burner too. Now the hardest part — leave it alone for a minute or two.", haptic: "double" },
    { at: 490, type: "finish", title: "Cut & eat 🫓", heat: "off", referenceImage: "assets/recipes/quesadilla/hero.webp",
      body: "Pizza cutter or knife, three cuts, six wedges. Eat while the cheese still pulls — dip in salsa or guac if you've got it.",
      beginner: "🍕 Three cuts → six wedges\n🧀 Eat while the cheese still pulls\n🥑 Dip in salsa or guac if you've got it",
      voice: "Cut it into wedges and dig in while the cheese still pulls. That's a crispy, cheesy quesadilla for about two bucks — delivery wanted nine and a forty minute wait. First of many.", haptic: "double" },
  ],
};

window.EXPERIENCES = [window.FREEBIRD_STEAK, window.SCRAMBLED_EGGS, window.ONEPOT_PASTA, window.CRISPY_CHICKEN, window.SMASH_BURGERS, window.CHICKEN_FRIED_RICE, window.GROUND_BEEF_TACOS, window.PANCAKES, window.TERIYAKI_BOWL, window.LOADED_QUESADILLA];
