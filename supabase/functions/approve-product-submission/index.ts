// ---------------------------------------------------------------------------
// supabase/functions/approve-product-submission/index.ts
// Admin-only: approves a pending submission and copies it into the
// separate food database. Safe against duplicate approvals.
// ---------------------------------------------------------------------------

import {
  HttpError,
  barcodeVariants,
  cleanBarcode,
  corsHeaders,
  explainUnclaimable,
  foodDbAdmin,
  handleError,
  json,
  readRequest,
  requireAdmin,
  text,
  userDbAdmin,
} from "../_shared/review.ts";

const SUBMISSION_FIELDS =
  "id, barcode, product_name, brand_name, variant, ingredients_text, contains_text, may_contain_text, source";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed." });
  }

  let userDb;
  let claimedId: string | null = null;
  let productInserted = false;

  // Puts a claimed submission back to "pending" after a failed approval.
  async function releaseClaim() {
    if (!claimedId || productInserted || !userDb) {
      return;
    }

    const { error } = await userDb
      .from("product_submissions")
      .update({ verification_status: "pending", reviewed_by: null })
      .eq("id", claimedId)
      .eq("verification_status", "processing");

    if (error) {
      console.error("Could not release submission claim:", error.message);
    }

    claimedId = null;
  }

  try {
    userDb = userDbAdmin();
    const foodDb = foodDbAdmin();

    const adminId = await requireAdmin(req, userDb);
    const { id } = await readRequest(req);

    // 1. Claim the submission atomically: only ONE request can move it
    //    from "pending" to "processing".
    const { data: submission, error: claimError } = await userDb
      .from("product_submissions")
      .update({ verification_status: "processing", reviewed_by: adminId })
      .eq("id", id)
      .eq("verification_status", "pending")
      .select(SUBMISSION_FIELDS)
      .maybeSingle();

    if (claimError) {
      throw new HttpError(500, "The submission could not be loaded.");
    }

    if (!submission) {
      throw await explainUnclaimable(userDb, id);
    }

    claimedId = id;

    // 2. Validate the product data.
    const barcode = cleanBarcode(submission.barcode);
    const productName = text(submission.product_name);
    const brandName = text(submission.brand_name);
    const ingredients = text(submission.ingredients_text);
    const contains = text(submission.contains_text);

    const problems: string[] = [];

    if (barcode.length < 8 || barcode.length > 14) {
      problems.push("a valid 8–14 digit barcode");
    }

    if (productName.length < 2 || !/\p{L}/u.test(productName)) {
      problems.push("a product name");
    }

    if (ingredients.length < 3 || !/\p{L}/u.test(ingredients)) {
      problems.push("an ingredient list");
    }

    if (problems.length > 0) {
      await releaseClaim();
      throw new HttpError(
        422,
        `This submission cannot be approved. It needs ${problems.join(", ")}.`
      );
    }

    // 3. Never create a duplicate barcode in the food database.
    const { data: existing, error: existingError } = await foodDb
      .from("products")
      .select("barcode")
      .in("barcode", barcodeVariants(barcode))
      .limit(1);

    if (existingError) {
      await releaseClaim();
      throw new HttpError(500, "The food database could not be checked.");
    }

    if ((existing ?? []).length > 0) {
      await releaseClaim();
      throw new HttpError(
        409,
        `A product with barcode ${existing![0].barcode} already exists in the food database.`
      );
    }

    // 4. Insert the verified product.
    const { error: insertError } = await foodDb.from("products").insert({
      barcode,
      product_name: productName,
      brand_name: brandName || null,
      ingredients_text: ingredients,
      allergen_text: contains || null,
      verification_status: "approved",
    });

    if (insertError) {
      await releaseClaim();

      if ((insertError as any).code === "23505") {
        throw new HttpError(
          409,
          "A product with this barcode already exists in the food database."
        );
      }

      console.error("Food database insert failed:", insertError.message);
      throw new HttpError(500, "The product could not be added to the food database.");
    }

    productInserted = true;

    // 5. Mark the submission as approved.
    const { error: finalError } = await userDb
      .from("product_submissions")
      .update({
        verification_status: "approved",
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        review_notes: "Approved and added to food database",
      })
      .eq("id", id)
      .eq("verification_status", "processing");

    if (finalError) {
      console.error("Submission status update failed:", finalError.message);
      return json(500, {
        ok: false,
        error:
          "The product was added to the food database, but the submission could not be marked as approved. Set it to 'approved' manually.",
      });
    }

    return json(200, {
      ok: true,
      message: "Approved and added to the food database.",
      product: { barcode, product_name: productName },
    });
  } catch (error) {
    await releaseClaim();
    return handleError(error);
  }
});