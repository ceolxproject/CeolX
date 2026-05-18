import * as SecureStore from 'expo-secure-store';

export const DISMISSED_ADS_KEY = 'dismissed-ad-ids';
const MAX_DISMISSED = 50;

export async function getDismissedAdIds(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(DISMISSED_ADS_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function dismissAd(id: string): Promise<void> {
  const existing = await getDismissedAdIds();
  if (existing.includes(id)) return;
  const withId = [...existing, id];
  const next = withId.length > MAX_DISMISSED ? withId.slice(withId.length - MAX_DISMISSED) : withId;
  await SecureStore.setItemAsync(DISMISSED_ADS_KEY, JSON.stringify(next));
}
