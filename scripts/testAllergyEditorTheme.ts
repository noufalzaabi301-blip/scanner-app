// ---------------------------------------------------------------------------
// scripts/testAllergyEditorTheme.ts
// Allergy editor colours (lib/formTokens.ts), Welcome language selector,
// Profile Settings "Forgot your password?", Show/Hide on password fields.
// Run with:  npx tsx scripts/testAllergyEditorTheme.ts
// ---------------------------------------------------------------------------

/// <reference types="node" />
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { FORM_TOKENS } from "../lib/formTokens";
import { contrastRatio } from "../lib/inputColors";
import { translateIn } from "../lib/i18n/translate";
import { remapColor } from "../lib/colorRemap";

let passed = 0;
let failed = 0;
function test(name: string, run: () => void) {
  try {
    run();
    passed++;
  } catch (error: any) {
    failed++;
    console.error(`FAIL ${name}: ${error?.message}`);
  }
}
const read = (path: string) => readFileSync(join(__dirname, "..", path), "utf8");
const dark = FORM_TOKENS.dark;
const light = FORM_TOKENS.light;
const DARK_PAGE = remapColor("#F7F9F7", "background") as string;

test("dark: text is readable (no dark text on dark backgrounds)", () => {
  const pairs: [string, string, number][] = [
    [dark.inputText, dark.inputBackground, 7],
    [dark.optionText, dark.optionBackground, 7],
    [dark.selectedText, dark.selectedBackground, 4.5],
    [dark.selectedRowText, dark.selectedRowBackground, 7],
    [dark.headingText, DARK_PAGE, 7],
    [dark.mutedText, DARK_PAGE, 4.5],
    [dark.errorText, DARK_PAGE, 4.5],
    [dark.errorText, dark.errorBackground, 4.5],
    [dark.addButtonText, dark.addButtonBackground, 4.5],
    [dark.linkText, DARK_PAGE, 4.5],
  ];
  for (const [fg, bg, min] of pairs) {
    assert.ok(contrastRatio(fg, bg) >= min, `${fg} on ${bg}: ${contrastRatio(fg, bg).toFixed(2)}`);
  }
});

test("dark: placeholder is grey and readable, but clearly dimmer than typed text", () => {
  const placeholder = contrastRatio(dark.inputPlaceholder, dark.inputBackground);
  assert.ok(placeholder >= 4.5, `placeholder ${placeholder.toFixed(2)}`);
  assert.ok(contrastRatio(dark.inputText, dark.inputBackground) > placeholder * 2);
});

test("dark: field, option borders, icons and checkbox are visible (≥ 3:1)", () => {
  const pairs: [string, string][] = [
    [dark.inputBorder, dark.inputBackground],
    [dark.inputBorder, DARK_PAGE],
    [dark.optionBorder, DARK_PAGE],
    [dark.selectedBorder, DARK_PAGE],
    [dark.deleteIcon, dark.deleteBackground],
    [dark.deleteIcon, dark.selectedRowBackground],
    [dark.checkFill, dark.selectedRowBackground],
    [dark.checkMark, dark.checkFill],
    [dark.addButtonBorder, DARK_PAGE],
  ];
  for (const [fg, bg] of pairs) {
    assert.ok(contrastRatio(fg, bg) >= 3, `${fg} on ${bg}: ${contrastRatio(fg, bg).toFixed(2)}`);
  }
});

test("dark: field background is solid (not transparent) and differs from the page", () => {
  assert.match(dark.inputBackground, /^#[0-9A-F]{6}$/i);
  assert.notEqual(dark.inputBackground.toUpperCase(), DARK_PAGE.toUpperCase());
});

test("dark: selected and unselected options look different", () => {
  assert.notEqual(dark.selectedRowBackground, dark.optionBackground);
  assert.notEqual(dark.selectedBorder, dark.optionBorder);
  assert.ok(contrastRatio(dark.selectedBorder, dark.optionBorder) > 1.5);
});

test("dark tokens are not converted a second time by the themed components", () => {
  for (const key of ["inputBackground", "optionBackground", "selectedBackground", "selectedRowBackground", "errorBackground", "deleteBackground", "addButtonBackground"] as const) {
    assert.equal(remapColor(dark[key], "background"), dark[key].toUpperCase(), key);
  }
  for (const key of ["inputBorder", "optionBorder", "selectedBorder", "errorBorder", "addButtonBorder"] as const) {
    assert.equal(remapColor(dark[key], "border"), dark[key].toUpperCase(), key);
  }
  for (const key of ["inputText", "optionText", "selectedText", "selectedRowText", "headingText", "mutedText", "errorText", "linkText", "addButtonText"] as const) {
    assert.equal(remapColor(dark[key], "text"), dark[key].toUpperCase(), key);
  }
});

test("light: text readable and placeholder visible", () => {
  assert.ok(contrastRatio(light.inputText, light.inputBackground) >= 7);
  assert.ok(contrastRatio(light.inputPlaceholder, light.inputBackground) >= 4.5);
  assert.ok(contrastRatio(light.selectedText, light.selectedBackground) >= 4.5);
  assert.ok(contrastRatio(light.errorText, "#F7F9F7") >= 4.5);
});

test("editor uses the tokens, icons (not emoji) and RTL-safe layout", () => {
  const editor = read("components/AllergyEditor.tsx");
  assert.match(editor, /useFormTokens\(\)/);
  for (const token of ["inputBackground", "inputText", "inputPlaceholder", "inputBorder", "selectedBackground", "selectedText", "errorText"]) {
    assert.match(editor, new RegExp(`c\\.${token}\\b`), token);
  }
  assert.match(editor, /name="trash-outline"/);
  assert.ok(!/🗑/.test(editor));
  assert.ok(!/marginLeft|marginRight|paddingLeft|paddingRight|\bleft:|\bright:/.test(editor));
  for (const screen of ["screens/PreferencesScreen.tsx", "screens/GuestPreferencesScreen.tsx"]) {
    assert.match(read(screen), /<AllergyEditor/);
    assert.ok(!/🗑/.test(read(screen)));
  }
});

test("one list of current allergies, delete on each, no checkboxes", () => {
  const editor = read("components/AllergyEditor.tsx");
  // Standard and custom together, without duplicates.
  assert.match(editor, /const current = \[\.\.\.new Set\(\[\.\.\.selected, \.\.\.custom\]\)\];/);
  assert.match(editor, /current\.map\(/);
  assert.match(editor, /onPress=\{\(\) => onRemove\(value\)\}/);
  assert.match(editor, /t\("prefs\.noAllergiesYet"\)/);
  assert.ok(!/accessibilityRole="checkbox"|checkmark"|styles\.checkbox/.test(editor), "no checkboxes");
  for (const screen of ["screens/PreferencesScreen.tsx", "screens/GuestPreferencesScreen.tsx"]) {
    const s = read(screen);
    assert.ok(!/accessibilityRole="checkbox"/.test(s), screen);
    // Delete removes exactly that allergy from either list.
    const fn = s.slice(s.indexOf("function removeAllergy"));
    assert.equal((fn.slice(0, fn.indexOf("\n  }\n")).match(/filter\(\(item\) => item !== /g) ?? []).length, 2, screen);
  }
});

test("common allergies are suggestions with an Add button (not yet selected)", () => {
  const editor = read("components/AllergyEditor.tsx");
  assert.match(editor, /STANDARD_ALLERGIES\.filter\(\s*\(value\) => !selected\.includes\(value\)\s*\)/);
  assert.match(editor, /onPress=\{\(\) => onAddStandard\(value\)\}/);
  assert.match(editor, /t\("prefs\.commonAllergies"\)/);
});

test("new list texts exist in English and Arabic", () => {
  const expected: Record<string, string> = {
    "prefs.selectedAllergies": "Your selected allergies",
    "prefs.noAllergiesYet": "No allergies selected yet.",
    "prefs.addAnother": "Add another allergy",
  };
  for (const [key, english] of Object.entries(expected)) {
    assert.equal(translateIn("en", key as any), english);
    assert.ok(/[\u0600-\u06FF]/.test(translateIn("ar", key as any)), key);
  }
});

test("Welcome shows the English / العربية selector in the normal layout", () => {
  const welcome = read("screens/WelcomeScreen.tsx");
  assert.match(welcome, /<LanguageSwitch /);
  assert.match(welcome, /ContextSafeAreaView as SafeAreaView/);
  const topBar = welcome.slice(welcome.indexOf("  topBar: {"), welcome.indexOf("  languageSwitch: {"));
  assert.ok(!/position: "absolute"/.test(topBar));
  const sw = read("components/LanguageSwitch.tsx");
  assert.match(sw, /setLanguage\(item\.code\)/);
  assert.match(sw, /accessibilityState=\{\{ selected: active \}\}/);
});

test("Profile Settings → Forgot your password? → existing six-digit flow", () => {
  const settings = read("screens/ProfileSettingsScreen.tsx");
  assert.match(settings, /navigation\.navigate\(ROUTES\.ForgotPassword/);
  assert.match(settings, /t\("settings\.forgotPassword"\)/);
  assert.ok(!/verifyOtp|resetPasswordForEmail/.test(settings), "no duplicated reset logic");
  const forgot = read("screens/ForgotPasswordScreen.tsx");
  assert.match(forgot, /type: "recovery"/);
  assert.match(forgot, /\^\\d\{6\}\$/);
  assert.equal(translateIn("en", "settings.forgotPassword" as any), "Forgot your password?");
  assert.equal(translateIn("ar", "settings.forgotPassword" as any), "هل نسيت كلمة المرور؟");
});

test("every password field has Show / Hide", () => {
  for (const file of ["screens/ResetPasswordScreen.tsx", "screens/ProfileSettingsScreen.tsx", "screens/ForgotPasswordScreen.tsx"]) {
    const s = read(file);
    assert.ok(!/secureTextEntry(?!=\{!)/.test(s), `${file}: plain secureTextEntry`);
  }
  for (const file of ["screens/LoginScreen.tsx", "screens/RegisterScreen.tsx"]) {
    assert.match(read(file), /secureTextEntry=\{!show/);
  }
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
