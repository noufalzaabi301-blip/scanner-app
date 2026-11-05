// ---------------------------------------------------------------------------
// lib/text.ts
// Small shared text helper. AI, Open Food Facts and database fields can be
// missing or not strings, so every reader goes through asText().
// ---------------------------------------------------------------------------

export function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Open Food Facts style tags ("en:milk, en:tree-nuts") → "Milk, Tree nuts".
// Some products in the food database were imported with raw tags, so this
// is applied when reading AND when displaying older saved items.
export function cleanTagText(value: unknown): string {
  const raw = asText(value);

  if (!/\b[a-z]{2}:[a-z]/i.test(raw)) {
    return raw;
  }

  return raw
    .split(/\s*,\s*/)
    .map((item) => item.replace(/^[a-z]{2}:/i, "").replace(/-/g, " ").trim())
    .filter(Boolean)
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(", ");
}
