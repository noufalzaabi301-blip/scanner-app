// ---------------------------------------------------------------------------
// lib/guestPreferencesCore.ts
// Guest preferences: the pure rules (no storage, no React Native), so they
// can be unit-tested (scripts/testGuestMode.ts).
//
// A guest must answer BOTH questions before the scanner opens:
//   1. Do you have any food allergies?  Yes (+ at least one allergy) / No allergies
//   2. Do you prefer halal food?        Yes / No
// Guests never send anything for developer review: submitProducts is
// always false and is not stored.
// ---------------------------------------------------------------------------

export const GUEST_PREFERENCES_VERSION = 1;

export type GuestPreferences = {
  version: number;
  hasAllergies: boolean | null; // null = not answered yet
  allergies: string[]; // standard allergies (English option values)
  customAllergies: string[]; // validated custom allergies
  prefersHalal: boolean | null; // null = not answered yet
  updatedAt: string | null;
};

export const EMPTY_GUEST_PREFERENCES: GuestPreferences = {
  version: GUEST_PREFERENCES_VERSION,
  hasAllergies: null,
  allergies: [],
  customAllergies: [],
  prefersHalal: null,
  updatedAt: null,
};

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
}

function cleanAnswer(value: unknown): boolean | null {
  return value === true ? true : value === false ? false : null;
}

// Reads stored JSON safely; anything broken becomes "not answered".
export function parseGuestPreferences(raw: string | null | undefined): GuestPreferences {
  if (!raw) {
    return { ...EMPTY_GUEST_PREFERENCES };
  }

  try {
    const data = JSON.parse(raw);
    const prefs: GuestPreferences = {
      version: GUEST_PREFERENCES_VERSION,
      hasAllergies: cleanAnswer(data?.hasAllergies),
      allergies: cleanList(data?.allergies),
      customAllergies: cleanList(data?.customAllergies),
      prefersHalal: cleanAnswer(data?.prefersHalal),
      updatedAt: typeof data?.updatedAt === "string" ? data.updatedAt : null,
    };

    // "No allergies" never keeps a list.
    if (prefs.hasAllergies === false) {
      prefs.allergies = [];
      prefs.customAllergies = [];
    }

    return prefs;
  } catch {
    return { ...EMPTY_GUEST_PREFERENCES };
  }
}

export type GuestSetupProblem =
  | "allergy-question"
  | "allergy-list-empty"
  | "halal-question";

// What is still missing before scanning (null = ready).
export function guestSetupProblem(prefs: GuestPreferences): GuestSetupProblem | null {
  if (prefs.hasAllergies === null) {
    return "allergy-question";
  }

  if (prefs.hasAllergies && prefs.allergies.length + prefs.customAllergies.length === 0) {
    return "allergy-list-empty";
  }

  if (prefs.prefersHalal === null) {
    return "halal-question";
  }

  return null;
}

export function isGuestSetupComplete(prefs: GuestPreferences): boolean {
  return guestSetupProblem(prefs) === null;
}

// Serialised for local storage. Never contains a submission setting.
export function serializeGuestPreferences(prefs: GuestPreferences, now = new Date()): string {
  const hasAllergies = prefs.hasAllergies;

  return JSON.stringify({
    version: GUEST_PREFERENCES_VERSION,
    hasAllergies,
    allergies: hasAllergies ? cleanList(prefs.allergies) : [],
    customAllergies: hasAllergies ? cleanList(prefs.customAllergies) : [],
    prefersHalal: prefs.prefersHalal,
    updatedAt: now.toISOString(),
  });
}

// What the scanner uses for a guest. submitProducts is ALWAYS false.
export function guestScreeningPreferences(prefs: GuestPreferences): {
  allergies: string[];
  prefersHalal: boolean;
  submitProducts: false;
  allergyMatchingOff: boolean;
} {
  const allergies = prefs.hasAllergies
    ? [...new Set([...prefs.allergies, ...prefs.customAllergies])]
    : [];

  return {
    allergies,
    prefersHalal: prefs.prefersHalal === true,
    submitProducts: false,
    allergyMatchingOff: allergies.length === 0,
  };
}
