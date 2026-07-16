# Soundtrack migration map

Retire the four per-recipe "songs" (Free Bird, Here Comes the Sun, Bohemian Rhapsody, Hotel California) in
favour of a shuffled copyright-free **Choppd soundtrack** pool with AM-style continuous/loop behaviour; add a
**no-music** option; remove the "Music Sync" badge label (keep the wiring); and **wipe every copyrighted-song
reference** so grep returns zero.

## Founder corrections (post-review — override the map where they conflict)

1. **The four song mp3s ARE the copyrighted recordings — DELETE them, never pool them.** The
   `audioCredit: "…(royalty-free)"` line in `cues.js` is **inaccurate**. `steak-music.mp3`, `eggs-music.mp3`,
   `pasta-music.mp3`, `chicken-music.mp3` are the real copyrighted tracks. They get `git rm`'d, their
   `.gitignore` whitelist lines removed, and are purged from the server + iOS bundle. (This **supersedes** the
   Context/§6 "the mp3s are royalty-free" conclusion below — that read the credit line at face value and was
   wrong.) They remain in git **history** (delete-forward default; a history scrub is available on request.)
2. **A "no music" option ships** across onboarding (step-4 third card), settings (a persistent music
   preference), and pre-cook (the audio selector) — silencing the soundtrack + phase-1 ambient ONLY; voice
   cues, countdown blips, and the **timer alarm still sound** (a silent alarm is a safety regression → locked).
3. **The pool is manifest-based** — `mvp/audio/soundtrack/` + a `soundtrack-manifest.js` of `{file, title}`;
   adding a track later = drop the mp3, add one line, commit. A `docs/HOW-TO-ADD-SOUNDTRACK.md` documents it.

The rest of the map (behaviour, wiring, lock strategy) stands as approved.

## Context

**Load-bearing nuance (superseded by correction #1):** as first read, the four `audioFile`s *appeared*
royalty-free (their `audioCredit` says so) — i.e. the exposure looked like naming + `youtubeId` embeds + spoken
clips only. **The founder confirms the credit line is wrong: the mp3s themselves are the copyrighted
recordings.** So the wipe is naming **and** the audio files: the four mp3s are deleted, the new pool is
genuinely copyright-free (manifest-listed), and the branding is genericised.

---

## §0 — CURRENT FUNCTIONALITY of each feature being modified (as-is)

Plain-language "how it works today" for every surface this migration touches.

**1. Per-recipe local "song" (the 4 music recipes).**
Each music recipe (`cues.js`) carries a `song` block: `title`, `artist`, `bpm`, `audioFile`, `youtubeId`,
`audioCredit`, and (chicken only) `musicStartAt`/`songStartOffset`/`phase2Blurb`. At cook mount,
`Music.setSrc(EXP.song.audioFile)` loads the one mp3 into `music-backend.js`'s `<audio>` + a WebAudio "muffle"
graph (`initGraph`). The **cook clock** (`songPos`, advanced by wall-clock `dt` in `loop()`) is the driver;
cues fire when `songPos >= cue.at`. The audio plays **offset** by `musicStartAt`
(`filePos = max(0, songPos − musicStartAt + songStartOffset)`) and starts via `Music.fadeIn(500, filePos)` the
moment `songPos` crosses `musicStartAt` (steak/eggs/pasta cross at 0 → play from cook start; chicken at 190 →
kicks in for "round two"). At checkpoints the timer parks (`songPos` frozen) while the track plays muffled;
gate confirm seeks + un-muffles. Pause/resume = `Music.pause/play` with a `_wantPlay` intent flag. **No
skip/back and no 🎵 panel for a local cook** — the panel (`#tAmEdit`) renders only when `amSel` is set.

**2. Phase-1 ambient (preCook).**
Recipes with a `prePhase` run a Phase-1 "simmer" screen. For a **local/Choppd** cook,
`Ambient.playShuffled(PHASE1_TRACKS)` plays a **shuffled, looping** mix of 5 separate royalty-free chill tracks
(Delosound / Mondamusic / PumpupTheMind / Alex Morgan / Tokyo Music Walker) — a bare second `<audio>` that
shuffles the list, advances on `onended`, skips missing on `onerror`. At the transition it
`Ambient.fadeOut(900)` and the phase-2 **song** fades in. (An **AM** cook skips Ambient and plays the AM queue
continuously — see 3.)

**3. Apple Music (the reference behaviour the pool should match).**
`startAmContinuous()` (preCook) queues + plays **one native `ApplicationMusicPlayer` queue spanning phase 1→2**
with no restart/reseek (`phase1MusicPlaying`), optional shuffle, repeat=all. Cues ride the cook clock (never
slaved to `playbackTime`). The module-scope `MusicPanel` (🎵 icon, preCook + cook) offers pause-the-music-only
(user pause outranks everything, lock #9), ⏭/⏮ skip/back (AM-only), "pick different music," and a self-heal
repair ladder. Resume goes through a single `resumeAudio(reason)` owner guarded by `audioEpoch`. Locked
#1/#2/#3/#9/#10/#12.

**4. Now-playing header (cook screen).**
`app.js ~6967` renders bold the source — for a local cook: `EXP.song.title` with a sub-line
`artist + " · " + bpm + " BPM"` (+ `· demo` if unloaded). AM → first track + "via Apple Music"; Spotify → the
selection + "🎧 Spotify"; noMusic → recipe emoji + "Guided · cook at your pace." Eyebrows print
`"{song.title} · {recipe}"`.

**5. The "Music Sync" badge.**
`syncBadge()` = `🎵 Music Sync`, `guidedBadge()` = `🍳 Guided`. Sync badge when `song.audioFile` && !`noMusic`;
else guided. Rendered on featured card, recipe rows, detail, dashboard. Separately, `isMusicSync`/`musicSynced`
drive **preview availability** + the music-experience lookup (`musicExpFor`) — badge label and "is-music-cook"
data are distinct.

**6. Beat-sync / cue timing.**
`cues[].at` (seconds into the cook clock) is the only real timeline; cues never read audio position. `bpm` is
display + a dormant beat grid. `musicStartAt` (chicken=190) sets where the file fades in, not when cues fire.
`spotifyQuery`/`youtubeId` are specific-track pointers.

**7. Song-named copy + voice (spoken).**
Transition banners ("🎸 Drop it — Free Bird starts now"), the greeting (`"${EXP.song.title} is rolling"`), the
finish card ("Cooked to {title} / {artist} · Choppd"), the pasta finish voice ("…cooked to Bohemian
Rhapsody"), the onboarding line ("the Free Bird steak cook is on us"), a home card ("🎸 New · Free Bird
steak"). The greeting + pasta finish line are **spoken clips** (hash-named mp3s) — text change → new hash →
regenerate.

**8. How audio ships (deploy).**
The Node server serves `mvp/` (incl. `mvp/audio/`) via `express.static`; Caddy reverse-proxies
`getchoppd.app → :8788`. iOS has `webDir:"mvp"`, **no `server.url`** → `cap sync` **bundles** `mvp/audio/`
(local tracks bundled, not fetched). The 4 song files are git-tracked (whitelisted); the 5 phase-1 tracks are
**not** tracked. No deploy script in the repo — manual rsync of `mvp/`.

---

## §1 — Local music file inventory

**Four music-sync recipes.** Everything else (8 recipes) is `noMusic: true` (`audioFile: null`) and is
**untouched**.

| Recipe | `title` / `artist` / `bpm` | `audioFile` | `musicStartAt` | git-tracked? |
|---|---|---|---|---|
| `freebird-medium-rare-steak` | Free Bird / Lynyrd Skynyrd / 63 | `audio/steak-music.mp3` | 0 | ✅ (→ DELETE) |
| `scrambled-eggs` | Here Comes the Sun / The Beatles / 129 | `audio/eggs-music.mp3` | 0 | ✅ (→ DELETE) |
| `one-pot-garlic-parmesan-pasta` | Bohemian Rhapsody / Queen / 72 | `audio/pasta-music.mp3` | 0 | ✅ (→ DELETE) |
| `crispy-chicken-thighs` | Hotel California / Eagles / null | `audio/chicken-music.mp3` | **190** + `phase2Blurb` | ✅ (→ DELETE) |

**Phase-1 ambient pool** (a *separate* system — `PHASE1_TRACKS`, app.js ~1070) — 5 royalty-free chill tracks,
**already shuffled + looped**: `delosound-background.mp3`, `mondamusic-background.mp3`, `pumpupthemind-on.mp3`,
`alex-morgan-downtempo-chill-electronic.mp3`, `tokyo-music-walker-way-home.mp3`. **⚠️ NOT git-tracked** (§6).

**Code sites that load/play a local song file:** `cues.js` `song.audioFile` (source); `Music.setSrc` (cook
mount ~6951, BYO loader ~5657, eggs demo ~2760); `Music.initGraph`/`VoicePlayer.unlock` (~6506/6592/6873/6900);
`Music.fadeIn`/`play`/`seek`/`rate`/`kick` (phase-2 start ~7405, resume ~7209, gate seek ~7224/7269, recover
~2430/2436/7145); `musicStartAt` crossing (`filePos` ~7042-7045); `Ambient.playShuffled(PHASE1_TRACKS)`
(~6557/6572/6613, fadeOut ~6595/6877); the players (`Music` = `music-backend.js`; `Ambient` = app.js ~1080).

---

## §2 — Local vs AM pipeline (the comparison IS the strategy)

| Concern | LOCAL today | APPLE MUSIC today |
|---|---|---|
| Player | `music-backend.js` `<audio>` + muffle graph; `Ambient` = 2nd bare `<audio>` | native `ApplicationMusicPlayer` |
| Pool / shuffle | **Ambient** shuffles+loops a pool (phase 1); **Music** plays **one** file (phase 2) | one queue (N ids), shuffle, repeat=all |
| Continuity 1→2 | **two players hand off** (Ambient fadeOut → Music fadeIn) | **one queue spans both phases**, no restart |
| Cook-clock | `songPos` drives cues; file offset by `musicStartAt` | `songPos` drives cues; AM ambient |
| Pause/resume | `Music.pause/play`; `_wantPlay` | single `resumeAudio(reason)` + `audioEpoch` |
| Skip/back | none | `MusicPanel` ⏭/⏮ → native, AM-only |
| Panel | none for local | `MusicPanel` (module-scope, ctx-bound) |
| Locks | #4, #5, #10 fence | #1/2/3/9/10/12 |

**Recommendation — extend the LOCAL pipeline with pool+shuffle+continuity; do NOT re-home local onto the AM
state machine.** `Ambient.playShuffled()` already *is* a shuffled looping pool; the new cook soundtrack is
"Ambient, but it also spans phase 2." Faking `AppleMusic_` would inherit locks whose invariants
(`localStarts==0`, `duckReleases`) are meaningless for a local source. The `MusicPanel` is already
source-agnostic (Stage 2b) — a `localPoolCtx` reuses lock #12 without faking AM.

**Net:** one **`Soundtrack` pool player** (generalise `Ambient`: shuffle a pool, loop, skip-missing, **span
phase 1→2 without a handoff**), plus a `MusicPanel` `localPoolCtx`. The per-recipe `Music.setSrc(audioFile)` +
`musicStartAt` crossing goes **dormant** (kept in `music-backend.js` for future sync-capable tracks, §3).

---

## §3 — Beat-sync wiring (KEEP, DORMANT)

**Where "sync" lives:** `cues[].at` (the real timeline; cues never read audio position — RATIFIED); `bpm`
(display + dormant beat grid); `musicStartAt`/`songStartOffset`/`phase2Blurb` (chicken only — where the file
fades in, not when cues fire); `spotifyQuery`/`youtubeId` (track pointers; `youtubeId` is a copyright hit → wipe).

**"Cues ride the cook clock" — CONFIRMED per recipe:** steak/eggs/pasta (`musicStartAt=0`) — swapping the track
changes nothing about cue timing. Chicken (190) — the *file* is offset but cues still fire on `songPos`;
swapping loses only the artistic intent. Pasta's `at` values were *authored against Bohemian Rhapsody's
structure* — artistic landing, not a timing dependency. **No recipe's cue timing breaks without its song.** The
only loss is artistic moments; every phase-2 cue already carries a song-agnostic `custom` variant (the pool
uses that copy path; §4 lists the 2 leaks where `custom` is missing).

**"Dormant" per site:** `bpm` — keep in data, stop printing "· N BPM" for pool cooks. `musicStartAt`/etc —
keep in chicken data, pool ignores it. `spotifyQuery` — keep; `youtubeId` — set null (keep the field).
`music-backend.js` — keep the module compiled + tested, off the default path for the 4 recipes.

---

## §4 — Branding sweep inventory (the wipe checklist — grep must return zero)

**A. Recipe data / display (`mvp/cues.js`):** `song.title`/`artist`/`bpm`/`youtubeId` for the 4 recipes
(L17/351/536/946; bpm L139/365/555; youtubeId "0LwcvjNJTuM"/"KQetemT1sWc"); header comments (L2/344/522/528);
transition titles ("🎸 Drop it — Bohemian Rhapsody starts now" L590; steak's in **app.js** L6182); spoken
"…cooked to Bohemian Rhapsody" (L654) + its `beginner` leak.

**B. Now-playing header + display (`mvp/app.js`):** cook header L6967; eyebrows L6365/6487; AM picker small
L4448; song-file section/loader L2728/2734/2747; **voice greeting** L7670 (`${EXP.song.title} is rolling`);
**finish card** L8503/8504; feedback key L8518; telemetry `songsPlayed` L7068/8457.

**C. Marketing / onboarding (`mvp/app.js`):** onboarding L3001 ("the **Free Bird steak** cook is on us"); home
card L8554 ("🎸 New · **Free Bird steak**").

**D. Docs + `mvp/audio/README.txt`:** `docs/CLAUDE.md` L7; `docs/PLAN.md` L5/6/74/80/219/230/254;
`docs/COMPETITIVE_ANALYSIS.md` L4/47; `docs/LAUNCH_PLAN.md` L46; `docs/RECIPE_FORMAT.md` L580-581/882-883;
`docs/STEAK_CUES.md`; `docs/ONEPOT_PASTA_CUES*.md` + `ONEPOT_PASTA_AUDIT.md` (incl. the 2 `custom`-missing
leaks); `docs/design/apple-music-pilot.md` L97/209; `mvp/audio/README.txt` L12.

**E. SPOKEN clips naming a song — regenerate (new text → new hash):** `tools/voicegen/voice-lines.json` + cue
`voice` fields — "{song} is rolling" ×8 (Free Bird / Here Comes the Sun / Bohemian Rhapsody / Hotel California,
greeting + non-beginner) + "…cooked to Bohemian Rhapsody" (pasta finish). Genericise the greeting → **one clip
for all recipes**; rewrite the pasta finish song-agnostic; regenerate via Kokoro (`tools/voicegen/gen.mjs`),
delete the 9 orphans, prove 0 orphans.

**F. Test/mock branding:** `mvp/applemusic.js` L32-35 (MOCK_CATALOG names all 4 — genericise); `mvp/app.js`
L33/L46 (`__testCook` seeds "Hotel California"/"Take It Easy" — neutralise). No song names in image alt text.

**Proof of done:** `grep -rniE "Free Bird|Hotel California|Bohemian Rhapsody|Here Comes the Sun|Lynyrd
Skynyrd|Beatles|Eagles|Queen" mvp server tools docs` returns **zero** (excluding this migration doc +
postmortems).

---

## §5 — The badge

`syncBadge()` (L4796) `🎵 Music Sync` / `guidedBadge()` (L4797) `🍳 Guided`, chosen by `noMusic`/`hasSong`
(L3543). Render sites: L4036/4059/4877/6367/3544/9003. **Minimal change:** flip the **4 pool recipes to render
guided** via a derived predicate (`showsSyncBadge(exp)=false`) — one function, every site inherits it — while
`musicSynced`/`isMusicSync`/`song.audioFile` stay in data. **Caution:** `musicExpFor`/`isMusicSyncRecipe`
(L4760/4795) drive **preview availability** + the experience lookup — do NOT clear `isMusicSync` (that would
drop the preview + route to guided-tap mode). Flip only the label.

---

## §6 — Gitignored-audio / deployment reality

**Prod web:** the Node server serves `mvp/` statically (`express.static`, `server/src/index.ts` L194-195);
Caddy reverse-proxies. So `getchoppd.app/audio/*.mp3` is served from the deployed `mvp/audio/`. **Deploy:** no
script in the repo (`server/README.md` points at a missing `DEPLOY.md`); manual rsync of `mvp/`. Whether
ignored audio ships depends on the rsync source (working tree → ships; git checkout → the 5 untracked phase-1
tracks are MISSING → silent phase 1). **iOS:** `webDir:"mvp"`, no `server.url` → `cap sync` bundles
`mvp/audio/` (confirmed `ios/App/App/public/audio/`). New files must be in `mvp/audio/` **before** `cap sync`.

**Recommendation — gitignore is the WRONG home for shippable assets.** The new pool is genuinely
copyright-free (licensed to distribute). **Commit the pool** (whitelist each in `.gitignore` like the 4 song
files were) so checkout-deploy + fresh-clone + `cap sync` are deterministic. Keep genuinely-copyrighted
**source/working** files in the top-level `/audio/` (fully gitignored). Add a **missing-asset assert**
(boot/CI: every manifest entry + `PHASE1_TRACKS.file` resolves) so a missing track fails loud.

---

## §7 — Lock coverage + risk + staged plan

**Protected:** local #4/#5/#10-fence; AM #1/2/3/9/10/12/13 + goldens (the fence proving the migration doesn't
disturb AM). **Unprotected gaps:** (1) `Ambient` pool — no lock; (2) local phase-1→2 continuity (music keeps
playing across the drop) — #10 only asserts re-init runs; (3) `musicStartAt` crossing / the "B CONTRACT"; (4)
header/badge/greeting/finish copy; (5) missing-asset behaviour.

**Ranked most-likely-to-break:** (1) phase-1→2 continuity on the new pool (unlocked; the AM version took four
rounds); (2) the `custom`-copy leaks; (3) silent audio on a clean deploy/clone; (4) voice-clip orphans/404s;
(5) badge over-reach (clearing `isMusicSync`).

**Staged plan (locks first):**
- **Stage 0 — lock the gaps** (no behaviour change): a **local phase-1→2 continuity lock** + a **missing-asset
  assert** (every manifest entry + `PHASE1_TRACKS` file resolves, fail loud).
- **Stage 1 — pool player + files:** generalise `Ambient` → `Soundtrack` (shuffle/loop/skip-missing, one
  player spanning 1→2, no gap at the drop); **manifest** (`mvp/audio/soundtrack/` + `soundtrack-manifest.js`,
  `docs/HOW-TO-ADD-SOUNDTRACK.md`); **`git rm` the 4 copyrighted mp3s** + remove whitelist lines + server-purge
  + iOS-bundle-verify steps; **dedupe** `/audio` vs `mvp/audio`; whitelist+commit the pool; point the 4 recipes
  at the pool; `Music.setSrc`/`musicStartAt` dormant.
- **Stage 2 — panel on local pool:** `MusicPanel.localPoolCtx` (pause/skip/back = next shuffled track); extend
  lock #12 to `source:"local-pool"`.
- **Stage 3 — no-music option:** onboarding third card, settings preference, pre-cook selector; silences
  soundtrack + ambient ONLY (voice/blips/**alarm** still sound); lock: alarm audible with music=none.
- **Stage 4 — branding wipe:** §4 A–F to grep-zero; header reads "Choppd soundtrack"; badge label → Guided;
  voice regen (1 greeting clip, song-agnostic pasta finish, delete 9 orphans, prove parity).
- **Stage 5 — verify + ship:** full suite green (new locks + #1-#13 + goldens); sim screenshots; founder deploy
  checklist (server purge, `cap sync`, verify).

**Caps fence:** AM path, the alarm system, and the noMusic recipes stay byte-identical (their locks prove it);
only the 4 music recipes' *local source* + branding change.
