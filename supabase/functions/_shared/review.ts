// ---------------------------------------------------------------------------
// supabase/functions/_shared/review.ts
// Shared helpers for the admin review Edge Functions.
// Service-role keys are read from Edge Function secrets only.
// ---------------------------------------------------------------------------

import {
  createClient,
  type SupabaseClient,
} from "jsr:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);

  if (!value) {
    throw new HttpError(500, `Server is missing the ${name} setting.`);
  }

  return value;
}

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
};

// User database (the project this function is deployed to).
export function userDbAdmin(): SupabaseClient {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    clientOptions
  );
}

// Separate food database.
export function foodDbAdmin(): SupabaseClient {
  return createClient(
    requireEnv("FOOD_SUPABASE_URL"),
    requireEnv("FOOD_SUPABASE_SERVICE_ROLE_KEY"),
    clientOptions
  );
}

// Returns the admin's user ID, or throws 401 / 403.
export async function requireAdmin(
  req: Request,
  userDb: SupabaseClient
): Promise<string> {
  const token = (req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    throw new HttpError(401, "Please log in.");
  }

  const { data, error } = await userDb.auth.getUser(token);

  if (error || !data?.user) {
    throw new HttpError(401, "Your login session expired. Please log in again.");
  }

  const { data: admin, error: adminError } = await userDb
    .from("admin_users")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (adminError) {
    throw new HttpError(500, "Admin access could not be checked.");
  }

  if (!admin) {
    throw new HttpError(403, "You are not allowed to review submissions.");
  }

  return data.user.id;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readRequest(
  req: Request
): Promise<{ id: string; notes: string }> {
  let body: any;

  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Invalid request body.");
  }

  const id =
    typeof body?.submission_id === "string" ? body.submission_id.trim() : "";

  if (!UUID_PATTERN.test(id)) {
    throw new HttpError(400, "A valid submission_id is required.");
  }

  const notes =
    typeof body?.review_notes === "string"
      ? body.review_notes.trim().slice(0, 1000)
      : "";

  return { id, notes };
}

// Explains why a submission could not be claimed.
export async function explainUnclaimable(
  userDb: SupabaseClient,
  id: string
): Promise<HttpError> {
  const { data } = await userDb
    .from("product_submissions")
    .select("verification_status")
    .eq("id", id)
    .maybeSingle();

  if (!data) {
    return new HttpError(404, "Submission not found.");
  }

  if (data.verification_status === "processing") {
    return new HttpError(409, "This submission is already being processed.");
  }

  return new HttpError(
    409,
    `This submission is already ${data.verification_status}.`
  );
}

export function text(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function cleanBarcode(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

// Exact barcode plus its UPC-A / EAN-13 (leading zero) equivalent.
export function barcodeVariants(barcode: string): string[] {
  const variants = new Set([barcode]);

  if (barcode.length === 12) {
    variants.add(`0${barcode}`);
  }

  if (barcode.length === 13 && barcode.startsWith("0")) {
    variants.add(barcode.slice(1));
  }

  return [...variants];
}

export function handleError(error: unknown): Response {
  if (error instanceof HttpError) {
    return json(error.status, { ok: false, error: error.message });
  }

  console.error("Review function failed:", error);
  return json(500, { ok: false, error: "Something went wrong. Please try again." });
}