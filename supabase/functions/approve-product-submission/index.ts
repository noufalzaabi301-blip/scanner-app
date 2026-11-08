// ---------------------------------------------------------------------------
// supabase/functions/approve-product-submission/index.ts
// Admin-only: approves a pending submission and copies it into the
// separate food database. Safe against duplicate approvals.
//
// Called by the developer page with:
//   supabase.functions.invoke("approve-product-submission", {
//     body: { submission_id: submission.id },
//   })
//
// Steps:
//   1. Authenticate the caller and check user-DB admin_users.
//   2. Claim the PENDING product_submissions row (pending → processing).
//   3. Validate product name, ingredients and barcode (length + check digit).
//   4. Reject duplicates (exact barcode and its UPC/EAN equivalent).
//   5. Insert into food-DB public.products with FOOD_SUPABASE_SERVICE_ROLE_KEY.
//   6. Mark the submission approved.
// On any failure before step 5 succeeds, the submission goes back to
// "pending" and a clear { ok: false, error } message is returned.
//
// Why an Edge Function: writing to the food database needs its
// service-role key (FOOD_SUPABASE_SERVICE_ROLE_KEY). That key must never be
// bundled in the app, so the write happens here on the server, after the
// caller is verified as an admin. Users never get insert access to the
// food database.
// ---------------------------------------------------------------------------

import {
  HttpError,
  barcodeVariants,
  cleanBarcode,
  corsHeaders,
  isValidBarcode,
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

    // Developer check first: only users in user-DB admin_users continue.
    const adminId = await requireAdmin(req, userDb);
    const foodDb = foodDbAdmin();
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

    if (!isValidBarcode(barcode)) {
      problems.push(
        "a valid barcode (8, 12, 13 or 14 digits with a correct check digit)"
      );
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
      console.error("Food database duplicate check failed:", existingError.message);
      throw new HttpError(
        500,
        `The food database could not be checked: ${existingError.message}`
      );
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

      // 42501 = permission denied: the secret is not the food project's
      // service-role key, or table grants for service_role were removed.
      if ((insertError as any).code === "42501") {
        throw new HttpError(
          500,
          `Food database refused the insert (${insertError.message}). Check that FOOD_SUPABASE_SERVICE_ROLE_KEY is the FOOD project's service-role key and run supabase/sql/food_database_read_only.sql (it grants service_role access).`
        );
      }

      if ((insertError as any).code === "23505") {
        throw new HttpError(
          409,
          "A product with this barcode already exists in the food database."
        );
      }

      console.error("Food database insert failed:", insertError.message);
      throw new HttpError(
        500,
        `The product could not be added to the food database: ${insertError.message}`
      );
    }

    productInserted = true;

    // 5. Mark the submission as approved.
    const { error: finalError } = await userDb
      .from("product_submissions")
      .update({
        verification_status: "approved",
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        review_notes: "Approved and added to scanner database",
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
      message: "Approved and added to scanner database",
      product: { barcode, product_name: productName },
    });
  } catch (error) {
    await releaseClaim();
    return handleError(error);
  }
});