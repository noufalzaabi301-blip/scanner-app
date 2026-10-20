// ---------------------------------------------------------------------------
// lib/barcode.ts
// Cleans and validates scanned or manually entered food barcodes.
// ---------------------------------------------------------------------------

// Only these barcode lengths match the products table.
const VALID_BARCODE_LENGTHS = [8, 12, 13, 14];

// Removes spaces and non-numeric characters.
export function cleanBarcode(
  raw: string | null | undefined
): string {
  return String(raw ?? "").replace(/\D/g, "");
}

// Validates the standard GTIN check digit.
function hasValidCheckDigit(code: string): boolean {
  const digits = code.split("").map(Number);

  // Remove the final check digit.
  const checkDigit = digits.pop();

  if (checkDigit === undefined) {
    return false;
  }

  let sum = 0;

  // GTIN weights alternate 3 and 1 from the right.
  digits.reverse().forEach((digit, index) => {
    sum += digit * (index % 2 === 0 ? 3 : 1);
  });

  const calculatedCheckDigit =
    (10 - (sum % 10)) % 10;

  return calculatedCheckDigit === checkDigit;
}

// Checks whether the barcode is supported and valid.
export function isValidBarcode(
  rawCode: string | null | undefined
): boolean {
  // Clean the value before validation.
  const code = cleanBarcode(rawCode);

  // Reject unsupported lengths.
  if (!VALID_BARCODE_LENGTHS.includes(code.length)) {
    return false;
  }

  // EAN-8 may also represent UPC-E-style scanner output.
  // Keep the existing compatibility behavior for 8-digit codes.
  if (code.length === 8) {
    return true;
  }

  // Validate the check digit for UPC-A, EAN-13, and GTIN-14.
  return hasValidCheckDigit(code);
}