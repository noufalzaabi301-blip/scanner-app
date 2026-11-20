// ---------------------------------------------------------------------------
// scripts/testPrivacyOnce.ts
// Privacy Notice order and "once per version":
//   Welcome → Login / Create account → (signed in) → Privacy Notice →
//   allergy + halal setup → Scan
//   Welcome → Continue as guest → Privacy Notice → guest setup → Scan
// Never before Login / Create account; skipped once accepted; still
// readable from Profile.
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
const code = (path: string) => read(path).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

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
  assert.deepEqual(privacyMetadataFrom({ version: "1.2", acceptedAt: "2026-11-18T10:00:00.000Z" }), {
    privacy_accepted: true,
    privacy_version: "1.2",
    privacy_accepted_at: "2026-11-18T10:00:00.000Z",
  });
});

test("Welcome never opens the notice (not before Login / Create account)", () => {
  const welcome = code("screens/WelcomeScreen.tsx");
  assert.ok(!/PrivacyNotice/.test(welcome), "no PrivacyNotice route on Welcome");
  assert.ok(!/hasDeviceAcceptedPrivacy/.test(welcome));
});

test("Login and Create account screens never open the notice before auth", () => {
  const register = code("screens/RegisterScreen.tsx");
  assert.ok(!/PrivacyNotice/.test(register), "Register does not open the notice itself");
  // Sign-up with a session → routeAfterSignIn (notice after authentication).
  assert.ok(register.indexOf("supabase.auth.signUp") < register.indexOf("routeAfterSignIn(data.user)"));
  const login = code("screens/LoginScreen.tsx");
  assert.ok(login.indexOf("signInWithPassword") < login.indexOf('name: "PrivacyNotice"'), "only after sign-in");
});

test("after sign-in: notice (if needed) → setup → scan", () => {
  const route = code("lib/postAuthRoute.ts");
  const signIn = route.slice(route.indexOf("export async function routeAfterSignIn"), route.indexOf("export async function routeForGuest"));
  assert.ok(signIn.indexOf("ensureAccountPrivacy") < signIn.indexOf("hasSavedPreferences"));
  assert.match(signIn, /ROUTES\.PrivacyNotice, params: \{ fromLogin: true \}/);
  assert.match(signIn, /ROUTES\.Home\s*:\s*ROUTES\.Preferences/);
  // Accepting as a signed-in user continues to setup or the scanner.
  const notice = code("screens/PrivacyNoticeScreen.tsx");
  assert.match(notice, /hasPreferences \? "Home" : "Preferences"/);
});

test("guest: Continue as guest → notice (if needed) → guest setup", () => {
  const route = code("lib/postAuthRoute.ts");
  const guest = route.slice(route.indexOf("export async function routeForGuest"));
  assert.match(guest, /hasDeviceAcceptedPrivacy\(\)/);
  assert.match(guest, /ROUTES\.GuestPreferences/);
  assert.match(guest, /fromGuest: true/);
});

test("accepting saves the acceptance (shown once per version)", () => {
  const notice = code("screens/PrivacyNoticeScreen.tsx");
  assert.match(notice, /await saveDeviceAcceptance\(\);/);
  assert.match(notice, /privacy_version: PRIVACY_VERSION/);
  // App start with a session skips it once accepted on the account/device.
  assert.match(read("App.tsx"), /await ensureAccountPrivacy\(user\.user_metadata\)/);
});

test("only signed-in or guest modes show Accept; old pre-login modes are gone", () => {
  const notice = code("screens/PrivacyNoticeScreen.tsx");
  assert.match(notice, /const showConsentControls = \(fromLogin \|\| fromGuest\) && !readOnly;/);
  for (const file of ["App.tsx", "screens/PrivacyNoticeScreen.tsx", "screens/RegisterScreen.tsx", "screens/WelcomeScreen.tsx"]) {
    assert.ok(!/fromAppStart|fromSignup/.test(code(file)), `${file}: no pre-login notice`);
  }
});

test("the notice is one route only (not also global / embedded)", () => {
  const app = read("App.tsx");
  assert.equal((app.match(/name="PrivacyNotice"/g) ?? []).length, 1);
  assert.equal((app.match(/<PrivacyNoticeScreen/g) ?? []).length, 0);
  for (const file of ["screens/HomeScreen.tsx", "screens/ProfileScreen.tsx", "screens/LoginScreen.tsx", "screens/WelcomeScreen.tsx"]) {
    assert.ok(!/import PrivacyNoticeScreen/.test(read(file)), `${file} embeds the notice`);
  }
});

test("the scanner never opens the notice", () => {
  assert.ok(!/PrivacyNotice/.test(code("screens/HomeScreen.tsx")));
});

test("Profile → Privacy Notice stays available (read-only)", () => {
  assert.match(read("screens/ProfileScreen.tsx"), /navigate\(ROUTES\.PrivacyNotice, \{ readOnly: true \}\)/);
});

test("notice texts exist in English and Arabic", () => {
  for (const key of ["title.privacyNotice", "privacy.acceptButton", "privacy.guestNote", "register.privacyHint"]) {
    assert.ok(/[\u0600-\u06FF]/.test(translateIn("ar", key as any)), key);
    assert.ok(translateIn("en", key as any).length > 3, key);
  }
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
