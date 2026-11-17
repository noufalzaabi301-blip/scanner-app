// ---------------------------------------------------------------------------
// scripts/checkNoFoodWrites.ts
// Safety check for the app (frontend) code:
//   - no direct write (insert / update / upsert / delete) to the food
//     database "products" table: approvals must go through the
//     approve-product-submission Edge Function;
//   - the food database client (lib/productSupabase.ts) is only used for
//     reading approved products;
//   - no service-role / secret key in app code.
//
// Run: npx tsx scripts/checkNoFoodWrites.ts   (exits with 1 on a problem)
// Edge Functions (supabase/functions) are server code and are not checked.
// ---------------------------------------------------------------------------

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const FRONTEND = ["App.tsx", "index.ts", "lib", "screens", "components"];

function listFiles(path: string): string[] {
  const full = join(ROOT, path);

  if (statSync(full).isFile()) {
    return [full];
  }

  return readdirSync(full).flatMap((name) => listFiles(join(path, name)));
}

const files = FRONTEND.flatMap(listFiles).filter((file) => /\.(ts|tsx)$/.test(file));
const problems: string[] = [];

for (const file of files) {
  const name = relative(ROOT, file);
  const source = readFileSync(file, "utf8");
  // Ignore comments so explanations do not count as code.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  // .from("products") followed (within the same chain) by a write.
  const productChains = code.match(/\.from\(\s*["'`]products["'`]\s*\)[\s\S]{0,200}?;/g) ?? [];

  for (const chain of productChains) {
    if (/\.(insert|update|upsert|delete)\s*\(/.test(chain)) {
      problems.push(`${name}: direct write to the food "products" table`);
    }
  }

  if (name !== "lib/productSupabase.ts" && /productSupabase\b(?!\.ts)/.test(code) && /createClient/.test(code) && /PRODUCT_SUPABASE/.test(code)) {
    problems.push(`${name}: creates its own food database client`);
  }

  if (/SERVICE_ROLE|service_role_key|sb_secret_[A-Za-z0-9]/i.test(code)) {
    problems.push(`${name}: mentions a service-role / secret key`);
  }
}

// The food database client must stay read-only.
const foodClient = readFileSync(join(ROOT, "lib/productSupabase.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

if (/\.(insert|update|upsert|delete)\s*\(/.test(foodClient)) {
  problems.push("lib/productSupabase.ts: the food database client writes data");
}

if (problems.length > 0) {
  console.error("Food database safety check FAILED:");
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

console.log(
  `Food database safety check passed: ${files.length} app files, no direct writes to food products, no service-role keys.`
);
