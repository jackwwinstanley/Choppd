# native-verify — Tier-2 iOS simulator pre-deploy gate

One command that builds the Choppd iOS app, runs it in a simulator, and asserts
the things that keep breaking on device. **Run it before every native-facing
deploy** — it is to native what `test:match` is to scan.

```bash
scripts/native-verify.sh
```

Green exit (0) = safe to ship native-facing changes. Any non-zero exit is a
hard gate; the failing stage prints loudly and a summary table lists every
stage. Artifacts (build log, captured boot line, login screenshot, Maestro
JUnit) are kept per-run under `build/artifacts/<timestamp>/`.

The harness **observes only** — it never edits app code, device signing, or
schemes. The simulator build uses its own `build/sim` derivedDataPath.

## What it checks (stages + exit codes)

| Stage | Exit | What it asserts |
|---|---|---|
| 0 · prereqs | 10 | xcodebuild, simctl, Java, Maestro, capacitor.config.json, target sim present |
| a · freshness | 20 | `cap sync ios`, then `public/` is **byte-identical** to `mvp/` (only `cordova.js` + `cordova_plugins.js` may be injected) and the `?v=` markers match — the stale-bundle bug becomes impossible to ship past |
| b · build | 30 | `xcodebuild` for the simulator (no signing), `App.app` produced |
| c · sim lifecycle | 40 | boot (reuse if booted) · install · pre-grant microphone |
| d · prod-reach | 50 | **Hits real prod over the network** from the `capacitor://localhost` origin: `/api/auth/config` reachable + `devAuth:false`, and a CORS **preflight** proves the native origin is allowed on the auth `POST` (the sign-in write) |
| e · screenshot | 60 | `login.png` of the login screen into the artifacts dir |
| f · maestro | 70 | `.maestro/flows` (pre-auth), excluding `seam`-tagged flows |

### Why stage (d) is the important one — and how it actually reads prod
This is the stage that catches the two bugs from this week. It asserts the same
four facts the app's `[choppd]` boot line encodes — **native · api=prod · online
· devAuth=false** — over the real network:

- **`api=http://127.0.0.1:8788` (stale "dev shell" bundle)** → caught by stage (a)
  freshness (structural) **and** at runtime by stage (f): a bundle pointing at a
  dead `127.0.0.1` can't get online, renders "Can't reach the kitchen", and the
  `login-native` flow fails loudly (verified — see the break test below).
- **`online=false` / CORS regression that blocks native** → caught in (d) by the
  `capacitor://localhost`-origin config probe **and** the auth-`POST` CORS
  preflight, **and** by stage (f) (offline app can't reach the login screen).
- **`devAuth=true` (dev backend)** → caught by the `/api/auth/config` assertion in (d).

> **Why not just scrape the `[choppd]` console line?** Because it isn't
> capturable from a simulator. `console.log` runs in the WKWebView **WebContent**
> process; Capacitor does not forward it to the app's stdout, and WKWebView
> console is not written to the unified log (verified empirically — `simctl launch
> --console` / `log stream` never see it). Scraping the app's *network* log is
> also unreliable: `log stream` echoes its own predicate (a false match) and
> connection reuse means a healthy launch often emits no fresh DNS line. So stage
> (d) verifies prod reachability + CORS with deterministic `curl` from the native
> origin, and the app-side "is it really online / the right bundle" question is
> answered by stage (f). (The boot line is still useful on-device via Safari Web
> Inspector — it just can't gate CI.)
>
> The simulator WKWebView sends the **same `capacitor://localhost` Origin as a
> real device**, so the CORS behavior this stage exercises is the real one.

## Prerequisites (one-time, agent-installable — no sudo)

```bash
brew install openjdk                          # Maestro needs a JRE 11+
brew install mobile-dev-inc/tap/maestro        # UI-flow runner
```

Xcode + command line tools must already be installed (`xcodebuild -version`).
The script sets `JAVA_HOME` to the brew openjdk and finds Maestro at
`/opt/homebrew/opt/maestro/bin/maestro` if it isn't on `PATH`. Override the
target device with `SIM_NAME="iPhone 17 Pro" scripts/native-verify.sh`.

## Maestro flows (`.maestro/flows/`)

- **`login-native.yaml`** (runs by default, pre-auth, **deterministic — makes no
  auth write**): welcome → assert `What's your email?` (reaching this screen
  proves the app went **online** on native; offline shows "Can't reach the
  kitchen") → assert **no Google button** (the platform split, in a real
  WKWebView) → tap the email field, type a test address → assert the `Send code`
  CTA renders. It **stops before actually sending** a code: prod's OTP endpoint
  has a 60s per-email resend throttle, so tapping Send code on every gate run is
  non-deterministic. The full Send-code → OTP → home path lives in the seam flow.
- **`browse-and-open-recipe.yaml`** (`tags: [seam]`, excluded by default):
  logs in and opens a flagship recipe. It needs a completed login, which needs
  the TEST-OTP seam below.

## TEST-OTP seam — decision (recommended; NOT built)

Completing login or a cook in the simulator is impossible pre-auth: the home
screen is behind OTP, and no real code arrives in CI. Two options:

1. **Server-side TEST-OTP allowlist (recommended).** A tightly env-gated path
   where **one** specific test email accepts a **fixed** code. Proposed design,
   for your approval before it exists:
   - New env on the API: `TEST_OTP_EMAIL` (single address) + `TEST_OTP_CODE`.
   - In `verifyCode()`, accept the fixed code **only** when
     `email === TEST_OTP_EMAIL` **and** both envs are set **and**
     `NODE_ENV !== 'production'` (or a separate `ALLOW_TEST_OTP=true` that is
     asserted-off in the prod deploy check). Never a wildcard; never a default.
   - The sim then runs the `seam`-tagged flows with
     `-e TEST_OTP_EMAIL=… -e TEST_OTP_CODE=…`.
   - **This does not exist yet — it needs your go-ahead before I add it.**
2. **Pre-auth only (current default).** `login-native.yaml` ships and runs now;
   post-login flows stay authored-but-gated until (1) is approved.

Either way the pre-auth gate ships today.

## The permanent boundary — what a simulator can NEVER verify

These are **device-only**. Never "fix" a simulator failure in this list — the
simulator lacks the underlying services, and a green result here says nothing
about them. They remain the founder's on-device check:

- **Speech recognition** — the simulator has no speech service. Its signature
  failure is **error 1101**; that is the simulator telling you it can't, not a
  bug to debug. Voice ("say 'next'") must be verified on a real device.
- **Real microphone capture** — the sim has no mic input.
- **AVAudioSession coexistence** — music ducking under the voice, category/
  interruption behavior: device-only.
- **OS permission prompt sequencing** — the real mic/speech permission dialogs
  and their order (the harness pre-grants mic so flows aren't blocked).
- **Lock-screen / background audio** — playback while backgrounded or locked.

## Notes

- Runs locally on your Mac; no CI service. Keep it dependency-light.
- `build/` and the artifacts dir are gitignored — nothing generated is committed.
- Committed by design: `scripts/native-verify.sh`, `.maestro/flows/*`, this README.

**Run `scripts/native-verify.sh` before any native-facing deploy.**
