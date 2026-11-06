// ---------------------------------------------------------------------------
// scripts/testAllergyValidation.ts
// Run with:  npx tsx scripts/testAllergyValidation.ts
// ---------------------------------------------------------------------------

/// <reference types="node" />
import assert from "node:assert/strict";

import { validateCustomAllergy } from "../lib/allergyValidation";

let passed = 0;
let failed = 0;

type Expect =
  | { ok: true; value?: string; standard?: string | null }
  | { ok: false; message: string };

function check(
  name: string,
  input: string,
  expected: Expect,
  selected: string[] = [],
  custom: string[] = []
) {
  const result = validateCustomAllergy(input, selected, custom);

  try {
    assert.equal(result.ok, expected.ok);

    if (expected.ok && result.ok) {
      if (expected.value !== undefined) assert.equal(result.value, expected.value);
      if (expected.standard !== undefined) {
        assert.equal(result.standardOption, expected.standard);
      }
    }

    if (!expected.ok && !result.ok) {
      assert.equal(result.message, expected.message);
    }

    passed += 1;
    console.log(`PASS  ${name}: ${JSON.stringify(input)}`);
  } catch {
    failed += 1;
    console.log(`FAIL  ${name}: ${JSON.stringify(input)} → ${JSON.stringify(result)}`);
  }
}

const OK = { ok: true } as const;
const unknown = { ok: false, message: "prefs.allergyUnknown" } as const;
const notFood = { ok: false, message: "prefs.allergyNotFood" } as const;
const numbers = { ok: false, message: "prefs.allergyNoNumbers" } as const;
const letters = { ok: false, message: "prefs.allergyLettersOnly" } as const;
const sentence = { ok: false, message: "prefs.allergyTooManyWords" } as const;
const duplicate = { ok: false, message: "prefs.alreadyAddedBody" } as const;
const selectedMsg = { ok: false, message: "prefs.alreadySelectedBody" } as const;

// --- Valid English custom allergies ---------------------------------------
for (const food of [
  "Coconut", "Mustard", "Lupin", "Kiwi", "Strawberry", "Corn", "Sugar",
  "Celery", "Garlic", "Pine nuts", "Sunflower", "Soya lecithin", "Hazelnut",
  "Almond", "Walnut", "Gluten", "Soybeans",
]) {
  check("valid English", food, OK);
}
check("trim + collapse spaces", "   Pine    nuts  ", { ok: true, value: "Pine nuts" });
check("NFKC full-width letters", "Ｃｏｃｏｎｕｔ", { ok: true, value: "Coconut" });

// --- Valid Arabic custom allergies -----------------------------------------
for (const food of [
  "مكسرات", "بندق", "لوز", "جوز", "جلوتين", "فول الصويا", "محار", "جوز الهند",
  "خردل", "لوبين", "كيوي", "فراولة", "ذرة", "سكر", "كرفس", "ثوم", "صنوبر",
  "عباد الشمس",
]) {
  check("valid Arabic", food, OK);
}
check("Arabic with tatweel / harakat", "فراوِلـة", OK);

// --- Valid hyphenated food name --------------------------------------------
check("hyphenated", "Kiwi-fruit", OK);
check("apostrophe", "Hen's egg", OK);

// --- Standard allergy alias selects the standard option --------------------
check("Arabic Milk alias", "حليب", { ok: true, standard: "Milk" });
check("Arabic Eggs alias", "بيض", { ok: true, standard: "Eggs" });
check("Arabic Peanuts alias", "فول سوداني", { ok: true, standard: "Peanuts" });
check("Arabic Wheat alias", "قمح", { ok: true, standard: "Wheat" });
check("Arabic Sesame alias", "سمسم", { ok: true, standard: "Sesame" });
check("Arabic Fish alias", "سمك", { ok: true, standard: "Fish" });
check("Arabic Soy alias", "صويا", { ok: true, standard: "Soy" });
check("English Peanut → Peanuts", "Peanut", { ok: true, standard: "Peanuts" });
check("English egg → Eggs", "egg", { ok: true, standard: "Eggs" });

// --- Arabic random words and sentences -------------------------------------
check("Arabic random word", "مرحبا", notFood);
check("Arabic random word", "اختبار", notFood);
check("Arabic random word", "تجريبي", notFood);
check("Arabic random word", "كلام", notFood);
check("Arabic random word", "فارغ", notFood);
check("Arabic random word", "لا شيء", notFood);
check("Arabic random word", "لايوجد", notFood);
check("Arabic random word", "غير معروف", notFood);
check("Arabic random word", "أي شيء", notFood);
check("Arabic random word (not food)", "سيارة", unknown);
check("Arabic random word (not food)", "كتاب", unknown);
check("Arabic random word (not food)", "قلم ازرق", unknown);
check("Arabic sentence", "انا عندي حساسية من الحليب والبيض", sentence);
check("Arabic with question mark", "حليب؟", letters);
check("Arabic comma list", "حليب، بيض", letters);

// --- English placeholders and random text ----------------------------------
for (const value of [
  "test", "Testing", "hello", "abc", "XYZ", "anything", "none", "null",
  "undefined", "empty", "aaaa",
]) {
  check("English placeholder", value, notFood);
}
check("English random word", "banana bread pudding cake", unknown);
check("English random word", "Car", unknown);
check("English sentence", "I am allergic to peanuts and milk", sentence);

// --- Numbers, emoji, URLs, e-mails, code, punctuation ----------------------
check("numbers", "123", numbers);
check("numbers inside", "milk2", numbers);
check("Arabic-Indic digits", "حليب٢", numbers);
check("emoji", "🍓", letters);
check("emoji after word", "Strawberry 🍓", letters);
check("URL", "https://example.com", letters);
check("e-mail", "me@mail.com", letters);
check("code", "<script>", letters);
check("code", "console.log()", letters);
check("punctuation", "Milk, eggs", letters);
check("other script", "Молоко", letters);

// --- Empty / length --------------------------------------------------------
check("empty", "   ", { ok: false, message: "prefs.enterAllergyBody" });
check("too short", "a", { ok: false, message: "prefs.allergyTooShort" });
check("too long", "Strawberry".repeat(5), { ok: false, message: "prefs.allergyTooLong" });

// --- Duplicates (case-insensitive, Arabic-normalised, cross-language) -------
check("duplicate same case", "Coconut", duplicate, [], ["Coconut"]);
check("duplicate other case", "COCONUT", duplicate, [], ["coconut"]);
check("duplicate Arabic of English", "جوز الهند", duplicate, [], ["Coconut"]);
check("duplicate English of Arabic", "Sugar", duplicate, [], ["سكر"]);
check("duplicate Arabic spelling variant", "فراوله", duplicate, [], ["فراولة"]);
check("duplicate plural", "Strawberries", duplicate, [], ["Strawberry"]);

// --- Already selected standard allergy -------------------------------------
check("selected Milk (Arabic)", "حليب", selectedMsg, ["Milk"]);
check("selected Milk (English)", "milk", selectedMsg, ["Milk"]);
check("selected Peanuts (singular)", "Peanut", selectedMsg, ["Peanuts"]);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
