// ---------------------------------------------------------------------------
// lib/productSupabase.ts
// Read-only client for the separate FOOD (approved products) database.
//
// Why two Supabase projects?
// - The USER database (lib/supabase.ts) holds personal data: accounts,
//   preferences, the Avoid List and product submissions.
// - The FOOD database holds only verified product data that every user can
//   read. Keeping it separate means no user session or personal data is
//   ever sent to it, and users can never write to it: new products only
//   arrive through the admin-approved Edge Function, which holds the food
//   database's service-role key on the server.
// The app only ever uses the publishable (anon) key here.
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js";

import { barcodeVariants } from "./barcode";

const productSupabaseUrl = process.env.EXPO_PUBLIC_PRODUCT_SUPABASE_URL;
const productSupabaseKey = process.env.EXPO_PUBLIC_PRODUCT_SUPABASE_KEY;

if (!productSupabaseUrl || !productSupabaseKey) {
  throw new Error("Product Supabase URL or publishable key is missing.");
}

// Not exported on purpose: the only thing app code can do with the food
// database is fetchApprovedProduct() below (a SELECT). Approvals go through
// the approve-product-submission Edge Function. The database itself also
// blocks INSERT / UPDATE / DELETE for anon and authenticated clients
// (supabase/sql/food_database_read_only.sql).
const productSupabase = createClient(
  productSupabaseUrl,
  productSupabaseKey,
  {
    auth: {
      // Product lookup is anonymous: no user session is stored or sent.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

export type ApprovedProductRow = {
  barcode: string;
  product_name: string | null;
  brand_name: string | null;
  ingredients_text: string | null;
  allergen_text: string | null;
  verification_status: string;
  // Optional photo columns: used when the products table has one of them.
  image_url?: string | null;
  image_front_url?: string | null;
  front_photo_url?: string | null;
};

// "*" so an optional photo column (image_url, …) is returned when it
// exists, without breaking tables that do not have one.
const COLUMNS = "*";

// Fetches only APPROVED products: exact barcode first, then the permitted
// UPC/EAN equivalent.
export async function fetchApprovedProduct(
  barcode: string
): Promise<ApprovedProductRow | null> {
  const exactResult = await productSupabase
    .from("products")
    .select(COLUMNS)
    .eq("barcode", barcode)
    .eq("verification_status", "approved")
    .limit(1);

  if (exactResult.error) {
    throw new Error(exactResult.error.message);
  }

  if (exactResult.data?.[0]) {
    return exactResult.data[0] as ApprovedProductRow;
  }

  const alternatives = barcodeVariants(barcode).filter(
    (candidate) => candidate !== barcode
  );

  if (alternatives.length === 0) {
    return null;
  }

  const equivalentResult = await productSupabase
    .from("products")
    .select(COLUMNS)
    .in("barcode", alternatives)
    .eq("verification_status", "approved")
    .limit(1);

  if (equivalentResult.error) {
    throw new Error(equivalentResult.error.message);
  }

  return (equivalentResult.data?.[0] as ApprovedProductRow) ?? null;
}
