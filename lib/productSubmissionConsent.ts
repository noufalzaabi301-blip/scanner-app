// ---------------------------------------------------------------------------
// lib/productSubmissionConsent.ts
// Holds the optional product-submission choice made on the Privacy Notice
// ONLY until the account is created. After that, the database value in
// user_preferences.submit_products_for_review is the source of truth.
// ---------------------------------------------------------------------------

import AsyncStorage from "@react-native-async-storage/async-storage";

const PENDING_CONSENT_KEY = "labellens_submit_products_consent_v1";

export async function savePendingSubmissionConsent(
  value: boolean
): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_CONSENT_KEY, value ? "true" : "false");
  } catch {
    // Not critical: the default is "off".
  }
}

export async function readPendingSubmissionConsent(): Promise<
  boolean | undefined
> {
  try {
    const value = await AsyncStorage.getItem(PENDING_CONSENT_KEY);

    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

export async function clearPendingSubmissionConsent(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_CONSENT_KEY);
  } catch {
    // Ignore.
  }
}