// ---------------------------------------------------------------------------
// lib/productProviders.ts
// Connects the barcode lookup system to:
// 1. The approved LabelLens product database.
// 2. Open Food Facts as the fallback provider.
// ---------------------------------------------------------------------------

import { Platform } from "react-native";

import { fetchApprovedProduct } from "./productSupabase";
import {
  type ProductInfo,
  type ProductProvider,
  type ProviderResult,
} from "./productLookup";

// Converts database or API values into safe trimmed text.
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// A product has usable information when its ingredient list is available.
function hasIngredients(product: ProductInfo): boolean {
  return product.ingredients.trim().length > 0;
}

// Converts a product into the correct provider result.
function toResult(product: ProductInfo): ProviderResult {
  if (hasIngredients(product)) {
    return {
      kind: "found",
      product,
    };
  }

  return {
    kind: "incomplete",
    product,
  };
}

// ---------------------------------------------------------------------------
// APPROVED LABELหLENS PRODUCT DATABASE
// ---------------------------------------------------------------------------

export const internalProvider: ProductProvider = {
  async lookup(barcode: string): Promise<ProviderResult> {
    // The product database function already checks:
    // - The exact barcode first.
    // - The allowed UPC/EAN equivalent.
    // - verification_status = "approved".
    const row = await fetchApprovedProduct(barcode);

    // No approved product was found.
    if (!row) {
      return {
        kind: "notfound",
      };
    }

    // Map the actual products-table column names to ProductInfo.
    return toResult({
      barcode: row.barcode,
      productName: text(row.product_name),
      brandName: text(row.brand_name),
      variant: "",
      ingredients: text(row.ingredients_text),
      contains: text(row.allergen_text),
      mayContain: "",
      source: "LabelLens verified product database",
      imageUrl: null,
    });
  },
};

// ---------------------------------------------------------------------------
// OPEN FOOD FACTS FALLBACK
// ---------------------------------------------------------------------------

// Only request the fields used by the application.
const OPEN_FOOD_FACTS_FIELDS = [
  "product_name",
  "product_name_en",
  "brands",
  "quantity",
  "ingredients_text",
  "ingredients_text_en",
  "allergens_tags",
  "traces_tags",
  "image_front_url",
  "image_url",
].join(",");

// Converts Open Food Facts tags such as "en:tree-nuts"
// into readable text such as "Tree nuts".
function tagsToText(tags: unknown): string {
  if (!Array.isArray(tags)) {
    return "";
  }

  return tags
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) =>
      tag
        .replace(/^[a-z]{2}:/, "")
        .replace(/-/g, " ")
        .trim()
    )
    .filter(Boolean)
    .map(
      (tag) =>
        tag.charAt(0).toUpperCase() + tag.slice(1)
    )
    .join(", ");
}

// Requests one barcode from Open Food Facts.
async function fetchOpenFoodFactsProduct(
  barcode: string
): Promise<ProviderResult> {
  const controller = new AbortController();

  // Prevent the request from waiting forever.
  const timeout = setTimeout(() => {
    controller.abort();
  }, 10000);

  try {
    const url =
      `https://world.openfoodfacts.org/api/v2/product/` +
      `${encodeURIComponent(barcode)}.json?fields=` +
      `${encodeURIComponent(OPEN_FOOD_FACTS_FIELDS)}`;

    const response = await fetch(url, {
      headers:
        Platform.OS === "web"
          ? {
              Accept: "application/json",
            }
          : {
              Accept: "application/json",
              "User-Agent": "LabelLens/1.0",
            },
      signal: controller.signal,
    });

    // A 404 means that Open Food Facts does not contain this product.
    if (response.status === 404) {
      return {
        kind: "notfound",
      };
    }

    // Any other failed response means the provider is unavailable.
    if (!response.ok) {
      return {
        kind: "unavailable",
        message: `Open Food Facts returned HTTP ${response.status}.`,
      };
    }

    const json = (await response.json()) as {
      status?: number;
      product?: Record<string, unknown>;
    };

    // Open Food Facts uses status = 1 when a product exists.
    if (json.status !== 1 || !json.product) {
      return {
        kind: "notfound",
      };
    }

    const product = json.product;

    // Prefer English fields when available.
    const productName =
      text(product.product_name_en) ||
      text(product.product_name);

    const ingredients =
      text(product.ingredients_text_en) ||
      text(product.ingredients_text);

    const brandName =
      text(product.brands)
        .split(",")[0]
        ?.trim() ?? "";

    const mappedProduct: ProductInfo = {
      barcode,
      productName,
      brandName,
      variant: text(product.quantity),
      ingredients,
      contains: tagsToText(product.allergens_tags),
      mayContain: tagsToText(product.traces_tags),
      source:
        "Open Food Facts — verify against the physical package.",
      imageUrl:
        text(product.image_front_url) ||
        text(product.image_url) ||
        null,
    };

    return toResult(mappedProduct);
  } catch (error) {
    // AbortError and network failures are both treated as unavailable.
    console.warn("Open Food Facts request failed:", error);

    return {
      kind: "unavailable",
      message: "Open Food Facts could not be reached.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

// Open Food Facts provider used by productLookup.ts.
export const openFoodFactsProvider: ProductProvider = {
  async lookup(barcode: string): Promise<ProviderResult> {
    return fetchOpenFoodFactsProduct(barcode);
  },
};