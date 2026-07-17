Choppd — local audio
=====================

THE CHOPPD SOUNDTRACK (royalty-free — bundled & shipped)
========================================================
Music cooks play a SHUFFLED, copyright-free "Choppd soundtrack" pool that spans
Phase 1 (prep/preheat/simmer) straight through the cook — one continuous player,
no per-recipe song. The tracks + titles live in a manifest:

    audio/soundtrack/*.mp3          — the pool files (all royalty-free / licensed
                                      to distribute — see LICENSES.md)
    audio/soundtrack-manifest.js    — window.SOUNDTRACK_MANIFEST = [{file,title}]

To add a track: drop the .mp3 into audio/soundtrack/, add a {file,title} row to
the manifest, and cap sync. See docs/HOW-TO-ADD-SOUNDTRACK.md.

A random track plays; when it ends the next shuffled one plays. Any missing file
is skipped gracefully. The boot-time missing-asset assert (app.js
assertAudioAssets) fails loud if a manifest file 404s, so a deploy/clone never
ships silence.

"No music" pref: a user can turn the soundtrack off (onboarding / settings /
pre-cook). Voice cues, countdown blips, and the timer alarm still ring — only the
soundtrack + ambient are silenced.

BRING YOUR OWN (dev only)
=========================
For local dev you can play a file you legally own via the "Load a music file"
button / drag-and-drop on the Prep screen (or the in-app file picker). This rides
the dormant Music backend, not the pool. Do NOT bundle or distribute a
copyrighted track with a shipped app — that is infringement. Users who want their
own music connect Apple Music (or Spotify Premium), the licensed path.

Supported: any browser-playable audio (.mp3, .m4a, .ogg, .wav).

CREDITS (keep these — required by the free-to-use licenses)
===========================================================
The consolidated soundtrack credits live in audio/LICENSES.md; the in-app prep
music note shows PHASE1_CREDIT. Every pooled track is royalty-free or carries a
free-to-use / distribution license.
