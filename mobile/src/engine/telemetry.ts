// Behavioral telemetry (the data-flywheel seed), ported from mvp/app.js.
// Logs each cook session — incl. the MEAL (recipe) and STARS (rating) — to
// AsyncStorage. In production this streams to the backend with the same schema.
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "seartune_sessions";

export type StepStat = {
  title: string;
  type?: string;
  atSec?: number;
  firedSec?: number;
  authoredSec?: number;
  actualSec?: number;
  waitSec?: number;
  extends: number;
};

export type CookSession = {
  mode: "music" | "guided";
  recipe: string; // ← the MEAL cooked
  song?: string;
  equipment: { pan: string | null; heat: string | null };
  experience: string | null;
  startedAt: number;
  finishedAt?: string;
  durationSec?: number;
  completed: boolean;
  totalExtends: number;
  rating?: number; // ← STARS (0.5–5)
  hasPhoto?: boolean;
  steps: StepStat[];
};

export async function readSessions(): Promise<CookSession[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CookSession[]) : [];
  } catch {
    return [];
  }
}

export async function saveSession(s: CookSession): Promise<void> {
  try {
    const log = await readSessions();
    log.push(s);
    await AsyncStorage.setItem(KEY, JSON.stringify(log.slice(-200)));
  } catch {
    // ignore
  }
}

export async function clearSessions(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
