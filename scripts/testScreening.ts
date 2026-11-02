// ---------------------------------------------------------------------------
// scripts/testScreening.ts
// Run with:  npx tsx scripts/testScreening.ts
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import {
  isIngredientHighlighted,
  screenProduct,
  type ScreeningInput,
} from "../lib/screening";

let passed = 0;
let failed = 0;

function run(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (error: any) {
    failed += 1;
    console.log(`FAIL  ${name}\n      ${error?.message}`);
  }
}

function screen(partial: Partial<ScreeningInput>) {
  return screenProduct({
    allergies: [],
    prefersHalal: false,
    ingredients: "",
    contains: "",
    mayContain: "",
    ...partial,
  });
}

// ----- Required cases -----

run("Soybeans: 'Emulsifier (Soya Lecithin)' is detected", () => {
  const r = screen({ allergies: ["Soybeans"], ingredients: "Sugar, Emulsifier (Soya Lecithin)" });
  assert.equal(r.allergy.level, "direct");
  assert.match(r.allergy.status, /Soybeans/);
  assert.equal(r.allergy.findings[0].statement, "Emulsifier (Soya Lecithin)");
  assert.equal(r.allergy.findings[0].sourceLabel, "Ingredients");
  assert.ok(isIngredientHighlighted("Emulsifier (Soya Lecithin)", r));
  assert.ok(!isIngredientHighlighted("Sugar", r));
});

run("Milk: 'Skimmed Milk Powder' detected and highlighted", () => {
  const r = screen({ allergies: ["Milk"], ingredients: "Sugar, Skimmed Milk Powder, Salt" });
  assert.equal(r.allergy.level, "direct");
  assert.ok(isIngredientHighlighted("Skimmed Milk Powder", r));
});

run("Wheat: 'Wheat Flour' detected and highlighted", () => {
  const r = screen({ allergies: ["Wheat"], ingredients: "Wheat Flour, Water" });
  assert.equal(r.allergy.level, "direct");
  assert.ok(isIngredientHighlighted("Wheat Flour", r));
  assert.ok(!isIngredientHighlighted("Water", r));
});

run("Eggs: 'Whole Egg Powder' detected and highlighted", () => {
  const r = screen({ allergies: ["Eggs"], ingredients: "Whole Egg Powder, Sugar" });
  assert.equal(r.allergy.level, "direct");
  assert.match(r.allergy.status, /Eggs/);
  assert.ok(isIngredientHighlighted("Whole Egg Powder", r));
});

run("Tree nuts: 'Hazelnut Paste' detected", () => {
  const r = screen({ allergies: ["Tree nuts"], ingredients: "Sugar, Hazelnut Paste" });
  assert.equal(r.allergy.level, "direct");
  assert.match(r.allergy.status, /Tree nuts/);
});

run("Sesame: 'Tahini' detected", () => {
  const r = screen({ allergies: ["Sesame"], ingredients: "Chickpeas, Tahini, Lemon" });
  assert.equal(r.allergy.level, "direct");
});

run("Halal: 'Soy Lecithin (E322)' -> no identified concern", () => {
  const r = screen({ prefersHalal: true, ingredients: "Sugar, Soy Lecithin (E322)" });
  assert.equal(r.halal?.level, "clear");
  assert.equal(r.halal?.status, "No identified concern from available label information");
});

// ----- Extra cases -----

run("Several allergens are all listed in label order", () => {
  const r = screen({
    allergies: ["Milk", "Wheat", "Soybeans", "Eggs"],
    ingredients: "Wheat Flour, Sugar, Whole Milk Powder, Salt, Soya Lecithin, Eggs",
  });
  assert.equal(r.allergy.status, "Allergen detected: Wheat, Milk, Soybeans, Eggs");
  assert.equal(r.allergy.findings.length, 4);
});

run("Contains-only finding still highlights the related ingredient", () => {
  const r = screen({ allergies: ["Milk"], ingredients: "Sugar, Whey", contains: "Milk" });
  assert.ok(r.allergy.findings.some((f) => f.sourceLabel === "Contains"));
  assert.ok(isIngredientHighlighted("Whey", r));
});

run("May contain -> possible, not direct", () => {
  const r = screen({ allergies: ["Peanuts"], ingredients: "Sugar", mayContain: "Peanuts" });
  assert.equal(r.allergy.level, "may");
  assert.equal(r.allergy.findings[0].matchType, "possible");
});

run("Traces wording inside ingredients -> possible", () => {
  const r = screen({ allergies: ["Milk"], ingredients: "Sugar, Cocoa. May contain traces of milk" });
  assert.equal(r.allergy.level, "may");
});

run("'fish' does not match 'Fisherman'", () => {
  const r = screen({ allergies: ["Fish"], ingredients: "Sugar", brandName: "Fisherman's Friend" });
  assert.equal(r.allergy.level, "clear");
});

run("Coconut milk is not dairy", () => {
  const r = screen({ allergies: ["Milk"], ingredients: "Coconut Milk, Water" });
  assert.equal(r.allergy.level, "clear");
});

run("Sunflower lecithin does not trigger soy", () => {
  const r = screen({ allergies: ["Soy"], ingredients: "Emulsifier (Sunflower Lecithin, E322)" });
  assert.equal(r.allergy.level, "clear");
});

run("E322 alone -> soy needs verification", () => {
  const r = screen({ allergies: ["Soy"], ingredients: "Emulsifier (E322)" });
  assert.equal(r.allergy.level, "verify");
});

run("Halal: E322 alone -> verify", () => {
  const r = screen({ prefersHalal: true, ingredients: "Emulsifier (E 322)" });
  assert.equal(r.halal?.level, "verify");
});

run("Halal: E471 still flagged next to soy lecithin", () => {
  const r = screen({ prefersHalal: true, ingredients: "Emulsifiers (Soy Lecithin, E471)" });
  assert.equal(r.halal?.level, "verify");
  assert.match(r.halal?.findings[0].headline ?? "", /e471/);
});

run("Halal: oils, wheat, sugar, salt, milk, sesame are not concerns", () => {
  const r = screen({
    prefersHalal: true,
    ingredients: "Vegetable Oil, Wheat Flour, Sugar, Salt, Milk, Sesame",
  });
  assert.equal(r.halal?.level, "clear");
});

run("Halal: pork gelatin -> concern", () => {
  const r = screen({ prefersHalal: true, ingredients: "Sugar, Pork Gelatin" });
  assert.equal(r.halal?.level, "direct");
});

run("Halal disabled -> no halal card", () => {
  const r = screen({ prefersHalal: false, ingredients: "Pork" });
  assert.equal(r.halal, null);
});

run("Custom allergy with plural is never ignored", () => {
  const r = screen({ allergies: ["Strawberries"], ingredients: "Sugar, Strawberry Puree" });
  assert.equal(r.allergy.level, "direct");
  assert.match(r.allergy.status, /Strawberries/);
});

run("Custom allergy with hyphen", () => {
  const r = screen({ allergies: ["kiwi-fruit"], ingredients: "Kiwi Fruit (12%), Sugar" });
  assert.equal(r.allergy.level, "direct");
});

run("Product name match -> verify when ingredients miss it", () => {
  const r = screen({ allergies: ["Peanuts"], ingredients: "Sugar, Salt", productName: "Peanut Crunch Bar" });
  assert.equal(r.allergy.level, "verify");
  assert.equal(r.allergy.findings[0].sourceLabel, "Product name");
});

run("'Contains: Milk, Soy and Wheat' finds all three", () => {
  const r = screen({ allergies: ["Milk", "Soy", "Wheat"], ingredients: "Sugar", contains: "Milk, Soy and Wheat" });
  assert.equal(r.allergy.status, "Allergen detected: Milk, Soy, Wheat");
});

run("Gluten-free oats don't trigger wheat", () => {
  const r = screen({ allergies: ["Wheat"], ingredients: "Gluten-free oats, Rice Flour" });
  assert.equal(r.allergy.level, "clear");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);