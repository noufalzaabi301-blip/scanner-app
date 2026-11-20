// ---------------------------------------------------------------------------
// lib/formTokens.ts
// Explicit colour tokens for form controls (allergy editor, Yes/No answers,
// option lists, text fields, errors) in the light and dark theme.
//
// Why: the automatic dark-mode conversion in components/Themed.tsx turns
// light colours into dark ones by formula. That works for plain pages, but
// in the allergy editor it made the rows the same colour as the page, the
// borders almost invisible and the 🗑 emoji grey, so the editor "disappeared"
// in dark mode. Form controls now use these fixed tokens instead.
//
// Every dark token is a "fixed point" of remapColor() (dark backgrounds,
// borders darker than the limit, light text), so passing them through the
// themed components never changes them again (checked in
// scripts/testAllergyEditorTheme.ts together with the contrast ratios).
// ---------------------------------------------------------------------------

import { INPUT_TOKENS } from "./inputColors";

export type FormTokens = {
  // Text fields
  inputBackground: string;
  inputText: string;
  inputPlaceholder: string;
  inputBorder: string;
  inputFocusBorder: string;
  // Unselected options (Yes/No buttons, allergy checkboxes)
  optionBackground: string;
  optionBorder: string;
  optionText: string;
  // Selected Yes/No button (solid)
  selectedBackground: string;
  selectedBorder: string;
  selectedText: string;
  // Selected allergy row (tinted) and its checkbox
  selectedRowBackground: string;
  selectedRowText: string;
  checkFill: string;
  checkMark: string;
  // Text
  headingText: string;
  mutedText: string;
  linkText: string;
  // Errors / delete
  errorText: string;
  errorBorder: string;
  errorBackground: string;
  deleteIcon: string;
  deleteBackground: string;
  // Add button
  addButtonBackground: string;
  addButtonBorder: string;
  addButtonText: string;
};

export const FORM_TOKENS: { light: FormTokens; dark: FormTokens } = {
  light: {
    inputBackground: "#FFFFFF",
    inputText: "#17452F",
    inputPlaceholder: INPUT_TOKENS.light.placeholder,
    inputBorder: "#8DA596",
    inputFocusBorder: INPUT_TOKENS.light.focusBorder,
    optionBackground: "#FFFFFF",
    optionBorder: "#8DA596",
    optionText: "#17452F",
    selectedBackground: "#176B43",
    selectedBorder: "#176B43",
    selectedText: "#FFFFFF",
    selectedRowBackground: "#E8F5E9",
    selectedRowText: "#0E3B26",
    checkFill: "#176B43",
    checkMark: "#FFFFFF",
    headingText: "#17452F",
    mutedText: "#5F7068",
    linkText: "#176B43",
    errorText: "#B42318",
    errorBorder: "#B42318",
    errorBackground: "#FDECEA",
    deleteIcon: "#B42318",
    deleteBackground: "#FDECEA",
    addButtonBackground: "#176B43",
    addButtonBorder: "#176B43",
    addButtonText: "#FFFFFF",
  },
  dark: {
    inputBackground: INPUT_TOKENS.dark.surface as string, // #121A16
    inputText: INPUT_TOKENS.dark.text as string, // #F1F6F3
    inputPlaceholder: INPUT_TOKENS.dark.placeholder, // #8E9C95 (grey)
    inputBorder: INPUT_TOKENS.dark.border as string, // #7A8E83
    inputFocusBorder: INPUT_TOKENS.dark.focusBorder, // #5CC08A
    optionBackground: "#1B2420",
    optionBorder: "#6F8378",
    optionText: "#E8F0EB",
    selectedBackground: "#1F7A4D",
    selectedBorder: "#5CC08A",
    selectedText: "#FFFFFF",
    selectedRowBackground: "#173F2B",
    selectedRowText: "#FFFFFF",
    checkFill: "#5CC08A",
    checkMark: "#0B2116",
    headingText: "#F1F6F3",
    mutedText: "#B3C1B9",
    linkText: "#7FD6A5",
    errorText: "#FFA197",
    errorBorder: "#FF7B6E",
    errorBackground: "#3A1F1C",
    deleteIcon: "#FF9A8F",
    deleteBackground: "#3A2220",
    addButtonBackground: "#1F7A4D",
    addButtonBorder: "#5CC08A",
    addButtonText: "#FFFFFF",
  },
};

export function formTokens(isDark: boolean): FormTokens {
  return isDark ? FORM_TOKENS.dark : FORM_TOKENS.light;
}
