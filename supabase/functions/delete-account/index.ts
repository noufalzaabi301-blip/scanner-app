// ---------------------------------------------------------------------------
// supabase/functions/delete-account/index.ts
// Permanently deletes the CALLER's own account and personal data.
//
// Why an Edge Function: deleting a Supabase Auth user needs the service-role
// key, which must never be in the app. The function only ever deletes the
// account of the logged-in user who calls it (taken from their login
// token), so nobody can delete someone else's account.
//
// Two separate databases:
//
// CUSTOMER (user) database – always cleaned for the caller:
//   - photos in the "avoid-products" and "product-submissions" buckets
//   - avoid_list, user_preferences, product_submissions rows
//   - admin_users row (if any)
//   - the Auth user itself
//
// FOOD database – NOT touched by default:
//   - Approved products are never deleted (verified product data).
//   - The developer's row in food-DB developer_users is removed ONLY when
//     the request explicitly sends { "remove_developer_access": true }
//     (the app sends it only after a developer confirms it).
//   - The two projects have separate auth.users, so the developer is
//     matched by the signed-in user's normalised EMAIL, never by user id.
//     If no developer has that email, an error is returned and nothing is
//     deleted at all.
//   - Normal customers never cause any change in the food database.
//   - The food database service-role key (FOOD_SUPABASE_SERVICE_ROLE_KEY)
//     is read only here, on the server, and only in that case.
//
// Two clients in the customer project (never mixed):
//   - userAuth: built with the caller's Authorization token, used ONLY to
//     verify who is calling (auth.getUser). It never deletes anything.
//   - admin:    built with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and NO
//     caller Authorization header, so it runs as service_role. It does every
//     customer-data deletion, always filtered to the verified user's id.
//
// "permission denied for table …" (Postgres 42501) means the service_role
// has no GRANT on that table; run supabase/sql/user_database_delete_account.sql
// in the USER project's SQL editor.
//
// Deploy (Windows):
//   npx.cmd supabase@latest functions deploy delete-account --no-verify-jwt
// ---------------------------------------------------------------------------

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const NO_SESSION = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

// New-style secret keys start with "sb_secret_"; legacy keys are JWTs whose
// payload has role "service_role". A publishable / anon key here would make
// every delete run without service-role rights.
function isServiceRoleKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) {
    return true;
  }

  if (key.startsWith("sb_publishable_")) {
    return false;
  }

  try {
    const payload = key.split(".")[1];
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    );
    return decoded?.role === "service_role";
  } catch {
    return false;
  }
}

// Turns a database error into a readable message that keeps the real
// Postgres error text and code.
function describeDbError(
  step: string,
  error: { message?: string; code?: string; details?: string | null; hint?: string | null }
): string {
  const parts = [`Database deletion failed (${step}): ${error.message ?? "unknown error"}`];

  if (error.code) {
    parts.push(`[code ${error.code}]`);
  }

  if (error.details) {
    parts.push(error.details);
  }

  if (error.hint) {
    parts.push(`Hint: ${error.hint}`);
  }

  if (error.code === "42501") {
    parts.push(
      "The service_role has no permission on this table. Run supabase/sql/user_database_delete_account.sql in the USER project's SQL editor."
    );
  }

  return parts.join(" ");
}

// Removes every file stored under "<userId>/" in a bucket.
async function removeUserFiles(
  db: SupabaseClient,
  bucket: string,
  userId: string
): Promise<void> {
  for (let round = 0; round < 20; round++) {
    const { data, error } = await db.storage
      .from(bucket)
      .list(userId, { limit: 1000 });

    if (error) {
      // A bucket that does not exist means there is nothing to remove; any
      // other error (e.g. permissions) is reported, not ignored.
      if (/not\s*found/i.test(error.message ?? "")) {
        return;
      }

      throw new Error(describeDbError(`listing photos in ${bucket}`, error as any));
    }

    const paths = (data ?? []).map((file) => `${userId}/${file.name}`);

    if (paths.length === 0) {
      return;
    }

    const { error: removeError } = await db.storage.from(bucket).remove(paths);

    if (removeError) {
      throw new Error(describeDbError(`photos in ${bucket}`, removeError as any));
    }
  }
}

// Deletes the user's rows from one table (always filtered by the verified
// user's id); a missing table is ignored.
async function deleteRows(
  db: SupabaseClient,
  table: string,
  column: string,
  userId: string
): Promise<void> {
  const { error } = await db.from(table).delete().eq(column, userId);

  if (error && error.code !== "42P01") {
    throw new Error(describeDbError(table, error));
  }
}

class DeveloperAccessError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Removes the caller's row from food-DB developer_users.
//
// Identity: the customer project and the food project have SEPARATE
// auth.users tables, so their user ids never match. The developer is
// therefore found ONLY by email: the verified email of the signed-in
// customer, normalised with trim().toLowerCase(). The customer user_id is
// never used here. Nothing in food-DB products is ever touched.
async function removeFoodDeveloperAccess(
  customerEmail: string | undefined
): Promise<void> {
  const email = (customerEmail ?? "").trim().toLowerCase();

  if (!email) {
    throw new DeveloperAccessError(
      400,
      "Your account has no email address, so developer access could not be matched. Nothing was deleted."
    );
  }

  const url = Deno.env.get("FOOD_SUPABASE_URL");
  const key = Deno.env.get("FOOD_SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new DeveloperAccessError(
      500,
      "Developer access could not be removed: FOOD_SUPABASE_URL / FOOD_SUPABASE_SERVICE_ROLE_KEY are not set. Nothing was deleted."
    );
  }

  const foodDb = createClient(url, key, { auth: NO_SESSION });

  // Case-insensitive lookup. "%" and "_" are escaped so they are matched
  // literally (an "_" in an email must not act as a wildcard).
  const pattern = email.replace(/[\\%_]/g, (c) => `\\${c}`);

  const { data: candidates, error: findError } = await foodDb
    .from("developer_users")
    .select("email")
    .ilike("email", pattern);

  if (findError) {
    throw new DeveloperAccessError(
      500,
      `Developer access could not be checked: ${findError.message}. Nothing was deleted.`
    );
  }

  // Keep only exact matches after normalising both sides.
  const matches = (candidates ?? []).filter(
    (row: { email: unknown }) =>
      typeof row.email === "string" && row.email.trim().toLowerCase() === email
  );

  if (matches.length === 0) {
    throw new DeveloperAccessError(
      404,
      `No developer with the email ${email} was found in the food database, so developer access was not removed and your account was NOT deleted. Choose "Keep developer access" to delete only your customer account.`
    );
  }

  // Delete exactly the matching row(s), by their stored email value.
  for (const storedEmail of new Set(matches.map((row: { email: string }) => row.email))) {
    const { error: deleteError } = await foodDb
      .from("developer_users")
      .delete()
      .eq("email", storedEmail);

    if (deleteError) {
      throw new DeveloperAccessError(
        500,
        `Developer access could not be removed: ${deleteError.message}. Your account was NOT deleted.`
      );
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed." });
  }

  try {
    // Provided automatically by Supabase for the project this function is
    // deployed to (it must be the USER / customer project).
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? serviceKey;

    if (!url || !serviceKey) {
      return json(500, {
        ok: false,
        error:
          "Server setup error: the SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY secrets are missing for delete-account.",
      });
    }

    if (!isServiceRoleKey(serviceKey)) {
      return json(500, {
        ok: false,
        error:
          "Server setup error: SUPABASE_SERVICE_ROLE_KEY is not a service-role (secret) key, so delete-account cannot remove data.",
      });
    }

    // Who is calling? Only their own account can be deleted.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    // verify_jwt is off for this function (supabase/config.toml), so the
    // login token is verified here.
    if (!token) {
      return json(401, {
        ok: false,
        error: "No login session was sent. Please log in again and retry.",
      });
    }

    // 1. User-auth client: carries the caller's token and is used ONLY to
    //    verify the signed-in user. Nothing is deleted with it.
    const userAuth = createClient(url, anonKey!, {
      auth: NO_SESSION,
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: auth, error: authError } = await userAuth.auth.getUser(token);

    if (authError || !auth?.user) {
      return json(401, {
        ok: false,
        error:
          "Your login session is invalid or expired. Please log in again and retry.",
      });
    }

    const user = auth.user;

    // 2. Service-role admin client: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
    //    only. The caller's Authorization header is deliberately NOT
    //    attached, so every request runs as service_role.
    const admin = createClient(url, serviceKey, { auth: NO_SESSION });

    let removeDeveloperAccess = false;

    try {
      const body = await req.json();
      removeDeveloperAccess = body?.remove_developer_access === true;
    } catch {
      // No body: a normal account deletion.
    }

    // Food database step (only when explicitly requested; default keeps
    // developer access). Done FIRST: if the developer email is not found
    // or anything fails, the customer account is NOT deleted.
    let developerAccess: "kept" | "removed" = "kept";

    if (removeDeveloperAccess) {
      try {
        await removeFoodDeveloperAccess(user.email);
        developerAccess = "removed";
      } catch (error) {
        if (error instanceof DeveloperAccessError) {
          return json(error.status, { ok: false, error: error.message });
        }
        throw error;
      }
    }

    // Customer database: the caller's own data only, all with the
    // service-role admin client and filtered by the verified user.id.
    // (Approved products in the food database are never touched.)
    await removeUserFiles(admin, "avoid-products", user.id);
    await removeUserFiles(admin, "product-submissions", user.id);

    await deleteRows(admin, "avoid_list", "user_id", user.id);
    // product_submissions stores the owner in "submitted_by".
    await deleteRows(admin, "product_submissions", "submitted_by", user.id);
    await deleteRows(admin, "user_preferences", "user_id", user.id);
    await deleteRows(admin, "admin_users", "user_id", user.id);

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      return json(500, {
        ok: false,
        error: `Your data was removed, but the login could not be deleted: ${deleteError.message}`,
      });
    }

    return json(200, {
      ok: true,
      message: "Account deleted.",
      developer_access: developerAccess,
    });
  } catch (error) {
    console.error("delete-account failed:", error);
    return json(500, {
      ok: false,
      error:
        error instanceof Error ? error.message : "Something went wrong. Please try again.",
    });
  }
});
