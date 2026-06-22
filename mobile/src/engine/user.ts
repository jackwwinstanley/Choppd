// User profile (experience + equipment) and parametric timing, ported from the
// web demo. Stored in AsyncStorage.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { readSessions } from "./telemetry";

const KEY = "seartune_profile";

export type Experience = "beginner" | "some" | "decent" | "seasoned";
export type Profile = { experience: Experience | null; pan: string | null; heat: string | null };

const DEFAULT: Profile = { experience: null, pan: null, heat: null };

export const EXPERIENCE_LEVELS = [
  { id: "beginner", label: "Beginner", emoji: "🌱", blurb: "Just starting out — we'll explain every step." },
  { id: "some", label: "Finding my feet", emoji: "🍳", blurb: "A few cooks in, still learning the basics." },
  { id: "decent", label: "Comfortable cook", emoji: "🧑‍🍳", blurb: "I can handle most everyday recipes." },
  { id: "seasoned", label: "Seasoned cook", emoji: "🔥", blurb: "Very experienced — keep the cues brief." },
] as const;
export const PAN_OPTIONS = [
  { id: "cast-iron", label: "Cast iron", emoji: "🍳" },
  { id: "stainless", label: "Stainless steel", emoji: "🪙" },
  { id: "nonstick", label: "Non-stick", emoji: "⚫️" },
] as const;
export const HEAT_OPTIONS = [
  { id: "gas", label: "Gas", emoji: "🔥" },
  { id: "electric", label: "Electric / induction", emoji: "♨️" },
] as const;

export async function getProfile(): Promise<Profile> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}
export async function setProfile(p: Profile): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}
export const hasOnboarded = (p: Profile) => !!(p.experience && p.pan && p.heat);
export const isBeginner = (p: Profile) => p.experience === "beginner" || p.experience === "some";

const SKILL_FACTOR: Record<string, number> = { beginner: 1.25, some: 1.1, decent: 1.0, seasoned: 0.9 };
const PAN_FACTOR: Record<string, number> = { "cast-iron": 0.95, stainless: 1.0, nonstick: 1.05 };
const HEAT_FACTOR: Record<string, number> = { gas: 1.0, electric: 1.1 };

// observed pace = median(actual/authored) across guided steps; null if too little data
export async function detectedPace(): Promise<number | null> {
  const ratios: number[] = [];
  (await readSessions()).forEach((s) => {
    if (s.mode === "guided") (s.steps || []).forEach((st: any) => { if (st.authoredSec > 5 && st.actualSec > 0) ratios.push(st.actualSec / st.authoredSec); });
  });
  if (ratios.length < 5) return null;
  ratios.sort((a, b) => a - b);
  return Math.max(0.6, Math.min(1.8, ratios[Math.floor(ratios.length / 2)]));
}

// returns a function base→adjusted seconds, personalized to skill + equipment + observed pace
export function makeAdjuster(p: Profile, pace: number | null) {
  const sf = SKILL_FACTOR[p.experience ?? "some"] ?? 1.1;
  const paceF = pace != null ? 0.5 * sf + 0.5 * pace : sf;
  const equipF = (PAN_FACTOR[p.pan ?? ""] ?? 1.0) * (HEAT_FACTOR[p.heat ?? ""] ?? 1.0);
  return (base: number) => Math.max(5, Math.round(base * paceF * equipF));
}
