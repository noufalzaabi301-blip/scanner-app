// ---------------------------------------------------------------------------
// lib/adminAccess.ts
// UI-level admin check. Real security is enforced by RLS and the Edge
// Functions; this only decides whether to show the admin screen.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";

import { supabase } from "./supabase";

export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return false;
    }

    const { data, error } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return Boolean(data);
  } catch (error: any) {
    console.warn("Admin check failed:", error?.message ?? "unknown error");
    return false;
  }
}

// Re-checks whenever the user logs in or out.
export function useIsAdmin(): { isAdmin: boolean; checking: boolean } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    async function check() {
      const result = await isCurrentUserAdmin();

      if (active) {
        setIsAdmin(result);
        setChecking(false);
      }
    }

    void check();

    const { data } = supabase.auth.onAuthStateChange(() => {
      // Defer the query so it never runs inside the auth callback.
      setTimeout(() => void check(), 0);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { isAdmin, checking };
}

// Calls a review Edge Function and returns its message, or throws the REAL
// error returned by the function (e.g. "A product with barcode … already
// exists"), not a generic one.
//
// Security: approvals never write to the food database from the app. Only
// the Edge Function can, using the food database's service-role key that
// is stored in Supabase Edge Function secrets.
export async function callReviewFunction(
  name: "approve-product-submission" | "reject-product-submission",
  body: Record<string, unknown>
): Promise<string> {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    throw new Error(await readFunctionError(error));
  }

  if (!data?.ok) {
    throw new Error(data?.error || "The request failed. Please try again.");
  }

  return data.message ?? "Done.";
}
// Fields a developer may correct before approval. These are written ONLY to
// the user database (public.product_submissions), never to the food DB.
export type SubmissionDraft = {
  barcode: string;
  product_name: string;
  brand_name: string;
  variant: string;
  ingredients_text: string;
  contains_text: string;
  may_contain_text: string;
};

// "Save draft": updates the pending submission row in the USER database.
// RLS must allow admins (admin_users) to update product_submissions; see
// supabase/sql/user_database_developer_review.sql.
export async function saveSubmissionDraft(
  submissionId: string,
  draft: SubmissionDraft
): Promise<void> {
  const clean = (value: string) => value.replace(/\s+/g, " ").trim() || null;

  const { data, error } = await supabase
    .from("product_submissions")
    .update({
      barcode: draft.barcode.replace(/\D/g, "") || null,
      product_name: clean(draft.product_name),
      brand_name: clean(draft.brand_name),
      variant: clean(draft.variant),
      ingredients_text: clean(draft.ingredients_text),
      contains_text: clean(draft.contains_text),
      may_contain_text: clean(draft.may_contain_text),
    })
    .eq("id", submissionId)
    .eq("verification_status", "pending")
    .select("id");

  if (error) {
    throw new Error(`Draft not saved: ${error.message}`);
  }

  // RLS returns zero rows (not an error) when an update is not allowed.
  if (!data || data.length === 0) {
    throw new Error(
      "Draft not saved: the submission is no longer pending, or your account is not allowed to edit submissions (check admin_users and the developer review policy)."
    );
  }
}

// "Approve for scanner": the ONLY way a product reaches the food database.
// The Edge Function verifies admin_users, validates the submission, inserts
// into food-DB public.products with FOOD_SUPABASE_SERVICE_ROLE_KEY and then
// marks the submission approved. Throws the function's real error message.
export async function approveSubmissionForScanner(
  submissionId: string
): Promise<string> {
  const { data, error } = await supabase.functions.invoke(
    "approve-product-submission",
    { body: { submission_id: submissionId } }
  );

  if (error) {
    throw new Error(await readFunctionError(error));
  }

  if (!data?.ok) {
    throw new Error(data?.error || "Approval failed. The submission is still pending.");
  }

  return data.message ?? "Approved and added to scanner database";
}

// Extracts the message from a failed functions.invoke() call.
// - FunctionsHttpError: the function answered with an error status; its
//   JSON body holds { ok: false, error: "..." }.
// - FunctionsRelayError / FunctionsFetchError: the function could not be
//   reached (not deployed, offline, CORS); error.message explains it.
export async function readFunctionError(error: any): Promise<string> {
  const response = error?.context;

  if (response && typeof response.text === "function") {
    try {
      const raw = await response.clone().text();

      try {
        const payload = JSON.parse(raw);
        const message = payload?.error ?? payload?.message ?? payload?.msg;

        if (typeof message === "string" && message.trim()) {
          return message;
        }
      } catch {
        if (raw.trim()) {
          return raw.trim().slice(0, 300);
        }
      }

      if (typeof response.status === "number") {
        return `The server returned an error (HTTP ${response.status}).`;
      }
    } catch {
      // Fall through to the error's own message.
    }
  }

  return typeof error?.message === "string" && error.message
    ? error.message
    : "The request failed. Please try again.";
}
