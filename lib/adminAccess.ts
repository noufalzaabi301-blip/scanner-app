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

// Calls a review Edge Function and returns its message, or throws a
// readable error.
export async function callReviewFunction(
  name: "approve-product-submission" | "reject-product-submission",
  body: Record<string, unknown>
): Promise<string> {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    let message = "The request failed. Please try again.";

    try {
      const response = (error as any).context;

      if (response && typeof response.json === "function") {
        const payload = await response.json();

        if (typeof payload?.error === "string") {
          message = payload.error;
        }
      }
    } catch {
      // keep the default message
    }

    throw new Error(message);
  }

  if (!data?.ok) {
    throw new Error(data?.error || "The request failed. Please try again.");
  }

  return data.message ?? "Done.";
}