// ---------------------------------------------------------------------------
// lib/account.ts
// Delete account (Profile → Delete account).
//
// Uses the USER Supabase client (lib/supabase.ts), never the food database
// client. The delete-account Edge Function, deployed to the same user
// project, does the deleting with the service-role key on the server.
// ---------------------------------------------------------------------------

import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";

import { translate } from "./i18n/translate";
import { supabase } from "./supabase";

// Short name of the user project, e.g. "lqbbbzoleutjhlfkljae", for messages.
function userProjectRef(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
  return url.replace(/^https?:\/\//, "").split(".")[0] || "?";
}

// Turns any functions.invoke() failure into a clear, real message.
async function describeInvokeError(error: unknown): Promise<string> {
  // The request never reached the function: not deployed, wrong project,
  // offline, or blocked by the browser.
  if (error instanceof FunctionsFetchError) {
    return translate("account.functionUnreachable", { project: userProjectRef() });
  }

  if (error instanceof FunctionsRelayError) {
    return translate("account.functionRelay", {
      message: (error as Error).message,
    });
  }

  if (error instanceof FunctionsHttpError) {
    const response = (error as any).context as Response | undefined;
    let serverMessage = "";

    try {
      const payload = await response?.clone().json();
      serverMessage = payload?.error ?? payload?.message ?? payload?.msg ?? "";
    } catch {
      try {
        serverMessage = (await response?.clone().text())?.trim() ?? "";
      } catch {
        serverMessage = "";
      }
    }

    if (response?.status === 404 && !serverMessage) {
      return translate("account.functionNotDeployed", { project: userProjectRef() });
    }

    return serverMessage || translate("account.serverError", {
      status: String(response?.status ?? "?"),
    });
  }

  return error instanceof Error && error.message
    ? error.message
    : translate("account.unknownError");
}

// Permanently deletes the signed-in user's account. Throws a readable error
// and changes nothing locally if the server did not confirm the deletion.
//
// shouldRemoveDeveloperAccess: only for developers who EXPLICITLY chose to
// also be removed from the food database's developer_users table. Normal
// customers always pass false, so the food database is never contacted.
export async function deleteMyAccount(
  shouldRemoveDeveloperAccess = false
): Promise<void> {
  // 1. Must be signed in.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error(translate("account.notSignedIn"));
  }

  // 2. Refresh the session if it expires within the next minute, so the
  //    function receives a valid login token.
  const expiresAtMs = (session.expires_at ?? 0) * 1000;

  if (expiresAtMs - Date.now() < 60_000) {
    const { error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError) {
      throw new Error(translate("account.sessionExpired"));
    }
  }

  // 3. Call the Edge Function on the USER project.
  const { data, error } = await supabase.functions.invoke("delete-account", {
    body: {
      remove_developer_access: shouldRemoveDeveloperAccess,
    },
  });

  if (error) {
    throw new Error(await describeInvokeError(error));
  }

  if (!data?.ok) {
    throw new Error(data?.error || translate("account.unknownError"));
  }

  // 4. Deleted on the server: clear the session saved on this device.
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
}
