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
  | "May Contain";

// One detected ingredient or warning.
export type Finding = {
  headline: string;
  sourceLabel: SourceLabel;
  statement: string;
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
};

// Separators used to display ingredient items.
export const ITEM_SEPARATORS = ",;\n،|";

// Normalizes English and Arabic text before matching.
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

    const isSeparator =
      depth === 0 && separators.includes(character);

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
export function parseUncertainIngredients(
  raw: unknown
): UncertainIngredient[] {
  const values: string[] = Array.isArray(raw)
    ? raw.filter(
        (item): item is string =>
          typeof item === "string"
      )
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
// Allergy rules
// ---------------------------------------------------------------------------

type AllergyRule = {
  name: string;
  directTerms: string[];
  verifyTerms?: string[];
  exclusions?: string[];
};

// These phrases should not make coconut or plant products look like dairy.
const MILK_EXCLUSIONS = [
  "coconut milk",
  "coconut cream",
  "almond milk",
  "oat milk",
  "soy milk",
  "soya milk",
  "rice milk",
  "cocoa butter",
  "shea butter",
  "peanut butter",
  "nut butter",
  "cream of tartar",
];

const ALLERGY_RULES: Record<string, AllergyRule> = {
  milk: {
    name: "Milk",
    directTerms: [
      "milk",
      "whey",
      "casein",
      "caseinate",
      "lactose",
      "butter",
      "buttermilk",
      "cream",
      "cheese",
      "yogurt",
      "yoghurt",
      "ghee",
      "curd",
      "dairy",
      "lactalbumin",
      "lactoglobulin",
      "milk solids",
      "milk powder",
      "حليب",
      "لبن",
      "جبن",
      "زبدة",
      "قشدة",
      "مصل اللبن",
    ],
    verifyTerms: [
      "lactic acid",
      "milk flavor",
      "milk flavour",
    ],
    exclusions: MILK_EXCLUSIONS,
  },

  eggs: {
    name: "Eggs",
    directTerms: [
      "egg",
      "eggs",
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
    exclusions: ["eggplant", "egg plant"],
  },

  peanuts: {
    name: "Peanuts",
    directTerms: [
      "peanut",
      "groundnut",
      "arachis",
      "monkey nut",
      "فول سوداني",
      "فستق سوداني",
    ],
  },

  "tree nuts": {
    name: "Tree nuts",
    directTerms: [
      "tree nut",
      "almond",
      "hazelnut",
      "walnut",
      "cashew",
      "pistachio",
      "pecan",
      "macadamia",
      "brazil nut",
      "pine nut",
      "praline",
      "marzipan",
      "nougat",
      "مكسرات",
      "لوز",
      "بندق",
      "جوز",
      "كاجو",
      "فستق حلبي",
    ],
    exclusions: [
      "water chestnut",
      "nutmeg",
      "coconut",
      "peanut",
      "groundnut",
      "جوز الهند",
      "جوزة الطيب",
    ],
  },

  wheat: {
    name: "Wheat",
    directTerms: [
      "wheat",
      "wheat flour",
      "semolina",
      "durum",
      "spelt",
      "farina",
      "couscous",
      "bulgur",
      "seitan",
      "einkorn",
      "emmer",
      "kamut",
      "graham",
      "قمح",
      "دقيق القمح",
      "سميد",
      "برغل",
    ],
    verifyTerms: [
      "flour",
      "gluten",
      "malt",
      "starch",
      "modified starch",
      "breadcrumbs",
      "دقيق",
    ],
    exclusions: [
      "buckwheat",
      "rice flour",
      "corn flour",
      "maize flour",
      "gluten free",
    ],
  },

  soy: {
    name: "Soy",
    directTerms: [
      "soy",
      "soya",
      "soybean",
      "soy bean",
      "soy lecithin",
      "soya lecithin",
      "edamame",
      "tofu",
      "miso",
      "tempeh",
      "صويا",
      "فول الصويا",
    ],
    verifyTerms: [
      "lecithin",
      "e322",
      "vegetable protein",
      "ليسيثين",
    ],
    exclusions: [
      "sunflower lecithin",
      "rapeseed lecithin",
    ],
  },

  fish: {
    name: "Fish",
    directTerms: [
      "fish",
      "anchovy",
      "cod",
      "salmon",
      "tuna",
      "sardine",
      "mackerel",
      "haddock",
      "pollock",
      "tilapia",
      "trout",
      "hake",
      "fish sauce",
      "fish oil",
      "سمك",
      "أسماك",
      "تونة",
      "سردين",
      "أنشوجة",
    ],
    verifyTerms: [
      "omega 3",
      "worcestershire sauce",
    ],
  },

  shellfish: {
    name: "Shellfish",
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
      "mussel",
      "oyster",
      "clam",
      "scallop",
      "squid",
      "octopus",
      "mollusc",
      "mollusk",
      "روبيان",
      "جمبري",
      "قريدس",
      "سلطعون",
      "كركند",
      "محار",
    ],
  },

  sesame: {
    name: "Sesame",
    directTerms: [
      "sesame",
      "sesame seed",
      "sesame oil",
      "tahini",
      "tahina",
      "gingelly",
      "benne",
      "simsim",
      "سمسم",
      "طحينة",
      "طحينية",
    ],
  },
};

// Matches the user's saved allergy name to a known rule.
function ruleForAllergy(allergy: string): AllergyRule {
  const key = normalizeText(allergy);

  const aliases: Record<string, string> = {
    egg: "eggs",
    peanut: "peanuts",
    nut: "tree nuts",
    "tree nut": "tree nuts",
    soya: "soy",
    gluten: "wheat",
    dairy: "milk",
    lactose: "milk",
    crustaceans: "shellfish",
    seafood: "shellfish",
  };

  return (
    ALLERGY_RULES[key] ||
    ALLERGY_RULES[aliases[key]] || {
      name: allergy.trim(),
      directTerms: [allergy.trim()],
    }
  );
}

// Escapes special characters before using a term in RegExp.
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Checks whether a term appears as a complete word or phrase.
function containsTerm(
  text: string,
  term: string
): boolean {
  const normalizedText = normalizeText(text);
  const normalizedTerm = normalizeText(term);

  if (!normalizedText || !normalizedTerm) {
    return false;
  }

  // Arabic terms are checked by phrase inclusion.
  if (/[\u0600-\u06ff]/.test(normalizedTerm)) {
    return normalizedText.includes(normalizedTerm);
  }

  const expression = new RegExp(
    `(^| )${escapeRegExp(normalizedTerm)}(s|es)?( |$)`
  );

  return expression.test(normalizedText);
}

// Returns true only when an item is exactly an excluded phrase.
function isExcluded(
  item: string,
  exclusions: string[] = []
): boolean {
  const normalizedItem = normalizeText(item);

  return exclusions.some(
    (exclusion) =>
      normalizeText(exclusion) === normalizedItem
  );
}

// Finds the first matching term in one ingredient item.
function findMatch(
  item: string,
  terms: string[] = [],
  exclusions: string[] = []
): string | null {
  // Do not classify exact safe phrases as allergen matches.
  if (isExcluded(item, exclusions)) {
    return null;
  }

  for (const term of terms) {
    if (containsTerm(item, term)) {
      return term;
    }
  }

  return null;
}

// Splits the label into ingredients, Contains, and May Contain sections.
function labelParts(input: ScreeningInput) {
  return [
    {
      source: "Ingredients" as SourceLabel,
      items: splitTopLevel(input.ingredients),
    },
    {
      source: "Contains" as SourceLabel,
      items: splitTopLevel(input.contains),
    },
    {
      source: "May Contain" as SourceLabel,
      items: splitTopLevel(input.mayContain),
    },
  ];
}

// Removes duplicate findings while preserving each source separately.
function uniqueFindings(findings: Finding[]): Finding[] {
  const unique = new Map<string, Finding>();

  for (const finding of findings) {
    const key =
      `${normalizeText(finding.headline)}|` +
      `${finding.sourceLabel}|` +
      `${normalizeText(finding.statement)}`;

    if (!unique.has(key)) {
      unique.set(key, finding);
    }
  }

  return [...unique.values()];
}

// ---------------------------------------------------------------------------
// Allergy screening
// ---------------------------------------------------------------------------

function screenAllergies(
  input: ScreeningInput
): ScreeningSection {
  const allergies = input.allergies
    .map((allergy) => allergy.trim())
    .filter(Boolean);

  if (allergies.length === 0) {
    return {
      level: "none",
      status: "No allergies in your profile",
      explanation:
        "Add allergies to your profile to screen products against them.",
      findings: [],
    };
  }

  if (
    !input.ingredients.trim() &&
    !input.contains.trim() &&
    !input.mayContain.trim()
  ) {
    return {
      level: "error",
      status: "Insufficient information",
      explanation:
        "There is no confirmed ingredient or allergen information to check.",
      findings: [],
    };
  }

  const directFindings: Finding[] = [];
  const mayFindings: Finding[] = [];
  const verifyFindings: Finding[] = [];

  const directAllergens = new Set<string>();
  const mayAllergens = new Set<string>();

  for (const allergy of allergies) {
    const rule = ruleForAllergy(allergy);

    for (const part of labelParts(input)) {
      for (const item of part.items) {
        const directMatch = findMatch(
          item,
          rule.directTerms,
          rule.exclusions
        );

        if (directMatch) {
          if (part.source === "May Contain") {
            mayAllergens.add(rule.name);

            mayFindings.push({
              headline: `May contain ${rule.name}`,
              sourceLabel: part.source,
              statement: item,
            });
          } else {
            directAllergens.add(rule.name);

            directFindings.push({
              headline: `Contains ${rule.name} (${directMatch})`,
              sourceLabel: part.source,
              statement: item,
            });
          }

          continue;
        }

        const verifyMatch = findMatch(
          item,
          rule.verifyTerms,
          rule.exclusions
        );

        if (
          verifyMatch &&
          part.source !== "May Contain"
        ) {
          verifyFindings.push({
            headline: `Possible ${rule.name} source (${verifyMatch})`,
            sourceLabel: part.source,
            statement: item,
          });
        }
      }
    }
  }

  const uniqueDirect = uniqueFindings(directFindings);
  const uniqueMay = uniqueFindings(mayFindings);
  const uniqueVerify = uniqueFindings(verifyFindings);

  if (uniqueDirect.length > 0) {
    return {
      level: "direct",
      status: `Allergen detected: ${[
        ...directAllergens,
      ].join(", ")}`,
      explanation:
        "A selected allergy was found in the ingredients or Contains statement.",
      findings: [
        ...uniqueDirect,
        ...uniqueMay,
        ...uniqueVerify,
      ],
    };
  }

  if (uniqueMay.length > 0) {
    return {
      level: "may",
      status: `May contain: ${[
        ...mayAllergens,
      ].join(", ")}`,
      explanation:
        "The label includes a possible trace warning related to an allergy in your profile.",
      findings: [
        ...uniqueMay,
        ...uniqueVerify,
      ],
    };
  }

  if (uniqueVerify.length > 0) {
    return {
      level: "verify",
      status: "Requires allergy verification",
      explanation:
        "Some ingredients may come from an allergen source, but the label does not provide enough detail to confirm it.",
      findings: uniqueVerify,
    };
  }

  return {
    level: "clear",
    status: "No selected allergen detected",
    explanation:
      "No selected allergy was found in the available label text. Always check the physical package.",
    findings: [],
  };
}

// ---------------------------------------------------------------------------
// Halal-related screening
// ---------------------------------------------------------------------------

// Explicit pork-related terms.
const HALAL_CONCERN_TERMS = [
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
];

// Ingredients whose source may vary.
const HALAL_VERIFY_TERMS = [
  "gelatin",
  "gelatine",
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
];

// Exact phrases that should not create false warnings.
const HALAL_EXCLUSIONS = [
  "vanilla",
  "vanilla flavor",
  "vanilla flavour",
  "vanillin",
  "vegetable glycerin",
  "vegetable glycerine",
  "vegetable fat",
  "vegetable shortening",
  "fish gelatin",
  "fish gelatine",
  "halal gelatin",
  "halal gelatine",
  "non alcoholic",
  "alcohol free",
  "sugar alcohol",
  "wine vinegar",
  "cider vinegar",
  "apple cider vinegar",
  "beef bacon",
  "turkey bacon",
  "chicken ham",
  "turkey ham",
];

// Screens halal-related concerns.
function screenHalal(
  input: ScreeningInput
): ScreeningSection {
  if (
    !input.ingredients.trim() &&
    !input.contains.trim()
  ) {
    return {
      level: "error",
      status: "Insufficient information",
      explanation:
        "There is not enough label information for halal-related screening.",
      findings: [],
    };
  }

  const concernFindings: Finding[] = [];
  const verifyFindings: Finding[] = [];

  for (const part of labelParts(input)) {
    // May Contain traces are not treated as direct halal findings.
    if (part.source === "May Contain") {
      continue;
    }

    for (const item of part.items) {
      const concernMatch = findMatch(
        item,
        HALAL_CONCERN_TERMS,
        HALAL_EXCLUSIONS
      );

      if (concernMatch) {
        concernFindings.push({
          headline: `Halal-related concern (${concernMatch})`,
          sourceLabel: part.source,
          statement: item,
        });

        continue;
      }

      const verifyMatch = findMatch(
        item,
        HALAL_VERIFY_TERMS,
        HALAL_EXCLUSIONS
      );

      if (verifyMatch) {
        verifyFindings.push({
          headline: `Requires halal verification (${verifyMatch})`,
          sourceLabel: part.source,
          statement: item,
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
      findings: [
        ...uniqueConcerns,
        ...uniqueVerify,
      ],
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
    status:
      "No identified concern from available label information",
    explanation:
      "No known halal-related concern was identified in the available label text. This is not halal certification.",
    findings: [],
  };
}

// ---------------------------------------------------------------------------
// Public screening function
// ---------------------------------------------------------------------------

export function screenProduct(
  input: ScreeningInput
): ScreeningData {
  // Protect the screening function from missing or malformed values.
  const safeInput: ScreeningInput = {
    allergies: Array.isArray(input?.allergies)
      ? input.allergies
      : [],

    prefersHalal: input?.prefersHalal === true,

    ingredients: String(input?.ingredients ?? ""),
    contains: String(input?.contains ?? ""),
    mayContain: String(input?.mayContain ?? ""),
  };

  return {
    allergy: screenAllergies(safeInput),
    halal: safeInput.prefersHalal
      ? screenHalal(safeInput)
      : null,
  };
}