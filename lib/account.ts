// ---------------------------------------------------------------------------
// lib/account.ts
// Account actions that need the server: deleting the account.
// ---------------------------------------------------------------------------

import { readFunctionError } from "./adminAccess";
import { supabase } from "./supabase";

// Permanently deletes the signed-in user's account and personal data via
// the delete-account Edge Function (it holds the service-role key; the app
// never does). Signs out locally afterwards.
//
// removeDeveloperAccess: only for developers who EXPLICITLY chose to also
// be removed from the food database's developer_users table. Normal
// customers always call this with false, so the food database is untouched.
export async function deleteMyAccount(
  removeDeveloperAccess = false
): Promise<void> {
  const { data, error } = await supabase.functions.invoke("delete-account", {
    body: { remove_developer_access: removeDeveloperAccess === true },
  });

  if (error) {
    throw new Error(await readFunctionError(error));
  }

  if (!data?.ok) {
    throw new Error(data?.error || "The account could not be deleted.");
  }

  // The account no longer exists; clear the session saved on this device.
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
}
