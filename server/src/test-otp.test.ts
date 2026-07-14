/* Fail-closed lockout tests for the TEST-OTP seam. Run: npm run test:otp
 *
 * The seam lets ONE fixed email sign in with a fixed code so the native-verify
 * iOS-simulator harness can complete login. THE property that matters here: it is
 * structurally DEAD in production, even with every hostile flag set — the same
 * lockout shape as DEV_AUTH. `testOtpEnabled` is a pure fn of env so we can prove
 * the matrix without touching the DB. */
import { testOtpEnabled, verifyCode } from "./auth.js";

let pass = 0, fail = 0;
function is(name: string, got: boolean, want: boolean) {
  if (got === want) { pass++; return; }
  fail++; console.error(`✗ ${name}\n   got  ${got}\n   want ${want}`);
}
const env = (o: Record<string, string | undefined>) => o as unknown as NodeJS.ProcessEnv;
const FULL = { ALLOW_TEST_OTP: "true", TEST_OTP_EMAIL: "native-verify@getchoppd.app", TEST_OTP_CODE: "424242" };

// ── ENABLED: only the exact non-prod + opt-in + fully-configured case ──────────
is("dev + opt-in + email + code → ENABLED", testOtpEnabled(env({ NODE_ENV: "development", ...FULL })), true);
is("test NODE_ENV also enabled", testOtpEnabled(env({ NODE_ENV: "test", ...FULL })), true);
is("undefined NODE_ENV (not prod) → enabled", testOtpEnabled(env({ ...FULL })), true);

// ── FAIL-CLOSED: production kills it regardless of hostile flags (THE test) ─────
is("PROD + all hostile flags → DEAD", testOtpEnabled(env({ NODE_ENV: "production", ...FULL })), false);
is("PROD + opt-in only → DEAD", testOtpEnabled(env({ NODE_ENV: "production", ALLOW_TEST_OTP: "true" })), false);

// ── FAIL-CLOSED: any missing ingredient, even off-prod ─────────────────────────
is("no opt-in flag → dead", testOtpEnabled(env({ NODE_ENV: "development", TEST_OTP_EMAIL: FULL.TEST_OTP_EMAIL, TEST_OTP_CODE: FULL.TEST_OTP_CODE })), false);
is("opt-in but no email → dead", testOtpEnabled(env({ NODE_ENV: "development", ALLOW_TEST_OTP: "true", TEST_OTP_CODE: FULL.TEST_OTP_CODE })), false);
is("opt-in but no code → dead", testOtpEnabled(env({ NODE_ENV: "development", ALLOW_TEST_OTP: "true", TEST_OTP_EMAIL: FULL.TEST_OTP_EMAIL })), false);
is("flag not exactly 'true' → dead", testOtpEnabled(env({ NODE_ENV: "development", ...FULL, ALLOW_TEST_OTP: "1" })), false);
is("whitespace-only email → dead", testOtpEnabled(env({ NODE_ENV: "development", ...FULL, TEST_OTP_EMAIL: "   " })), false);
is("empty env → dead", testOtpEnabled(env({})), false);

// ── FUNCTIONAL: when the seam is live, verifyCode accepts the fixture email+code.
// The accept path returns before any DB access, so this needs no DB. (Wrong codes
// fall through to the normal hashed path — not the seam's concern, and DB-bound.)
(async () => {
  Object.assign(process.env, { NODE_ENV: "development", ...FULL });
  is("live seam: fixture email + correct code → 'ok'", (await verifyCode(FULL.TEST_OTP_EMAIL, FULL.TEST_OTP_CODE)) === "ok", true);

  console.log(`\nTEST-OTP: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
})();
