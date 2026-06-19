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
  song: { title: "Free Bird", artist: "Lynyrd Skynyrd", spotifyQuery: "Free Bird Lynyrd Skynyrd" },
  recipe: { title: "Medium-Rare Steak", technique: "Pan Sear", doneness: "Medium-rare", emoji: "🥩" },
  durationSec: 480, // ~8 min cook mapped onto the song

  // Shown on the prep screen BEFORE the cook clock starts.
  prep: [
    "Pull the steak out 30 min early so it comes to room temperature.",
    "Pat it bone-dry with paper towel — dry = better crust.",
    "Season generously with salt (and pepper) on both sides.",
    "Have tongs, butter, and a plate or board ready before you start.",
  ],

  cues: [
    {
      at: 0, type: "tip", title: "Heat the pan — HOT",
      body: "Heavy pan on high. Let it get screaming hot, ~2 min.",
      beginner: "Put your heaviest pan on high heat and let it sit empty for about 2 minutes. We want it really hot so the steak sizzles the second it lands. Careful — the handle and pan get very hot.",
      voice: "Let's go. Put your pan on high heat and let it get really hot for about two minutes.",
      haptic: "tap",
    },
    {
      at: 60, type: "action", title: "Add the oil",
      body: "A little high-smoke-point oil. Swirl until it shimmers.",
      beginner: "Add a thin layer of oil — something like avocado or canola, not olive oil. When it looks shimmery and almost smoking, it's ready.",
      voice: "Add a thin layer of oil. Wait until it shimmers.",
      haptic: "tap",
    },
    {
      at: 90, type: "action", title: "Lay the steak in",
      body: "Place it down AWAY from you. Don't move it.",
      beginner: "Gently set the steak into the pan, laying it down away from you so the oil doesn't splash toward you. Now leave it completely alone — moving it stops the crust from forming.",
      voice: "Lay the steak into the pan, away from you. Now don't touch it.",
      haptic: "double",
    },
    {
      at: 180, type: "tip", title: "Building the crust",
      body: "Still searing side one. Resist the urge to peek.",
      beginner: "It's working. That loud sizzle is a good thing — it's building a brown, tasty crust. Let it keep going.",
      voice: "Nice. Leave it searing. That sizzle is building your crust.",
      haptic: null,
    },
    {
      at: 210, type: "flip", title: "Flip it — once",
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
      at: 270, type: "baste", title: "Butter, garlic, thyme",
      body: "Drop in butter + smashed garlic + thyme. Tilt the pan.",
      beginner: "Add a knob of butter and, if you have them, a smashed garlic clove and some thyme. Tilt the pan slightly so the melted butter pools at the bottom.",
      voice: "Add a spoon of butter, plus garlic and thyme if you have them. Tilt the pan toward you.",
      haptic: "tap",
    },
    {
      at: 330, type: "baste", title: "Spoon-baste the top",
      body: "Spoon the foaming butter over the steak, keep it moving.",
      beginner: "Use your spoon to scoop that foaming butter and pour it over the top of the steak again and again. This adds flavor and cooks the top evenly.",
      voice: "Spoon the butter over the top of the steak, again and again.",
      haptic: null,
    },
    {
      at: 390, type: "tip", title: "Solo's kicking in 🔥",
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
