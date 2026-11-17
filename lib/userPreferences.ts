// ---------------------------------------------------------------------------
// lib/userPreferences.ts
// Shared access to the user_preferences table in the USER Supabase database.
//
// The database row is the source of truth for allergies, halal preference
// and product-submission consent. Row Level Security limits every query to
// the signed-in user's own row, so the app never needs elevated keys.
// ---------------------------------------------------------------------------

import { supabase } from "./supabase";

export type UserPreferences = {
  exists: boolean;
  // Standard options + "other" allergies merged and de-duplicated
  // (this is what the screening engine uses).
  allergies: string[];
  // Raw columns, for editing screens.
  selectedAllergies: string[];
  otherAllergy: string;
  prefersHalal: boolean;
  submitProducts: boolean;
};

export const EMPTY_PREFERENCES: UserPreferences = {
  exists: false,
  allergies: [],
  selectedAllergies: [],
  otherAllergy: "",
  prefersHalal: false,
  submitProducts: false,
};

function cleanList(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item: unknown): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

// "Other allergy" is free text and may contain several items separated by
// commas, semicolons, the Arabic comma or new lines.
export function splitOtherAllergies(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(/[,;،\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

// Loads the preferences for one user id. Throws on database errors so
// callers can decide whether to show an error or fall back to defaults.
export async function fetchPreferencesForUser(
  userId: string
): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select(
      "allergies, other_allergy, prefers_halal, submit_products_for_review"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return { ...EMPTY_PREFERENCES };
  }

  const selectedAllergies = cleanList(data.allergies);
  const otherAllergy =
    typeof data.other_allergy === "string" ? data.other_allergy : "";

  return {
    exists: true,
    allergies: [
      ...new Set([...selectedAllergies, ...splitOtherAllergies(otherAllergy)]),
    ],
    selectedAllergies,
    otherAllergy,
    prefersHalal: data.prefers_halal === true,
    submitProducts: data.submit_products_for_review === true,
  };
}

// Loads the CURRENT user's preferences. Throws if nobody is signed in.
export async function fetchCurrentUserPreferences(): Promise<UserPreferences> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("No signed-in user.");
  }

  return fetchPreferencesForUser(user.id);
}

// Used after login to decide between Home and first-time Preferences.
export async function hasSavedPreferences(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return !!data;
}

export type AllergyFields = {
  hasAllergies: boolean;
  allergies: string[];
  otherAllergy: string | null;
};

// Saves the allergy part of user_preferences WITHOUT touching the halal
// preference or the product-verification consent.
//
// Why the complete row is sent: an upsert is an INSERT … ON CONFLICT
// UPDATE, and Postgres checks NOT NULL on the inserted row first. Leaving
// prefers_halal out (or sending null/undefined) therefore fails with
// 'null value in column "prefers_halal" … violates not-null constraint',
// even when the row already exists. So the existing row is read right
// before saving and its booleans are sent back unchanged; a first-time row
// gets safe defaults (false) instead of null.
export async function saveAllergyPreferences(
  userId: string,
  fields: AllergyFields
): Promise<void> {
  const { data: existing, error: readError } = await supabase
    .from("user_preferences")
    .select("prefers_halal, submit_products_for_review")
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  const row = {
    user_id: userId,
    prefers_halal: existing?.prefers_halal === true,
    submit_products_for_review: existing?.submit_products_for_review === true,
    has_allergies: fields.hasAllergies,
    allergies: fields.hasAllergies ? fields.allergies : [],
    other_allergy: fields.hasAllergies ? fields.otherAllergy : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("user_preferences")
    .upsert(row, { onConflict: "user_id" })
    .select("user_id");

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    throw new Error("Preferences were not saved. Please try again.");
  }
}
