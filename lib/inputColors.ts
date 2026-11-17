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

// Input tokens of the theme system (re-exported by lib/theme.tsx and used
// by components/Themed.tsx → TextInput for EVERY text field).
// light: undefined = keep the screen's own colour (light theme unchanged).
export type InputTokens = {
  surface?: string; // field background
  disabledSurface?: string; // read-only field background
  border?: string; // neutral border
  focusBorder: string; // border while typing
  text?: string; // typed text and password dots
  disabledText?: string;
  placeholder: string; // dim hint text
  cursor: string; // caret
  selection: string; // selected-text highlight
  selectionText: string; // selected text colour
};

export const INPUT_TOKENS: { light: InputTokens; dark: InputTokens } = {
  light: {
    focusBorder: "#176B43",
    placeholder: LIGHT_PLACEHOLDER,
    cursor: "#176B43",
    selection: "rgba(23, 107, 67, 0.22)",
    selectionText: "#0E2A1C",
  },
  dark: {
    // A dark inset surface, visibly different from the dark cards
    // (#262D29) and page (#1A221D), with a clearly visible border.
    surface: "#141C18",
    disabledSurface: "#1E2622",
    border: "#5A6B61",
    focusBorder: "#5CC08A",
    text: DARK_INPUT_TEXT,
    disabledText: "#A3B0A8",
    placeholder: DARK_PLACEHOLDER,
    cursor: "#7FD6A5",
    selection: "rgba(92, 192, 138, 0.45)",
    selectionText: "#FFFFFF",
  },
};

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
