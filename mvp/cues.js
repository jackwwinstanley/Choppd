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
  durationSec: 480, // ~8 min cook mapped onto the song
  bpm: 63,          // beat grid for Phase C musical seams

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

  cues: [
    {
      at: 0, type: "tip", title: "Heat the pan — HOT", heat: "high",
      body: "Heavy pan on high. Let it get screaming hot, ~2 min.",
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
      body: "Place it down AWAY from you. Don't move it.",
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
    },
    {
      at: 330, type: "baste", title: "Spoon-baste the top", heat: "medium", opt: "garlicButter",
      body: "Spoon the foaming butter over the steak, keep it moving.",
      beginner: "Use your spoon to scoop that foaming butter and pour it over the top of the steak again and again. This adds flavor and cooks the top evenly.",
      voice: "Spoon the butter over the top of the steak, again and again.",
      haptic: null,
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
        notReadyCoach: "Not quite yet — pop it back in the hot pan for another 30 to 60 seconds, then check again.",
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
    },
    {
      at: 470, type: "finish", title: "Slice & serve 🎸",
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

  cues: [
    {
      at: 0, type: "tip", title: "Butter in a cold pan", heat: "low",
      body: "Butter into the COLD non-stick pan, then set it to low.",
      beginner: "Put a knob of butter into your non-stick pan while it's still cold, THEN turn it to low. Letting the butter and pan warm up together means the eggs never hit a scorching surface — that's the secret to creamy, low-and-slow eggs. No browning.",
      voice: "Add the butter to a cold pan first, then turn it to low so they warm up together.",
      haptic: "tap",
    },
    {
      at: 25, type: "action", title: "Pour in the eggs", heat: "low",
      body: "Pour the whisked eggs into the melted butter.",
      beginner: "Pour your whisked eggs into the melted butter. Leave them for a few seconds to start setting before you stir.",
      voice: "Pour in the eggs. Let them sit for just a few seconds.",
      haptic: "double",
    },
    {
      at: 55, type: "action", title: "Gentle folds", heat: "low",
      body: "Fold from the edges to the center — don't stir constantly.",
      beginner: "Now FOLD, don't scramble. Use your spatula to push the eggs from the edges into the middle in slow, deliberate folds — every 15 to 20 seconds, not constantly. Constant stirring breaks the curds into dry little bits; gentle folds build big, soft ones.",
      voice: "Fold gently — push from the edges to the middle, every fifteen to twenty seconds. Don't stir constantly.",
      haptic: "tap",
    },
    {
      at: 95, type: "tip", title: "Soft curds forming", heat: "low",
      body: "Small, soft folds appear. Keep it gentle.",
      beginner: "See those soft folds forming? That's exactly right. Keep the heat low and keep folding gently every 15 to 20 seconds — don't stir constantly.",
      voice: "Nice — soft curds are forming. Keep it gentle.",
      haptic: null,
    },
    {
      at: 135, type: "tip", title: "Still glossy & wet", heat: "low",
      body: "Eggs should look glossy and slightly underdone.",
      beginner: "The eggs should still look a little wet and glossy — that's good. They'll keep cooking from their own heat once you stop.",
      voice: "Keep them glossy and a little wet. Almost there.",
      haptic: "tap",
    },
    {
      at: 165, type: "action", title: "Take them off early",
      body: "Off the heat just before done — then one more fold.",
      beginner: "Take the pan completely off the heat now — just before they look fully cooked. Give them one more gentle fold; the residual heat finishes them in the next few seconds.",
      voice: "Take the eggs off the heat now, just before they look done. One more gentle fold.",
      haptic: "double",
    },
    {
      at: 178, type: "temp", title: "Just set?",
      body: "Soft & creamy, no runny raw egg.",
      beginner: "Check them: soft and creamy, with no runny raw liquid left. If they're still wet and raw, put them back on low for a few more seconds.",
      voice: "They should be soft and creamy, with no runny raw egg.",
      haptic: "tap",
      gate: {
        kind: "confirm",
        doneLabel: "Just set",
        notReadyCoach: "Not yet — back on low heat for a few seconds, then check again. No runny raw egg, but keep them creamy.",
        checkCoach: "How do they look? Tap “Just set” once there's no runny raw egg.",
        doneCoach: "Perfect — soft and creamy.",
        nudgeSec: 20,
      },
    },
    {
      at: 198, type: "finish", title: "Season & plate 🍳",
      body: "Season, plate, and eat right away while soft.",
      beginner: "Season with a little salt and pepper, slide them onto a plate, and eat straight away while they're soft. You just made fluffy scrambled eggs — nice work!",
      voice: "Season with salt and pepper, plate up, and enjoy. You made fluffy scrambled eggs.",
      haptic: "double",
    },
  ],
};

/*
 * Suggested pairing -> Creamy One-Pot Pasta (Garlic Parmesan). Free-tier cook.
 * Royalty-free demo audio stands in for the song; premium can play any Spotify track.
 * Great for multi-step sequencing: sauté -> simmer -> finish off heat.
 */
window.ONEPOT_PASTA = {
  id: "one-pot-garlic-parmesan-pasta",
  song: { title: "That's Amore", artist: "Dean Martin", spotifyQuery: "That's Amore Dean Martin", youtubeId: null, audioFile: "audio/eggs-music.mp3", audioCredit: "Music: SigmaMusicArt (royalty-free)" },
  recipe: { title: "Creamy One-Pot Pasta", technique: "One-Pot", doneness: "Tender & creamy", emoji: "🍝" },
  durationSec: 330,
  bpm: 96,

  optionalGroups: [
    { id: "basil", emoji: "🌿", label: "Fresh basil finish", note: "Tear fresh basil over the top to serve." },
  ],
  portion: { label: "How many servings?", unit: "servings", base: 2, options: [2, 3, 4], perUnit: 0.1, clamp: [0.85, 1.4] },

  prep: [
    "Grab a wide, deep pan or pot.",
    "Mince 2 garlic cloves; grate ~1/2 cup parmesan.",
    "Measure 8 oz short pasta, 2 cups broth, 1/2 cup cream.",
    "Have butter, salt, pepper (and basil) ready.",
  ],

  cues: [
    {
      at: 0, type: "tip", title: "Garlic in butter", heat: "medium",
      body: "Melt butter, add garlic — ~1 min, don't brown it.",
      beginner: "Melt the butter over medium heat, then add the minced garlic. Stir for about a minute until it smells amazing — but don't let it brown, or it turns bitter.",
      voice: "Melt the butter and add the garlic. About a minute — don't let it brown.",
      haptic: "tap",
    },
    {
      at: 35, type: "action", title: "Pasta + broth in", heat: "medium-high",
      body: "Add the pasta and broth. Stir, bring to a simmer.",
      beginner: "Add the dry pasta and the broth straight into the pan. Give it a stir and turn the heat up to bring it to a gentle simmer.",
      voice: "Add the pasta and the broth, stir, and bring it to a simmer.",
      haptic: "double",
    },
    {
      at: 75, type: "tip", title: "Simmer uncovered", heat: "medium-high",
      body: "Uncovered ~10–12 min. Stir every couple minutes.",
      beginner: "Let it simmer uncovered for 10 to 12 minutes. Stir every couple of minutes so the pasta doesn't stick — the liquid slowly turns into a silky sauce as the starch releases.",
      voice: "Simmer it uncovered for ten to twelve minutes, stirring every couple of minutes.",
      haptic: "tap",
    },
    {
      at: 230, type: "temp", title: "Pasta tender?", heat: "medium",
      body: "Bite a piece — tender, liquid mostly absorbed.",
      beginner: "Taste a piece — it should be tender (not mushy) and most of the liquid should have cooked down into a creamy sauce. Still firm or watery? Give it a few more minutes.",
      voice: "Taste a piece — it should be tender, with most of the liquid absorbed.",
      haptic: "tap",
      gate: {
        kind: "confirm",
        doneLabel: "Tender & saucy",
        notReadyCoach: "Not yet — a few more minutes of simmering. If it's drying out before the pasta's tender, add a splash of broth or water.",
        checkCoach: "Taste again — tap “Tender & saucy” once the pasta's soft and the liquid's mostly gone.",
        doneCoach: "Perfect. Off the heat for the creamy finish.",
        nudgeSec: 30,
      },
    },
    {
      at: 255, type: "action", title: "Cream + parmesan — off heat", heat: "low",
      body: "Off the heat. Stir in cream + parmesan until glossy.",
      beginner: "Take the pan OFF the heat first (so the cheese stays silky, not grainy), then stir in the cream and parmesan. Keep stirring until it's glossy and smooth.",
      voice: "Off the heat now. Stir in the cream and parmesan until it's glossy.",
      haptic: "double",
    },
    {
      at: 290, type: "tip", title: "Season", heat: "low",
      body: "Salt + pepper. Loosen with a splash of broth if thick.",
      beginner: "Season with salt and pepper to taste. If it's thicker than you'd like, stir in a splash of broth to loosen it — it keeps thickening as it sits.",
      voice: "Season with salt and pepper. Loosen with a splash of broth if it's too thick.",
      haptic: "tap",
    },
    {
      at: 310, type: "baste", title: "Fresh basil", heat: "low", opt: "basil",
      body: "Tear fresh basil over the top.",
      beginner: "Tear a few fresh basil leaves over the top — it adds a bright, fresh lift against the rich, creamy sauce.",
      voice: "Tear some fresh basil over the top.",
      haptic: "tap",
    },
    {
      at: 325, type: "finish", title: "Serve 🍝",
      body: "Serve right away while creamy. Nice work.",
      beginner: "Serve it straight away while it's hot and creamy — it firms up as it sits. You just made creamy one-pot garlic parmesan pasta. Nice work!",
      voice: "Serve it right away while it's creamy. You made one-pot garlic parmesan pasta.",
      haptic: "double",
    },
  ],
};

/*
 * Suggested pairing -> Crispy Pan-Fried Chicken Thighs. Free-tier cook.
 * The skin-crispiness "does it release?" check + the 165°F safety gate line up
 * beautifully with music cueing.
 */
window.CRISPY_CHICKEN = {
  id: "crispy-chicken-thighs",
  song: { title: "Superstition", artist: "Stevie Wonder", spotifyQuery: "Superstition Stevie Wonder", youtubeId: null, audioFile: "audio/steak-music.mp3", audioCredit: "Music: Alex-Productions (royalty-free)" },
  recipe: { title: "Crispy Chicken Thighs", technique: "Crispy Pan-Fry", doneness: "165°F, crispy skin", emoji: "🍗" },
  durationSec: 560,
  bpm: 100,

  portion: { label: "How many thighs?", unit: "thighs", base: 4, options: [2, 4, 6], perUnit: 0.04, clamp: [0.9, 1.15] },

  prep: [
    "Pat the thighs VERY dry with paper towel — dry skin = crispy skin.",
    "Season both sides: salt, pepper, garlic powder, paprika.",
    "Use a cast-iron or stainless pan (not non-stick).",
    "Have tongs and an instant-read thermometer ready if you can.",
  ],

  cues: [
    {
      at: 0, type: "tip", title: "Cold pan, skin down", heat: "medium",
      body: "Thighs skin-down in a cold pan, then turn to medium.",
      beginner: "Lay the thighs skin-side down in a COLD pan, then turn the heat to medium. Starting cold lets the fat under the skin slowly render out — that's the secret to deeply crispy skin. Skin-on needs no oil.",
      voice: "Lay the thighs skin-side down in a cold pan, then turn it to medium. They render their own fat.",
      haptic: "double",
    },
    {
      at: 40, type: "action", title: "Now leave them alone", heat: "medium",
      body: "Don't move them. Moving = no crisp.",
      beginner: "Now leave them completely alone. Don't poke, press, or peek underneath — moving them stops the skin from crisping and sticking releases on its own when it's ready.",
      voice: "Leave them alone now. Don't move them.",
      haptic: "tap",
    },
    {
      at: 160, type: "tip", title: "Fat's rendering", heat: "medium",
      body: "Steady sizzle = fat rendering, skin browning.",
      beginner: "Hear that steady, gentle sizzle? That's the fat rendering and the skin slowly going golden. If it's spitting violently, nudge the heat down a touch.",
      voice: "That steady sizzle is the fat rendering. Keep it there.",
      haptic: null,
    },
    {
      at: 290, type: "flip", title: "Skin crisp? Flip", heat: "medium",
      body: "Deep golden + releases easily = flip. Sticks = wait.",
      beginner: "After about 8 to 10 minutes, lift one with tongs. The skin should be deeply golden and release easily. If it sticks, it's NOT ready — leave it another minute or two, then check again.",
      voice: "Lift one — if the skin's deep golden and lets go easily, flip it. If it sticks, give it another minute.",
      haptic: "strong",
      gate: {
        kind: "confirm",
        doneLabel: "Crisp — flipped",
        notReadyCoach: "If it's sticking, the skin isn't crisp yet. Leave it another minute or two — it releases on its own when it's ready.",
        checkCoach: "How's the skin? Tap “Crisp — flipped” once it's deep golden and releases easily.",
        doneCoach: "Beautiful. Now cook it through on the second side.",
        nudgeSec: 45,
      },
    },
    {
      at: 320, type: "action", title: "Cook it through", heat: "medium",
      body: "Skin up. 6–8 min more to cook through.",
      beginner: "Skin-side up now. Cook another 6 to 8 minutes to cook it all the way through — bone-in thighs take a little longer than you'd think.",
      voice: "Skin up now. Six to eight more minutes to cook it through.",
      haptic: "tap",
    },
    {
      at: 480, type: "temp", title: "165°F check 🌡️", heat: "medium",
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
      at: 510, type: "rest", title: "Rest a few min",
      body: "Rest ~5 min so the juices settle.",
      beginner: "Let the thighs rest for about 5 minutes — the juices settle back in so they stay moist, and the skin stays crisp.",
      voice: "Let them rest about five minutes so the juices settle.",
      haptic: "strong",
    },
    {
      at: 545, type: "finish", title: "Serve 🍗",
      body: "Crispy-skin chicken thighs. Nice work.",
      beginner: "Serve them up crispy-side proud. You just pan-fried chicken thighs with shatteringly crisp skin, cooked safely through. Nice work, chef!",
      voice: "Serve them up. You made crispy pan-fried chicken thighs. Nice work.",
      haptic: "double",
    },
  ],
};

// all music-synced cooks (first = featured)
window.EXPERIENCES = [window.FREEBIRD_STEAK, window.SCRAMBLED_EGGS, window.ONEPOT_PASTA, window.CRISPY_CHICKEN];
