# LICENSES.md — bundled audio provenance

Rule: every audio file shipped in this folder has a row here. A track with
status ⚠️ must be verified (exact source page) or replaced before it is
treated as license-clean. Attribution surface: the `audioCredit` string
renders on the prep music screen; PROPOSED second surface for CC-BY
tracks: the finish screen's credit line (not yet built — founder call).

| file | recipe | artist / title | source | license | retrieved | attribution line | status |
|---|---|---|---|---|---|---|---|
| chicken-music.mp3 (6:31) | crispy-chicken-thighs | SigmaMusicArt (title unrecorded) | Pixabay — artist: https://pixabay.com/users/sigmamusicart-36860929/ | Pixabay Content License (commercial OK, no attribution, no standalone redistribution) — verified at artist level 2026-07-06 | pre-2026-06 (unrecorded) | none required | ⚠️ exact track page unrecorded — founder confirms original download URL or replaces via shortlist |
| eggs-music.mp3 | scrambled-eggs | SigmaMusicArt (title unrecorded) | Pixabay (same artist) | Pixabay Content License | unrecorded | none required | ⚠️ same — outside this task's scope, flagged |
| steak-music.mp3 | freebird-medium-rare-steak | Alex-Productions (title unrecorded) | unrecorded (Alex-Productions distributes via CC BY 3.0) | LIKELY CC BY 3.0 — attribution REQUIRED if so | unrecorded | "Music: Alex-Productions" shown on prep screen — CC-BY needs the full line + link | ⚠️ outside scope, flagged: verify or replace |
| pasta-music.mp3 | one-pot-garlic-parmesan-pasta | Alex-Productions (title unrecorded) | unrecorded | LIKELY CC BY 3.0 | unrecorded | same as steak | ⚠️ outside scope, flagged |

| tokyo-music-walker-way-home.mp3 (4:38) | phase-1 ambient | Tokyo Music Walker — "Way Home" | unrecorded | "Free To Use YouTube license" per PHASE1_CREDIT — ⚠️ THIS LICENSE CLASS FAILS THE SOURCING RULES (YouTube free-to-use ≠ verifiable commercial license) | unrecorded | credit shown in PHASE1_CREDIT | 🔴 replace or obtain a verifiable license |
| pumpupthemind-on.mp3 (2:12) | phase-1 ambient | PumpupTheMind | unrecorded | unrecorded | unrecorded | PHASE1_CREDIT | ⚠️ verify or replace |
| alex-morgan-downtempo-chill-electronic.mp3 (3:19) | phase-1 ambient | Alex Morgan | unrecorded | unrecorded | unrecorded | PHASE1_CREDIT | ⚠️ verify or replace |
| delosound-background.mp3 (4:36) | phase-1 ambient | Delosound | unrecorded | unrecorded | unrecorded | PHASE1_CREDIT | ⚠️ verify or replace |
| mondamusic-background.mp3 (2:00) | phase-1 ambient | Mondamusic | unrecorded | unrecorded | unrecorded | PHASE1_CREDIT | ⚠️ verify or replace |

NOT LICENSED, NEVER SHIP: `freebird.mp3` and `herecomesthesun.mp3` are
dev-only files (untracked in git, per README.txt "drop a file you legally
own") — they are commercial recordings. 🔴 FOUND SERVING ON PROD
2026-07-06 (a past whole-folder rsync); they must be deleted from the
server and excluded from every future deploy. Deploys of this folder
should whitelist tracked files only.

NOTE: the phase-1 ambient files are also untracked in git yet deployed —
they ship without version control. Track them (they're licensed
stand-ins, not copyrighted originals) or document the deploy source.
