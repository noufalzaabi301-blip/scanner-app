// ---------------------------------------------------------------------------
// lib/postAuthRoute.ts
// Where the app goes once the user has chosen how to continue.
//
//   Welcome → Login / Create account → (signed in) → Privacy Notice*
//           → allergy + halal setup (first time) → Scan
//   Welcome → Continue as guest → Privacy Notice* → guest allergy + halal
//           setup → Scan
//
// * only when the current notice version has not been accepted yet
//   (account metadata, or this device). The notice is NEVER shown before
//   Login / Create account.
// ---------------------------------------------------------------------------

import { ROUTES } from "./constants";
import { ensureAccountPrivacy, hasDeviceAcceptedPrivacy } from "./privacyConsent";
import { hasSavedPreferences } from "./userPreferences";

export type NextRoute = { name: string; params?: Record<string, unknown> };

// Signed in (after Login, sign-up with a session, or app start).
export async function routeAfterSignIn(user: {
  id: string;
  user_metadata?: Record<string, unknown> | null;
}): Promise<NextRoute> {
  if (!(await ensureAccountPrivacy(user.user_metadata))) {
    return { name: ROUTES.PrivacyNotice, params: { fromLogin: true } };
  }

  try {
    return {
      name: (await hasSavedPreferences(user.id))
        ? ROUTES.Home
        : ROUTES.Preferences,
    };
  } catch {
    // Offline: still open the scanner; preferences load when online.
    return { name: ROUTES.Home };
  }
}

// Guest: the notice first (once per version on this device), then the
// guest allergy + halal setup.
export async function routeForGuest(): Promise<NextRoute> {
  return (await hasDeviceAcceptedPrivacy())
    ? { name: ROUTES.GuestPreferences }
    : { name: ROUTES.PrivacyNotice, params: { fromGuest: true } };
}
