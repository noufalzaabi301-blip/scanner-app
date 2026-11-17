// ---------------------------------------------------------------------------
// scripts/testResponsiveTheme.ts
// Dark-theme input tokens and the shared responsive web layout.
// Run with:  npx tsx scripts/testResponsiveTheme.ts
// ---------------------------------------------------------------------------

/// <reference types="node" />
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { contrastRatio, INPUT_TOKENS } from "../lib/inputColors";

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

// lib/layout.ts imports react-native; its pure rule is repeated here and
// compared with the source below.
const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const DARK_CARD = "#262D29"; // white card in dark mode (lib/theme.tsx)
const dark = INPUT_TOKENS.dark;

test("dark input surface is visibly different from the dark card", () => {
  assert.ok(contrastRatio(dark.surface!, DARK_CARD) >= 1.2);
});

test("dark input border is clearly visible on both card and field", () => {
  assert.ok(contrastRatio(dark.border!, DARK_CARD) >= 2, "border vs card");
  assert.ok(contrastRatio(dark.border!, dark.surface!) >= 2.5, "border vs field");
  assert.ok(contrastRatio(dark.focusBorder, dark.surface!) >= 6, "focus border");
});

test("dark typed text is bright, placeholder dim but readable", () => {
  const text = contrastRatio(dark.text!, dark.surface!);
  const placeholder = contrastRatio(dark.placeholder, dark.surface!);
  assert.ok(text >= 12, `text ${text}`);
  assert.ok(placeholder >= 3.5 && placeholder < text / 2, `placeholder ${placeholder}`);
});

test("cursor and selection colours are set for both themes", () => {
  for (const tokens of [INPUT_TOKENS.light, INPUT_TOKENS.dark]) {
    assert.ok(tokens.cursor && tokens.selection && tokens.selectionText && tokens.focusBorder);
  }
  assert.ok(contrastRatio(dark.cursor, dark.surface!) >= 7, "visible caret");
});

test("every text field uses the themed TextInput", () => {
  for (const dir of ["screens", "components"]) {
    for (const file of readdirSync(join(root, dir))) {
      const source = read(`${dir}/${file}`);
      if (/<TextInput/.test(source) && file !== "Themed.tsx") {
        assert.ok(
          /import[\s\S]*?TextInput[\s\S]*?from "\.\.?\/components\/Themed"|from "\.\/Themed"/.test(source),
          `${file} must import TextInput from components/Themed`
        );
        assert.ok(!/TextInput[^\n]*from "react-native"/.test(source), `${file} uses react-native TextInput`);
      }
    }
  }
});

test("themed TextInput applies tokens, focus, cursor and selection", () => {
  const themed = read("components/Themed.tsx");
  for (const piece of ["INPUT_TOKENS", "focusBorder", "selectionColor=", "cursorColor=", "caretColor", "::selection", "onFocus", "onBlur"]) {
    assert.ok(themed.includes(piece), piece);
  }
});

test("one shared page column with a max width (App.tsx + lib/layout.ts)", () => {
  const layout = read("lib/layout.ts");
  assert.match(layout, /PAGE_MAX_WIDTH = 720/);
  assert.match(layout, /width: "100%"/);
  assert.match(read("App.tsx"), /<View style=\{pageColumnStyle\}>/);
});

test("responsive side padding: 14 / 20 / 24", () => {
  const layout = read("lib/layout.ts");
  assert.match(layout, /column < 360\) \{\s*return 14;/);
  assert.match(layout, /windowWidth < 768 \? 20 : 24/);
});

test("no screen uses its own fixed page width, scale transform or zoom", () => {
  for (const file of readdirSync(join(root, "screens"))) {
    const source = read(`screens/${file}`);
    assert.ok(!/maxWidth: \d{3}/.test(source), `${file}: fixed maxWidth`);
    assert.ok(!/transform: \[\{ ?scale/.test(source), `${file}: scale transform`);
    assert.ok(!/zoom:/.test(source), `${file}: zoom`);
  }
});

test("main screens use the shared page padding", () => {
  for (const file of [
    "LoginScreen", "RegisterScreen", "ForgotPasswordScreen", "PreferencesScreen",
    "ProfileScreen", "ProfileSettingsScreen", "HomeScreen", "AvoidListScreen",
    "AdminProductSubmissionsScreen", "HalalAndVerificationScreen", "WelcomeScreen",
  ]) {
    assert.ok(read(`screens/${file}.tsx`).includes("usePageInsets()"), file);
  }
});

test("web viewport: device width, scale 1, no forced text inflation", () => {
  const html = read("public/index.html");
  assert.match(html, /width=device-width, initial-scale=1/);
  assert.ok(!/maximum-scale|user-scalable=no/.test(html), "pinch zoom stays possible");
  assert.match(html, /text-size-adjust: 100%/);
  assert.match(html, /overflow-x: hidden/);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
