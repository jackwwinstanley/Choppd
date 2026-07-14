#!/usr/bin/env bash
#
# native-verify.sh — Tier-2 iOS-simulator pre-deploy gate for Choppd.
#
# Run this before EVERY native-facing deploy (like `test:match` is for scan).
# It builds the iOS app, runs it in a simulator, and asserts the things that
# keep breaking on device: bundle freshness, prod API reachability/CORS, and
# the login-screen platform split — then runs Maestro UI flows.
#
# It OBSERVES. It does not modify app code, device signing, or schemes.
#
# Usage:      scripts/native-verify.sh
# Overrides:  SIM_NAME="iPhone 17 Pro"  BOOT_TIMEOUT=45  scripts/native-verify.sh
#
# Exit codes: 0 pass · 10 prereqs · 20 freshness · 30 build · 40 sim lifecycle
#             50 boot-log assertions · 60 screenshot · 70 maestro
#
# See scripts/README.md for the permanent boundary (what a simulator can NEVER
# test) and the TEST-OTP seam that unlocks the post-login flows.

set -o pipefail

# ─────────────────────────── config (env-overridable) ───────────────────────
SIM_NAME="${SIM_NAME:-iPhone 17 Pro}"
BUNDLE_ID="app.getchoppd.mobile"
WORKSPACE="ios/App/App.xcworkspace"
SCHEME="App"
WEBDIR="${WEBDIR:-mvp}"                      # web source of truth (overridable for the break test)
PUBLIC="ios/App/App/public"
PROD_API="${PROD_API:-https://getchoppd.app}"   # prod target (overridable for gate self-tests)
DERIVED="build/sim"
BOOT_TIMEOUT="${BOOT_TIMEOUT:-45}"          # seconds to wait for the [choppd] boot line

# Toolchain — resolved explicitly so this never depends on the caller's shell rc.
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home}"
export PATH="$JAVA_HOME/bin:/opt/homebrew/bin:/Users/$(whoami)/.local/node-current/bin:$PATH"
MAESTRO_BIN="$(command -v maestro 2>/dev/null || echo /opt/homebrew/opt/maestro/bin/maestro)"

# Repo root (script lives in scripts/).
cd "$(dirname "$0")/.." || { echo "cannot cd to repo root"; exit 2; }

# Timestamped artifacts — kept from every run.
TS="$(date +%Y%m%d-%H%M%S)"
ART="build/artifacts/$TS"
mkdir -p "$ART"

# ─────────────────────────── summary-table plumbing ─────────────────────────
STAGES=(); STATUSES=()
PASS="PASS ✅"; FAILED="FAIL ❌"
START_ALL="$(date +%s)"
record() { STAGES+=("$1"); STATUSES+=("$2"); }
say()    { echo; echo "▶ $*"; }

print_summary() {
  local dur=$(( $(date +%s) - START_ALL ))
  echo
  echo "──────────────── native-verify summary · $SIM_NAME ────────────────"
  printf "  %-26s %s\n" "STAGE" "RESULT"
  if [ "${#STAGES[@]}" -gt 0 ]; then
    local i
    for i in $(seq 0 $(( ${#STAGES[@]} - 1 )) ); do
      printf "  %-26s %s\n" "${STAGES[$i]}" "${STATUSES[$i]}"
    done
  fi
  printf "  %-26s %ss\n" "total runtime" "$dur"
  echo "  artifacts: $ART"
  echo "───────────────────────────────────────────────────────────────────"
}

fail() { # $1 stage label · $2 exit code · $3 message
  echo
  echo "‼️  FAIL [$1]: $3"
  record "$1" "$FAILED"
  print_summary
  exit "$2"
}

# ══════════════════════════════ 0 · PREREQS ═════════════════════════════════
say "[0] PREREQS"
command -v xcodebuild >/dev/null 2>&1 || fail "0 prereqs" 10 "xcodebuild not found — install Xcode + command line tools"
xcrun simctl help    >/dev/null 2>&1 || fail "0 prereqs" 10 "xcrun simctl not available"
"$JAVA_HOME/bin/java" -version >/dev/null 2>&1 || fail "0 prereqs" 10 "Java not found at JAVA_HOME=$JAVA_HOME — run: brew install openjdk"
[ -x "$MAESTRO_BIN" ] || fail "0 prereqs" 10 "maestro not found — run: brew install mobile-dev-inc/tap/maestro"
[ -f "capacitor.config.json" ] || fail "0 prereqs" 10 "capacitor.config.json not found — run from a Capacitor project"

# Resolve the simulator UDID. "$SIM_NAME (" cannot match e.g. "iPhone 17 Pro Max (".
SIM_UDID="$(xcrun simctl list devices available | grep -F "$SIM_NAME (" | head -1 \
  | grep -oE '[0-9A-Fa-f]{8}-([0-9A-Fa-f]{4}-){3}[0-9A-Fa-f]{12}')"
[ -n "$SIM_UDID" ] || fail "0 prereqs" 10 "simulator '$SIM_NAME' not found — see: xcrun simctl list devices available"
echo "  xcodebuild $(xcodebuild -version | head -1 | awk '{print $2}') · maestro $("$MAESTRO_BIN" --version 2>/dev/null | tail -1) · java $("$JAVA_HOME/bin/java" -version 2>&1 | head -1 | grep -oE '"[0-9._]+"' | tr -d '\"')"
echo "  sim: $SIM_NAME → $SIM_UDID"
record "0 prereqs" "$PASS"

# ═══════════════════════ a · FRESHNESS (stale-bundle gate) ══════════════════
# cap sync, then assert public/ is byte-identical to mvp/ — the stale-bundle bug
# becomes structurally impossible to ship past this line.
say "[a] FRESHNESS — cap sync + byte-identical public/"
npx cap sync ios > "$ART/cap-sync.log" 2>&1 || fail "a freshness" 20 "cap sync ios failed — see $ART/cap-sync.log"

# Capacitor injects exactly these two files into public/; they are the ONLY
# permitted extras. Any other diff (differing file, or a file missing from
# public/) means the shipped bundle is not the current web app → stale.
DIFF="$(diff -rq -x '.DS_Store' "$WEBDIR" "$PUBLIC" \
        | grep -vE "^Only in $PUBLIC: (cordova\.js|cordova_plugins\.js)$")"
if [ -n "$DIFF" ]; then
  echo "$DIFF" | tee "$ART/freshness-diff.txt"
  fail "a freshness" 20 "public/ is NOT byte-identical to mvp/ (stale bundle). Diff above."
fi

# Belt-and-suspenders: the cache-buster version markers must match exactly.
MVP_VERS="$(grep -oE '(src|href)="[^\"]+\?v=[0-9]+"' "$WEBDIR/index.html")"
PUB_VERS="$(grep -oE '(src|href)="[^\"]+\?v=[0-9]+"' "$PUBLIC/index.html")"
if [ "$MVP_VERS" != "$PUB_VERS" ]; then
  { echo "mvp/index.html:"; echo "$MVP_VERS"; echo "public/index.html:"; echo "$PUB_VERS"; } | tee "$ART/version-markers.txt"
  fail "a freshness" 20 "version markers in public/index.html != mvp/index.html"
fi
echo "  public/ matches mvp/ (only cordova.js + cordova_plugins.js injected) · version markers match"
record "a freshness" "$PASS"

# ══════════════════════════ b · BUILD for simulator ═════════════════════════
# No signing — simulator build. Own derivedDataPath; the device build path is
# never touched.
say "[b] BUILD for simulator (no signing · derivedDataPath=$DERIVED)"
xcodebuild \
  -workspace "$WORKSPACE" -scheme "$SCHEME" \
  -destination "platform=iOS Simulator,name=$SIM_NAME" \
  -derivedDataPath "$DERIVED" -configuration Debug \
  CODE_SIGNING_ALLOWED=NO build > "$ART/xcodebuild.log" 2>&1
BRC=$?
if [ $BRC -ne 0 ]; then tail -25 "$ART/xcodebuild.log"; fail "b build" 30 "xcodebuild failed (rc=$BRC) — see $ART/xcodebuild.log"; fi
APP_PATH="$DERIVED/Build/Products/Debug-iphonesimulator/App.app"
[ -d "$APP_PATH" ] || fail "b build" 30 "built .app not found at $APP_PATH"
echo "  built: $APP_PATH"
record "b build" "$PASS"

# ═════════════════════ c · SIM LIFECYCLE (boot/install/grant) ═══════════════
say "[c] SIM LIFECYCLE — boot · install · pre-grant mic · (launch in stage d)"
STATE="$(xcrun simctl list devices | grep "$SIM_UDID" | grep -oE '\((Booted|Shutdown)\)' | tr -d '()')"
if [ "$STATE" = "Booted" ]; then echo "  reusing booted simulator"; else
  echo "  booting $SIM_NAME ..."; xcrun simctl boot "$SIM_UDID" || fail "c sim" 40 "simctl boot failed"
fi
xcrun simctl bootstatus "$SIM_UDID" >/dev/null 2>&1
open -a Simulator 2>/dev/null || true   # show the UI (best-effort; headless is fine too)
xcrun simctl install "$SIM_UDID" "$APP_PATH" || fail "c sim" 40 "simctl install failed"
# Pre-grant mic so a permission modal never blocks a flow (voice uses it later on device).
if xcrun simctl privacy "$SIM_UDID" grant microphone "$BUNDLE_ID" 2>/dev/null; then
  echo "  mic permission pre-granted"
else
  echo "  (mic pre-grant skipped — non-fatal)"
fi
record "c sim" "$PASS"

# ═══════════════ d · PROD REACHABILITY + CORS (hits REAL prod) ══════════════
# The CORS/reachability half of this week's bugs, as a permanent check. The app's
# own [choppd] boot line runs in the WKWebView WebContent process and is NOT
# surfaced by `simctl` (verified: Capacitor doesn't forward JS console to stdout,
# and WKWebView console isn't in the unified log — so scraping it can't gate CI).
# Instead we assert the facts it encodes through reliable, real-network channels
# from the SAME `capacitor://localhost` Origin the WKWebView (sim AND device) sends:
#   • prod reachable + devAuth=false        → the app would talk to a live PROD backend
#   • CORS allows the native origin on a WRITE → native sign-in isn't CORS-blocked
# (The app-side "did it actually get online / is it the right bundle" check is
#  stage f: an offline / wrong-API-base / CORS-blocked app renders "Can't reach the
#  kitchen" and the login flow fails. Stale bundles are also caught by stage a.)
say "[d] PROD REACHABILITY + CORS — real network (capacitor:// origin)"
ORIGIN="capacitor://localhost"

# d1 — live config from the native origin: prod reachable AND devAuth=false.
CFG="$(curl -fsS -m 15 -H "Origin: $ORIGIN" "$PROD_API/api/auth/config" 2>"$ART/curl-config.err")"
echo "  config($ORIGIN) → ${CFG:-<unreachable>}"
[ -n "$CFG" ] || fail "d prod-reach" 50 "$PROD_API/api/auth/config unreachable from $ORIGIN — native would be OFFLINE (CORS/outage): $(cat "$ART/curl-config.err" 2>/dev/null)"
echo "$CFG" | grep -q '"devAuth":false' || fail "d prod-reach" 50 "prod devAuth != false — app would run against a DEV backend. config=$CFG"

# d2 — CORS preflight for the auth WRITE (POST) must allow the native origin. This
# is the exact regression that silently broke native sign-in this week: a server
# whose CORS allowlist drops capacitor://localhost blocks the OTP request.
ACAO="$(curl -fsS -m 15 -o /dev/null -D - -X OPTIONS \
  -H "Origin: $ORIGIN" -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  "$PROD_API/api/auth/request" 2>/dev/null | tr -d '\r' | grep -i '^access-control-allow-origin:')"
echo "  preflight ACAO → ${ACAO:-<none>}"
echo "$ACAO" | grep -qi "$ORIGIN" || fail "d prod-reach" 50 "prod did NOT return access-control-allow-origin for $ORIGIN on the auth POST preflight — native sign-in is CORS-blocked. got: '${ACAO:-<none>}'"
echo "  ✔ prod reachable · devAuth=false · CORS allows $ORIGIN on the auth POST"
record "d prod-reach" "$PASS"

# ═══════════════════════════ e · SCREENSHOT (login) ═════════════════════════
say "[e] SCREENSHOT — login screen"
sleep 2  # let first paint settle
if xcrun simctl io "$SIM_UDID" screenshot "$ART/login.png" >/dev/null 2>&1; then
  echo "  saved: $ART/login.png"
else
  echo "  (screenshot failed — non-fatal)"
fi
record "e screenshot" "$PASS"

# ═══════════════════════════ f · MAESTRO UI FLOWS ══════════════════════════
# Pre-auth flows only by default. Flows tagged `seam` need a logged-in session
# (home is behind OTP) and run only once the TEST-OTP server seam is approved:
#   maestro test --include-tags=seam -e TEST_OTP_EMAIL=... -e TEST_OTP_CODE=... .maestro/flows
say "[f] MAESTRO UI FLOWS — .maestro/flows (pre-auth; browse gated behind test-OTP seam)"
# login-native uses a unique per-run email (generated inside the flow) to dodge
# prod's 60s per-email OTP resend throttle — deterministic on back-to-back runs.
xcrun simctl terminate "$SIM_UDID" "$BUNDLE_ID" >/dev/null 2>&1
"$MAESTRO_BIN" --device "$SIM_UDID" test --exclude-tags=seam \
  --format junit --output "$ART/maestro-junit.xml" .maestro/flows 2>&1 | tee "$ART/maestro.log"
MRC=${PIPESTATUS[0]}
[ $MRC -eq 0 ] || fail "f maestro" 70 "maestro flows failed (rc=$MRC) — see $ART/maestro.log"
record "f maestro" "$PASS"

# ═══════════════════════════════ SUCCESS ════════════════════════════════════
print_summary
echo
echo "✅ NATIVE-VERIFY GREEN — safe to ship native-facing changes."
exit 0
