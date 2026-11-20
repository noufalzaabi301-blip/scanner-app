// ---------------------------------------------------------------------------
// scripts/testGuestMode.ts
// Guest onboarding: required before scanning, saved only on the device,
// "No allergies" and halal answers, never sent to Supabase, never submitted.
// Run with:  npx tsx scripts/testGuestMode.ts
// ---------------------------------------------------------------------------

/// <reference types="node" />
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  EMPTY_GUEST_PREFERENCES,
  guestScreeningPreferences,
  guestSetupProblem,
  isGuestSetupComplete,
  parseGuestPreferences,
  serializeGuestPreferences,
} from "../lib/guestPreferencesCore";
import { translateIn } from "../lib/i18n/translate";

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
const ARABIC = /[؀-ۿ]/;

test("nothing answered → setup required (no scanning)", () => {
  assert.equal(isGuestSetupComplete(EMPTY_GUEST_PREFERENCES), false);
  assert.equal(guestSetupProblem(EMPTY_GUEST_PREFERENCES), "allergy-question");
});

test("allergies answered but halal not → still required", () => {
  const prefs = { ...EMPTY_GUEST_PREFERENCES, hasAllergies: false };
  assert.equal(guestSetupProblem(prefs), "halal-question");
});

test("'Yes' with no allergy chosen → must choose one", () => {
  const prefs = { ...EMPTY_GUEST_PREFERENCES, hasAllergies: true, prefersHalal: false };
  assert.equal(guestSetupProblem(prefs), "allergy-list-empty");
});

test("standard + custom allergies are saved and used for screening", () => {
  const saved = serializeGuestPreferences({
    ...EMPTY_GUEST_PREFERENCES,
    hasAllergies: true,
    allergies: ["Milk", "Sesame"],
    customAllergies: ["Kiwi"],
    prefersHalal: true,
  });
  const loaded = parseGuestPreferences(saved);
  assert.equal(isGuestSetupComplete(loaded), true);
  assert.deepEqual(loaded.allergies, ["Milk", "Sesame"]);
  assert.deepEqual(loaded.customAllergies, ["Kiwi"]);
  const screening = guestScreeningPreferences(loaded);
  assert.deepEqual(screening.allergies, ["Milk", "Sesame", "Kiwi"]);
  assert.equal(screening.prefersHalal, true);
  assert.equal(screening.allergyMatchingOff, false);
});

test("'No allergies' works: scanning allowed, allergy matching off", () => {
  const loaded = parseGuestPreferences(
    serializeGuestPreferences({
      ...EMPTY_GUEST_PREFERENCES,
      hasAllergies: false,
      allergies: ["Milk"], // dropped: "No allergies" never keeps a list
      prefersHalal: false,
    })
  );
  assert.equal(isGuestSetupComplete(loaded), true);
  assert.deepEqual(loaded.allergies, []);
  const screening = guestScreeningPreferences(loaded);
  assert.deepEqual(screening.allergies, []);
  assert.equal(screening.allergyMatchingOff, true);
  assert.equal(screening.prefersHalal, false);
});

test("halal Yes / No are kept", () => {
  for (const prefersHalal of [true, false]) {
    const loaded = parseGuestPreferences(
      serializeGuestPreferences({ ...EMPTY_GUEST_PREFERENCES, hasAllergies: false, prefersHalal })
    );
    assert.equal(loaded.prefersHalal, prefersHalal);
    assert.equal(guestScreeningPreferences(loaded).prefersHalal, prefersHalal);
  }
});

test("broken stored data counts as 'not answered'", () => {
  assert.equal(isGuestSetupComplete(parseGuestPreferences("{oops")), false);
  assert.equal(isGuestSetupComplete(parseGuestPreferences(null)), false);
});

test("guests never submit: submitProducts is always false and not stored", () => {
  const prefs = { ...EMPTY_GUEST_PREFERENCES, hasAllergies: false, prefersHalal: true };
  assert.equal(guestScreeningPreferences(prefs).submitProducts, false);
  assert.ok(!/submit/i.test(serializeGuestPreferences(prefs)));
});

test("guest storage is local only (no Supabase in guest modules)", () => {
  for (const file of ["lib/guestPreferences.ts", "lib/guestPreferencesCore.ts", "screens/GuestPreferencesScreen.tsx"]) {
    const source = read(file);
    assert.ok(!/supabase/i.test(source.replace(/\/\/.*$/gm, "")), `${file} must not use Supabase`);
  }
  assert.match(read("lib/guestPreferences.ts"), /AsyncStorage\.setItem\(STORAGE_KEYS\.guestPreferences/);
});

test("'Continue as guest' opens the onboarding, not the scanner", () => {
  const welcome = read("screens/WelcomeScreen.tsx");
  const fn = welcome.slice(welcome.indexOf("async function continueAsGuest"));
  const body = fn.slice(0, fn.indexOf("\n  }\n"));
  assert.match(body, /await routeForGuest\(\)/);
  assert.ok(!/"Home"|ROUTES\.Home/.test(body), "must not open Home directly");
  const route = read("lib/postAuthRoute.ts");
  const guest = route.slice(route.indexOf("export async function routeForGuest"));
  assert.match(guest, /ROUTES\.GuestPreferences/);
  assert.match(guest, /ROUTES\.PrivacyNotice, params: \{ fromGuest: true \}/);
  assert.ok(!/ROUTES\.Home/.test(guest));
});

test("the scanner sends unfinished guests back to onboarding", () => {
  const home = read("screens/HomeScreen.tsx");
  assert.match(home, /guestSetupNeeded: !isGuestSetupComplete\(guest\)/);
  assert.equal((home.match(/if \(prefs\.guestSetupNeeded\)/g) ?? []).length, 2, "on load and before a result");
  assert.match(home, /routes: \[\{ name: "Welcome" \}, \{ name: "GuestPreferences" \}\]/);
});

test("the scanner never submits for guests", () => {
  const home = read("screens/HomeScreen.tsx");
  assert.match(home, /submitProducts: false,\s*isGuest: true/);
  assert.match(home, /if \(prefs\.submitProducts && !prefs\.isGuest\)/);
  // And the submission helper itself requires a signed-in user.
  assert.match(read("lib/productSubmission.ts"), /if \(!user\) \{\s*return \{\};/);
});

test("guests can reopen and edit their preferences", () => {
  assert.match(read("screens/ProfileScreen.tsx"), /navigate\(ROUTES\.GuestPreferences, \{ mode: "edit" \}\)/);
  assert.match(read("screens/HomeScreen.tsx"), /openScreen\("GuestPreferences", \{ mode: "edit" \}\)/);
});

test("English and Arabic texts exist", () => {
  const keys = [
    "guest.title", "guest.allergyQuestion", "guest.noAllergies", "guest.halalQuestion",
    "guest.savedOnDevice", "guest.matchingOffNotice", "guest.startScanning", "title.guestPreferences",
  ];
  for (const key of keys) {
    assert.ok(ARABIC.test(translateIn("ar", key as any)), `${key} (ar)`);
    assert.ok(!ARABIC.test(translateIn("en", key as any)), `${key} (en)`);
  }
  assert.equal(translateIn("en", "guest.title" as any), "Set your preferences before scanning");
  assert.equal(translateIn("en", "guest.savedOnDevice" as any), "Your allergy preferences are saved on this device.");
  assert.equal(translateIn("en", "guest.noAllergies" as any), "No allergies");
});

test("guest Privacy Notice → guest setup (device only, no Supabase)", () => {
  const notice = read("screens/PrivacyNoticeScreen.tsx");
  assert.match(notice, /navigation\.replace\(ROUTES\.GuestPreferences\)/);
  const accept = notice.slice(notice.indexOf("async function acceptPrivacyNotice"));
  const guestBranch = accept.slice(accept.indexOf("} else {"), accept.indexOf("} catch"));
  assert.ok(!/supabase/.test(guestBranch), "guest acceptance is not sent to Supabase");
});

test("guest setup asks halal and uses several-at-once allergy entry", () => {
  const screen = read("screens/GuestPreferencesScreen.tsx");
  assert.match(screen, /t\("guest\.halalQuestion"\)/);
  assert.match(screen, /addAllergyEntries\(customInput, allergies, customAllergies\)/);
});

test("onboarding uses themed components and RTL-safe spacing", () => {
  const screen = read("screens/GuestPreferencesScreen.tsx");
  assert.match(screen, /from "\.\.\/components\/Themed"/);
  assert.ok(!/marginLeft|marginRight|paddingLeft|paddingRight|left:|right:/.test(screen), "use gap / start / end");
  assert.match(screen, /usePageInsets\(\)/);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
