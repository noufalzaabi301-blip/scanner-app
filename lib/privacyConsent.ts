// ---------------------------------------------------------------------------
// lib/privacyConsent.ts
// One place that decides whether the Privacy Notice must be shown
// (rules: lib/privacyConsentCore.ts). Used by Welcome, Register, Login and
// the app start, so the notice is shown ONCE per version:
//   - accepted on this device → not shown again at sign-up, login or start;
//     the account gets the same acceptance record (Supabase auth metadata);
//   - Profile → Privacy Notice always opens it read-only.
// ---------------------------------------------------------------------------

import AsyncStorage from "@react-native-async-storage/async-storage";

import { hasAcceptedCurrentPrivacy, PRIVACY_VERSION, STORAGE_KEYS } from "./constants";
import {
  isDeviceAcceptanceCurrent,
  parseDeviceAcceptance,
  privacyMetadataFrom,
  serializeDeviceAcceptance,
  type DeviceAcceptance,
} from "./privacyConsentCore";
import { supabase } from "./supabase";

export async function readDeviceAcceptance(): Promise<DeviceAcceptance | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.privacyNoticeAccepted);
    return isDeviceAcceptanceCurrent(raw, PRIVACY_VERSION) ? parseDeviceAcceptance(raw) : null;
  } catch {
    return null;
  }
}

export async function hasDeviceAcceptedPrivacy(): Promise<boolean> {
  return (await readDeviceAcceptance()) !== null;
}

// Called only after the user ticked "I have read and accept" and pressed
// Accept on the Privacy Notice.
export async function saveDeviceAcceptance(): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.privacyNoticeAccepted,
    serializeDeviceAcceptance(PRIVACY_VERSION)
  );
}

// Metadata for a new account, when the notice was already accepted on this
// device (so Register does not show it a second time).
export async function deviceAcceptanceMetadata() {
  const acceptance = await readDeviceAcceptance();
  return acceptance ? privacyMetadataFrom(acceptance) : null;
}

// Signed-in user: true when their account (or, failing that, this device)
// has accepted the current notice. A device acceptance is copied to the
// account so it is not asked again on other screens.
export async function ensureAccountPrivacy(
  metadata: Record<string, unknown> | null | undefined
): Promise<boolean> {
  if (hasAcceptedCurrentPrivacy(metadata)) {
    return true;
  }

  const acceptance = await readDeviceAcceptance();

  if (!acceptance) {
    return false;
  }

  try {
    const { error } = await supabase.auth.updateUser({
      data: privacyMetadataFrom(acceptance),
    });
    return !error;
  } catch {
    return false;
  }
}
