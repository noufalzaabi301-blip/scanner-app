// ---------------------------------------------------------------------------
// scripts/testPasswordFields.ts
// Dark-theme password fields: grey text placeholders (no fake dots),
// bright typed dots, and a Show / Hide button on every password field.
// Run with:  npx tsx scripts/testPasswordFields.ts
// ---------------------------------------------------------------------------

/// <reference types="node" />
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { translateIn } from "../lib/i18n/translate";
import {
  contrastRatio,
  DARK_INPUT_TEXT,
  DARK_PLACEHOLDER,
  inputColors,
} from "../lib/inputColors";

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

// Darkest input background used in the dark theme.
const DARK_FIELD = "#1C2620";

test("dark theme: typed text / dots are bright", () => {
  const colors = inputColors(true, "#AAB8AE");
  assert.equal(colors.text, DARK_INPUT_TEXT);
  assert.ok(contrastRatio(colors.text!, DARK_FIELD) >= 12, "typed dots must be clearly visible");
});

test("dark theme: placeholder is grey and dimmer than typed text", () => {
  const colors = inputColors(true, "#AAB8AE");
  assert.equal(colors.placeholder, DARK_PLACEHOLDER);
  const placeholder = contrastRatio(colors.placeholder, DARK_FIELD);
  const typed = contrastRatio(colors.text!, DARK_FIELD);
  assert.ok(placeholder >= 3, "placeholder still readable");
  assert.ok(typed > placeholder * 2, "typed text clearly brighter than the placeholder");
});

test("light theme keeps each screen's own placeholder colour", () => {
  assert.equal(inputColors(false, "#AAB8AE").placeholder, "#AAB8AE");
  assert.equal(inputColors(false).text, undefined);
});

const root = join(__dirname, "..");
const files = [
  "screens/LoginScreen.tsx",
  "screens/RegisterScreen.tsx",
  "screens/ForgotPasswordScreen.tsx",
  "screens/ProfileSettingsScreen.tsx",
];

test("no password field uses fake dots as its placeholder", () => {
  for (const file of files) {
    const source = readFileSync(join(root, file), "utf8");
    assert.ok(!/placeholder="[•●*·]+"/.test(source), `${file} uses a dot placeholder`);
  }
});

test("every password field has a Show / Hide button", () => {
  for (const file of files) {
    const source = readFileSync(join(root, file), "utf8");
    const plainSecure = (source.match(/<TextInput[^>]*?secureTextEntry[^>]*?\/>/gs) ?? []).filter(
      (tag) => !/secureTextEntry=\{!show/.test(tag)
    );
    assert.equal(plainSecure.length, 0, `${file}: password field without Show / Hide`);
  }
  const forgot = readFileSync(join(root, "screens/ForgotPasswordScreen.tsx"), "utf8");
  const settings = readFileSync(join(root, "screens/ProfileSettingsScreen.tsx"), "utf8");
  assert.equal((forgot.match(/<PasswordInput/g) ?? []).length, 2, "new + confirm password");
  assert.equal((settings.match(/<PasswordInput/g) ?? []).length, 3, "current + new + confirm");
});

test("placeholders are words in English and Arabic", () => {
  for (const key of [
    "login.passwordPlaceholder",
    "reset.newPasswordPlaceholder",
    "reset.confirmPlaceholder",
    "settings.currentPlaceholder",
    "settings.newPlaceholder",
    "settings.confirmPlaceholder",
    "register.confirmPlaceholder",
  ]) {
    for (const language of ["en", "ar"] as const) {
      const text = translateIn(language, key as any);
      assert.ok(/[A-Za-z؀-ۿ]/.test(text) && !/^[•●]+$/.test(text), `${key} (${language})`);
    }
  }
  assert.equal(translateIn("en", "login.passwordPlaceholder" as any), "Enter your password");
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
