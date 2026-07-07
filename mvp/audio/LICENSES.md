# LICENSES.md — bundled audio provenance

Rule: every audio file shipped in this folder has a row here. The four
recipe stand-in tracks and the two copyrighted dev files were DELETED
2026-07-06 (founder). Recipe song blocks now carry `audioFile: null` —
wiring future music is a data add: drop a licensed file here, add its
row below, and point the recipe's `song.audioFile` at it.

| file | used by | artist | source | license | status |
|---|---|---|---|---|---|
| tokyo-music-walker-way-home.mp3 (4:38) | phase-1 ambient | Tokyo Music Walker — "Way Home" | unrecorded | "Free To Use YouTube license" per PHASE1_CREDIT — 🔴 fails the sourcing rules (not a verifiable commercial license) | founder's call: replace or obtain verifiable license |
| pumpupthemind-on.mp3 (2:12) | phase-1 ambient | PumpupTheMind | unrecorded | unrecorded | ⚠️ verify or replace |
| alex-morgan-downtempo-chill-electronic.mp3 (3:19) | phase-1 ambient | Alex Morgan | unrecorded | unrecorded | ⚠️ verify or replace |
| delosound-background.mp3 (4:36) | phase-1 ambient | Delosound | unrecorded | unrecorded | ⚠️ verify or replace |
| mondamusic-background.mp3 (2:00) | phase-1 ambient | Mondamusic | unrecorded | unrecorded | ⚠️ verify or replace |
| voice/am_michael/*.mp3 (151 clips) | all recipes (TTS) | generated in-repo (Kokoro-82M, am_michael) | tools/voicegen | Kokoro model outputs, Apache-2.0 model — our generated audio | ✓ |

NOTE: the five ambient files are untracked in git yet deployed — they
ship without version control (flagged; founder's call to track or
document the deploy source).
