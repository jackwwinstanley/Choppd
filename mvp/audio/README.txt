Sizle — local audio (DEV ONLY)
=================================

Drop a file you legally own named exactly:

    freebird.mp3

into this folder. The app will auto-detect it on the Prep screen and play it
in sync with the cooking cues (the cue clock follows the song's playback
position).

You can also just use the "Load your Free Bird file" button / drag-and-drop on
the Prep screen — no need to copy it here.

IMPORTANT (copyright):
This is a local development convenience only. Do NOT bundle or distribute a
copyrighted track with a shipped app — that is infringement. The production
app streams the song through the Spotify Premium SDK (the user plays it from
their own account), which is the licensed, compliant path.

Supported: any browser-playable audio (.mp3, .m4a, .ogg, .wav).


PHASE-1 CHILL MIX (royalty-free — safe to bundle)
=================================================
During Phase 1 (the silent prep / preheat / simmer wait, before the cook song
drops) the app plays a SHUFFLED mix of free-to-use chill tracks. A random track
plays; when it ends the next shuffled one plays. Any file that's missing is
skipped gracefully, so you don't need all four for it to work.

These are royalty-free / free-to-use (NOT the copyrighted cook songs), so unlike
freebird.mp3 they ARE safe to bundle and ship. Drop them into this folder named:

    delosound-background.mp3            — Delosound (royalty-free)
    mondamusic-background.mp3           — Mondamusic (royalty-free)
    pumpupthemind-on.mp3                — PumpupTheMind (royalty-free)
    tokyo-music-walker-way-home.mp3     — "Way Home" by Tokyo Music Walker

The list + shuffle live in app.js (PHASE1_TRACKS); add/rename entries there if
you change the files.

CREDITS (keep these — required by the free-to-use licenses):
  • "Way Home" by Tokyo Music Walker | Free To Use YouTube license
        https://breakingcopyright.com/song/tokyo-music-walker-way-home
  • Delosound — royalty-free
  • Mondamusic — royalty-free
  • PumpupTheMind — royalty-free
The consolidated credit is also shown in-app on the prep music note (PHASE1_CREDIT).
