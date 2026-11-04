// ---------------------------------------------------------------------------
// lib/productProviders.ts
// Connects the barcode lookup system to:
// 1. The approved LabelLens product database.
// 2. Open Food Facts (API v3) as the fallback provider.
//
// Open Food Facts data is community-edited and NOT verified. A product is
// only returned as "found" when its name, brand and ingredients look usable;
// otherwise it is returned as "incomplete" so HomeScreen asks for package
// photos. Open Food Facts records are never written to the approved table.
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
// APPROVED LABELLENS PRODUCT DATABASE (unchanged)
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
// OPEN FOOD FACTS FALLBACK (API v3)
// ---------------------------------------------------------------------------

const OPEN_FOOD_FACTS_SOURCE = "Open Food Facts — not verified";

// Only request the fields used by the application.
// Both the plain and the "_tags" names of the data-quality fields are
// requested, so whichever Open Food Facts returns is available.
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
  "completeness",
  "data_quality_tags",
  "data_quality_errors",
  "data_quality_warnings",
  "data_quality_errors_tags",
  "data_quality_warnings_tags",
  "last_modified_t",
].join(",");

// Products below this completeness score (0–1) are treated as suspicious.
// Completeness also counts nutrition and photos, so this is kept low.
const MIN_COMPLETENESS = 0.2;

// Values that mean "nothing useful was entered".
const PLACEHOLDER_TEXT =
  /^(unknown|n\/?a|none|null|undefined|test|tbd|todo|x+|-+|\?+|\.+|0+|no name|sans nom|inconnu|desconocido|غير معروف)$/i;

// Data-quality errors that affect names, ingredients or allergens.
const RELEVANT_QUALITY_ERROR = /ingredient|allergen|trace|product-name|brand/;

// Tags such as "en:ingredients-80-percent-unknown".
const UNKNOWN_INGREDIENTS_TAG = /ingredients-(\d+)-percent-unknown/;

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

// Reads a data-quality field that may be an array or a comma-separated string.
function toTagList(value: unknown): string[] {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
    ? value.split(",")
    : [];

  return items
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

// True when a name or brand is obviously not real text.
function isUnusableText(value: string): boolean {
  const cleaned = value.replace(/\s+/g, " ").trim();

  if (cleaned.length < 2) {
    return true;
  }

  if (PLACEHOLDER_TEXT.test(cleaned)) {
    return true;
  }

  // Must contain at least one letter (rejects barcodes and numbers only).
  if (!/\p{L}/u.test(cleaned)) {
    return true;
  }

  // Broken characters from a bad import.
  if (cleaned.includes("\uFFFD")) {
    return true;
  }

  // Mostly symbols or digits.
  const letters = (cleaned.match(/\p{L}/gu) ?? []).length;

  return letters / cleaned.length < 0.4;
}

// True when the ingredient list is missing or obviously unusable.
function ingredientsUnusable(value: string): boolean {
  // Ignore a leading "Ingredients:" label when checking.
  const body = value
    .replace(
      /^\s*(ingredients?|ingr[ée]dients?|zutaten|ingredientes|ingredienti|المكونات)\s*[:：\-]?\s*/i,
      ""
    )
    .trim();

  if (body.length < 3 || isUnusableText(body)) {
    return true;
  }

  // Placeholders left by unreadable label text.
  return /\?{2,}|_{3,}|\*{3,}/.test(body);
}

// Returns the reasons an Open Food Facts product cannot be trusted as complete.
// An empty list means the product is usable (but still not verified).
function validateOpenFoodFactsProduct(
  mapped: ProductInfo,
  raw: Record<string, unknown>
): string[] {
  const reasons: string[] = [];

  if (!mapped.productName) {
    reasons.push("missing product name");
  } else if (isUnusableText(mapped.productName)) {
    reasons.push("unusable product name");
  }

  if (!mapped.brandName) {
    reasons.push("missing brand");
  } else if (isUnusableText(mapped.brandName)) {
    reasons.push("unusable brand");
  }

  if (!mapped.ingredients) {
    reasons.push("missing ingredients");
  } else if (ingredientsUnusable(mapped.ingredients)) {
    reasons.push("unusable ingredients");
  }

  // Data-quality errors about names, ingredients or allergens.
  const errorTags = [
    ...toTagList(raw.data_quality_errors_tags),
    ...toTagList(raw.data_quality_errors),
  ];

  const otherTags = [
    ...toTagList(raw.data_quality_tags),
    ...toTagList(raw.data_quality_warnings_tags),
    ...toTagList(raw.data_quality_warnings),
  ];

  const relevantErrors = errorTags.filter((tag) =>
    RELEVANT_QUALITY_ERROR.test(tag)
  );

  if (relevantErrors.length > 0) {
    reasons.push(`data-quality errors: ${relevantErrors.join(", ")}`);
  }

  // Half or more of the ingredients were not recognised.
  for (const tag of [...errorTags, ...otherTags]) {
    const match = UNKNOWN_INGREDIENTS_TAG.exec(tag);

    if (match && Number(match[1]) >= 50) {
      reasons.push(`mostly unknown ingredients (${tag})`);
      break;
    }
  }

  // Very incomplete record.
  const completeness =
    typeof raw.completeness === "number"
      ? raw.completeness
      : Number(raw.completeness);

  if (Number.isFinite(completeness) && completeness < MIN_COMPLETENESS) {
    reasons.push(`low completeness (${completeness})`);
  }

  return reasons;
}

type OpenFoodFactsV3Response = {
  status?: string; // "success", "success_with_warnings", "success_with_errors", "failure"
  result?: { id?: string };
  errors?: Array<{ message?: { id?: string } }>;
  product?: Record<string, unknown>;
};

// True when a v3 "failure" response means the product does not exist.
function isProductNotFound(json: OpenFoodFactsV3Response): boolean {
  if (json.result?.id === "product_not_found") {
    return true;
  }

  return (json.errors ?? []).some(
    (error) => error?.message?.id === "product_not_found"
  );
}

// Requests one barcode from Open Food Facts API v3.
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
      `https://world.openfoodfacts.org/api/v3/product/` +
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

    const json = (await response.json()) as OpenFoodFactsV3Response;

    if (json.status === "failure") {
      if (isProductNotFound(json)) {
        return { kind: "notfound" };
      }

      return {
        kind: "unavailable",
        message: "Open Food Facts could not return this product.",
      };
    }

    if (!json.product) {
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
      // Never labelled as an approved LabelLens product.
      source: OPEN_FOOD_FACTS_SOURCE,
      imageUrl:
        text(product.image_front_url) ||
        text(product.image_url) ||
        null,
    };

    const problems = validateOpenFoodFactsProduct(mappedProduct, product);

    // Incomplete or suspicious: HomeScreen starts the package-photo fallback.
    if (problems.length > 0) {
      console.info(
        `Open Food Facts product ${barcode} treated as incomplete:`,
        problems.join("; ")
      );

      return {
        kind: "incomplete",
        product: mappedProduct,
      };
    }

    return {
      kind: "found",
      product: mappedProduct,
    };
  } catch (error: any) {
    // AbortError and network failures are both treated as unavailable.
    console.warn(
      "Open Food Facts request failed:",
      typeof error?.message === "string" ? error.message : "unknown error"
    );

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