// ---------------------------------------------------------------------------
// scripts/testPrivacyOnce.ts
// The Privacy Notice is shown once per version; the acceptance persists.
// Run with:  npx tsx scripts/testPrivacyOnce.ts
// ---------------------------------------------------------------------------

/// <reference types="node" />
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { translateIn } from "../lib/i18n/translate";
import {
  isDeviceAcceptanceCurrent,
  parseDeviceAcceptance,
  privacyMetadataFrom,
  serializeDeviceAcceptance,
} from "../lib/privacyConsentCore";

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

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("acceptance is stored with its version and date", () => {
  const saved = serializeDeviceAcceptance("1.2", new Date("2026-11-18T10:00:00Z"));
  assert.deepEqual(parseDeviceAcceptance(saved), { version: "1.2", acceptedAt: "2026-11-18T10:00:00.000Z" });
  assert.equal(isDeviceAcceptanceCurrent(saved, "1.2"), true);
});

test("earlier acceptances ('true') still count, so it is not shown again", () => {
  assert.equal(isDeviceAcceptanceCurrent("true", "1.2"), true);
});

test("a new notice version is asked again", () => {
  assert.equal(isDeviceAcceptanceCurrent(serializeDeviceAcceptance("1.2"), "1.3"), false);
  assert.equal(isDeviceAcceptanceCurrent(null, "1.2"), false);
});

test("the account gets the same acceptance record", () => {
  const meta = privacyMetadataFrom({ version: "1.2", acceptedAt: "2026-11-18T10:00:00.000Z" });
  assert.deepEqual(meta, {
    privacy_accepted: true,
    privacy_version: "1.2",
    privacy_accepted_at: "2026-11-18T10:00:00.000Z",
  });
});

test("Accept saves the acceptance on the device", () => {
  assert.match(read("screens/PrivacyNoticeScreen.tsx"), /await saveDeviceAcceptance\(\);/);
});

test("sign-up skips the notice when already accepted on this device", () => {
  const register = read("screens/RegisterScreen.tsx");
  const fn = register.slice(register.indexOf("async function continueToPrivacyNotice"));
  assert.ok(fn.indexOf("hasDeviceAcceptedPrivacy()") < fn.indexOf('navigate("PrivacyNotice"'));
  assert.match(register, /deviceAcceptanceMetadata\(\)/);
});

test("login and app start reuse the device acceptance", () => {
  assert.match(read("screens/LoginScreen.tsx"), /await ensureAccountPrivacy\(user\.user_metadata\)/);
  assert.match(read("App.tsx"), /await ensureAccountPrivacy\(user\.user_metadata\)/);
});

test("Welcome opens the notice at most once (effect guard)", () => {
  const welcome = read("screens/WelcomeScreen.tsx");
  assert.match(welcome, /let cancelled = false;/);
  assert.match(welcome, /if \(cancelled\) \{\s*return;\s*\}\s*if \(!privacyAccepted\)/);
  assert.equal((welcome.match(/replace\("PrivacyNotice"/g) ?? []).length, 1);
});

test("the notice is one route only (not also a global banner / modal)", () => {
  const app = read("App.tsx");
  assert.equal((app.match(/name="PrivacyNotice"/g) ?? []).length, 1);
  assert.equal((app.match(/<PrivacyNoticeScreen/g) ?? []).length, 0, "not rendered globally");
  for (const file of ["App.tsx", "screens/HomeScreen.tsx", "screens/ProfileScreen.tsx", "screens/LoginScreen.tsx"]) {
    assert.ok(!/import PrivacyNoticeScreen/.test(read(file)) || file === "App.tsx", `${file} embeds the notice`);
  }
});

test("Profile → Privacy Notice stays available (read-only)", () => {
  assert.match(read("screens/ProfileScreen.tsx"), /navigate\(ROUTES\.PrivacyNotice, \{ readOnly: true \}\)/);
});

test("notice texts exist in English and Arabic", () => {
  for (const key of ["title.privacyNotice", "register.privacyAlreadyAccepted", "register.readPrivacyAgain"]) {
    assert.ok(/[؀-ۿ]/.test(translateIn("ar", key as any)), key);
    assert.ok(translateIn("en", key as any).length > 3, key);
  }
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
