// ---------------------------------------------------------------------------
// scripts/testConsent.ts
// Product submissions are sent ONLY when the user's saved setting
// (user_preferences.submit_products_for_review) is true.
// Run with:  npx tsx scripts/testConsent.ts
// ---------------------------------------------------------------------------

/// <reference types="node" />
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { submissionDecision } from "../lib/submissionConsent";

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

const product = {
  barcode: "5449000000996",
  productName: "Test Bar",
  ingredients: "Sugar, cocoa",
  source: "Open Food Facts — not verified",
};

test("consent true → submit", () => {
  assert.equal(submissionDecision(product, true), "submit");
});

test("consent false → nothing is submitted", () => {
  assert.equal(submissionDecision(product, false), "no-consent");
});

test("no preferences row (null / undefined) → nothing is submitted", () => {
  assert.equal(submissionDecision(product, null), "no-consent");
  assert.equal(submissionDecision(product, undefined), "no-consent");
});

test("only the boolean true counts as consent", () => {
  assert.equal(submissionDecision(product, "true" as any), "no-consent");
  assert.equal(submissionDecision(product, 1 as any), "no-consent");
});

test("already approved products are not resubmitted", () => {
  assert.equal(
    submissionDecision({ ...product, source: "LabelLens verified product database" }, true),
    "already-approved"
  );
});

test("products without ingredients or identity are skipped", () => {
  assert.equal(submissionDecision({ ...product, ingredients: " " }, true), "no-ingredients");
  assert.equal(
    submissionDecision({ ...product, barcode: null, productName: "" }, true),
    "no-identity"
  );
});

// Static checks of the real code paths.
const root = join(__dirname, "..");
const submission = readFileSync(join(root, "lib/productSubmission.ts"), "utf8");

test("the setting is read from the database right before submitting", () => {
  const read = submission.indexOf("await isProductSubmissionEnabled(user.id)");
  const decide = submission.indexOf("submissionDecision(product, consent)");
  const upload = submission.indexOf("await uploadSubmissionPhoto(");
  const insert = submission.indexOf('.from("product_submissions").insert(');
  assert.ok(read > 0 && decide > read, "consent must be read, then checked");
  assert.ok(upload > decide && insert > decide, "upload / insert only after the check");
  assert.ok(!/if \(!options\.preferenceConfirmed\)/.test(submission), "no cached-consent shortcut");
});

test("the app never sends an approval status", () => {
  const insertBlock = submission.slice(submission.indexOf('.from("product_submissions").insert('));
  assert.ok(!/verification_status/.test(insertBlock.slice(0, insertBlock.indexOf("});"))));
});

test("the database also enforces consent (SQL migration)", () => {
  const sql = readFileSync(join(root, "supabase/sql/user_database_consent_rls.sql"), "utf8")
    .replace(/--.*$/gm, ""); // ignore comments
  assert.match(sql, /as restrictive\s+for insert/);
  assert.match(sql, /public\.has_submission_consent\(\)/);
  assert.match(sql, /submit_products_for_review/);
  assert.ok(!/\b(drop|truncate)\s+table\b/i.test(sql), "must not drop tables");
  assert.ok(!/\bdelete\s+from\b/i.test(sql), "must not delete rows");
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
