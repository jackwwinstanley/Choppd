// ─── The Choppd soundtrack pool ────────────────────────────────────────────────────────────────────
// Copyright-FREE tracks that play, shuffled + looping, across a music cook (phase 1 → phase 2, one player).
// This replaced the four copyrighted per-recipe "songs." To ADD a track: drop the .mp3 into
// mvp/audio/soundtrack/, add one line below, whitelist it in .gitignore, and commit. See
// docs/HOW-TO-ADD-SOUNDTRACK.md. Every entry's file must resolve (the Stage-0 missing-asset assert +
// boot check enforce it) or a deploy/clone ships silence.
//
// `file`  — path relative to mvp/ (served at getchoppd.app/… and bundled into the iOS app via cap sync).
// `title` — friendly display name (panel "now playing"); safe to show — these ARE the real royalty-free tracks.
window.SOUNDTRACK_MANIFEST = [
  { file: "audio/soundtrack/alex-morgan-chillhop-jazz-coffee-shop.mp3", title: "Chillhop Jazz · Alex Morgan" },
  { file: "audio/soundtrack/alex-morgan-downtempo-chill-electronic.mp3", title: "Downtempo Chill · Alex Morgan" },
  { file: "audio/soundtrack/alex-morgan-lofi-jazz-midnight-club.mp3", title: "Lo-fi Jazz · Alex Morgan" },
  { file: "audio/soundtrack/alexguz-funk-breakbeat.mp3", title: "Funk Breakbeat · Alexguz" },
  { file: "audio/soundtrack/apalonbeats-lofi-hiphop.mp3", title: "Lo-fi Hip-Hop · Apalonbeats" },
  { file: "audio/soundtrack/delosound-background.mp3", title: "Background Chill · Delosound" },
  { file: "audio/soundtrack/fassounds-lofi-study-chillhop.mp3", title: "Lo-fi Study · FASSounds" },
  { file: "audio/soundtrack/lofi-library-coffee-ambient.mp3", title: "Coffee Lo-fi · Lofi Music Library" },
  { file: "audio/soundtrack/mondamusic-background.mp3", title: "Background · Mondamusic" },
  { file: "audio/soundtrack/pumpupthemind-once-in-paris.mp3", title: "Once in Paris · PumpupTheMind" },
  { file: "audio/soundtrack/sigmamusicart-chill.mp3", title: "Chill · SigmaMusicArt" },
  { file: "audio/soundtrack/tokyo-music-walker-way-home.mp3", title: "Way Home · Tokyo Music Walker" },
];
