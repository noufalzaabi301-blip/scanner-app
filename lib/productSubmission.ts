// ---------------------------------------------------------------------------
// lib/productSubmission.ts
// Sends a confirmed product for developer verification, but only when the
// user turned on "Send scanned products for verification".
//
// Consent model (user database only; the food database never stores
// customer consent):
//   user_preferences.submit_products_for_review = true → permission given
//   a row in product_submissions                       → actually submitted
//   product_submissions.verification_status           → pending / approved
//                                                         / rejected
// The setting is read from the database right before anything is uploaded
// (no cached value is trusted), and the database insert policy checks the
// same setting again (supabase/sql/user_database_consent_rls.sql), so a
// product can never be submitted while the setting is off.
// Approved products reach the food database only through the
// approve-product-submission Edge Function.
// ---------------------------------------------------------------------------

import { PhotoError, uploadPhotoToBucket } from "./photoStorage";
import { submissionDecision } from "./submissionConsent";
import { supabase } from "./supabase";
import { fetchPreferencesForUser } from "./userPreferences";
import { asText as text } from "./text";

export type SubmissionProduct = {
  barcode: string | null;
  productName: string;
  brandName: string;
  variant: string;
  ingredients: string;
  contains: string;
  mayContain: string;
  source: string;
  frontPhotoUri: string | null;
  ingredientsPhotoUri: string | null;
  imageUrl: string | null;
};

export type SubmissionOptions = {
  // Kept for compatibility with existing callers. It no longer skips the
  // database check: consent is always re-read right before submitting.
  preferenceConfirmed?: boolean;
};

const BUCKET = "product-submissions";

// photoError is set when a photo could not be uploaded.
export type SubmissionResult = { photoError?: string };

// Products already submitted (or tried) in this app session, e.g. when the
// result is re-screened after editing allergies.
const attemptedThisSession = new Set<string>();

// Submissions currently being sent, so two quick calls cannot both upload.
const inFlight = new Set<string>();


function submissionKey(userId: string, product: SubmissionProduct): string {
  const barcode = text(product.barcode);

  if (barcode) {
    return `${userId}|barcode|${barcode}`;
  }

  return `${userId}|name|${text(product.brandName).toLowerCase()}|${text(
    product.productName
  ).toLowerCase()}`;
}

// Escapes % and _ for an exact, case-insensitive ilike match.
function exactIlike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

// Photos are uploaded with lib/photoStorage.ts: local photos (permanent
// copies made right after the camera / picker) are read from their file,
// and Open Food Facts images are downloaded first, so the submission keeps
// its own copy in the "product-submissions" bucket under "<userId>/".
// A failed upload stops the submission (nothing half-saved) and the reason
// is returned to the caller.
async function uploadSubmissionPhoto(
  userId: string,
  photoUri: string | null,
  photoName: "front" | "ingredients"
): Promise<string | null> {
  return uploadPhotoToBucket(BUCKET, userId, photoUri, photoName);
}

// Reads the saved preference from user_preferences (the source of truth).
export async function isProductSubmissionEnabled(
  userId: string
): Promise<boolean> {
  const preferences = await fetchPreferencesForUser(userId);
  return preferences.submitProducts;
}

async function alreadySubmitted(
  userId: string,
  product: SubmissionProduct
): Promise<boolean> {
  const barcode = text(product.barcode);

  let query = supabase
    .from("product_submissions")
    .select("id")
    .eq("submitted_by", userId)
    .limit(1);

  if (barcode) {
    query = query.eq("barcode", barcode);
  } else {
    query = query
      .is("barcode", null)
      .ilike("brand_name", exactIlike(text(product.brandName)))
      .ilike("product_name", exactIlike(text(product.productName)));
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []).length > 0;
}

// Fire-and-forget: call with `void submitProductForReview(product)`.
export async function submitProductForReview(
  product: SubmissionProduct,
  options: SubmissionOptions = {}
): Promise<SubmissionResult> {
  let key = "";
  let succeeded = false;

  try {
    // Nothing useful to verify, or already an approved product (checked
    // again with the real consent value below).
    if (submissionDecision(product, true) !== "submit") {
      return {};
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {};
    }

    key = submissionKey(user.id, product);

    // Already submitted this session, or being sent right now.
    if (attemptedThisSession.has(key) || inFlight.has(key)) {
      key = "";
      return {};
    }

    inFlight.add(key);

    // Consent is read from user_preferences right now. Off (or no row) =
    // nothing is uploaded and nothing is inserted.
    const consent = await isProductSubmissionEnabled(user.id);

    if (submissionDecision(product, consent) !== "submit") {
      return {};
    }

    // Do not upload photos for a product that was already submitted.
    if (await alreadySubmitted(user.id, product)) {
      succeeded = true;
      return {};
    }

    const frontPhotoPath = await uploadSubmissionPhoto(
      user.id,
      product.frontPhotoUri || product.imageUrl || null,
      "front"
    );

    const ingredientsPhotoPath = await uploadSubmissionPhoto(
      user.id,
      product.ingredientsPhotoUri,
      "ingredients"
    );

    // verification_status is NOT sent: the database sets it to "pending".
    const { error } = await supabase.from("product_submissions").insert({
      submitted_by: user.id,
      barcode: text(product.barcode) || null,
      product_name: text(product.productName) || null,
      brand_name: text(product.brandName) || null,
      variant: text(product.variant) || null,
      ingredients_text: text(product.ingredients) || null,
      contains_text: text(product.contains) || null,
      may_contain_text: text(product.mayContain) || null,
      front_photo_url: frontPhotoPath,
      ingredients_photo_url: ingredientsPhotoPath,
      source: text(product.source) || null,
    });

    // 23505 = already submitted (unique index). That is fine.
    // 42501 = the database refused the row (e.g. consent switched off at
    // the same moment): nothing was submitted, which is correct.
    if (error && (error as any).code !== "23505") {
      if ((error as any).code === "42501") {
        return {};
      }
      throw error;
    }

    succeeded = true;
  } catch (error: any) {
    // A photo that could not be uploaded is reported to the caller, which
    // tells the user; nothing was inserted, so it is retried next scan.
    if (error instanceof PhotoError) {
      console.warn("Product submission photo failed:", error.message);
      return { photoError: error.message };
    }

    // Other problems: log only a short message.
    console.warn(
      "Product submission skipped:",
      typeof error?.message === "string" ? error.message : "unknown error"
    );
  } finally {
    if (key) {
      inFlight.delete(key);

      // Remember successes; failures may be retried on a later scan.
      if (succeeded) {
        attemptedThisSession.add(key);
      }
    }
  }

  return {};
}