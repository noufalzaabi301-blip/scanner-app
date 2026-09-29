import { createClient } from "@supabase/supabase-js";

const productSupabaseUrl =
  process.env.EXPO_PUBLIC_PRODUCT_SUPABASE_URL;

const productSupabaseKey =
  process.env.EXPO_PUBLIC_PRODUCT_SUPABASE_KEY;

if (!productSupabaseUrl || !productSupabaseKey) {
  throw new Error(
    "Product Supabase URL or publishable key is missing."
  );
}

export const productSupabase = createClient(
  productSupabaseUrl,
  productSupabaseKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);