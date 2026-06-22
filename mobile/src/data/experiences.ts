// Music-synced cook experiences, ported from mvp/cues.js.
// Keep in sync with the web demo's cue schema.

export type Gate = {
  doneLabel: string;
  notReadyCoach: string;
  checkCoach?: string;
  doneCoach?: string;
  nudgeSec?: number;
};

export type Cue = {
  at: number; // seconds into the cook timeline
  type: "prep" | "tip" | "action" | "flip" | "baste" | "temp" | "rest" | "finish";
  title: string;
  body: string;
  beginner: string;
  voice: string;
  haptic: "tap" | "double" | "strong" | null;
  gate?: Gate; // doneness/safety checkpoint
};

export type Experience = {
  id: string;
  song: { title: string; artist: string; youtubeId: string; bpm: number };
  recipe: { title: string; technique: string; doneness: string; emoji: string };
  durationSec: number;
  prep: string[];
  cues: Cue[];
};

export const FREEBIRD_STEAK: Experience = {
  id: "freebird-steak",
  song: { title: "Free Bird", artist: "Lynyrd Skynyrd", youtubeId: "0LwcvjNJTuM", bpm: 63 },
  recipe: { title: "Medium-Rare Steak", technique: "Pan Sear", doneness: "Medium-rare", emoji: "🥩" },
  durationSec: 480,
  prep: [
    "Pull the steak out 30 min early so it comes to room temperature.",
    "Pat it bone-dry with paper towel — dry = better crust.",
    "Season generously with salt (and pepper) on both sides.",
    "Have tongs, butter, and a plate or board ready before you start.",
  ],
  cues: [
    { at: 0, type: "tip", title: "Heat the pan — HOT", body: "Heavy pan on high, ~2 min.", beginner: "Heaviest pan on high for ~2 min. Careful — it gets very hot.", voice: "Let's go. Put your pan on high heat and let it get really hot.", haptic: "tap" },
    { at: 60, type: "action", title: "Add the oil", body: "A little high-smoke-point oil. Swirl until it shimmers.", beginner: "Thin layer of oil — avocado or canola, not olive. Shimmery = ready.", voice: "Add a thin layer of oil. Wait until it shimmers.", haptic: "tap" },
    { at: 90, type: "action", title: "Lay the steak in", body: "Place it down away from you. Don't move it.", beginner: "Gently set it in, away from you. Now leave it alone.", voice: "Lay the steak into the pan, away from you. Now don't touch it.", haptic: "double" },
    { at: 180, type: "tip", title: "Building the crust", body: "Still searing side one. Resist the urge to peek.", beginner: "That loud sizzle is good — it's building the crust.", voice: "Nice. Leave it searing. That sizzle is building your crust.", haptic: null },
    {
      at: 210, type: "flip", title: "Flip it — once", body: "One clean flip. First side deep brown.", beginner: "Lift a corner — deep brown? Flip once. Pale? 30 more seconds.", voice: "Time to flip. Lift a corner — if it's deep brown, flip it once.", haptic: "strong",
      gate: { doneLabel: "I flipped it", notReadyCoach: "No worries — give it another 30 seconds. Deep golden-brown crust, not grey.", checkCoach: "How's that crust looking? Tap “I flipped it” once it's done.", doneCoach: "Beautiful. Searing the second side now.", nudgeSec: 30 },
    },
    { at: 270, type: "baste", title: "Butter, garlic, thyme", body: "Drop in butter + smashed garlic + thyme. Tilt the pan.", beginner: "Add a knob of butter, smashed garlic, thyme. Tilt the pan toward you.", voice: "Add a spoon of butter, plus garlic and thyme if you have them.", haptic: "tap" },
    { at: 330, type: "baste", title: "Spoon-baste the top", body: "Spoon the foaming butter over the steak.", beginner: "Scoop the foaming butter and pour it over the top, again and again.", voice: "Spoon the butter over the top of the steak, again and again.", haptic: null },
    { at: 390, type: "tip", title: "Solo's kicking in 🔥", body: "The guitars climb — so does the heat.", beginner: "Hear the solo? Home stretch. A few more spoonfuls over the top.", voice: "The solo's kicking in, and so is the heat. Almost there.", haptic: "tap" },
    { at: 410, type: "action", title: "Off the heat", body: "Pull the steak onto a board.", beginner: "Turn off the heat, move it to a board so it stops cooking.", voice: "Take the steak out of the pan and onto a board.", haptic: "double" },
    {
      at: 420, type: "temp", title: "Temp check 🌡️", body: "130–135°F / 54–57°C = medium-rare.", beginner: "Thermometer in the middle: 130–135°F (54–57°C). No thermometer? Soft with a little spring.", voice: "If you've got a thermometer, you're looking for about 130 to 135 degrees in the middle.", haptic: "tap",
      gate: { doneLabel: "It's there", notReadyCoach: "Not quite — back in the hot pan 30–60s, then check again.", checkCoach: "Check the temp again — tap “It's there” at 130 to 135.", doneCoach: "Perfect. Off the heat for real now.", nudgeSec: 30 },
    },
    {
      at: 435, type: "rest", title: "Let it REST", body: "Do not cut yet. Rest while the song winds down.", beginner: "Do NOT cut it yet. Let it rest as the song fades — keeps the juices in.", voice: "Now let it rest. Don't cut into it yet.", haptic: "strong",
      gate: { doneLabel: "Rested", notReadyCoach: "Give it a little longer — resting keeps it juicy.", checkCoach: "Almost — let it rest a touch more.", doneCoach: "Rest's done.", nudgeSec: 30 },
    },
    { at: 470, type: "finish", title: "Slice & serve 🎸", body: "Slice against the grain. You made a medium-rare steak.", beginner: "Slice against the grain for tender bites. You cooked a medium-rare steak to Free Bird. Nice work.", voice: "Slice it against the grain, and enjoy. You just made a medium-rare steak.", haptic: "double" },
  ],
};

export const SCRAMBLED_EGGS: Experience = {
  id: "scrambled-eggs",
  song: { title: "Here Comes the Sun", artist: "The Beatles", youtubeId: "KQetemT1sWc", bpm: 129 },
  recipe: { title: "Fluffy Scrambled Eggs", technique: "Soft Scramble", doneness: "Soft & creamy", emoji: "🍳" },
  durationSec: 210,
  prep: [
    "Crack 3 eggs into a bowl.",
    "Whisk well until fully blended — no streaks of white.",
    "Add a small pinch of salt.",
    "Have butter, a spatula, and a non-stick pan ready.",
  ],
  cues: [
    { at: 0, type: "tip", title: "Low heat + butter", body: "Non-stick pan on low. Add a knob of butter.", beginner: "Low heat is the secret to creamy eggs. Melt a knob of butter, no browning.", voice: "Low and slow. Pan on low heat, add a knob of butter.", haptic: "tap" },
    { at: 25, type: "action", title: "Pour in the eggs", body: "Pour the whisked eggs into the melted butter.", beginner: "Pour the eggs in. Leave them a few seconds before stirring.", voice: "Pour in the eggs. Let them sit for a few seconds.", haptic: "double" },
    { at: 55, type: "action", title: "Stir slowly", body: "Stir gently and constantly, pushing eggs across the pan.", beginner: "Stir slowly, pushing eggs from the edges to the middle. Keep moving.", voice: "Start stirring slowly, pushing the eggs around the pan.", haptic: "tap" },
    { at: 95, type: "tip", title: "Soft curds forming", body: "Small, soft folds appear. Keep it gentle.", beginner: "Soft folds forming? That's right. Keep heat low, keep stirring.", voice: "Soft curds are forming. Keep it gentle.", haptic: null },
    { at: 135, type: "tip", title: "Still glossy & wet", body: "Eggs should look glossy and slightly underdone.", beginner: "A little wet and glossy is good — they finish from their own heat.", voice: "Keep them glossy and a little wet. Almost there.", haptic: "tap" },
    { at: 165, type: "action", title: "Take them off early", body: "Pull off the heat just before they look fully done.", beginner: "Off the heat now, just before fully cooked. They finish on their own.", voice: "Take the eggs off the heat now, just before they look done.", haptic: "double" },
    {
      at: 178, type: "temp", title: "Just set?", body: "Soft & creamy, no runny raw egg.", beginner: "Soft and creamy, no runny raw liquid. Still wet & raw? Back on low a few seconds.", voice: "They should be soft and creamy, with no runny raw egg.", haptic: "tap",
      gate: { doneLabel: "Just set", notReadyCoach: "Not yet — back on low a few seconds, then check. No runny raw egg.", checkCoach: "How do they look? Tap “Just set” once there's no runny raw egg.", doneCoach: "Perfect — soft and creamy.", nudgeSec: 20 },
    },
    { at: 198, type: "finish", title: "Season & plate 🍳", body: "Season, plate, and eat right away while soft.", beginner: "Season with salt & pepper, plate, and eat while soft. You made fluffy scrambled eggs!", voice: "Season with salt and pepper, plate up, and enjoy.", haptic: "double" },
  ],
};

export const EXPERIENCES: Experience[] = [FREEBIRD_STEAK, SCRAMBLED_EGGS];
