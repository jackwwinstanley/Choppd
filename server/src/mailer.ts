/*
 * MAILER SEAM — the ONE module that sends transactional email (docs/auth/otp-plan.md §0).
 * Transport is Resend over plain HTTP; it's swappable behind sendOtpEmail() (the same
 * resume/receipts/basket portability discipline). The web client + the future native
 * shell both trigger it through /api/auth/request.
 *
 * SECRETS HYGIENE (non-negotiable): the API key AND the OTP code NEVER appear in any
 * log, return value, or thrown error — including error paths. Success logs only the
 * provider message id (safe); failures log/return only a generic reason + HTTP status,
 * never the provider body (which can echo the recipient / inputs) and never the key.
 *
 * Tracking OFF: the email has NO links and no images → open/click tracking is
 * structurally impossible from the payload (bare text + minimal inline-styled HTML).
 */

type SendResult = { ok: true; id: string } | { ok: false; reason: string };

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "Choppd <code@getchoppd.app>";

// The founder's VERBATIM approved strings; the live 6-digit code replaces the literal.
// Code stays IN the subject (lock-screen visible). 10 minutes MUST match CODE_TTL_MS.
function otpEmail(code: string) {
  const subject = `${code} is your Choppd code`;
  const text = `Here's your sign-in code: ${code} — it's good for 10 minutes. Didn't ask for this? Ignore it and carry on.`;
  const html =
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;line-height:1.55;color:#111">` +
    `Here's your sign-in code: <strong style="font-size:22px;letter-spacing:3px">${code}</strong> — it's good for 10 minutes.` +
    `<br><br><span style="color:#666">Didn't ask for this? Ignore it and carry on.</span></div>`;
  return { subject, text, html };
}

export async function sendOtpEmail(email: string, code: string): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY || "";
  const from = process.env.MAIL_FROM || DEFAULT_FROM;
  const prod = process.env.NODE_ENV === "production";

  if (!key) {
    // PROD missing key → HARD failure surfaced to the route (never a silent prod no-op).
    if (prod) return { ok: false, reason: "mailer-not-configured" };
    // DEV → log-guarded no-op so the local flow works via the DEV_AUTH devCode. No code logged.
    console.log(`[mailer] dev no-op (no RESEND_API_KEY) — OTP for ${email} not emailed`);
    return { ok: true, id: "dev-noop" };
  }

  const { subject, text, html } = otpEmail(code);
  try {
    const r = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: email, subject, text, html }),
    });
    if (!r.ok) return { ok: false, reason: `send-failed-${r.status}` };   // status only — never the body
    const data = (await r.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: String(data.id || "sent") };                  // message id is safe to surface
  } catch {
    return { ok: false, reason: "send-error" };                          // never the error object
  }
}
