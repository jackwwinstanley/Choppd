/*
 * Weekly email digest — run by cron (`node dist/digest.js`). Computes the
 * session report and emails it via SMTP (nodemailer). Config from env:
 *   SMTP_URL    e.g. smtps://USER:APP_PASSWORD@smtp.gmail.com:465
 *   DIGEST_TO   where to send it (your inbox)
 *   DIGEST_FROM optional From header (defaults to a sizle.nodaysoff.pro address)
 * If SMTP_URL/DIGEST_TO are missing it prints the report instead (dry run), so
 * cron logs still show the data and you can confirm wiring before adding creds.
 */
import "dotenv/config";
import nodemailer from "nodemailer";
import { initDb, db } from "./db.js";
import { computeReport, reportToHtml, reportToText } from "./analytics.js";

async function main() {
  await initDb();
  const report = await computeReport(db);
  const text = reportToText(report);
  const html = reportToHtml(report);

  const smtp = process.env.SMTP_URL;
  const to = process.env.DIGEST_TO;
  if (!smtp || !to) {
    console.log("[digest] SMTP_URL/DIGEST_TO not set — dry run, printing report:\n");
    console.log(text);
    return;
  }
  const from = process.env.DIGEST_FROM || "Sizle <digest@sizle.nodaysoff.pro>";
  const transport = nodemailer.createTransport(smtp);
  const subject = `Sizle weekly digest — ${new Date().toISOString().slice(0, 10)} (${report.overview.total} sessions)`;
  await transport.sendMail({ from, to, subject, text, html });
  console.log(`[digest] sent to ${to} (${report.overview.total} sessions)`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("[digest] error:", e); process.exit(1); });
