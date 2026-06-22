// Entitlement + music-account state (premium gating). Persisted to AsyncStorage.
// Custom song selection requires app-Premium AND a connected platform with
// platform-Premium (PLAN.md). A developer code unlocks app-Premium for free.
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "seartune_entitlement";
export const DEV_CODE = "Dev123";

export type Account = { connected: boolean; premium: boolean };
export type Entitlement = {
  appPremium: boolean;
  spotify: Account;
  apple: Account;
};

const DEFAULT: Entitlement = {
  appPremium: false,
  spotify: { connected: false, premium: false },
  apple: { connected: false, premium: false },
};

export async function getEntitlement(): Promise<Entitlement> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export async function setEntitlement(e: Entitlement): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(e));
  } catch {
    // ignore
  }
}

// Picking your own song needs app-Premium AND a Premium platform account.
export function canSelectCustom(e: Entitlement): boolean {
  return e.appPremium && ((e.spotify.connected && e.spotify.premium) || (e.apple.connected && e.apple.premium));
}
