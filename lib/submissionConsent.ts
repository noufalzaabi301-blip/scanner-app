// ---------------------------------------------------------------------------
// lib/submissionConsent.ts
// Pure decision: may this scanned product be sent for verification?
// Used by lib/productSubmission.ts and unit-tested in scripts/testConsent.ts.
//
// consentEnabled must be user_preferences.submit_products_for_review read
// from the database just before submitting. Anything other than true
// (false, null, missing row) means NO: nothing is uploaded or inserted.
// ---------------------------------------------------------------------------

export type SubmissionDecision =
  | "submit"
  | "no-consent"
  | "no-ingredients"
  | "already-approved"
  | "no-identity";

export type ConsentProduct = {
  barcode: string | null;
  productName: string;
  ingredients: string;
  source: string;
};

// Products already in the approved LabelLens database are not resubmitted.
// Matches ONLY the exact source label set in lib/productProviders.ts, so
// "Open Food Facts — not verified" and photo-extracted products are still
// submitted.
export const APPROVED_SOURCE = /^LabelLens verified product database$/i;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function submissionDecision(
  product: ConsentProduct,
  consentEnabled: boolean | null | undefined
): SubmissionDecision {
  if (consentEnabled !== true) {
    return "no-consent";
  }

  if (!clean(product.ingredients)) {
    return "no-ingredients";
  }

  if (APPROVED_SOURCE.test(clean(product.source))) {
    return "already-approved";
  }

  if (!clean(product.barcode) && !clean(product.productName)) {
    return "no-identity";
  }

  return "submit";
}
