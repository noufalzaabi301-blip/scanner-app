// ---------------------------------------------------------------------------
// scripts/testAllergyValidation.ts
// Run with:  npx tsx scripts/testAllergyValidation.ts
// ---------------------------------------------------------------------------

/// <reference types="node" />
import assert from "node:assert/strict";

import { validateCustomAllergy } from "../lib/allergyValidation";

const selected = ["Milk", "Peanuts"];
const custom = ["Mustard", "سكر"];

let passed = 0;
let failed = 0;

function check(
  input: string,
  expectOk: boolean,
  extra?: (r: any) => void,
  lists: [string[], string[]] = [selected, custom]
) {
  const result = validateCustomAllergy(input, lists[0], lists[1]);

  try {
    assert.equal(result.ok, expectOk);
    extra?.(result);
    passed += 1;
    console.log(`PASS  ${expectOk ? "accept" : "reject"}  ${JSON.stringify(input)}${
      result.ok ? "" : `  (${(result as any).message})`
    }`);
  } catch (error: any) {
    failed += 1;
    console.log(`FAIL  ${JSON.stringify(input)} → ${JSON.stringify(result)}`);
  }
}

// Valid custom food allergens
for (const food of [
  "Coconut",
  "Lupin",
  "Kiwi",
  "Strawberry",
  "Corn",
  "Sugar",
  "Celery",
  "Garlic",
  "  Pine nuts  ",
  "Kiwi-fruit",
  "Hen's egg white",
  "جوز الهند",
]) {
  // Checked against an empty profile, so only the validation rules apply.
  check(food, true, undefined, [[], []]);
}

check("  Coconut  ", true, (r) => assert.equal(r.value, "Coconut"));

// Standard allergy typed by hand → ticks the standard option
check("egg", true, (r) => assert.equal(r.standardOption, "Eggs"));
check("بيض", true, (r) => assert.equal(r.standardOption, "Eggs"));

// Empty / length
check("", false);
check("   ", false);
check("a", false);
check("A".repeat(20) + "b".repeat(21), false);

// Numbers, URLs, emojis, code, sentences
check("123", false);
check("milk2", false);
check("https://example.com", false);
check("www.food.com", false);
check("me@mail.com", false);
check("🍓", false);
check("Strawberry 🍓", false);
check("<script>", false);
check("DROP TABLE users;", false);
check("console.log()", false);
check("I am allergic to peanuts and milk", false);
check("Milk, eggs", false);

// Test / placeholder values
for (const value of [
  "test",
  "Testing",
  "hello",
  "abc",
  "XYZ",
  "anything",
  "none",
  "n/a",
  "N A",
  "null",
  "undefined",
  "aaaa",
]) {
  check(value, false);
}

// Duplicates (case-insensitive, across languages) and already selected
check("mustard", false);
check("MUSTARD", false);
check("Sugar", false); // "سكر" (sugar) is already a custom allergy
check("milk", false);
check("حليب", false);
check("Peanut", false);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
