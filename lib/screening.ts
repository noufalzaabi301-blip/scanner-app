// ---------------------------------------------------------------------------
// lib/screening.ts
// Controlled allergy and halal-related screening for label text.
// This does not guarantee safety and does not certify a product as halal.
// ---------------------------------------------------------------------------

// Result levels used by HomeScreen colors.
export type Level =
  | "direct"
  | "may"
  | "clear"
  | "verify"
  | "none"
  | "error";

// Locations where a finding was detected.
export type SourceLabel =
  | "Ingredients"
  | "Contains"
  | "May contain"
  | "Product name"
  | "Brand";

// How strong a finding is.
// direct   = listed in the ingredients or Contains statement
// possible = "may contain", traces or similar precautionary wording
// verify   = the source is not stated (or only the product name / brand matched)
export type MatchType = "direct" | "possible" | "verify";

// One detected ingredient or warning.
export type Finding = {
  headline: string;
  sourceLabel: SourceLabel;
  statement: string; // the exact label text that caused the match
  allergen?: string; // the user's allergy name, or "Halal"
  matchedTerm?: string; // the dictionary term that matched
  matchType?: MatchType;
};

// One screening result section.
export type ScreeningSection = {
  level: Level;
  status: string;
  explanation: string;
  findings: Finding[];
};

// Complete screening result.
export type ScreeningData = {
  allergy: ScreeningSection;
  halal: ScreeningSection | null;
};

// Ingredient that the AI was not certain about.
export type UncertainIngredient = {
  original: string;
  value: string;
  confirmed: boolean;
};

// Input used by screenProduct.
export type ScreeningInput = {
  allergies: string[];
  prefersHalal: boolean;
  ingredients: string;
  contains: string;
  mayContain: string;
  productName?: string;
  brandName?: string;
};

// Separators used to display ingredient items.
export const ITEM_SEPARATORS = ",;\n،|";

// ---------------------------------------------------------------------------
// TEXT HELPERS
// ---------------------------------------------------------------------------

// Normalizes English and Arabic text: lowercase, no accents,
// punctuation (hyphens, slashes, parentheses, commas) becomes spaces.
export function normalizeText(value: string): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Spelling variations that should match each other.
// Applied to BOTH the label text and the dictionary terms.
const PHRASE_EQUIVALENTS: [string, string][] = [
  ["soya", "soy"],
  ["soy bean", "soybean"],
  ["yoghurt", "yogurt"],
  ["skimmed", "skim"],
  ["albumen", "albumin"],
  ["flavour", "flavor"],
  ["gelatine", "gelatin"],
  ["glycerine", "glycerin"],
  ["tahina", "tahini"],
  ["mollusk", "mollusc"],
];

// Turns plural English words into their singular form
// (eggs -> egg, hazelnuts -> hazelnut, anchovies -> anchovy).
function singularizeWord(word: string): string {
  if (!/^[a-z]+$/.test(word) || word.length <= 3) {
    return word;
  }

  if (word.endsWith("ies") && word.length > 4) {
    return `${word.slice(0, -3)}y`;
  }

  // Words like "glass", "couscous", "arachis" are not plurals.
  if (/(ss|us|is)$/.test(word)) {
    return word;
  }

  if (word.endsWith("s")) {
    return word.slice(0, -1);
  }

  return word;
}

const canonicalCache = new Map<string, string>();

// Full matching form: normalized, E-numbers joined ("E 322" -> "e322"),
// plurals removed and spelling variations unified.
export function canonicalText(value: string): string {
  const raw = String(value ?? "");
  const cached = canonicalCache.get(raw);

  if (cached !== undefined) {
    return cached;
  }

  let text = normalizeText(raw).replace(/\be (\d{3,4}[a-z]?)\b/g, "e$1");

  let padded = ` ${text.split(" ").map(singularizeWord).join(" ")} `;

  for (const [from, to] of PHRASE_EQUIVALENTS) {
    const pattern = ` ${from} `;
    let guard = 0;

    while (padded.includes(pattern) && guard < 50) {
      padded = padded.replace(pattern, ` ${to} `);
      guard += 1;
    }
  }

  text = padded.replace(/\s+/g, " ").trim();

  if (canonicalCache.size > 5000) {
    canonicalCache.clear();
  }

  canonicalCache.set(raw, text);
  return text;
}

function isArabic(value: string): boolean {
  return /[\u0600-\u06ff]/.test(value);
}

// Word-aware check: "fish" matches "fish oil" but not "fisherman".
function containsCanonical(textCanon: string, termCanon: string): boolean {
  if (!textCanon || !termCanon) {
    return false;
  }

  if (isArabic(termCanon)) {
    return textCanon.includes(termCanon);
  }

  return ` ${textCanon} `.includes(` ${termCanon} `);
}

// Removes safe phrases (e.g. "coconut milk") before matching,
// and reports which ones were present.
function maskExclusions(
  textCanon: string,
  exclusions: string[] = []
): { text: string; found: string[] } {
  let padded = ` ${textCanon} `;
  const found: string[] = [];

  for (const exclusion of exclusions) {
    const exclusionCanon = canonicalText(exclusion);

    if (!exclusionCanon) {
      continue;
    }

    const pattern = isArabic(exclusionCanon)
      ? exclusionCanon
      : ` ${exclusionCanon} `;

    if (padded.includes(pattern)) {
      found.push(exclusion);
      padded = padded.split(pattern).join(" # ");
    }
  }

  return { text: padded.replace(/\s+/g, " ").trim(), found };
}

// Splits text without splitting inside parentheses.
export function splitTopLevel(
  text: string,
  separators: string = ITEM_SEPARATORS
): string[] {
  const result: string[] = [];
  let current = "";
  let depth = 0;

  for (const character of String(text ?? "")) {
    if ("([{".includes(character)) {
      depth += 1;
    }

    if (")]}".includes(character)) {
      depth = Math.max(0, depth - 1);
    }

    const isSeparator = depth === 0 && separators.includes(character);

    if (isSeparator) {
      if (current.trim()) {
        result.push(current.trim());
      }

      current = "";
    } else {
      current += character;
    }
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result.filter(Boolean);
}

// Converts the AI uncertainty result into editable review rows.
export function parseUncertainIngredients(raw: unknown): UncertainIngredient[] {
  const values: string[] = Array.isArray(raw)
    ? raw.filter((item): item is string => typeof item === "string")
    : typeof raw === "string"
    ? splitTopLevel(raw)
    : [];

  const seen = new Set<string>();

  return values
    .map((item) => item.trim())
    .filter((item) => {
      const normalized = normalizeText(item);

      if (!normalized || seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    })
    .map((item) => ({
      original: item,
      value: item,
      confirmed: false,
    }));
}

// Applies user corrections to the original ingredient list.
export function applyIngredientCorrections(
  ingredients: string,
  items: UncertainIngredient[]
): string {
  let result = String(ingredients ?? "");

  for (const item of items) {
    const original = item.original.trim();
    const replacement = item.value.trim();

    if (!original || !replacement || original === replacement) {
      continue;
    }

    const index = result.indexOf(original);

    if (index >= 0) {
      result =
        result.slice(0, index) +
        replacement +
        result.slice(index + original.length);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// RULES + MATCHING
// ---------------------------------------------------------------------------

type Rule = {
  key: string;
  aliases: string[]; // allergy names a user may have saved for this rule
  directTerms: string[];
  verifyTerms?: string[];
  exclusions?: string[]; // safe phrases removed before matching
  // When an exclusion phrase is present, these verify terms are already
  // explained (e.g. "sunflower lecithin" explains "E322").
  resolves?: Record<string, string[]>;
};

type RuleMatch = { kind: "direct" | "verify"; term: string };

// Checks one label item against one rule.
function matchRule(
  item: string,
  rule: Rule,
  includeVerify: boolean
): RuleMatch | null {
  const { text, found } = maskExclusions(canonicalText(item), rule.exclusions);

  for (const term of rule.directTerms) {
    if (containsCanonical(text, canonicalText(term))) {
      return { kind: "direct", term };
    }
  }

  if (!includeVerify || !rule.verifyTerms) {
    return null;
  }

  const suppressed = new Set(
    found.flatMap((phrase) =>
      (rule.resolves?.[phrase] ?? []).map((term) => canonicalText(term))
    )
  );

  for (const term of rule.verifyTerms) {
    const termCanon = canonicalText(term);

    if (!suppressed.has(termCanon) && containsCanonical(text, termCanon)) {
      return { kind: "verify", term };
    }
  }

  return null;
}

// Precautionary wording inside any field = "possible", not "direct".
function isPrecautionary(item: string): boolean {
  const text = ` ${normalizeText(item)} `;

  return [
    " may contain ",
    " may also contain ",
    " can contain ",
    " might contain ",
    " trace ",
    " traces ",
    " may be present ",
    " made in a factory ",
    " made in a facility ",
    " produced in a factory ",
    " produced in a facility ",
    " manufactured in a facility ",
    " manufactured on ",
    " processed in a facility ",
    " packed in a facility ",
    " same production line ",
    " shared equipment ",
    " قد يحتوي ",
    " اثار ",
  ].some((phrase) => text.includes(phrase));
}

// ---------------------------------------------------------------------------
// ALLERGEN DICTIONARY
// ---------------------------------------------------------------------------

const WHEAT_DIRECT = [
  "wheat",
  "wheat flour",
  "whole wheat",
  "wheat starch",
  "wheat protein",
  "wheat gluten",
  "gluten",
  "durum",
  "semolina",
  "farina",
  "spelt",
  "couscous",
  "bulgur",
  "seitan",
  "einkorn",
  "emmer",
  "kamut",
  "قمح",
  "دقيق القمح",
  "سميد",
  "برغل",
];

const WHEAT_VERIFY = [
  "flour",
  "starch",
  "modified starch",
  "breadcrumbs",
  "دقيق",
];

const WHEAT_EXCLUSIONS = [
  "buckwheat",
  "rice flour",
  "corn flour",
  "maize flour",
  "potato flour",
  "chickpea flour",
  "coconut flour",
  "almond flour",
  "potato starch",
  "corn starch",
  "maize starch",
  "tapioca starch",
  "rice starch",
  "pea starch",
  "gluten free",
];

const ALLERGY_RULES: Rule[] = [
  {
    key: "milk",
    aliases: ["milk", "dairy", "dairy products", "lactose", "cow milk", "milk products"],
    directTerms: [
      "milk",
      "dairy",
      "dairy products",
      "milk powder",
      "skimmed milk powder",
      "skim milk",
      "milk solids",
      "whey",
      "whey powder",
      "lactose",
      "casein",
      "caseinate",
      "butter",
      "buttermilk",
      "butterfat",
      "butter oil",
      "cream",
      "cheese",
      "yogurt",
      "yoghurt",
      "ghee",
      "curd",
      "lactalbumin",
      "lactoglobulin",
      "حليب",
      "لبن",
      "جبن",
      "زبدة",
      "قشدة",
      "مصل اللبن",
    ],
    verifyTerms: ["lactic acid", "milk flavor", "milk flavour"],
    exclusions: [
      "coconut milk",
      "coconut cream",
      "coconut yogurt",
      "almond milk",
      "oat milk",
      "soy milk",
      "soya milk",
      "rice milk",
      "cashew milk",
      "cocoa butter",
      "shea butter",
      "peanut butter",
      "nut butter",
      "almond butter",
      "cashew butter",
      "cream of tartar",
      "milk thistle",
      "dairy free",
      "milk free",
      "lactose free",
    ],
  },

  {
    key: "egg",
    aliases: ["egg", "eggs", "egg products"],
    directTerms: [
      "egg",
      "eggs",
      "egg powder",
      "whole egg",
      "egg white",
      "egg yolk",
      "albumin",
      "albumen",
      "ovalbumin",
      "ovomucoid",
      "lysozyme",
      "mayonnaise",
      "meringue",
      "بيض",
      "صفار البيض",
    ],
    exclusions: ["egg plant", "egg free"],
  },

  {
    key: "peanut",
    aliases: ["peanut", "peanuts", "groundnut", "groundnuts"],
    directTerms: [
      "peanut",
      "peanuts",
      "peanut butter",
      "peanut flour",
      "peanut oil",
      "groundnut",
      "arachis",
      "monkey nut",
      "فول سوداني",
      "فستق سوداني",
    ],
  },

  {
    key: "tree nut",
    aliases: ["tree nut", "tree nuts", "nut", "nuts"],
    directTerms: [
      "tree nuts",
      "almond",
      "almonds",
      "hazelnut",
      "hazelnuts",
      "walnut",
      "walnuts",
      "cashew",
      "cashews",
      "pistachio",
      "pistachios",
      "pecan",
      "pecans",
      "macadamia",
      "brazil nut",
      "brazil nuts",
      "pine nut",
      "pine nuts",
      "mixed nuts",
      "praline",
      "marzipan",
      "gianduja",
      "مكسرات",
      "لوز",
      "بندق",
      "جوز",
      "كاجو",
      "فستق حلبي",
    ],
    // Generic "nuts" (e.g. "may contain nuts") needs checking.
    verifyTerms: ["nut", "nuts"],
    exclusions: ["water chestnut", "جوز الهند", "جوزة الطيب"],
  },

  {
    key: "wheat",
    aliases: ["wheat", "wheat products"],
    directTerms: WHEAT_DIRECT,
    verifyTerms: WHEAT_VERIFY,
    exclusions: WHEAT_EXCLUSIONS,
  },

  {
    key: "gluten",
    aliases: ["gluten", "celiac", "coeliac", "gluten intolerance"],
    directTerms: [...WHEAT_DIRECT, "barley", "rye", "triticale", "malt", "malt extract"],
    verifyTerms: [...WHEAT_VERIFY, "oat", "oats"],
    exclusions: WHEAT_EXCLUSIONS,
  },

  {
    key: "soy",
    aliases: ["soy", "soya", "soybean", "soybeans", "soy bean", "soy beans", "soya beans"],
    directTerms: [
      "soy",
      "soya",
      "soybean",
      "soybeans",
      "soy bean",
      "soy beans",
      "soya lecithin",
      "soy lecithin",
      "soybean oil",
      "soy protein",
      "soy flour",
      "textured vegetable protein",
      "tvp",
      "edamame",
      "tofu",
      "miso",
      "tempeh",
      "صويا",
      "فول الصويا",
    ],
    verifyTerms: ["lecithin", "e322", "vegetable protein", "ليسيثين"],
    exclusions: ["sunflower lecithin", "rapeseed lecithin", "canola lecithin", "soy free"],
    resolves: {
      "sunflower lecithin": ["lecithin", "e322"],
      "rapeseed lecithin": ["lecithin", "e322"],
      "canola lecithin": ["lecithin", "e322"],
    },
  },

  {
    key: "fish",
    aliases: ["fish", "fishes"],
    directTerms: [
      "fish",
      "fish oil",
      "fish stock",
      "fish sauce",
      "fish gelatin",
      "anchovy",
      "anchovies",
      "salmon",
      "tuna",
      "cod",
      "sardine",
      "sardines",
      "mackerel",
      "haddock",
      "trout",
      "pollock",
      "tilapia",
      "hake",
      "herring",
      "سمك",
      "اسماك",
      "تونة",
      "سردين",
      "انشوجة",
    ],
    verifyTerms: ["omega 3", "worcestershire sauce"],
  },

  {
    key: "shellfish",
    aliases: ["shellfish", "crustacean", "crustaceans", "mollusc", "molluscs", "seafood"],
    directTerms: [
      "shellfish",
      "crustacean",
      "shrimp",
      "prawn",
      "crab",
      "lobster",
      "crayfish",
      "krill",
      "scampi",
      "clam",
      "mussel",
      "oyster",
      "scallop",
      "squid",
      "octopus",
      "mollusc",
      "روبيان",
      "جمبري",
      "قريدس",
      "سلطعون",
      "كركند",
      "محار",
    ],
  },

  {
    key: "sesame",
    aliases: ["sesame", "sesame seed", "sesame seeds"],
    directTerms: [
      "sesame",
      "sesame seed",
      "sesame seeds",
      "tahini",
      "sesame oil",
      "sesame flour",
      "gingelly",
      "benne",
      "simsim",
      "سمسم",
      "طحينة",
      "طحينية",
    ],
  },
];

// Matches the user's saved allergy name to a dictionary rule.
// Unknown names become a custom rule, so a custom allergy is never ignored.
function ruleForAllergy(allergy: string): Rule {
  const key = canonicalText(allergy);

  for (const rule of ALLERGY_RULES) {
    if (rule.aliases.some((alias) => canonicalText(alias) === key)) {
      return rule;
    }
  }

  return {
    key: `custom:${key}`,
    aliases: [allergy],
    directTerms: [allergy.trim()],
  };
}

// ---------------------------------------------------------------------------
// LABEL SOURCES
// ---------------------------------------------------------------------------

type LabelPart = { source: SourceLabel; items: string[] };

function labelParts(input: ScreeningInput): LabelPart[] {
  const productName = String(input.productName ?? "").trim();
  const brandName = String(input.brandName ?? "").trim();

  return [
    { source: "Ingredients", items: splitTopLevel(input.ingredients) },
    { source: "Contains", items: splitTopLevel(input.contains) },
    { source: "May contain", items: splitTopLevel(input.mayContain) },
    { source: "Product name", items: productName ? [productName] : [] },
    { source: "Brand", items: brandName ? [brandName] : [] },
  ];
}

// Removes duplicate findings while preserving the order they appeared in.
function uniqueFindings(findings: Finding[]): Finding[] {
  const unique = new Map<string, Finding>();

  for (const finding of findings) {
    const key =
      `${canonicalText(finding.allergen ?? finding.headline)}|` +
      `${finding.sourceLabel}|` +
      `${canonicalText(finding.statement)}`;

    if (!unique.has(key)) {
      unique.set(key, finding);
    }
  }

  return [...unique.values()];
}

function uniqueInOrder(values: string[]): string[] {
  return [...new Set(values)];
}

// ---------------------------------------------------------------------------
// ALLERGY SCREENING
// ---------------------------------------------------------------------------

function screenAllergies(input: ScreeningInput): ScreeningSection {
  // One entry per rule, keeping the name the user saved.
  const profile: { label: string; rule: Rule }[] = [];
  const seenRules = new Set<string>();

  for (const raw of input.allergies) {
    const label = String(raw ?? "").trim();

    if (!label || !canonicalText(label)) {
      continue;
    }

    const rule = ruleForAllergy(label);

    if (!seenRules.has(rule.key)) {
      seenRules.add(rule.key);
      profile.push({ label, rule });
    }
  }

  if (profile.length === 0) {
    return {
      level: "none",
      status: "No allergies in your profile",
      explanation: "Add allergies to your profile to screen products against them.",
      findings: [],
    };
  }

  if (!input.ingredients.trim() && !input.contains.trim() && !input.mayContain.trim()) {
    return {
      level: "error",
      status: "Insufficient information",
      explanation: "There is no confirmed ingredient or allergen information to check.",
      findings: [],
    };
  }

  const findings: Finding[] = [];
  const foundInLabel = new Set<string>(); // rule keys found in label text

  // Every source, every item, every allergy — never stops at the first match.
  for (const part of labelParts(input)) {
    const isNameSource = part.source === "Product name" || part.source === "Brand";

    for (const item of part.items) {
      const precautionary = part.source === "May contain" || isPrecautionary(item);

      for (const { label, rule } of profile) {
        // Brand is only relevant when nothing else found this allergen.
        if (part.source === "Brand" && foundInLabel.has(rule.key)) {
          continue;
        }

        const match = matchRule(item, rule, !isNameSource);

        if (!match) {
          continue;
        }

        let matchType: MatchType;
        let headline: string;

        if (isNameSource) {
          matchType = "verify";
          headline = `${label} mentioned in ${part.source.toLowerCase()}`;
        } else if (precautionary) {
          matchType = "possible";
          headline = `May contain: ${label}`;
        } else if (match.kind === "direct") {
          matchType = "direct";
          headline = `Allergen detected: ${label}`;
        } else {
          matchType = "verify";
          headline = `Possible ${label} source (${match.term})`;
        }

        if (!isNameSource) {
          foundInLabel.add(rule.key);
        }

        findings.push({
          headline,
          sourceLabel: part.source,
          statement: item,
          allergen: label,
          matchedTerm: match.term,
          matchType,
        });
      }
    }
  }

  const unique = uniqueFindings(findings);

  const direct = unique.filter((f) => f.matchType === "direct");
  const possible = unique.filter((f) => f.matchType === "possible");
  const verify = unique.filter((f) => f.matchType === "verify");

  const names = (list: Finding[]) =>
    uniqueInOrder(list.map((f) => f.allergen ?? "")).filter(Boolean);

  const directNames = names(direct);
  const possibleNames = names(possible).filter((n) => !directNames.includes(n));
  const verifyNames = names(verify).filter(
    (n) => !directNames.includes(n) && !possibleNames.includes(n)
  );

  // Direct first, then possible, then needs-checking.
  const ordered = [...direct, ...possible, ...verify];

  if (direct.length > 0) {
    const extra: string[] = [];

    if (possibleNames.length > 0) {
      extra.push(`The label also warns it may contain: ${possibleNames.join(", ")}.`);
    }

    if (verifyNames.length > 0) {
      extra.push(`Also check: ${verifyNames.join(", ")}.`);
    }

    return {
      level: "direct",
      status: `Allergen detected: ${directNames.join(", ")}`,
      explanation: [
        `Found in the ingredients or Contains statement: ${directNames.join(", ")}.`,
        ...extra,
      ].join(" "),
      findings: ordered,
    };
  }

  if (possible.length > 0) {
    return {
      level: "may",
      status: `May contain: ${possibleNames.join(", ")}`,
      explanation: [
        "The label includes a precautionary \"may contain\" or traces warning related to an allergy in your profile.",
        verifyNames.length > 0 ? `Also check: ${verifyNames.join(", ")}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
      findings: ordered,
    };
  }

  if (verify.length > 0) {
    return {
      level: "verify",
      status: "Requires allergy verification",
      explanation:
        "Some label text may relate to an allergy in your profile, but the label does not give enough detail to confirm it.",
      findings: ordered,
    };
  }

  return {
    level: "clear",
    status: "No selected allergen detected",
    explanation:
      "No selected allergy was found in the available label text. This is not a safety guarantee — always check the physical package.",
    findings: [],
  };
}

// ---------------------------------------------------------------------------
// HALAL-RELATED SCREENING
// ---------------------------------------------------------------------------

const HALAL_RULE: Rule = {
  key: "halal",
  aliases: [],
  // Explicit pork-related terms.
  directTerms: [
    "pork",
    "pig",
    "swine",
    "porcine",
    "pork fat",
    "lard",
    "ham",
    "bacon",
    "prosciutto",
    "pancetta",
    "خنزير",
    "لحم خنزير",
    "شحم الخنزير",
  ],
  // Ingredients whose source may vary.
  verifyTerms: [
    "gelatin",
    "e441",
    "collagen",
    "rennet",
    "animal rennet",
    "pepsin",
    "animal fat",
    "tallow",
    "carmine",
    "cochineal",
    "e120",
    "e542",
    "mono and diglycerides",
    "e471",
    "e472",
    "glycerin",
    "glycerol",
    "stearic acid",
    "e570",
    "shortening",
    "ethanol",
    "ethyl alcohol",
    "alcohol",
    "vanilla extract",
    "e322",
    "lecithin",
    "e422",
    "e470",
    "e470a",
    "e470b",
    "e476",
    "e477",
    "e481",
    "e482",
    "e920",
    "enzymes",
    "enzyme",
    "meat",
    "beef",
    "chicken",
    "lamb",
    "mutton",
    "veal",
    "turkey",
    "duck",
    "goat",
    "جيلاتين",
    "كحول",
    "منفحة",
    "شحم",
    "لحم",
    "دجاج",
  ],
  // Phrases that should not create a warning.
  exclusions: [
    "soy lecithin",
    "soybean lecithin",
    "sunflower lecithin",
    "rapeseed lecithin",
    "canola lecithin",
    "vegetable glycerin",
    "vegetable fat",
    "vegetable shortening",
    "vegetable mono and diglycerides",
    "fish gelatin",
    "halal gelatin",
    "non alcoholic",
    "alcohol free",
    "sugar alcohol",
    "beef bacon",
    "turkey bacon",
    "chicken ham",
    "turkey ham",
    "microbial rennet",
    "vegetable rennet",
  ],
  // A plant source stated on the label explains these terms.
  resolves: {
    "soy lecithin": ["e322", "lecithin"],
    "soybean lecithin": ["e322", "lecithin"],
    "sunflower lecithin": ["e322", "lecithin"],
    "rapeseed lecithin": ["e322", "lecithin"],
    "canola lecithin": ["e322", "lecithin"],
    "vegetable mono and diglycerides": ["e471", "mono and diglycerides"],
  },
};

function screenHalal(input: ScreeningInput): ScreeningSection {
  if (!input.ingredients.trim() && !input.contains.trim()) {
    return {
      level: "error",
      status: "Insufficient information",
      explanation: "There is not enough label information for halal-related screening.",
      findings: [],
    };
  }

  const concernFindings: Finding[] = [];
  const verifyFindings: Finding[] = [];

  for (const part of labelParts(input)) {
    // Traces are not halal findings; brand names are not checked.
    if (part.source === "May contain" || part.source === "Brand") {
      continue;
    }

    const isName = part.source === "Product name";

    for (const item of part.items) {
      // Product name: only explicit pork-related terms.
      const match = matchRule(item, HALAL_RULE, !isName);

      if (!match) {
        continue;
      }

      if (match.kind === "direct") {
        concernFindings.push({
          headline: `Halal-related concern (${match.term})`,
          sourceLabel: part.source,
          statement: item,
          allergen: "Halal",
          matchedTerm: match.term,
          matchType: "direct",
        });
      } else {
        verifyFindings.push({
          headline: `Requires halal verification (${match.term})`,
          sourceLabel: part.source,
          statement: item,
          allergen: "Halal",
          matchedTerm: match.term,
          matchType: "verify",
        });
      }
    }
  }

  const uniqueConcerns = uniqueFindings(concernFindings);
  const uniqueVerify = uniqueFindings(verifyFindings);

  if (uniqueConcerns.length > 0) {
    return {
      level: "direct",
      status: "Halal-related concern detected",
      explanation:
        "The label includes an ingredient that requires careful verification. This is not a halal certification decision.",
      findings: [...uniqueConcerns, ...uniqueVerify],
    };
  }

  if (uniqueVerify.length > 0) {
    return {
      level: "verify",
      status: "Requires verification",
      explanation:
        "Some ingredients can come from different sources. Check the package certification or contact the manufacturer.",
      findings: uniqueVerify,
    };
  }

  return {
    level: "clear",
    status: "No identified concern from available label information",
    explanation:
      "No known halal-related concern was identified in the available label text. This is not halal certification.",
    findings: [],
  };
}

// ---------------------------------------------------------------------------
// HIGHLIGHTING
// ---------------------------------------------------------------------------

// True when an ingredient row relates to ANY finding — including findings
// that came from Contains, May contain or the product name.
export function isIngredientHighlighted(
  ingredient: string,
  data: ScreeningData | null | undefined
): boolean {
  if (!data || !String(ingredient ?? "").trim()) {
    return false;
  }

  for (const finding of data.allergy.findings ?? []) {
    if (!finding.allergen) {
      continue;
    }

    const rule = ruleForAllergy(finding.allergen);

    if (matchRule(ingredient, rule, finding.matchType === "verify")) {
      return true;
    }
  }

  for (const finding of data.halal?.findings ?? []) {
    const match = matchRule(ingredient, HALAL_RULE, true);

    if (match && (finding.matchType === "verify" || match.kind === "direct")) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// PUBLIC SCREENING FUNCTION
// ---------------------------------------------------------------------------

export function screenProduct(input: ScreeningInput): ScreeningData {
  // Protect the screening function from missing or malformed values.
  const safeInput: ScreeningInput = {
    allergies: Array.isArray(input?.allergies)
      ? input.allergies.filter((a): a is string => typeof a === "string")
      : [],
    prefersHalal: input?.prefersHalal === true,
    ingredients: String(input?.ingredients ?? ""),
    contains: String(input?.contains ?? ""),
    mayContain: String(input?.mayContain ?? ""),
    productName: String(input?.productName ?? ""),
    brandName: String(input?.brandName ?? ""),
  };

  return {
    allergy: screenAllergies(safeInput),
    // Halal disabled = no halal card and no halal warning.
    halal: safeInput.prefersHalal ? screenHalal(safeInput) : null,
  };
}