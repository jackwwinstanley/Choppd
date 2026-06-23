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

  // Shown on the prep screen BEFORE the cook clock starts.
  prep: [
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
      at: 270, type: "baste", title: "Butter, garlic, thyme", heat: "medium-high",
      body: "Drop in butter + smashed garlic + thyme. Tilt the pan.",
      beginner: "Add a knob of butter and, if you have them, a smashed garlic clove and some thyme. Tilt the pan slightly so the melted butter pools at the bottom.",
      voice: "Add a spoon of butter, plus garlic and thyme if you have them. Tilt the pan toward you.",
      haptic: "tap",
    },
    {
      at: 330, type: "baste", title: "Spoon-baste the top", heat: "medium-high",
      body: "Spoon the foaming butter over the steak, keep it moving.",
      beginner: "Use your spoon to scoop that foaming butter and pour it over the top of the steak again and again. This adds flavor and cooks the top evenly.",
      voice: "Spoon the butter over the top of the steak, again and again.",
      haptic: null,
    },
    {
      at: 390, type: "tip", title: "Solo's kicking in 🔥", heat: "medium-high",
      body: "The guitars climb — so does the heat. Almost there.",
      beginner: "Hear the guitar solo taking off? You're in the home stretch. Just a few more spoonfuls of butter over the top.",
      voice: "The solo's kicking in, and so is the heat. Almost there.",
      haptic: "tap",
    },
    {
      at: 410, type: "action", title: "Off the heat",
      body: "Pull the steak onto a board or plate.",
      beginner: "Turn off the heat and move the steak out of the pan onto a board or plate so it stops cooking.",
      voice: "Take the steak out of the pan and onto a board.",
      haptic: "double",
    },
    {
      at: 420, type: "temp", title: "Temp check 🌡️",
      body: "130–135°F / 54–57°C = medium-rare.",
      beginner: "If you have a meat thermometer, the middle should read 130 to 135°F, or about 54 to 57°C, for medium-rare. No thermometer? It should feel soft with a little spring.",
      voice: "If you've got a thermometer, you're looking for about 130 to 135 degrees in the middle.",
      haptic: "tap",
      // PHASE A: a safety/doneness checkpoint — don't move on until it's there
      gate: {
        kind: "confirm",
        doneLabel: "It's there",
        notReadyCoach: "Not quite yet — pop it back in the hot pan for another 30 to 60 seconds, then check again.",
        checkCoach: "Check the temp again — tap “It's there” once it hits 130 to 135.",
        doneCoach: "Perfect. Off the heat for real now.",
        nudgeSec: 30,
      },
    },
    {
      at: 435, type: "rest", title: "Let it REST",
      body: "Do not cut yet. Rest while the song winds down.",
      beginner: "This part matters: do NOT cut into it yet. Let it sit and rest while the song fades out. Cutting early lets all the juices run out.",
      voice: "Now let it rest. Don't cut into it yet. Let it sit while the song winds down.",
      haptic: "strong",
    },
    {
      at: 470, type: "finish", title: "Slice & serve 🎸",
      body: "Slice against the grain. You made a medium-rare steak.",
      beginner: "Rest is done! Slice it against the grain — across the lines in the meat — for tender bites. You just cooked a medium-rare steak to Free Bird. Nice work.",
      voice: "Rest's done. Slice it against the grain, and enjoy. You just made a medium-rare steak.",
      haptic: "double",
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

// all music-synced cooks (first = featured)
window.EXPERIENCES = [window.FREEBIRD_STEAK, window.SCRAMBLED_EGGS];
