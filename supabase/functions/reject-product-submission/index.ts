// ---------------------------------------------------------------------------
// supabase/functions/reject-product-submission/index.ts
// Admin-only: rejects a pending submission with optional reviewer notes.
// ---------------------------------------------------------------------------

import {
  HttpError,
  corsHeaders,
  explainUnclaimable,
  handleError,
  json,
  readRequest,
  requireAdmin,
  userDbAdmin,
} from "../_shared/review.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed." });
  }

  try {
    const userDb = userDbAdmin();
    const adminId = await requireAdmin(req, userDb);
    const { id, notes } = await readRequest(req);

    // Only a pending submission can be rejected (single atomic update).
    const { data, error } = await userDb
      .from("product_submissions")
      .update({
        verification_status: "rejected",
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
        review_notes: notes || "Rejected by reviewer",
      })
      .eq("id", id)
      .eq("verification_status", "pending")
      .select("id")
      .maybeSingle();

    if (error) {
      throw new HttpError(500, "The submission could not be updated.");
    }

    if (!data) {
      throw await explainUnclaimable(userDb, id);
    }

    return json(200, { ok: true, message: "Submission rejected." });
  } catch (error) {
    return handleError(error);
  }
});