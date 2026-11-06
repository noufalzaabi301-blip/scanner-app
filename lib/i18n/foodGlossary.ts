// ---------------------------------------------------------------------------
// lib/i18n/foodGlossary.ts
// Built-in English ↔ Arabic dictionary of common food ingredients and
// allergens. It works offline and is used:
//   - to show ingredients / Contains / May contain in Arabic, and
//   - to understand allergies typed in Arabic (e.g. "سكر" → "sugar"),
//     because the screening engine compares against English label text.
// Terms not found here are translated by the translate-food-text Edge
// Function (see lib/foodTranslation.ts) when it is deployed.
// Keys are lower-case English; the longest matching phrase wins.
// ---------------------------------------------------------------------------

export const FOOD_GLOSSARY: Record<string, string> = {
  // Allergens and their common forms
  milk: "حليب",
  "whole milk": "حليب كامل الدسم",
  "skimmed milk": "حليب منزوع الدسم",
  "skim milk": "حليب منزوع الدسم",
  "milk powder": "حليب مجفف",
  "whole milk powder": "حليب كامل الدسم مجفف",
  "skimmed milk powder": "حليب منزوع الدسم مجفف",
  "skim milk powder": "حليب منزوع الدسم مجفف",
  "milk solids": "مواد صلبة من الحليب",
  "milk fat": "دهن الحليب",
  "milk protein": "بروتين الحليب",
  "condensed milk": "حليب مكثف",
  "coconut milk": "حليب جوز الهند",
  cream: "قشدة",
  butter: "زبدة",
  "butter oil": "زيت الزبدة",
  cheese: "جبن",
  yogurt: "زبادي",
  yoghurt: "زبادي",
  whey: "مصل اللبن",
  "whey powder": "مسحوق مصل اللبن",
  casein: "كازين",
  caseinate: "كازينات",
  lactose: "لاكتوز",
  dairy: "منتجات الألبان",
  egg: "بيض",
  eggs: "بيض",
  "egg white": "بياض البيض",
  "egg yolk": "صفار البيض",
  "whole egg": "بيض كامل",
  "whole egg powder": "مسحوق البيض الكامل",
  "egg powder": "مسحوق البيض",
  peanut: "فول سوداني",
  peanuts: "فول سوداني",
  "peanut butter": "زبدة الفول السوداني",
  "peanut oil": "زيت الفول السوداني",
  nuts: "مكسرات",
  "tree nuts": "مكسرات",
  hazelnut: "بندق",
  hazelnuts: "بندق",
  "hazelnut paste": "معجون البندق",
  almond: "لوز",
  almonds: "لوز",
  walnut: "جوز",
  walnuts: "جوز",
  cashew: "كاجو",
  cashews: "كاجو",
  pistachio: "فستق حلبي",
  pistachios: "فستق حلبي",
  pecan: "بيكان",
  pecans: "بيكان",
  macadamia: "مكاديميا",
  coconut: "جوز الهند",
  wheat: "قمح",
  "wheat flour": "دقيق القمح",
  flour: "دقيق",
  gluten: "غلوتين",
  "wheat gluten": "غلوتين القمح",
  barley: "شعير",
  "barley malt": "شعير مملح",
  malt: "شعير مملح",
  "malt extract": "مستخلص الشعير",
  rye: "جاودار",
  oats: "شوفان",
  oat: "شوفان",
  soy: "صويا",
  soya: "صويا",
  soybean: "فول الصويا",
  soybeans: "فول الصويا",
  "soy lecithin": "ليسيثين الصويا",
  "soya lecithin": "ليسيثين الصويا",
  "soy protein": "بروتين الصويا",
  "soy sauce": "صلصة الصويا",
  fish: "سمك",
  shellfish: "محار وقشريات",
  crustaceans: "قشريات",
  shrimp: "روبيان",
  prawn: "قريدس",
  crab: "سلطعون",
  lobster: "كركند",
  molluscs: "رخويات",
  sesame: "سمسم",
  "sesame seeds": "بذور السمسم",
  "sesame oil": "زيت السمسم",
  tahini: "طحينة",
  mustard: "خردل",
  celery: "كرفس",
  lupin: "ترمس",
  sulphites: "كبريتيتات",
  sulfites: "كبريتيتات",
  "sulphur dioxide": "ثاني أكسيد الكبريت",

  // Sugars and sweeteners
  sugar: "سكر",
  "cane sugar": "سكر القصب",
  "brown sugar": "سكر بني",
  "icing sugar": "سكر ناعم",
  "glucose syrup": "شراب الجلوكوز",
  glucose: "جلوكوز",
  fructose: "فركتوز",
  "glucose-fructose syrup": "شراب الجلوكوز والفركتوز",
  "high fructose corn syrup": "شراب الذرة عالي الفركتوز",
  "corn syrup": "شراب الذرة",
  dextrose: "دكستروز",
  dextrin: "دكسترين",
  maltodextrin: "مالتودكسترين",
  honey: "عسل",
  "invert sugar": "سكر محول",
  sweetener: "مُحلٍّ",
  sweeteners: "مُحليات",
  sorbitol: "سوربيتول",
  aspartame: "أسبارتام",
  sucralose: "سكرالوز",
  stevia: "ستيفيا",

  // Fats and oils
  oil: "زيت",
  "vegetable oil": "زيت نباتي",
  "vegetable oils": "زيوت نباتية",
  "vegetable fat": "دهن نباتي",
  "palm oil": "زيت النخيل",
  "palm fat": "دهن النخيل",
  "palm kernel oil": "زيت نواة النخيل",
  "sunflower oil": "زيت دوار الشمس",
  "rapeseed oil": "زيت بذور اللفت",
  "canola oil": "زيت الكانولا",
  "olive oil": "زيت الزيتون",
  "corn oil": "زيت الذرة",
  "coconut oil": "زيت جوز الهند",
  "shea fat": "دهن الشيا",
  "shea butter": "زبدة الشيا",
  "cocoa butter": "زبدة الكاكاو",
  lard: "شحم الخنزير",
  tallow: "شحم حيواني",
  margarine: "سمن نباتي",
  ghee: "سمن",

  // Cocoa, starches, grains
  cocoa: "كاكاو",
  "cocoa mass": "كتلة الكاكاو",
  "cocoa powder": "مسحوق الكاكاو",
  "cocoa solids": "مواد صلبة من الكاكاو",
  chocolate: "شوكولاتة",
  "milk chocolate": "شوكولاتة بالحليب",
  "dark chocolate": "شوكولاتة داكنة",
  starch: "نشا",
  "corn starch": "نشا الذرة",
  "maize starch": "نشا الذرة",
  "modified starch": "نشا معدل",
  "modified corn starch": "نشا ذرة معدل",
  "potato starch": "نشا البطاطس",
  "wheat starch": "نشا القمح",
  rice: "أرز",
  "rice flour": "دقيق الأرز",
  corn: "ذرة",
  maize: "ذرة",

  // Additives
  salt: "ملح",
  "sea salt": "ملح البحر",
  water: "ماء",
  emulsifier: "مستحلب",
  emulsifiers: "مستحلبات",
  lecithin: "ليسيثين",
  "sunflower lecithin": "ليسيثين دوار الشمس",
  stabilizer: "مثبت",
  stabiliser: "مثبت",
  stabilizers: "مثبتات",
  thickener: "مكثف قوام",
  "gum arabic": "صمغ عربي",
  "xanthan gum": "صمغ الزانثان",
  "guar gum": "صمغ الغوار",
  pectin: "بكتين",
  gelatin: "جيلاتين",
  gelatine: "جيلاتين",
  "pork gelatin": "جيلاتين الخنزير",
  "beef gelatin": "جيلاتين البقر",
  carrageenan: "كاراجينان",
  "glazing agent": "عامل تلميع",
  "carnauba wax": "شمع الكرنوبا",
  beeswax: "شمع العسل",
  shellac: "اللك (شيلاك)",
  colour: "ملون",
  colours: "ملونات",
  color: "ملون",
  colors: "ملونات",
  colouring: "ملون",
  coloring: "ملون",
  "natural colours": "ملونات طبيعية",
  flavour: "منكه",
  flavours: "منكهات",
  flavor: "منكه",
  flavors: "منكهات",
  flavouring: "منكه",
  flavoring: "منكه",
  flavourings: "منكهات",
  flavorings: "منكهات",
  "natural flavour": "منكه طبيعي",
  "natural flavor": "منكه طبيعي",
  "natural flavours": "منكهات طبيعية",
  "natural flavors": "منكهات طبيعية",
  "artificial flavor": "منكه صناعي",
  "artificial flavour": "منكه صناعي",
  vanillin: "فانيلين",
  vanilla: "فانيلا",
  "vanilla extract": "مستخلص الفانيلا",
  preservative: "مادة حافظة",
  preservatives: "مواد حافظة",
  antioxidant: "مضاد أكسدة",
  antioxidants: "مضادات أكسدة",
  "acidity regulator": "منظم حموضة",
  acid: "حمض",
  "citric acid": "حمض الستريك",
  "ascorbic acid": "حمض الأسكوربيك",
  "lactic acid": "حمض اللاكتيك",
  "raising agent": "عامل رفع",
  "raising agents": "عوامل رفع",
  "baking powder": "مسحوق الخبز",
  "sodium bicarbonate": "بيكربونات الصوديوم",
  yeast: "خميرة",
  "yeast extract": "مستخلص الخميرة",
  "monosodium glutamate": "غلوتامات أحادي الصوديوم",
  "flavour enhancer": "محسن نكهة",
  "flavor enhancer": "محسن نكهة",
  vinegar: "خل",
  alcohol: "كحول",
  ethanol: "إيثانول",
  wine: "نبيذ",
  rum: "رم",
  pork: "لحم خنزير",
  bacon: "لحم خنزير مقدد",
  ham: "لحم خنزير",
  beef: "لحم بقري",
  chicken: "دجاج",
  "animal fat": "دهن حيواني",
  carmine: "كارمين",
  cochineal: "قرمز (كوشينيال)",
  "mono- and diglycerides of fatty acids": "أحادي وثنائي جليسريدات الأحماض الدهنية",
  "mono and diglycerides": "أحادي وثنائي الجليسريدات",

  // Fruit, vegetables, spices
  fruit: "فاكهة",
  fruits: "فواكه",
  vegetable: "خضار",
  vegetables: "خضروات",
  meat: "لحم",
  lamb: "لحم ضأن",
  seafood: "مأكولات بحرية",
  mushroom: "فطر",
  mushrooms: "فطر",
  avocado: "أفوكادو",
  pineapple: "أناناس",
  peach: "خوخ",
  cherry: "كرز",
  grapes: "عنب",
  carrot: "جزر",
  cucumber: "خيار",
  spinach: "سبانخ",
  olive: "زيتون",
  olives: "زيتون",
  sunflower: "دوار الشمس",
  "sunflower seeds": "بذور دوار الشمس",
  "pumpkin seeds": "بذور اليقطين",
  "flax seeds": "بذور الكتان",
  quinoa: "كينوا",
  buckwheat: "حنطة سوداء",
  "pine nuts": "صنوبر",
  "brazil nuts": "جوز البرازيل",
  strawberry: "فراولة",
  strawberries: "فراولة",
  banana: "موز",
  apple: "تفاح",
  orange: "برتقال",
  lemon: "ليمون",
  "lemon juice": "عصير الليمون",
  kiwi: "كيوي",
  "kiwi fruit": "كيوي",
  mango: "مانجو",
  raisins: "زبيب",
  dates: "تمر",
  tomato: "طماطم",
  "tomato paste": "معجون الطماطم",
  onion: "بصل",
  garlic: "ثوم",
  potato: "بطاطس",
  potatoes: "بطاطس",
  pepper: "فلفل",
  "black pepper": "فلفل أسود",
  paprika: "بابريكا",
  spices: "بهارات",
  herbs: "أعشاب",
  cinnamon: "قرفة",
  ginger: "زنجبيل",
  chickpeas: "حمص",
  lentils: "عدس",
  beans: "فاصوليا",
  peas: "بازلاء",
  coffee: "قهوة",
  tea: "شاي",
  caffeine: "كافيين",
  "dried glucose syrup": "شراب الجلوكوز المجفف",
  "soya beans": "فول الصويا",
  "soy beans": "فول الصويا",
  "hen's egg": "بيض",
  "from milk": "من الحليب",
  traces: "آثار",
};

// Arabic → English, built once. Arabic spelling variants are normalised by
// normalizeArabic() before lookup.
export function normalizeArabic(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[ً-ْٰـ]/g, "") // harakat, dagger alif, tatweel
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim()
    .split(/\s+/)
    // "ال" (the) is removed from every word: "الفول السوداني" = "فول سوداني".
    .map((word) => (word.length > 3 && word.startsWith("ال") ? word.slice(2) : word))
    .join(" ");
}

const ARABIC_TO_ENGLISH: Map<string, string> = (() => {
  const map = new Map<string, string>();

  // Shorter English keys first so the simplest word wins (e.g. "حليب" →
  // "milk", not "whole milk").
  Object.keys(FOOD_GLOSSARY)
    .sort((a, b) => b.length - a.length)
    .forEach((english) => {
      map.set(normalizeArabic(FOOD_GLOSSARY[english]), english);
    });

  // Common extra spellings.
  const extra: Record<string, string> = {
    "فول سوداني": "peanuts",
    "الفول السوداني": "peanuts",
    "فستق": "peanuts",
    "لبن": "milk",
    "البان": "milk",
    "قشريات": "shellfish",
    "روبيان": "shellfish",
    "جمبري": "shellfish",
    "سمك": "fish",
    "اسماك": "fish",
    "بيض": "eggs",
    "صويا": "soy",
    "قمح": "wheat",
    "جلوتين": "gluten",
    "غلوتين": "gluten",
    "سكر": "sugar",
    "ملح": "salt",
    "خنزير": "pork",
    "جيلاتين": "gelatin",
    "كحول": "alcohol",
    "مكسرات": "tree nuts",
    "شوكولاته": "chocolate",
    "كاكاو": "cocoa",
    "عسل": "honey",
    "ذره": "corn",
    "فراوله": "strawberries",
    "محار": "shellfish",
    "لوبين": "lupin",
    "ترمس": "lupin",
    "عباد الشمس": "sunflower",
    "دوار الشمس": "sunflower",
    "بذور عباد الشمس": "sunflower seeds",
    "جوز": "walnuts",
    "صنوبر": "pine nuts",
    "كيوي": "kiwi",
    "ثوم": "garlic",
    "كرفس": "celery",
    "خردل": "mustard",
    "جوز الهند": "coconut",
    "بندق": "hazelnuts",
    "لوز": "almonds",
    "فول الصويا": "soybeans",
    "ليسيثين الصويا": "soy lecithin",
  };

  for (const [arabic, english] of Object.entries(extra)) {
    map.set(normalizeArabic(arabic), english);
  }

  return map;
})();

const ARABIC_LETTERS = /[؀-ۿ]/;

export function containsArabic(value: string): boolean {
  return ARABIC_LETTERS.test(value);
}

// "سكر" → "sugar"; null when the term is unknown.
export function arabicToEnglishTerm(value: string): string | null {
  return ARABIC_TO_ENGLISH.get(normalizeArabic(value.toLowerCase())) ?? null;
}

// "Sugar" → "سكر"; null when the whole term is unknown.
export function englishToArabicTerm(value: string): string | null {
  return FOOD_GLOSSARY[value.trim().toLowerCase()] ?? null;
}

const PHRASES = Object.keys(FOOD_GLOSSARY).sort((a, b) => b.length - a.length);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PHRASE_PATTERN = new RegExp(
  `\\b(${PHRASES.map(escapeRegExp).join("|")})\\b`,
  "gi"
);

// Translates one ingredient phrase with the glossary. E-numbers, numbers
// and percentages are kept. `complete` is true when no English words remain.
export function glossaryTranslate(value: string): {
  text: string;
  complete: boolean;
} {
  const exact = englishToArabicTerm(value);

  if (exact) {
    return { text: exact, complete: true };
  }

  const text = value.replace(PHRASE_PATTERN, (match) =>
    FOOD_GLOSSARY[match.toLowerCase()] ?? match
  );

  // E-numbers such as E322 / e160a stay as they are and are not leftovers.
  const leftovers = text
    .replace(/\be\s?\d{3,4}[a-z]?\b/gi, "")
    .match(/[a-z]{3,}/gi);

  return { text, complete: !leftovers };
}

// Translations learned from the AI (Arabic → English), kept in memory so
// display code can use them synchronously. lib/foodTranslation.ts fills
// this from its saved cache and from new AI results.
const learnedArabicToEnglish = new Map<string, string>();

export function rememberEnglishTerm(arabic: string, english: string): void {
  learnedArabicToEnglish.set(normalizeArabic(arabic.toLowerCase()), english);
}

export function learnedEnglishTerm(arabic: string): string | null {
  return learnedArabicToEnglish.get(normalizeArabic(arabic.toLowerCase())) ?? null;
}

// English → Arabic translations learned from the AI (for custom allergy
// names the glossary does not know, e.g. "vegetable").
const learnedEnglishToArabic = new Map<string, string>();

export function rememberArabicTerm(english: string, arabic: string): void {
  learnedEnglishToArabic.set(english.trim().toLowerCase(), arabic);
}

export function learnedArabicTerm(english: string): string | null {
  return learnedEnglishToArabic.get(english.trim().toLowerCase()) ?? null;
}

// True when the text is a food or allergen this app knows, in English or
// Arabic (used to reject random words typed as custom allergies).
// English allows simple singular / plural forms ("Peanut" / "Peanuts",
// "Strawberry" / "Strawberries").
export function isRecognizedFoodTerm(value: string): boolean {
  const text = value.normalize("NFKC").trim().replace(/\s+/g, " ");

  if (!text) {
    return false;
  }

  if (containsArabic(text)) {
    // Mixed Arabic + Latin text is never a single food name.
    return !/[a-z]/i.test(text) && arabicToEnglishTerm(text) !== null;
  }

  // Hyphens count as spaces: "Kiwi-fruit" = "kiwi fruit".
  const lower = text.toLowerCase().replace(/’/g, "'").replace(/-/g, " ");
  const candidates = new Set([
    lower,
    lower.replace(/ies$/, "y"),
    lower.replace(/es$/, ""),
    lower.replace(/s$/, ""),
    `${lower}s`,
    `${lower}es`,
    lower.replace(/y$/, "ies"),
  ]);

  return [...candidates].some((candidate) => candidate in FOOD_GLOSSARY);
}
