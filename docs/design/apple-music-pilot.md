# Apple Music pilot — SPEC (no code yet)

**Status:** spec-only. Build gated on: (a) the ChoppdAudio local-path ears pass, (b) founder
prerequisites below.

> **✅ RATIFIED (founder, 2026-07-15):** the §1 synchronization flag is resolved — **AM is ambient on
> the cook clock (elapsed seconds); song-specific beat-sync authoring stays on the local/licensed
> spine.** This is now a settled design constraint, not an open question. §4/§5 below reflect it.

Architecture recap (founder decisions): **local/hosted tracks = the universal floor** (every user,
ships to TestFlight, the spine — untouched). **Apple Music = free-tier for anyone with an active AM
subscription**, runtime-detected at cook start: subscribed + authorized → AM is the source and the
local file does **not** load (replacement, never overlay); otherwise → local exactly as today. **No
Choppd paywall on AM access, ever** (§1).

---

## 1. MusicKit / Apple Music API terms — the clauses that bind us

> **Sourcing note:** the binding agreement is the **"Apple Music API"** addendum you accept in your
> developer account (account-gated + versioned) plus the Apple Developer Program License Agreement and
> App Review Guidelines §5.2.3. The quotes below are the wording Apple publishes; **treat any not
> pulled from the live agreement in your account as "verify verbatim before shipping."** I did not
> invent legal text.

### 🚩 THE DECISIVE FLAG — synchronization (touches our cue-ladder-on-song-time core)
Apple's MusicKit guidance states (quoted):

> *"Using the MusicKit APIs is not a replacement for securing the licenses you might need for a deeper
> or more complex music integration. For example, if you want your app to **play a specific song at a
> particular moment**, or to create audio or video files that can be shared to social media, you'll
> need to contact rights-holders directly to get their permission (e.g. **synchronization or
> adaptation rights**) and assets."*

**This is Choppd's exact pattern.** Our cook is a **cue ladder synced to specific moments in a
specific song** (songPos as the master clock; cues fire at authored song-time positions; the eggs
pilot literally times steps to "Here Comes the Sun"). "Play a specific song at a particular moment"
is arguably **synchronization** — which MusicKit does **not** license. Two readings, founder's call:

- **Conservative (likely correct):** authoring a recipe to a *named song's structure* (cue at 0:25,
  the round-two cue "at:190", etc.) is a sync use → needs direct rights-holder sync licenses, which
  MusicKit doesn't grant. Under this reading, the **song-agnostic** path is safe: the cook clock runs
  on *elapsed time*, and the user's AM plays *whatever* underneath (or a Choppd-curated playlist) —
  we do **not** author cues to a specific track's timeline.
- **Permissive:** "play a specific song at a particular moment" means *triggering a track at an app
  event* (not authored beat-matching), and our step timing is generic. Riskier; don't assume it.

**Recommendation:** the AM pilot ships **decoupled from song-specific cue timing** — cues run on the
cook clock (elapsed seconds), AM is ambient/energy, no beat-matched authoring against an AM catalog
track. Keep song-synced authoring on the **local/licensed** tracks only (where we control the file).
This is the single biggest design constraint and it should be resolved *before* any code.

### No charging (hard rule — cited)
> *"You agree not to require payment for or indirectly monetize access to the Apple Music service."*

So: **no Choppd paywall, tier, or feature-gate may sit in front of AM playback.** AM is offered free
to subscribers; a non-subscriber simply gets the local track. Choppd Premium may never bundle,
upsell, or condition AM access. (App Review §5.2.3 reinforces: don't monetize others' content without
authorization.)

### Attribution / artwork (cited, verify verbatim)
- Display **"via Apple Music"**-style attribution where AM content is surfaced; show the now-playing
  track (title/artist) when AM is the source.
- Cover art + metadata may be used **only in connection with playback/playlists**, **not** in
  marketing/advertising without rights-holder authorization. → Our finish-card / share-card must
  **not** embed AM artwork; keep share artifacts on Choppd's own assets.

### Background playback (verify verbatim in your entitlement docs)
AM playback in the background is supported with the **Audio background mode** + an active session.
This is exactly the ChoppdAudio session we already own; the cook runs with the screen locked. Confirm
the current agreement doesn't add conditions (e.g. now-playing controls) for backgrounded AM.

---

## 2. The source-selection seam (design)

One decision point at **cook start**, then the SAME engine seam the YT pilot proved (`songPos`
slaving, gates, transport, tail) — source-swapped underneath.

```
cook start
  → MusicKit.authorizationStatus  (request once, at explicit enable — never during browsing)
  → check subscription capability  (MusicSubscription.current: canPlayCatalogContent?)
      subscribed + authorized + track available in territory
        → SOURCE = Apple Music (ApplicationMusicPlayer). Local file NOT loaded.
      else (unauth / no sub / expired / offline / track unavailable / any error)
        → SOURCE = local track, exactly as today.  ← silent-seamless, never a user-facing error
```

**Player choice: `ApplicationMusicPlayer` (MusicKit), not `MediaPlayer`/`MPMusicPlayerController`.** Why:
- App-scoped queue (doesn't hijack the user's system Music queue); `.systemMusicPlayer` would.
- Exposes `playbackTime` (current position) → **the master clock**, the direct analog of the YT
  bridge's `Yt.time()` — `songPos` slaves to it exactly as the pilot proved. `playbackStatus` gives
  playing/paused/interrupted for the same slaving-off-during-buffer discipline.
- Background + lock-screen playback with the Audio entitlement; MusicKit is the modern, supported path
  (MediaPlayer is legacy and its now-playing behavior is coarser).

**The seam = the existing `Music`/`Yt` abstraction.** Add an `AppleMusic` transport with the same
surface the bridged YT proved: `play/pause/seek/time/setVol/setRate/onReady/onPlaying/onError`. The
cook engine (`songPos = Music.pos()`, gates, transport-lands-paused, tail handoff) is **unchanged** —
it already runs source-agnostic on `Music`. `pos()` returns `ApplicationMusicPlayer.playbackTime`.

**Fallback = silent-seamless (non-negotiable).** Any AM failure (unauthorized, sub expired mid-cook,
network drop, song unavailable in territory, playback error) → fall back to the local track and keep
cooking. **Never** an error the user must resolve to cook. Mid-cook AM failure → seamless switch to
local at the current `songPos`; the ChoppdAudio duck + gates carry over unchanged (source-agnostic).

**Ducking:** ChoppdAudio (Build 1) already ducks whatever's playing via `.duckOthers` — AM is a
separate audio session, so `.duckOthers` ducks it under the voice with **no** change to the duck
mechanism. (Confirm the level on device — §3 row.)

---

## 3. DuckTest — Apple Music rows (spec now, build with the pilot)

Extend the harness with an AM source (a subscribed dev account required):

| # | Source · Mode · Options | What it answers |
|---|---|---|
| AM-1 | **Apple Music · .playback · duckOthers** | Does `.duckOthers` duck AM catalog audio under the native voice? (expected yes — AM is a separate session) — and to what level, by ear. |
| AM-2 | Apple Music · **.playAndRecord** · duckOthers | The voice-v2 coexistence question with AM: does the mic-record category duck/kill AM? orange mic? (feeds native-voice-v2 §4 with AM as the music). |

Add an "Apple Music" option to the harness's source selector (start an `ApplicationMusicPlayer` queue
from a catalog ID), reusing the existing Fire-runway + RMS/ear judgment.

---

## 4. Founder prerequisites (your hands — like the signing switch)

1. **MusicKit identifier + private key**: Developer portal → Certificates, Identifiers & Profiles →
   **Media IDs** (MusicKit) → create/register, and generate the **MusicKit private key (.p8)** +
   note the Key ID + Team ID. (Needed for developer-token signing / Apple Music API auth.)
2. **Accept the Apple Music API agreement** in the account (Agreements, Tax, and Banking / the
   Apple Music API addendum) — this is the account-gated legal doc §1 quotes; read the live sync +
   no-charge clauses there and confirm the §1 recommendation.
3. **An active Apple Music subscription on the dev test account** (and ideally a second, non-subscribed
   account to prove the local fallback path).
4. **Entitlement + Info.plist** (I'll add these in the build): the **MusicKit** capability on the App
   ID, and **`NSAppleMusicUsageDescription`** (string, `DRAFT-PENDING-VOICE-REVIEW` — e.g. *"Choppd
   uses Apple Music to play your music while you cook."*). Background: Audio background mode (already
   present for the cook).

---

## 5. Song strategy (spec note)

- **Catalog IDs replace YT videoIds.** Per recipe, the song reference becomes an **Apple Music catalog
  ID** (or an ISRC → catalog lookup) instead of a `youtubeId`. Same schema slot, new value type.
- The eggs pilot song carries over **conceptually** — "Here Comes the Sun" exists in the AM catalog —
  **but** per the §1 sync flag, do **not** author the cue ladder to its timeline on the AM path; song
  choice is ambient there. Beat-matched authoring stays on the local/licensed spine.
- **Per-territory availability is the new "embeddability check."** A catalog ID available in the US may
  be unavailable in another storefront; the source-selection seam must treat "unavailable in the
  user's storefront" as a normal fallback-to-local case (like the YT 150/153 embeddability failures).
  Resolve availability against the user's storefront at cook start.

---

## Order / dependencies
Build 1 ears pass → **this spec review (you gate the pilot build)** → the §1 synchronization decision
(the gating one) → prerequisites in hand → then code the AM transport + selection seam + DuckTest AM
rows. voice-v2 proceeds per its own §8 (recorded §4 values stand; the AM DuckTest row may refine the
coexistence picture later). **TestFlight is not blocked on any of this** — the local spine is the
launch build.

Sources: [MusicKit](https://developer.apple.com/musickit/) ·
[Apple Music API docs](https://developer.apple.com/documentation/applemusicapi/) ·
[Apple Developer Program License Agreement](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/) ·
App Review Guidelines §5.2.3.
