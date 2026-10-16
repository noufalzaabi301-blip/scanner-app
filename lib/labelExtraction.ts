// Supabase client used to read the signed-in session.
import { supabase } from "./supabase";

// Structured information returned by the AI.
export type LabelExtraction = {
  brand: string;
  product_name: string;
  variant: string;
  ingredients: string;
  contains: string;
  may_contain: string;
  unclear_text: string;
  confidence: "high" | "medium" | "low";
};

// Converts a local phone image URI into a real Blob.
async function uriToBlob(uri: string) {
  // Read the local image through the device file system.
  const response = await fetch(uri);

  // Stop if the local image cannot be read.
  if (!response.ok) {
    throw new Error(
      "The captured image could not be read."
    );
  }

  // Convert the image into a Blob supported by FormData.
  return response.blob();
}

// Sends both package photos to the AI Edge Function.
export async function extractLabelFromPhotos(
  frontPhotoUri: string,
  ingredientsPhotoUri: string
): Promise<LabelExtraction> {
  // Read the current login session.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // The Edge Function requires authentication.
  if (!session?.access_token) {
    throw new Error(
      "Your login session expired. Please log in again."
    );
  }

  // Read the Supabase project environment values.
  const supabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.EXPO_PUBLIC_SUPABASE_KEY;

  // Stop if the environment variables are missing.
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase environment variables are missing."
    );
  }

  // Convert both local images into supported Blobs.
  const frontBlob = await uriToBlob(
    frontPhotoUri
  );

  const ingredientsBlob = await uriToBlob(
    ingredientsPhotoUri
  );

  // Create the multipart request body.
  const formData = new FormData();

  // Add the front-package Blob.
  formData.append(
    "frontPhoto",
    frontBlob,
    "front-package.jpg"
  );

  // Add the ingredients-panel Blob.
  formData.append(
    "ingredientPhoto",
    ingredientsBlob,
    "ingredient-panel.jpg"
  );

  // Create a request timeout.
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 90000);

  try {
    // Call the deployed Supabase Edge Function.
    const response = await fetch(
      `${supabaseUrl}/functions/v1/extract-label`,
      {
        method: "POST",

        // The API key identifies the Supabase project.
        // The access token identifies the logged-in user.
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${session.access_token}`,
        },

        // Send the Blob-based multipart form.
        body: formData,

        // Stop if the server takes too long.
        signal: controller.signal,
      }
    );

    // Read the response body.
    const responseText = await response.text();

    // Convert the response to JSON.
    let responseData: any;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      throw new Error(
        `The server returned invalid data: ${responseText}`
      );
    }

    // Display the actual Edge Function error.
    if (!response.ok) {
      throw new Error(
        responseData?.error ||
          `Extraction failed with status ${response.status}.`
      );
    }

    // Confirm that extraction data exists.
    if (!responseData?.extraction) {
      throw new Error(
        "The AI returned no extraction data."
      );
    }

    // Return the structured extraction.
    return responseData.extraction as LabelExtraction;
  } catch (error) {
    // Display a clear timeout message.
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new Error(
        "The AI request timed out after 90 seconds."
      );
    }

    // Pass the real error back to HomeScreen.
    throw error;
  } finally {
    // Always clear the timeout.
    clearTimeout(timeoutId);
  }
}