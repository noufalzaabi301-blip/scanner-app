// ---------------------------------------------------------------------------
// lib/productLookup.ts
// Controls the product lookup order:
// approved LabelLens database first,
// Open Food Facts second,
// package photos as the final fallback.
// ---------------------------------------------------------------------------

// Product structure used by HomeScreen.
export type ProductInfo = {
  barcode: string;
  productName: string;
  brandName: string;
  variant: string;
  ingredients: string;
  contains: string;
  mayContain: string;
  source: string;
  imageUrl: string | null;
};

// Possible result returned by a provider.
export type ProviderResult =
  | {
      kind: "found";
      product: ProductInfo;
    }
  | {
      kind: "incomplete";
      product: ProductInfo;
    }
  | {
      kind: "notfound";
    }
  | {
      kind: "unavailable";
      message?: string;
    };

// Provider interface used by the lookup function.
export type ProductProvider = {
  lookup: (barcode: string) => Promise<ProviderResult>;
};

// Providers used by HomeScreen.
export type ProductProviders = {
  internal: ProductProvider;
  external: ProductProvider;
};

// Result returned to HomeScreen.
export type LookupResult =
  | {
      kind: "found";
      product: ProductInfo;
    }
  | {
      kind: "incomplete";
      product: ProductInfo;
    }
  | {
      kind: "notfound";
    }
  | {
      kind: "unavailable";
    };

// Stops a request from running forever.
export function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("The request timed out."));
    }, milliseconds);

    promise
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

// Searches the approved internal database first,
// then Open Food Facts.
export async function lookupProduct(
  barcode: string,
  providers: ProductProviders,
  options?: {
    onStep?: (message: string) => void;
    isCancelled?: () => boolean;
  }
): Promise<LookupResult> {
  // Stop if the user cancelled the scan.
  if (options?.isCancelled?.()) {
    return { kind: "notfound" };
  }

  try {
    // Search the approved LabelLens product database first.
    options?.onStep?.(
      "Checking LabelLens database..."
    );

    const internalResult = await withTimeout(
      providers.internal.lookup(barcode),
      15000
    );

    if (options?.isCancelled?.()) {
      return { kind: "notfound" };
    }

    // Return an approved internal product immediately.
    if (internalResult.kind === "found") {
      return {
        kind: "found",
        product: internalResult.product,
      };
    }

    // An incomplete internal product still continues
    // to Open Food Facts for additional information.
    options?.onStep?.(
      "Checking Open Food Facts..."
    );
  } catch (error) {
    // If the internal database is unavailable,
    // continue to the external provider.
    console.warn(
      "LabelLens database lookup failed:",
      error
    );

    options?.onStep?.(
      "Checking Open Food Facts..."
    );
  }

  if (options?.isCancelled?.()) {
    return { kind: "notfound" };
  }

  try {
    // Search Open Food Facts as the fallback provider.
    const externalResult = await withTimeout(
      providers.external.lookup(barcode),
      15000
    );

    if (options?.isCancelled?.()) {
      return { kind: "notfound" };
    }

    if (externalResult.kind === "found") {
      return {
        kind: "found",
        product: externalResult.product,
      };
    }

    if (externalResult.kind === "incomplete") {
      return {
        kind: "incomplete",
        product: externalResult.product,
      };
    }

    if (externalResult.kind === "unavailable") {
      return { kind: "unavailable" };
    }

    return { kind: "notfound" };
  } catch (error) {
    // The HomeScreen will continue to the photo fallback.
    console.warn(
      "Open Food Facts lookup failed:",
      error
    );

    return { kind: "unavailable" };
  }
}