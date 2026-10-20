// ---------------------------------------------------------------------------
// lib/labelExtraction.ts
// Sends the front-package and ingredient-label photos to the Supabase
// Edge Function that performs AI extraction.
// ---------------------------------------------------------------------------

import { Platform } from "react-native";

import { supabase } from "./supabase";

// Name of the deployed Supabase Edge Function.
const FUNCTION_NAME = "extract-label";

// AI confidence levels.
export type ExtractionConfidence =
  | "high"
  | "medium"
  | "low";

// Structured result returned to HomeScreen.
export type LabelExtraction = {
  product_name: string;
  brand: string;
  variant: string;
  ingredients: string;
  contains: string;
  may_contain: string;
  unclear_text: string[];
  confidence: ExtractionConfidence;
};

// Converts unknown values into safe text.
function text(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

// Creates a photo part that works on Android, iOS, and web.
async function createPhotoPart(
  uri: string,
  name: string
): Promise<Blob | { uri: string; name: string; type: string }> {
  // Web needs a real Blob or File object.
  if (Platform.OS === "web") {
    const response = await fetch(uri);

    if (!response.ok) {
      throw new Error(
        "The photo could not be read on the web."
      );
    }

    const blob = await response.blob();

    // Convert the web blob into a File with a reliable MIME type.
    return new File(
      [blob],
      name,
      {
        type: blob.type || "image/jpeg",
      }
    );
  }

  // Android and iOS accept this React Native file format.
  return {
    uri,
    name,
    type: "image/jpeg",
  };
}

// Converts the AI response into the format used by the app.
function normalizeExtraction(
  raw: unknown
): LabelExtraction {
  const value = (raw ?? {}) as Record<
    string,
    unknown
  >;

  const unclear: string[] = Array.isArray(
    value.unclear_text
  )
    ? value.unclear_text
        .filter(
          (item): item is string =>
            typeof item === "string"
        )
        .map((item) => item.trim())
        .filter(Boolean)
    : text(value.unclear_text)
        .split(/[,;\n]+/)
        .map((item) => item.trim())
        .filter(Boolean);

  const confidence: ExtractionConfidence =
    value.confidence === "high" ||
    value.confidence === "medium" ||
    value.confidence === "low"
      ? value.confidence
      : "low";

  return {
    product_name: text(value.product_name),
    brand: text(value.brand),
    variant: text(value.variant),
    ingredients: text(value.ingredients),
    contains: text(value.contains),
    may_contain: text(value.may_contain),
    unclear_text: unclear,
    confidence,
  };
}

// Sends both photos to the Supabase Edge Function.
export async function extractLabelFromPhotos(
  frontPhotoUri: string,
  ingredientsPhotoUri: string
): Promise<LabelExtraction> {
  const supabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.EXPO_PUBLIC_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "The app is not configured for photo analysis."
    );
  }

  if (!frontPhotoUri) {
    throw new Error(
      "A valid front package photo is required."
    );
  }

  if (!ingredientsPhotoUri) {
    throw new Error(
      "The ingredient label photo could not be read."
    );
  }

  // Get the current signed-in user's session.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // The Edge Function requires a valid user session.
  if (!session?.access_token) {
    throw new Error(
      "Your login session expired. Please log in again."
    );
  }

  // Convert each photo into the correct platform-specific upload part.
  let frontPhotoPart:
    | Blob
    | { uri: string; name: string; type: string };

  let ingredientPhotoPart:
    | Blob
    | { uri: string; name: string; type: string };

  try {
    frontPhotoPart = await createPhotoPart(
      frontPhotoUri,
      "front.jpg"
    );

    ingredientPhotoPart = await createPhotoPart(
      ingredientsPhotoUri,
      "ingredients.jpg"
    );
  } catch (error) {
    console.warn(
      "Could not prepare photos:",
      error
    );

    throw new Error(
      "The photos could not be prepared for analysis."
    );
  }

  // Create multipart form data.
  const formData = new FormData();

  // These names must match the Edge Function.
  formData.append(
    "frontPhoto",
    frontPhotoPart as any
  );

  formData.append(
    "ingredientPhoto",
    ingredientPhotoPart as any
  );

  // Send the photos to Supabase.
  // Do not manually set Content-Type because fetch creates
  // the multipart boundary automatically.
  const response = await fetch(
    `${supabaseUrl}/functions/v1/${FUNCTION_NAME}`,
    {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    }
  );

  // Read the server response.
  let responseBody: any = null;

  try {
    responseBody = await response.json();
  } catch {
    responseBody = null;
  }

  // Convert server errors into readable messages.
  if (!response.ok) {
    const serverError = text(
      responseBody?.error
    ).toLowerCase();

    if (
      serverError.includes("ingredient")
    ) {
      throw new Error(
        "The ingredient label could not be read."
      );
    }

    if (
      serverError.includes("front") ||
      serverError.includes("package")
    ) {
      throw new Error(
        "A valid front package photo is required."
      );
    }

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      throw new Error(
        "Your login session expired. Please log in again."
      );
    }

    if (
      response.status === 500 ||
      response.status === 502
    ) {
      throw new Error(
        "The AI analysis service is temporarily unavailable."
      );
    }

    throw new Error(
      text(responseBody?.error) ||
        "Network error while analyzing the photos."
    );
  }

  // The Edge Function returns:
  // { user_id, extraction, requires_user_confirmation }
  const extraction =
    responseBody?.extraction ||
    responseBody?.data?.extraction ||
    responseBody?.data ||
    responseBody;

  // Ensure the AI actually returned useful information.
  if (
    !extraction ||
    typeof extraction !== "object"
  ) {
    throw new Error(
      "The AI returned no extraction result."
    );
  }

  return normalizeExtraction(extraction);
}