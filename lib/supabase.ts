// ---------------------------------------------------------------------------
// lib/supabase.ts
// Client for the USER Supabase database: accounts, user_preferences,
// avoid_list, product_submissions and their Storage buckets.
// (Approved products live in a separate database; see productSupabase.ts.)
//
// Security: only the publishable key is bundled with the app. Every table
// is protected by Row Level Security, so each user can read and write only
// their own rows. Service-role keys are NEVER used in the app; they exist
// only as Edge Function secrets on the server.
// ---------------------------------------------------------------------------

import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL or publishable key is missing.");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Native apps persist the session in AsyncStorage; the web build uses
    // the browser's localStorage (Supabase's default).
    ...(Platform.OS !== "web" ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    // Password-reset links are handled manually in ResetPasswordScreen.
    detectSessionInUrl: false,
  },
});
