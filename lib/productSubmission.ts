// ---------------------------------------------------------------------------
// lib/productSubmission.ts
// Sends a confirmed product for developer verification, but only when the
// user turned on "Help improve LabelLens by sending scanned products for
// verification". Never blocks the app and never shows errors to the user.
// ---------------------------------------------------------------------------

import { supabase } from "./supabase";

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
  // true when the caller has just read submit_products_for_review = true
  // from user_preferences. The database insert policy still enforces it.
  preferenceConfirmed?: boolean;
};

const BUCKET = "product-submissions";

// Products already in the approved LabelLens database are not resubmitted.
// Matches ONLY the exact source label set in lib/productProviders.ts, so
// "Open Food Facts — not verified" and photo-extracted products are still
// submitted.
const APPROVED_SOURCE = /^LabelLens verified product database$/i;

// Products already submitted (or tried) in this app session, e.g. when the
// result is re-screened after editing allergies.
const attemptedThisSession = new Set<string>();

// Submissions currently being sent, so two quick calls cannot both upload.
const inFlight = new Set<string>();

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

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

// Local photos are uploaded; web URLs (e.g. Open Food Facts) are kept as-is.
async function uploadSubmissionPhoto(
  userId: string,
  photoUri: string | null,
  photoName: string
): Promise<string | null> {
  if (!photoUri) {
    return null;
  }

  if (/^https?:\/\//i.test(photoUri)) {
    return photoUri;
  }

  const response = await fetch(photoUri);
  const fileData = await response.arrayBuffer();

  const random = Math.random().toString(36).slice(2, 8);
  const filePath = `${userId}/${Date.now()}-${random}-${photoName}.jpg`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, fileData, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return filePath;
}

// Reads the saved preference from user_preferences (the source of truth).
export async function isProductSubmissionEnabled(
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("submit_products_for_review")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.submit_products_for_review === true;
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
): Promise<void> {
  let key = "";
  let succeeded = false;

  try {
    // Nothing useful to verify, or already an approved product.
    if (!text(product.ingredients) || APPROVED_SOURCE.test(text(product.source))) {
      return;
    }

    if (!text(product.barcode) && !text(product.productName)) {
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    key = submissionKey(user.id, product);

    // Already submitted this session, or being sent right now.
    if (attemptedThisSession.has(key) || inFlight.has(key)) {
      key = "";
      return;
    }

    inFlight.add(key);

    // Off = nothing is uploaded.
    if (!options.preferenceConfirmed) {
      if (!(await isProductSubmissionEnabled(user.id))) {
        return;
      }
    }

    // Do not upload photos for a product that was already submitted.
    if (await alreadySubmitted(user.id, product)) {
      succeeded = true;
      return;
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
    if (error && (error as any).code !== "23505") {
      throw error;
    }

    succeeded = true;
  } catch (error: any) {
    // Log only a short message; the user never sees this.
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
}