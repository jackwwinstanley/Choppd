// App preferences (voice / haptics / step-checkpoints / theme). AsyncStorage.
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "seartune_prefs";

export type Prefs = {
  voice: boolean;
  haptics: boolean;
  checkpoints: boolean; // music cook: confirm "Continue" at every step
  theme: "dark" | "light";
};

const DEFAULT: Prefs = { voice: true, haptics: true, checkpoints: true, theme: "dark" };

export async function getPrefs(): Promise<Prefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export async function setPrefs(p: Prefs): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}
