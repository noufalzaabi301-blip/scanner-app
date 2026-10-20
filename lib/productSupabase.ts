// ---------------------------------------------------------------------------
// lib/productSupabase.ts
// Connects to the separate product Supabase database.
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js";

// Read the product database URL.
const productSupabaseUrl =
  process.env.EXPO_PUBLIC_PRODUCT_SUPABASE_URL;

// Read the product database publishable key.
const productSupabaseKey =
  process.env.EXPO_PUBLIC_PRODUCT_SUPABASE_KEY;

// Stop the app if the product database configuration is missing.
if (!productSupabaseUrl || !productSupabaseKey) {
  throw new Error(
    "Product Supabase URL or publishable key is missing."
  );
}

// Create the separate product database client.
export const productSupabase = createClient(
  productSupabaseUrl,
  productSupabaseKey,
  {
    auth: {
      // Product lookup does not use user sessions.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

// Columns that actually exist in your products table.
export type ApprovedProductRow = {
  barcode: string;
  product_name: string | null;
  brand_name: string | null;
  ingredients_text: string | null;
  allergen_text: string | null;
  verification_status: string;
};

// Creates only the permitted UPC/EAN alternatives.
function barcodeCandidates(barcode: string): string[] {
  const candidates = [barcode];

  // A 12-digit UPC-A may also be stored as a 13-digit EAN with zero.
  if (barcode.length === 12) {
    candidates.push(`0${barcode}`);
  }

  // A 13-digit EAN beginning with zero may also be checked without it.
  if (barcode.length === 13 && barcode.startsWith("0")) {
    candidates.push(barcode.slice(1));
  }

  // Remove duplicates without changing barcode digits.
  return [...new Set(candidates)];
}

// Fetches only approved products from the product database.
export async function fetchApprovedProduct(
  barcode: string
): Promise<ApprovedProductRow | null> {
  const columns =
    "barcode, product_name, brand_name, ingredients_text, allergen_text, verification_status";

  // First check the exact barcode.
  const exactResult = await productSupabase
    .from("products")
    .select(columns)
    .eq("barcode", barcode)
    .eq("verification_status", "approved")
    .limit(1);

  if (exactResult.error) {
    throw new Error(exactResult.error.message);
  }

  if (exactResult.data?.[0]) {
    return exactResult.data[0] as ApprovedProductRow;
  }

  // Then check only the permitted UPC/EAN equivalent.
  const alternatives = barcodeCandidates(barcode).filter(
    (candidate) => candidate !== barcode
  );

  if (alternatives.length === 0) {
    return null;
  }

  const equivalentResult = await productSupabase
    .from("products")
    .select(columns)
    .in("barcode", alternatives)
    .eq("verification_status", "approved")
    .limit(1);

  if (equivalentResult.error) {
    throw new Error(equivalentResult.error.message);
  }

  return (
    (equivalentResult.data?.[0] as ApprovedProductRow) ??
    null
  );
}