/* Gate + independence tests for the REVIEWER SIGN-IN SEAM. Run: npm run test:reviewer
 *
 * The seam lets ONE allow-listed email sign in on PRODUCTION with a fixed code so an
 * App Review reviewer can complete login. Unlike the TEST-OTP seam it is ALIVE in prod
 * by design, so the properties that matter here are different:
 *   1. default OFF — one env var (REVIEWER_LOGIN_ENABLED) is the kill switch;
 *   2. exactly ONE email — any other address is not the seam;
 *   3. no founder account — pointing it at DEV_EMAIL (which drives isDevUser() → hidden
 *      recipes + Developer panel) fails CLOSED, so the reviewer can't be elevated;
 *   4. INDEPENDENCE — this seam and testOtpEnabled() share no env var and no code, so
 *      flipping either one can never flip the other.
 * All gates are pure fns of env, so the matrix is provable without a DB. */
import { reviewerLoginEnabled, testOtpEnabled } from "./auth.js";

let pass = 0, fail = 0;
function is(name: string, got: boolean, want: boolean) {
  if (got === want) { pass++; return; }
  fail++; console.error(`✗ ${name}\n   got  ${got}\n   want ${want}`);
}
const env = (o: Record<string, string | undefined>) => o as unknown as NodeJS.ProcessEnv;
// Deliberately UNUSABLE placeholders — the real email/code live only in server/.env on
// the box (S2: never hardcoded, never committed). `.invalid` is the reserved never-resolving
// TLD (RFC 2606) and the code is not a 6-digit string, so neither can be mistaken for,
// or used as, the production credential.
const FULL = {
  REVIEWER_LOGIN_ENABLED: "true",
  REVIEWER_LOGIN_EMAIL: "reviewer-fixture@example.invalid",
  REVIEWER_LOGIN_CODE: "PLACEHOLDER-NOT-A-REAL-CODE",
};

// ── ENABLED: works in production — that is the whole point of this seam ────────
is("PROD + fully configured → ENABLED", reviewerLoginEnabled(env({ NODE_ENV: "production", ...FULL })), true);
is("dev + fully configured → ENABLED", reviewerLoginEnabled(env({ NODE_ENV: "development", ...FULL })), true);

// ── KILL SWITCH (S3): one var disables it, no app-code deploy ─────────────────
is("switch off → DEAD", reviewerLoginEnabled(env({ NODE_ENV: "production", ...FULL, REVIEWER_LOGIN_ENABLED: "false" })), false);
is("switch unset (DEFAULT) → DEAD", reviewerLoginEnabled(env({ NODE_ENV: "production", REVIEWER_LOGIN_EMAIL: FULL.REVIEWER_LOGIN_EMAIL, REVIEWER_LOGIN_CODE: FULL.REVIEWER_LOGIN_CODE })), false);
is("switch not exactly 'true' → DEAD", reviewerLoginEnabled(env({ ...FULL, REVIEWER_LOGIN_ENABLED: "1" })), false);
is("empty env → DEAD", reviewerLoginEnabled(env({})), false);

// ── FAIL-CLOSED on any missing/weak ingredient ────────────────────────────────
is("no email → dead", reviewerLoginEnabled(env({ REVIEWER_LOGIN_ENABLED: "true", REVIEWER_LOGIN_CODE: FULL.REVIEWER_LOGIN_CODE })), false);
is("whitespace-only email → dead", reviewerLoginEnabled(env({ ...FULL, REVIEWER_LOGIN_EMAIL: "   " })), false);
is("no code → dead", reviewerLoginEnabled(env({ REVIEWER_LOGIN_ENABLED: "true", REVIEWER_LOGIN_EMAIL: FULL.REVIEWER_LOGIN_EMAIL })), false);
is("short code (<6) → dead", reviewerLoginEnabled(env({ ...FULL, REVIEWER_LOGIN_CODE: "1234" })), false);
is("harness fixture 424242 → dead", reviewerLoginEnabled(env({ ...FULL, REVIEWER_LOGIN_CODE: "424242" })), false);

// ── NO ELEVATED PRIVILEGES (S4): the founder address fails CLOSED ─────────────
is("REVIEWER = founder email → DEAD", reviewerLoginEnabled(env({ ...FULL, REVIEWER_LOGIN_EMAIL: "jackwwinstanley@gmail.com" })), false);
is("REVIEWER = founder email, any case → DEAD", reviewerLoginEnabled(env({ ...FULL, REVIEWER_LOGIN_EMAIL: "JackWWinstanley@Gmail.com" })), false);

// ── INDEPENDENCE (A2): the two seams cannot cross-trigger ────────────────────
const TEST_OTP_FULL = { ALLOW_TEST_OTP: "true", TEST_OTP_EMAIL: "native-verify@example.invalid", TEST_OTP_CODE: "424242" };
is("reviewer ON in prod does NOT enable test-otp", testOtpEnabled(env({ NODE_ENV: "production", ...FULL })), false);
is("reviewer ON + hostile test-otp flags in prod → test-otp STILL dead", testOtpEnabled(env({ NODE_ENV: "production", ...FULL, ...TEST_OTP_FULL })), false);
is("test-otp ON does NOT enable reviewer", reviewerLoginEnabled(env({ NODE_ENV: "development", ...TEST_OTP_FULL })), false);
is("test-otp env alone (no REVIEWER_*) → reviewer dead", reviewerLoginEnabled(env({ ...TEST_OTP_FULL })), false);
is("reviewer env alone (no TEST_OTP_*) → test-otp dead", testOtpEnabled(env({ NODE_ENV: "development", ...FULL })), false);

console.log(`\nREVIEWER-LOGIN: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
