// ---------------------------------------------------------------------------
// lib/inputColors.ts
// Text-input colours for the light and dark theme (pure, unit-tested in
// scripts/testPasswordFields.ts; used by components/Themed.tsx).
//
// Dark theme: typed text and password dots are near-white (clearly
// visible); placeholder text is a muted grey (clearly "empty"). Before, a
// light-grey "••••" placeholder looked brighter than real typed dots.
// ---------------------------------------------------------------------------

export const DARK_INPUT_TEXT = "#F1F6F3";
export const DARK_PLACEHOLDER = "#7C8A83";
export const LIGHT_PLACEHOLDER = "#8A9A91";

export function inputColors(
  isDark: boolean,
  placeholderTextColor?: string
): { text?: string; placeholder: string } {
  if (isDark) {
    return { text: DARK_INPUT_TEXT, placeholder: DARK_PLACEHOLDER };
  }

  // Light theme: the screen's own text colour; its placeholder colour.
  return { placeholder: placeholderTextColor ?? LIGHT_PLACEHOLDER };
}

// WCAG relative luminance (0 = black, 1 = white), used by the tests.
export function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((index) => {
    const c = parseInt(value.slice(index, index + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
