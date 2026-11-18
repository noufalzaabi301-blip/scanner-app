// ---------------------------------------------------------------------------
// lib/guestPreferences.ts
// Guest preferences are stored ONLY on this device (AsyncStorage, which is
// browser localStorage on the website), under STORAGE_KEYS.guestPreferences.
// Nothing here talks to Supabase: guest data never reaches the customer
// database, and guests never submit products for developer review.
// Rules: lib/guestPreferencesCore.ts.
// ---------------------------------------------------------------------------

import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "./constants";
import {
  parseGuestPreferences,
  serializeGuestPreferences,
  type GuestPreferences,
} from "./guestPreferencesCore";

export * from "./guestPreferencesCore";

export async function loadGuestPreferences(): Promise<GuestPreferences> {
  try {
    return parseGuestPreferences(await AsyncStorage.getItem(STORAGE_KEYS.guestPreferences));
  } catch {
    return parseGuestPreferences(null);
  }
}

export async function saveGuestPreferences(prefs: GuestPreferences): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.guestPreferences, serializeGuestPreferences(prefs));
}
