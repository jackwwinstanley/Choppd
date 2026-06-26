/*
 * Streak engine — consecutive local-calendar-day runs over a user's COMPLETED
 * cook sessions. Computed in the user's IANA timezone (default UTC). Cached on
 * the users row (current_streak / longest_streak): recomputed live on each
 * cook-save and nightly (tools/recompute-streaks.mjs) to expire broken streaks.
 *
 * A cook started at 11:58pm and finished 12:02am counts for the day it STARTED,
 * which is created_at (set when the session is logged at finish — close enough;
 * the client logs at completion, and the start day rarely differs).
 */
import { db } from "./db.js";

// Local calendar date "YYYY-MM-DD" for a UTC ISO timestamp in an IANA tz.
export function localDate(iso: string, tz: string): string {
  try { return new Date(iso).toLocaleDateString("en-CA", { timeZone: tz }); }
  catch { return new Date(iso).toLocaleDateString("en-CA", { timeZone: "UTC" }); }
}
// Calendar arithmetic on a "YYYY-MM-DD" string (tz-agnostic).
export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
// Today's local date for an IANA tz.
export function todayLocalDate(tz: string | null): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz || "UTC" });
}

export interface StreakResult { current: number; longest: number; }

/** Pure streak math over a list of completed-cook local dates + "today" local. */
export function computeStreak(completedDates: string[], todayLocal: string): StreakResult {
  const days = Array.from(new Set(completedDates)).sort(); // ascending YYYY-MM-DD
  if (!days.length) return { current: 0, longest: 0 };

  let longest = 1, run = 1;
  for (let i = 1; i < days.length; i++) {
    run = addDays(days[i - 1], 1) === days[i] ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  // Current run only counts if it reaches today or yesterday (alive until midnight).
  const last = days[days.length - 1];
  let current = 0;
  if (last === todayLocal || last === addDays(todayLocal, -1)) {
    current = 1;
    for (let i = days.length - 2; i >= 0; i--) {
      if (addDays(days[i], 1) === days[i + 1]) current++; else break;
    }
  }
  return { current, longest };
}

/** Recompute one user's streak from completed sessions and cache it on the row. */
export async function recomputeUserStreak(userId: string, tz: string | null): Promise<StreakResult> {
  const t = tz || "UTC";
  const rows = (await db.all(
    "SELECT created_at FROM cook_sessions WHERE user_id = ? AND completed = 1", [userId]
  )) as { created_at: string }[];
  const dates = rows.map((r) => localDate(r.created_at, t));
  const todayLocal = new Date().toLocaleDateString("en-CA", { timeZone: t });
  const res = computeStreak(dates, todayLocal);
  await db.run("UPDATE users SET current_streak = ?, longest_streak = ? WHERE id = ?", [res.current, res.longest, userId]);
  return res;
}

/** Nightly: recompute every user's cached streak (expires broken streaks). */
export async function recomputeAllStreaks(): Promise<number> {
  const users = (await db.all("SELECT id, timezone FROM users")) as { id: string; timezone: string | null }[];
  for (const u of users) await recomputeUserStreak(u.id, u.timezone);
  return users.length;
}
