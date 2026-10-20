// React hooks used by the HomeScreen workflow.
import { useEffect, useState } from "react";

// Expo barcode camera.
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";

// Expo native camera for package photos.
import * as ImagePicker from "expo-image-picker";

// React Native components.
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// User Supabase database.
import { supabase } from "../lib/supabase";

// Product Supabase database.
import { productSupabase } from "../lib/productSupabase";

// AI extraction helper.
import {
  extractLabelFromPhotos,
  type LabelExtraction,
} from "../lib/labelExtraction";

// Workflow stages.
type Stage =
  | "home"
  | "barcode"
  | "lookup"
  | "ingredients"
  | "front"
  | "extracting"
  | "review"
  | "result";

// Product data used by the workflow.
type ProductData = {
  barcode: string | null;
  productName: string;
  brandName: string;
  variant: string;
  ingredients: string;
  contains: string;
  mayContain: string;
  source: string;
  frontPhotoUri: string | null;
  ingredientsPhotoUri: string | null;
  unclearText?: string;
  confidence?: "high" | "medium" | "low";
};

// Allergy and halal result data.
type ScreeningData = {
  allergyStatus: string;
  allergyExplanation: string;
  halalStatus: string;
  halalExplanation: string;
};

// One ingredient that requires user confirmation.
type UncertainIngredient = {
  original: string;
  value: string;
  confirmed: boolean;
};

export default function HomeScreen({ navigation }: any) {
  // Controls the current workflow page.
  const [stage, setStage] = useState<Stage>("home");

  // Prevents repeated barcode detections.
  const [scanned, setScanned] = useState(false);

  // Stores the scanned barcode.
  const [barcode, setBarcode] = useState("");

  // Stores a manually entered barcode.
  const [manualBarcode, setManualBarcode] = useState("");

  // Stores the ingredient-label photo.
  const [ingredientsPhotoUri, setIngredientsPhotoUri] =
    useState<string | null>(null);

  // Stores the front-package photo.
  const [frontPhotoUri, setFrontPhotoUri] =
    useState<string | null>(null);

  // Stores the current product.
  const [product, setProduct] =
    useState<ProductData | null>(null);

  // Stores product information.
  const [brandName, setBrandName] = useState("");
  const [productName, setProductName] = useState("");
  const [variant, setVariant] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [contains, setContains] = useState("");
  const [mayContain, setMayContain] = useState("");

  // Stores the user's allergy profile.
  const [userAllergies, setUserAllergies] = useState<string[]>([]);

  // Stores whether halal screening is enabled.
  const [prefersHalal, setPrefersHalal] = useState(false);

  // Stores the AI uncertainty text.
  const [uncertainIngredients, setUncertainIngredients] =
    useState("");

  // Stores individual uncertain ingredients.
  const [uncertainItems, setUncertainItems] =
    useState<UncertainIngredient[]>([]);

  // Stores the uncertain item currently being edited.
  const [editingUncertainIndex, setEditingUncertainIndex] =
    useState<number | null>(null);

  // Shows lookup status.
  const [lookupMessage, setLookupMessage] = useState("");

  // Stores the final screening result.
  const [screening, setScreening] =
    useState<ScreeningData | null>(null);

  // Shows screening loading.
  const [screeningLoading, setScreeningLoading] =
    useState(false);

  // Prevents repeated photo presses.
  const [takingPhoto, setTakingPhoto] =
    useState(false);

  // Controls the barcode flashlight.
  const [torchEnabled, setTorchEnabled] =
    useState(false);

  // Stores camera permission.
  const [permission, requestPermission] =
    useCameraPermissions();

  // Loads the user's allergy and halal preferences.
  useEffect(() => {
    async function loadUserPreferences() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return;
      }

      const { data } = await supabase
        .from("user_preferences")
        .select("allergies, other_allergy, prefers_halal")
        .eq("user_id", user.id)
        .maybeSingle();

      const allergies = Array.isArray(data?.allergies)
        ? [...data.allergies]
        : [];

      if (data?.other_allergy?.trim()) {
        allergies.push(data.other_allergy.trim());
      }

      setUserAllergies(allergies);
      setPrefersHalal(data?.prefers_halal === true);
    }

    loadUserPreferences();
  }, []);

  // Shows allergies on normal pages.
  // It is intentionally not shown on the camera/loading pages.
  function renderAllergyBanner() {
    return (
      <View style={styles.allergyBanner}>
        <View style={styles.allergyTextContainer}>
          <Text style={styles.allergyTitle}>
            Your allergy profile
          </Text>

          <Text style={styles.allergyValue}>
            {userAllergies.length > 0
              ? userAllergies.join(", ")
              : "No allergies selected"}
          </Text>

          <Text style={styles.halalPreference}>
            Halal screening: {prefersHalal ? "On" : "Off"}
          </Text>
        </View>

        {/* Allows the user to edit their preferences. */}
        <TouchableOpacity
          onPress={() => navigation.navigate("Preferences")}
          activeOpacity={0.8}
        >
          <Text style={styles.editText}>
            Edit
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Returns the color for an analysis status.
  function getStatusColor(status: string) {
    const text = status.toLowerCase();

    if (
      text.includes("detected") ||
      text.includes("unable")
    ) {
      return "#C62828";
    }

    if (
      text.includes("may contain") ||
      text.includes("verification")
    ) {
      return "#C77700";
    }

    if (
      text.includes("no identified") ||
      text.includes("no selected")
    ) {
      return "#258D4D";
    }

    return "#68756D";
  }

  // Returns to the previous workflow page.
  function goBack() {
    if (stage === "barcode") {
      closeBarcodeCamera();
      return;
    }

    if (stage === "ingredients") {
      setStage("barcode");
      return;
    }

    if (stage === "front") {
      setStage("ingredients");
      return;
    }

    if (stage === "review") {
      setStage("front");
      return;
    }

    if (stage === "result") {
      setStage("review");
    }
  }

  // Displays a reusable back-arrow header.
  function renderTopBar(title: string) {
    return (
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={goBack}
          activeOpacity={0.8}
          accessibilityLabel="Go back"
        >
          <Text style={styles.backArrow}>
            ‹
          </Text>
        </TouchableOpacity>

        <Text style={styles.topBarTitle}>
          {title}
        </Text>

        <View style={styles.topBarSpacer} />
      </View>
    );
  }

  // Normalizes English and Arabic text.
  function normalizeText(value: string) {
    return value
      .toLowerCase()
      .normalize("NFKC")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[إأآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Creates exact barcode and valid UPC/EAN alternatives.
  function getBarcodeCandidates(value: string) {
    const cleaned = value.replace(/\D/g, "");

    const candidates = [cleaned];

    // A UPC-A may also be stored with one leading zero.
    if (cleaned.length === 12) {
      candidates.push(`0${cleaned}`);
    }

    // An EAN-13 beginning with zero may be checked without it.
    if (
      cleaned.length === 13 &&
      cleaned.startsWith("0")
    ) {
      candidates.push(cleaned.slice(1));
    }

    return [...new Set(candidates)];
  }

  // Checks whether a barcode has a valid length.
  function isValidBarcode(value: string) {
    return value.length >= 8 && value.length <= 14;
  }

  // Opens the barcode camera.
  async function openBarcodeCamera() {
    if (!permission?.granted) {
      const result = await requestPermission();

      if (!result.granted) {
        Alert.alert(
          "Camera permission needed",
          "Please allow camera access in your phone settings."
        );
        return;
      }
    }

    // Resets scanner state.
    setScanned(false);
    setBarcode("");
    setManualBarcode("");
    setTorchEnabled(false);

    setStage("barcode");
  }

  // Opens the ingredient-photo fallback.
  function openIngredientsPhoto() {
    // Starts a fresh two-photo process.
    setIngredientsPhotoUri(null);
    setFrontPhotoUri(null);
    setUncertainIngredients("");
    setUncertainItems([]);
    setEditingUncertainIndex(null);

    setStage("ingredients");
  }

  // Closes the barcode camera.
  function closeBarcodeCamera() {
    setTorchEnabled(false);
    setStage("home");
  }

  // Searches the approved LabelLens product database.
  async function findInternalProduct(
    barcodeValue: string
  ) {
    const candidates =
      getBarcodeCandidates(barcodeValue);

    for (const candidate of candidates) {
      const { data, error } =
        await productSupabase
          .from("products")
          .select(
            "barcode, product_name, brand_name, ingredients_text, allergen_text, verification_status"
          )
          .eq("barcode", candidate)
          .eq("verification_status", "approved")
          .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (data) {
        return {
          barcode: data.barcode,
          productName: data.product_name,
          brandName: data.brand_name,
          variant: "",
          ingredients: data.ingredients_text,
          contains: data.allergen_text,
          mayContain: "",
          source:
            "LabelLens verified product database",
          frontPhotoUri: null,
          ingredientsPhotoUri: null,
        } satisfies ProductData;
      }
    }

    return null;
  }

  // Searches Open Food Facts after the internal database.
  async function findOpenFoodFacts(
    barcodeValue: string
  ) {
    const candidates =
      getBarcodeCandidates(barcodeValue);

    for (const candidate of candidates) {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${candidate}.json?fields=code,product_name,brands,ingredients_text,ingredients_text_en,allergens,traces`
      );

      if (!response.ok) {
        throw new Error(
          "Open Food Facts is unavailable."
        );
      }

      const data = await response.json();

      if (
        data.status !== 1 ||
        !data.product
      ) {
        continue;
      }

      // Prefer English ingredient information.
      const ingredientText =
        data.product.ingredients_text_en ||
        data.product.ingredients_text ||
        "";

      return {
        barcode: data.product.code || candidate,
        productName:
          data.product.product_name || "",
        brandName:
          data.product.brands || "",
        variant: "",
        ingredients: ingredientText,
        contains:
          data.product.allergens || "",
        mayContain:
          data.product.traces || "",
        source:
          "Open Food Facts — verify against the physical package.",
        frontPhotoUri: null,
        ingredientsPhotoUri: null,
      } satisfies ProductData;
    }

    return null;
  }

  // Converts AI uncertainty text into separate ingredients.
  function parseUncertainIngredients(value: string) {
    return value
      .split(/[\n,;|]+/)
      .map((item) =>
        item.replace(/^[-•]\s*/, "").trim()
      )
      .filter(
        (item) =>
          Boolean(item) &&
          ![
            "none",
            "n/a",
            "unknown",
            "not sure",
          ].includes(item.toLowerCase())
      )
      .map((item) => ({
        original: item,
        value: item,
        confirmed: false,
      }));
  }

  // Loads product data into the screen.
  function fillProductFields(
    nextProduct: ProductData
  ) {
    setProduct(nextProduct);
    setBrandName(nextProduct.brandName);
    setProductName(nextProduct.productName);
    setVariant(nextProduct.variant);
    setIngredients(nextProduct.ingredients);
    setContains(nextProduct.contains);
    setMayContain(nextProduct.mayContain);
    setUncertainIngredients(nextProduct.unclearText || "");

    // Creates separate confirmation rows only when needed.
    setUncertainItems(
      parseUncertainIngredients(
        nextProduct.unclearText || ""
      )
    );

    setEditingUncertainIndex(null);
  }

  // Finds every matching allergy alias.
  function findAllergyMatches(
    allergy: string,
    labelText: string
  ): string[] {
    const selected = normalizeText(allergy);
    const text = normalizeText(labelText);

    // Controlled English and Arabic allergen aliases.
    const aliasGroups: Record<string, string[]> = {
      milk: [
        "milk",
        "whey",
        "casein",
        "lactose",
        "dairy",
        "حليب",
        "مصل اللبن",
        "كازين",
        "لاكتوز",
      ],

      egg: [
        "egg",
        "eggs",
        "albumin",
        "ovalbumin",
        "بيض",
      ],

      wheat: [
        "wheat",
        "flour",
        "gluten",
        "قمح",
        "دقيق",
        "جلوتين",
      ],

      soy: [
        "soy",
        "soya",
        "lecithin",
        "صويا",
        "ليسيثين",
      ],

      peanut: [
        "peanut",
        "groundnut",
        "فول سوداني",
      ],

      nuts: [
        "nut",
        "nuts",
        "almond",
        "hazelnut",
        "cashew",
        "walnut",
        "pistachio",
        "مكسرات",
        "لوز",
        "بندق",
        "كاجو",
        "جوز",
        "فستق",
      ],

      "tree nuts": [
        "tree nut",
        "tree nuts",
        "nut",
        "nuts",
        "almond",
        "hazelnut",
        "cashew",
        "walnut",
        "pistachio",
        "مكسرات",
        "لوز",
        "بندق",
        "كاجو",
        "جوز",
        "فستق",
      ],

      sesame: [
        "sesame",
        "سمسم",
      ],

      fish: [
        "fish",
        "anchovy",
        "salmon",
        "سمك",
        "انشوجة",
        "سلمون",
      ],

      shellfish: [
        "shellfish",
        "shrimp",
        "prawn",
        "crab",
        "محار",
        "جمبري",
        "روبيان",
        "سرطان",
      ],
    };

    // Finds the selected allergy's alias group.
    const groupKey = Object.keys(aliasGroups).find(
      (key) =>
        selected === key ||
        aliasGroups[key].some(
          (term) =>
            normalizeText(term) === selected
        )
    );

    const terms = groupKey
      ? aliasGroups[groupKey]
      : [allergy];

    // Returns every matching alias.
    const matches = terms.filter((term) => {
      const normalizedTerm = normalizeText(term);

      // Arabic phrases are checked directly.
      if (/[\u0600-\u06FF]/.test(normalizedTerm)) {
        return text.includes(normalizedTerm);
      }

      // English terms use boundaries.
      const escapedTerm = normalizedTerm.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      return new RegExp(
        `(^|\\s|[(),:;])${escapedTerm}(?=\\s|[),:;.\\-]|$)`,
        "i"
      ).test(text);
    });

    return [...new Set(matches)];
  }

  // Performs allergy and halal screening.
  async function screenConfirmedProduct(
    confirmedProduct?: ProductData
  ) {
    setScreeningLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("No signed-in user.");
      }

      const { data: preferences, error } =
        await supabase
          .from("user_preferences")
          .select(
            "prefers_halal, has_allergies, allergies, other_allergy"
          )
          .eq("user_id", user.id)
          .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      // Uses confirmed information instead of stale React state.
      const confirmedIngredients =
        confirmedProduct?.ingredients ?? ingredients;

      const confirmedContains =
        confirmedProduct?.contains ?? contains;

      const confirmedMayContain =
        confirmedProduct?.mayContain ?? mayContain;

      const allLabelText = [
        confirmedIngredients,
        confirmedContains,
        confirmedMayContain,
      ].join(" ");

      const mayContainText =
        normalizeText(confirmedMayContain);

      // Loads all saved allergies.
      const allergyValues: string[] =
        Array.isArray(preferences?.allergies)
          ? [...preferences.allergies]
          : [];

      if (
        preferences?.other_allergy &&
        preferences.other_allergy.trim()
      ) {
        allergyValues.push(
          preferences.other_allergy
        );
      }

      // Stores every direct and May Contain result.
      const directMatches: string[] = [];
      const mayContainMatches: string[] = [];

      // Checks every allergy against every label alias.
      for (const allergy of allergyValues) {
        const matches = findAllergyMatches(
          allergy,
          allLabelText
        );

        for (const match of matches) {
          const isMayContain =
            mayContainText.includes(
              normalizeText(match)
            );

          const description =
            `${match} (${allergy})`;

          if (isMayContain) {
            mayContainMatches.push(description);
          } else {
            directMatches.push(description);
          }
        }
      }

      const uniqueDirectMatches = [
        ...new Set(directMatches),
      ];

      const uniqueMayContainMatches = [
        ...new Set(mayContainMatches),
      ];

      let allergyStatus =
        "No selected allergen found";

      let allergyExplanation =
        "No selected allergen was found in the confirmed label information.";

      if (!confirmedIngredients.trim()) {
        allergyStatus = "Insufficient information";
        allergyExplanation =
          "A complete ingredient list was not confirmed.";
      } else if (!preferences?.has_allergies) {
        allergyStatus = "No allergy profile selected";
        allergyExplanation =
          "No allergy profile is currently selected.";
      } else if (uniqueDirectMatches.length > 0) {
        allergyStatus =
          uniqueMayContainMatches.length > 0
            ? "Allergens detected and may contain warnings"
            : "Allergens detected";

        const directText =
          uniqueDirectMatches.join(", ");

        const mayText =
          uniqueMayContainMatches.join(", ");

        allergyExplanation =
          uniqueMayContainMatches.length > 0
            ? `Direct allergens: ${directText}. May contain warnings: ${mayText}.`
            : `Detected allergens: ${directText}.`;
      } else if (uniqueMayContainMatches.length > 0) {
        allergyStatus = "May contain allergens";

        allergyExplanation =
          `May contain warnings: ${uniqueMayContainMatches.join(", ")}.`;
      }

      // Halal screening uses controlled rules.
      const halalText = normalizeText(allLabelText);

      const nonHalalTerms = [
        "pork",
        "porcine",
        "lard",
        "ham",
        "bacon",
        "خنزير",
        "شحم الخنزير",
      ];

      const verificationTerms = [
        "gelatin",
        "gelatine",
        "alcohol",
        "ethanol",
        "enzymes",
        "جيلاتين",
        "كحول",
        "انزيمات",
      ];

      const nonHalalMatch =
        nonHalalTerms.find((term) =>
          halalText.includes(normalizeText(term))
        );

      const verificationMatch =
        verificationTerms.find((term) =>
          halalText.includes(normalizeText(term))
        );

      let halalStatus =
        "No identified concern from available label information";

      let halalExplanation =
        "No identified concern was found from the available label information.";

      if (!confirmedIngredients.trim()) {
        halalStatus = "Insufficient information";
        halalExplanation =
          "A complete ingredient list was not confirmed.";
      } else if (!preferences?.prefers_halal) {
        halalStatus = "Halal screening not selected";
        halalExplanation =
          "Halal screening is not selected in your preferences.";
      } else if (nonHalalMatch) {
        halalStatus = "Non-halal concern detected";
        halalExplanation =
          `${nonHalalMatch} requires attention because it may be a non-halal ingredient.`;
      } else if (verificationMatch) {
        halalStatus = "Requires verification";
        halalExplanation =
          `${verificationMatch} may depend on its source or processing.`;
      }

      setScreening({
        allergyStatus,
        allergyExplanation,
        halalStatus,
        halalExplanation,
      });
    } catch {
      // Never show a false safe result.
      setScreening({
        allergyStatus: "Unable to complete screening",
        allergyExplanation:
          "The allergy preferences could not be loaded.",
        halalStatus: "Unable to complete screening",
        halalExplanation:
          "The halal preference could not be loaded.",
      });
    } finally {
      setScreeningLoading(false);
    }
  }

  // Performs barcode lookup in the required order.
  async function lookupBarcode(
    barcodeValue: string
  ) {
    setStage("lookup");
    setLookupMessage("Checking LabelLens database...");

    try {
      // First search the approved internal database.
      const internalProduct =
        await findInternalProduct(barcodeValue);

      if (
        internalProduct &&
        internalProduct.ingredients.trim()
      ) {
        setLookupMessage(
          "Found in LabelLens verified product database."
        );

        fillProductFields(internalProduct);
        setStage("result");

        await screenConfirmedProduct(internalProduct);
        return;
      }

      // Product exists but ingredients are missing.
      if (internalProduct) {
        setLookupMessage(
          "Product found, but ingredients are incomplete."
        );

        fillProductFields(internalProduct);
        setStage("ingredients");
        return;
      }

      // Search Open Food Facts second.
      setLookupMessage("Checking Open Food Facts...");

      const externalProduct =
        await findOpenFoodFacts(barcodeValue);

      if (
        externalProduct &&
        externalProduct.ingredients.trim()
      ) {
        setLookupMessage(
          "Found in Open Food Facts. Verify against the physical package."
        );

        fillProductFields(externalProduct);
        setStage("result");

        await screenConfirmedProduct(externalProduct);
        return;
      }

      // Product exists but ingredients are missing.
      if (externalProduct) {
        setLookupMessage(
          "Product found, but ingredients are incomplete."
        );

        fillProductFields(externalProduct);
        setStage("ingredients");
        return;
      }

      // Unknown product: request package photos.
      setLookupMessage(
        "Product not found. Photograph the package label."
      );

      setStage("ingredients");
    } catch (error) {
      setLookupMessage(
        error instanceof Error
          ? error.message
          : "Provider unavailable. Photograph the package label."
      );

      setStage("ingredients");
    }
  }

  // Handles barcode camera results.
  function handleBarcodeScanned(
    result: BarcodeScanningResult
  ) {
    if (scanned) {
      return;
    }

    const cleanedBarcode = result.data
      .replace(/\D/g, "")
      .trim();

    if (!isValidBarcode(cleanedBarcode)) {
      return;
    }

    setScanned(true);
    setBarcode(cleanedBarcode);
    setTorchEnabled(false);

    lookupBarcode(cleanedBarcode);
  }

  // Handles manual barcode entry.
  function submitManualBarcode() {
    const cleanedBarcode = manualBarcode
      .replace(/\D/g, "")
      .trim();

    if (!isValidBarcode(cleanedBarcode)) {
      Alert.alert(
        "Invalid barcode",
        "Enter an 8 to 14 digit barcode."
      );
      return;
    }

    setScanned(true);
    setBarcode(cleanedBarcode);
    setTorchEnabled(false);

    lookupBarcode(cleanedBarcode);
  }

  // Opens the phone camera for package photos.
  async function takePackagePhoto() {
    if (takingPhoto) {
      return;
    }

    setTakingPhoto(true);

    try {
      // Requests camera permission explicitly.
      const permissionResult =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          "Camera permission needed",
          "Allow camera access in Settings to photograph the package label."
        );
        return;
      }

      // Opens the native camera.
      const result =
        await ImagePicker.launchCameraAsync({
          mediaTypes:
            ImagePicker.MediaTypeOptions.Images,

          // Do not crop the photo.
          allowsEditing: false,

          // Request high image quality.
          quality: 1,

          // Keep the original image.
          exif: false,
          base64: false,
        });

      if (result.canceled) {
        return;
      }

      const photoUri = result.assets?.[0]?.uri;

      if (!photoUri) {
        Alert.alert(
          "Photo error",
          "The phone did not return a photo."
        );
        return;
      }

      // First photo: ingredient label.
      if (stage === "ingredients") {
        setIngredientsPhotoUri(photoUri);
        setStage("front");
        return;
      }

      // Second photo: front package.
      if (stage === "front") {
        if (!ingredientsPhotoUri) {
          Alert.alert(
            "Missing ingredient photo",
            "Please take the ingredient photo first."
          );

          setStage("ingredients");
          return;
        }

        setFrontPhotoUri(photoUri);
        setStage("extracting");

        // Sends both photos to the AI.
        const extraction: LabelExtraction =
          await extractLabelFromPhotos(
            photoUri,
            ingredientsPhotoUri
          );

        // Converts AI output into product data.
        const extractedProduct: ProductData = {
          barcode: barcode || null,
          productName: extraction.product_name,
          brandName: extraction.brand,
          variant: extraction.variant,
          ingredients: extraction.ingredients,
          contains: extraction.contains,
          mayContain: extraction.may_contain,
          source: "AI package-photo extraction",
          frontPhotoUri: photoUri,
          ingredientsPhotoUri,
          unclearText: extraction.unclear_text,
          confidence: extraction.confidence,
        };

        fillProductFields(extractedProduct);
        setStage("review");
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The photo could not be taken or analyzed.";

      Alert.alert("Photo error", message);
    } finally {
      setTakingPhoto(false);
    }
  }

  // Confirms uncertain ingredients before analysis.
  async function confirmAndAnalyze() {
    if (!ingredients.trim()) {
      Alert.alert(
        "Ingredients required",
        "Please review the ingredient list before continuing."
      );
      return;
    }

    // Every uncertain item must be confirmed.
    const unfinishedItems = uncertainItems.some(
      (item) => !item.confirmed
    );

    if (unfinishedItems) {
      Alert.alert(
        "Please check the highlighted ingredients",
        "Edit an uncertain ingredient if needed, then tick “It is correct” for every item."
      );
      return;
    }

    // Applies corrections to the full ingredient text.
    let confirmedIngredients = ingredients;

    for (const item of uncertainItems) {
      if (
        item.original.trim() &&
        item.value.trim() &&
        item.original !== item.value
      ) {
        confirmedIngredients =
          confirmedIngredients.replace(
            item.original,
            item.value
          );
      }
    }

    // Stores the corrected text.
    setIngredients(confirmedIngredients);

    const confirmedProduct: ProductData = {
      barcode: product?.barcode || barcode || null,
      productName: productName.trim(),
      brandName: brandName.trim(),
      variant: variant.trim(),
      ingredients: confirmedIngredients.trim(),
      contains: contains.trim(),
      mayContain: mayContain.trim(),
      source:
        product?.source || "AI package-photo extraction",
      frontPhotoUri,
      ingredientsPhotoUri,
    };

    setProduct(confirmedProduct);
    setStage("result");

    // Runs final screening only after confirmation.
    await screenConfirmedProduct(confirmedProduct);
  }

  // Saves the product to the Avoid List.
  async function addToAvoidList() {
    if (!product) {
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert(
          "Login required",
          "Please log in before saving products."
        );
        return;
      }

      const { error } = await supabase
        .from("avoid_list")
        .insert({
          user_id: user.id,
          barcode: product.barcode,
          product_name: productName.trim(),
          brand_name: brandName.trim(),
          variant: variant.trim(),
          ingredients_text: ingredients.trim(),
          contains_text: contains.trim(),
          may_contain_text: mayContain.trim(),
          save_reason:
            screening?.allergyExplanation || "",
          source: product.source,
        });

      if (error) {
        throw error;
      }

      Alert.alert(
        "Saved",
        "The product was added to your Avoid List."
      );
    } catch {
      Alert.alert(
        "Could not save",
        "The product could not be added to your Avoid List."
      );
    }
  }

  // Home page.
  if (stage === "home") {
    return (
      <SafeAreaView style={styles.homePage}>
        <View style={styles.homeContent}>
          {renderAllergyBanner()}

          <Text style={styles.homeTitle}>
            Scan food barcode
          </Text>

          <Text style={styles.homeSubtitle}>
            Check the product against your allergy and halal preferences.
          </Text>

          <TouchableOpacity
            style={styles.scanButton}
            onPress={openBarcodeCamera}
            activeOpacity={0.8}
          >
            <Text style={styles.scanButtonText}>
              Scan product
            </Text>
          </TouchableOpacity>

          <Text style={styles.homeNote}>
            If the product is not found, the app will ask for
            ingredient and package photos.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Barcode lookup loading page.
  if (stage === "lookup") {
    return (
      <SafeAreaView style={styles.loadingPage}>
        <ActivityIndicator
          size="large"
          color="#A4C766"
        />

        <Text style={styles.loadingTitle}>
          Checking product...
        </Text>

        <Text style={styles.loadingSubtitle}>
          {lookupMessage}
        </Text>
      </SafeAreaView>
    );
  }

  // AI extraction loading page.
  if (stage === "extracting") {
    return (
      <SafeAreaView style={styles.loadingPage}>
        <ActivityIndicator
          size="large"
          color="#A4C766"
        />

        <Text style={styles.loadingTitle}>
          Analyzing ingredients...
        </Text>

        <Text style={styles.loadingSubtitle}>
          Reading the package photos
        </Text>
      </SafeAreaView>
    );
  }

  // Ingredient and front-package photo pages.
  if (
    stage === "ingredients" ||
    stage === "front"
  ) {
    const isIngredients =
      stage === "ingredients";

    return (
      <SafeAreaView style={styles.photoPage}>
        <ScrollView
          contentContainerStyle={styles.photoContent}
        >
          {renderTopBar(
            isIngredients
              ? "Ingredient label"
              : "Front package"
          )}

          {renderAllergyBanner()}

          <Text style={styles.stepText}>
            {isIngredients ? "Step 1 of 2" : "Step 2 of 2"}
          </Text>

          <Text style={styles.photoTitle}>
            {isIngredients
              ? "Photograph the ingredient label"
              : "Photograph the front package"}
          </Text>

          <Text style={styles.photoSubtitle}>
            {isIngredients
              ? "Capture the complete ingredient and allergen information."
              : "Capture the product name and brand clearly."}
          </Text>

          <View style={styles.photoGuide}>
            <Text style={styles.photoGuideText}>
              Keep the label in focus
            </Text>
          </View>

          {isIngredients && ingredientsPhotoUri && (
            <Image
              source={{ uri: ingredientsPhotoUri }}
              style={styles.photoPreview}
            />
          )}

          {isIngredients && ingredientsPhotoUri && (
            <Text style={styles.photoPreviewHint}>
              If the text is blurry, take the ingredient photo again.
            </Text>
          )}

          <TouchableOpacity
            style={[
              styles.takePhotoButton,
              takingPhoto && styles.disabledButton,
            ]}
            onPress={takePackagePhoto}
            disabled={takingPhoto}
            activeOpacity={0.8}
          >
            <Text style={styles.takePhotoButtonText}>
              {takingPhoto
                ? "Opening camera..."
                : "Take photo"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={goBack}
          >
            <Text style={styles.cancelButtonText}>
              Back
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Review page.
  if (stage === "review" && product) {
    return (
      <SafeAreaView style={styles.resultPage}>
        <ScrollView
          contentContainerStyle={styles.resultContent}
          keyboardShouldPersistTaps="handled"
        >
          {renderTopBar("Review label")}

          {renderAllergyBanner()}

          {frontPhotoUri && (
            <Image
              source={{ uri: frontPhotoUri }}
              style={styles.resultPhoto}
            />
          )}

          <Text style={styles.resultTitle}>
            Review product information
          </Text>

          <Text style={styles.resultSubtitle}>
            Review the extracted information before continuing.
          </Text>

          <Text style={styles.fieldLabel}>
            Brand
          </Text>

          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyValue}>
              {brandName || "Not available"}
            </Text>
          </View>

          <Text style={styles.fieldLabel}>
            Product name
          </Text>

          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyValue}>
              {productName || "Not available"}
            </Text>
          </View>

          {/* This message appears only when uncertain ingredients exist. */}
          {uncertainItems.length > 0 && (
            <View style={styles.uncertaintyCard}>
              <Text style={styles.uncertaintyTitle}>
                I’m not sure about these ingredients
              </Text>

              <Text style={styles.uncertaintySubtitle}>
                Check them against the physical package:
              </Text>

              {uncertainItems.map((item, index) => (
                <View
                  key={`${item.original}-${index}`}
                  style={styles.uncertainItem}
                >
                  {/* Shows the uncertain ingredient clearly. */}
                  {editingUncertainIndex !== index && (
                    <Text style={styles.uncertainItemText}>
                      {item.value}
                    </Text>
                  )}

                  {/* Shows a small editor only for this item. */}
                  {editingUncertainIndex === index && (
                    <TextInput
                      style={styles.singleIngredientInput}
                      value={item.value}
                      onChangeText={(value) => {
                        setUncertainItems((current) =>
                          current.map((currentItem, currentIndex) =>
                            currentIndex === index
                              ? {
                                  ...currentItem,
                                  value,
                                  confirmed: false,
                                }
                              : currentItem
                          )
                        );
                      }}
                      autoFocus
                      accessibilityLabel={`Edit ${item.value}`}
                    />
                  )}

                  <View style={styles.uncertainActions}>
                    {/* Edits only this uncertain item. */}
                    <TouchableOpacity
                      style={styles.smallEditButton}
                      onPress={() =>
                        setEditingUncertainIndex(
                          editingUncertainIndex === index
                            ? null
                            : index
                        )
                      }
                    >
                      <Text style={styles.smallEditButtonText}>
                        {editingUncertainIndex === index
                          ? "Save"
                          : "Edit"}
                      </Text>
                    </TouchableOpacity>

                    {/* Confirms this uncertain item. */}
                    <TouchableOpacity
                      style={styles.correctCheckbox}
                      onPress={() =>
                        setUncertainItems((current) =>
                          current.map((currentItem, currentIndex) =>
                            currentIndex === index
                              ? {
                                  ...currentItem,
                                  confirmed: !currentItem.confirmed,
                                }
                              : currentItem
                          )
                        )
                      }
                    >
                      <Text style={styles.checkboxSymbol}>
                        {item.confirmed ? "☑" : "☐"}
                      </Text>

                      <Text style={styles.checkboxText}>
                        It is correct
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Displays the complete ingredient list in an organized way. */}
          <Text style={styles.fieldLabel}>
            Ingredients
          </Text>

          <View style={styles.ingredientListCard}>
            {ingredients
              .split(/,(?![^()]*\))/)
              .map((ingredient) => ingredient.trim())
              .filter(Boolean)
              .map((ingredient, index) => (
                <View
                  key={`${ingredient}-${index}`}
                  style={styles.ingredientRow}
                >
                  <Text style={styles.ingredientBullet}>
                    •
                  </Text>

                  <Text style={styles.ingredientText}>
                    {ingredient}
                  </Text>
                </View>
              ))}
          </View>

          <Text style={styles.fieldLabel}>
            Contains
          </Text>

          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyValue}>
              {contains || "None extracted"}
            </Text>
          </View>

          <Text style={styles.fieldLabel}>
            May contain
          </Text>

          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyValue}>
              {mayContain || "None extracted"}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.confirmButton}
            onPress={confirmAndAnalyze}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmButtonText}>
              Confirm and Analyze
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Final result page.
  if (stage === "result" && product) {
    return (
      <SafeAreaView style={styles.resultPage}>
        <ScrollView
          contentContainerStyle={styles.resultContent}
        >
          {renderTopBar("Analysis result")}

          {renderAllergyBanner()}

          {product.frontPhotoUri && (
            <Image
              source={{
                uri: product.frontPhotoUri,
              }}
              style={styles.resultPhoto}
            />
          )}

          <Text style={styles.resultTitle}>
            {productName || "Product result"}
          </Text>

          <Text style={styles.resultBrand}>
            {brandName || "Brand unavailable"}
          </Text>

          <Text style={styles.sourceText}>
            Source: {product.source}
          </Text>

          {/* Allergy result. */}
          <View
            style={[
              styles.statusCard,
              {
                borderLeftColor: getStatusColor(
                  screening?.allergyStatus || ""
                ),
              },
            ]}
          >
            <Text style={styles.statusHeading}>
              Allergy Screening
            </Text>

            {screeningLoading ? (
              <ActivityIndicator color="#258D4D" />
            ) : (
              <>
                <Text
                  style={[
                    styles.statusValue,
                    {
                      color: getStatusColor(
                        screening?.allergyStatus || ""
                      ),
                    },
                  ]}
                >
                  {screening?.allergyStatus}
                </Text>

                <Text style={styles.statusExplanation}>
                  {screening?.allergyExplanation}
                </Text>
              </>
            )}
          </View>

          {/* Halal result. */}
          <View
            style={[
              styles.statusCard,
              {
                borderLeftColor: getStatusColor(
                  screening?.halalStatus || ""
                ),
              },
            ]}
          >
            <Text style={styles.statusHeading}>
              Halal Screening
            </Text>

            {screeningLoading ? (
              <ActivityIndicator color="#258D4D" />
            ) : (
              <>
                <Text
                  style={[
                    styles.statusValue,
                    {
                      color: getStatusColor(
                        screening?.halalStatus || ""
                      ),
                    },
                  ]}
                >
                  {screening?.halalStatus}
                </Text>

                <Text style={styles.statusExplanation}>
                  {screening?.halalExplanation}
                </Text>
              </>
            )}
          </View>

          <Text style={styles.detailHeading}>
            Ingredients
          </Text>

          <Text style={styles.detailText}>
            {ingredients || "Not available"}
          </Text>

          <Text style={styles.detailHeading}>
            Contains
          </Text>

          <Text style={styles.detailText}>
            {contains || "None listed"}
          </Text>

          <Text style={styles.detailHeading}>
            May contain
          </Text>

          <Text style={styles.detailText}>
            {mayContain || "None listed"}
          </Text>

          <TouchableOpacity
            style={styles.avoidButton}
            onPress={addToAvoidList}
            activeOpacity={0.8}
          >
            <Text style={styles.avoidButtonText}>
              Add to My Avoid List
            </Text>
          </TouchableOpacity>

          <Text style={styles.resultNote}>
            Always verify the physical package. This is screening
            information and not a safety guarantee.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Barcode camera page.
  return (
    <SafeAreaView style={styles.cameraPage}>
      <CameraView
        style={styles.camera}
        facing="back"
        autofocus="on"
        enableTorch={torchEnabled}
        // Stops scanning after the first valid barcode.
        onBarcodeScanned={
          scanned ? undefined : handleBarcodeScanned
        }
        onMountError={(error) => {
          Alert.alert(
            "Camera error",
            error.message
          );
        }}
        barcodeScannerSettings={{
          barcodeTypes: [
            "ean13",
            "ean8",
            "upc_a",
            "upc_e",
            "code128",
            "code39",
            "code93",
            "itf14",
            "codabar",
          ],
        }}
      >
        <View style={styles.cameraOverlay}>
          {/* Back button. */}
          <TouchableOpacity
            style={styles.closeCameraButton}
            onPress={closeBarcodeCamera}
            activeOpacity={0.8}
          >
            <Text style={styles.closeCameraText}>
              ‹
            </Text>
          </TouchableOpacity>

          {/* Flashlight button. */}
          <TouchableOpacity
            style={styles.flashButton}
            onPress={() =>
              setTorchEnabled(!torchEnabled)
            }
            activeOpacity={0.8}
          >
            <Text style={styles.flashButtonText}>
              {torchEnabled ? "☼" : "♧"}
            </Text>
          </TouchableOpacity>

          <View style={styles.cameraHeading}>
            <Text style={styles.cameraTitle}>
              Scan food barcode
            </Text>

            <Text style={styles.cameraInstructions}>
              Point the camera at a barcode
            </Text>
          </View>

          {/* Barcode frame. */}
          <View
            style={styles.barcodeFrame}
            pointerEvents="none"
          />

          {/* Photo fallback. */}
          <TouchableOpacity
            style={styles.fallbackButton}
            onPress={openIngredientsPhoto}
            activeOpacity={0.8}
          >
            <Text style={styles.fallbackText}>
              No barcode? Scan the label
            </Text>
          </TouchableOpacity>

          {/* Manual barcode fallback. */}
          <View style={styles.manualBarcodeContainer}>
            <TextInput
              style={styles.manualBarcodeInput}
              value={manualBarcode}
              onChangeText={setManualBarcode}
              placeholder="Enter barcode manually"
              placeholderTextColor="#C7D0C8"
              keyboardType="number-pad"
              maxLength={14}
            />

            <TouchableOpacity
              style={styles.manualBarcodeButton}
              onPress={submitManualBarcode}
              activeOpacity={0.8}
            >
              <Text style={styles.manualBarcodeButtonText}>
                Check
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </SafeAreaView>
  );
}

// HomeScreen styles.
const styles = StyleSheet.create({
  topBar: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    marginBottom: 10,
  },

  backButton: {
    width: 42,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
  },

  backArrow: {
    color: "#176B43",
    fontSize: 36,
    lineHeight: 38,
  },

  topBarTitle: {
    color: "#163D2A",
    fontSize: 17,
    fontWeight: "800",
  },

  topBarSpacer: {
    width: 42,
  },

  allergyBanner: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EEF7E7",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },

  allergyTextContainer: {
    flex: 1,
    paddingRight: 10,
  },

  allergyTitle: {
    color: "#315D35",
    fontSize: 12,
    fontWeight: "800",
  },

  allergyValue: {
    color: "#45624B",
    fontSize: 13,
    marginTop: 4,
  },

  halalPreference: {
    color: "#45624B",
    fontSize: 12,
    marginTop: 3,
  },

  editText: {
    color: "#176B43",
    fontSize: 13,
    fontWeight: "800",
  },

  homePage: {
    flex: 1,
    backgroundColor: "#F8FBF8",
  },

  homeContent: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },

  homeTitle: {
    color: "#176B43",
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
  },

  homeSubtitle: {
    color: "#63776B",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 28,
  },

  scanButton: {
    backgroundColor: "#8FAE54",
    minHeight: 58,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },

  scanButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },

  homeNote: {
    color: "#63776B",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 20,
  },

  cameraPage: {
    flex: 1,
    backgroundColor: "#000000",
  },

  camera: {
    flex: 1,
  },

  cameraOverlay: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.22)",
  },

  closeCameraButton: {
    position: "absolute",
    top: 24,
    left: 18,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
  },

  closeCameraText: {
    color: "#FFFFFF",
    fontSize: 30,
  },

  flashButton: {
    position: "absolute",
    top: 24,
    right: 18,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
  },

  flashButtonText: {
    color: "#FFFFFF",
    fontSize: 22,
  },

  cameraHeading: {
    position: "absolute",
    top: 90,
    left: 25,
    right: 25,
    alignItems: "center",
  },

  cameraTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },

  cameraInstructions: {
    color: "#FFFFFF",
    fontSize: 14,
    marginTop: 8,
  },

  barcodeFrame: {
    position: "absolute",
    top: "41%",
    width: "84%",
    height: 145,
    borderWidth: 2,
    borderColor: "#D9F0B0",
    borderRadius: 16,
  },

  fallbackButton: {
    position: "absolute",
    bottom: 45,
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },

  fallbackText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  manualBarcodeContainer: {
    position: "absolute",
    bottom: 92,
    left: 20,
    right: 20,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  manualBarcodeInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.65)",
    color: "#FFFFFF",
    paddingHorizontal: 12,
    fontSize: 13,
    marginRight: 8,
  },

  manualBarcodeButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#258D4D",
    justifyContent: "center",
    alignItems: "center",
  },

  manualBarcodeButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  photoPage: {
    flex: 1,
    backgroundColor: "#F8FBF8",
  },

  photoContent: {
    padding: 24,
    paddingBottom: 40,
  },

  stepText: {
    color: "#8FAE54",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },

  photoTitle: {
    color: "#163D2A",
    fontSize: 27,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 12,
  },

  photoSubtitle: {
    color: "#63776B",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 10,
  },

  photoGuide: {
    height: 260,
    borderWidth: 2,
    borderColor: "#A9C778",
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 35,
    marginBottom: 30,
  },

  photoGuideText: {
    color: "#63776B",
    fontSize: 14,
  },

  photoPreview: {
    width: "100%",
    height: 120,
    borderRadius: 12,
    resizeMode: "cover",
    marginBottom: 8,
  },

  photoPreviewHint: {
    color: "#63776B",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 12,
  },

  takePhotoButton: {
    backgroundColor: "#258D4D",
    minHeight: 56,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },

  takePhotoButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  cancelButton: {
    minHeight: 50,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },

  cancelButtonText: {
    color: "#63776B",
    fontSize: 15,
    fontWeight: "700",
  },

  disabledButton: {
    opacity: 0.55,
  },

  loadingPage: {
    flex: 1,
    backgroundColor: "#071007",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  loadingTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 20,
  },

  loadingSubtitle: {
    color: "#A7B1A6",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },

  resultPage: {
    flex: 1,
    backgroundColor: "#F8FBF8",
  },

  resultContent: {
    padding: 20,
    paddingBottom: 45,
  },

  resultPhoto: {
    width: "100%",
    height: 250,
    borderRadius: 16,
    resizeMode: "cover",
    marginBottom: 18,
  },

  resultTitle: {
    color: "#163D2A",
    fontSize: 25,
    fontWeight: "800",
  },

  resultSubtitle: {
    color: "#63776B",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },

  resultBrand: {
    color: "#63776B",
    fontSize: 16,
    marginTop: 5,
  },

  sourceText: {
    color: "#176B43",
    fontSize: 12,
    marginTop: 10,
  },

  statusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderLeftWidth: 6,
    borderLeftColor: "#258D4D",
    padding: 16,
    marginTop: 16,
  },

  statusHeading: {
    color: "#163D2A",
    fontSize: 17,
    fontWeight: "800",
  },

  statusValue: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 10,
  },

  statusExplanation: {
    color: "#63776B",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },

  fieldLabel: {
    color: "#264C37",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 7,
  },

  // Yellow popup shown only when uncertain ingredients exist.
  uncertaintyCard: {
    backgroundColor: "#FFF8E1",
    borderWidth: 1,
    borderColor: "#E0B83F",
    borderRadius: 14,
    padding: 14,
    marginTop: 18,
  },

  uncertaintyTitle: {
    color: "#755000",
    fontSize: 16,
    fontWeight: "800",
  },

  uncertaintySubtitle: {
    color: "#755000",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
    marginBottom: 10,
  },

  uncertainItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 11,
    padding: 12,
    marginTop: 8,
  },

  uncertainItemText: {
    color: "#352B14",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },

  uncertainActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },

  smallEditButton: {
    backgroundColor: "#258D4D",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  smallEditButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  correctCheckbox: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 14,
    paddingVertical: 5,
  },

  checkboxSymbol: {
    color: "#176B43",
    fontSize: 22,
  },

  checkboxText: {
    color: "#315D35",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 5,
  },

  singleIngredientInput: {
    minHeight: 44,
    borderWidth: 2,
    borderColor: "#D7A928",
    borderRadius: 9,
    backgroundColor: "#FFFDF4",
    color: "#1D3829",
    paddingHorizontal: 10,
    marginTop: 8,
    fontSize: 14,
  },

  ingredientListCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE5DE",
    borderRadius: 12,
    padding: 14,
  },

  ingredientRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },

  ingredientBullet: {
    color: "#258D4D",
    fontSize: 18,
    lineHeight: 20,
    marginRight: 8,
  },

  ingredientText: {
    flex: 1,
    color: "#1D3829",
    fontSize: 14,
    lineHeight: 20,
  },

  readOnlyField: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#DCE5DE",
    borderRadius: 11,
    backgroundColor: "#F3F7F3",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  readOnlyValue: {
    color: "#1D3829",
    fontSize: 14,
    lineHeight: 21,
  },

  detailHeading: {
    color: "#264C37",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 6,
  },

  detailText: {
    color: "#1D3829",
    fontSize: 14,
    lineHeight: 21,
  },

  confirmButton: {
    backgroundColor: "#258D4D",
    minHeight: 54,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 28,
  },

  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  avoidButton: {
    backgroundColor: "#258D4D",
    minHeight: 56,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 28,
  },

  avoidButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  resultNote: {
    color: "#63776B",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 18,
  },
});