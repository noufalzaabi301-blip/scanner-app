// React hooks used for the scanning workflow.
import { useState } from "react";

// Barcode camera.
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";

// Native phone camera for package photos.
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

// Screen stages.
type Stage =
  | "home"
  | "barcode"
  | "lookup"
  | "ingredients"
  | "front"
  | "extracting"
  | "review"
  | "result";

// Product data used by the app.
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
};

// Screening information shown to the user.
type ScreeningData = {
  allergyStatus: string;
  allergyExplanation: string;
  halalStatus: string;
  halalExplanation: string;
};

export default function HomeScreen() {
  // Controls which part of the workflow is visible.
  const [stage, setStage] = useState<Stage>("home");

  // Prevents repeated barcode scans.
  const [scanned, setScanned] = useState(false);

  // Stores the scanned barcode.
  const [barcode, setBarcode] = useState("");

  // Stores the ingredients-panel photo.
  const [ingredientsPhotoUri, setIngredientsPhotoUri] =
    useState<string | null>(null);

  // Stores the front-package photo.
  const [frontPhotoUri, setFrontPhotoUri] =
    useState<string | null>(null);

  // Stores the current product.
  const [product, setProduct] =
    useState<ProductData | null>(null);

  // Editable product fields.
  const [brandName, setBrandName] = useState("");
  const [productName, setProductName] = useState("");
  const [variant, setVariant] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [contains, setContains] = useState("");
  const [mayContain, setMayContain] = useState("");

  // Stores the allergy and halal analysis.
  const [screening, setScreening] =
    useState<ScreeningData | null>(null);

  // Shows analysis loading.
  const [screeningLoading, setScreeningLoading] =
    useState(false);

  // Prevents pressing the native camera button repeatedly.
  const [takingPhoto, setTakingPhoto] =
    useState(false);

  // Controls the barcode camera flashlight.
  const [torchEnabled, setTorchEnabled] =
    useState(false);

  // Stores barcode camera permission.
  const [permission, requestPermission] =
    useCameraPermissions();

  // Normalizes English and Arabic text for matching.
  function normalizeText(value: string) {
    return value
      .toLowerCase()
      .normalize("NFKC")
      .replace(
        /[\u064B-\u065F\u0670]/g,
        ""
      )
      .replace(/[إأآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Creates the exact barcode and valid UPC/EAN alternatives.
  function getBarcodeCandidates(value: string) {
    // Keep numbers only.
    const cleaned = value.replace(/\D/g, "");

    // Always try the exact barcode first.
    const candidates = [cleaned];

    // A UPC-A may also be written with one leading zero.
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

    // Remove duplicate candidates.
    return [...new Set(candidates)];
  }

  // Checks whether a barcode has a valid length.
  function isValidBarcode(value: string) {
    return value.length >= 8 && value.length <= 14;
  }

  // Opens the barcode camera.
  async function openBarcodeCamera() {
    // Request permission before opening the barcode camera.
    if (!permission?.granted) {
      const result = await requestPermission();

      // Stop when permission is denied.
      if (!result.granted) {
        Alert.alert(
          "Camera permission needed",
          "Please allow camera access in your phone settings."
        );
        return;
      }
    }

    // Reset barcode state.
    setScanned(false);
    setBarcode("");
    setTorchEnabled(false);

    // Open the barcode screen.
    setStage("barcode");
  }

  // Opens the ingredient-photo instruction screen.
  function openIngredientsPhoto() {
    // Start with the back/ingredient label.
    setStage("ingredients");
  }

  // Opens the front-package instruction screen.
  function openFrontPhoto() {
    // Move to the front-package step.
    setStage("front");
  }

  // Closes the barcode camera.
  function closeBarcodeCamera() {
    setTorchEnabled(false);
    setStage("home");
  }

  // Searches the verified internal product database.
  async function findInternalProduct(
    barcodeValue: string
  ) {
    // Search exact and valid UPC/EAN alternatives.
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

      // Report database errors.
      if (error) {
        throw new Error(error.message);
      }

      // Return only approved products.
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

    // No approved internal product was found.
    return null;
  }

  // Searches Open Food Facts after the internal database.
  async function findOpenFoodFacts(
    barcodeValue: string
  ) {
    // Search exact and valid alternatives.
    const candidates =
      getBarcodeCandidates(barcodeValue);

    for (const candidate of candidates) {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${candidate}.json?fields=code,product_name,brands,ingredients_text,ingredients_text_en,allergens,traces`
      );

      // Stop if Open Food Facts is unavailable.
      if (!response.ok) {
        throw new Error(
          "Open Food Facts is unavailable."
        );
      }

      const data = await response.json();

      // Continue if the product does not exist.
      if (
        data.status !== 1 ||
        !data.product
      ) {
        continue;
      }

      // Prefer English ingredients when available.
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

    // No Open Food Facts product was found.
    return null;
  }

  // Fills the editable fields with product data.
  function fillProductFields(
    nextProduct: ProductData
  ) {
    // Save the product.
    setProduct(nextProduct);

    // Fill the editable fields.
    setBrandName(nextProduct.brandName);
    setProductName(nextProduct.productName);
    setVariant(nextProduct.variant);
    setIngredients(nextProduct.ingredients);
    setContains(nextProduct.contains);
    setMayContain(nextProduct.mayContain);
  }

  // Finds allergy aliases in English or Arabic label text.
  function findAllergyMatch(
    allergy: string,
    labelText: string
  ) {
    // Normalize both values before matching.
    const selected = normalizeText(allergy);
    const text = normalizeText(labelText);

    // English and Arabic allergen aliases.
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

    // Find the group matching the user's allergy.
    const groupKey = Object.keys(aliasGroups).find(
      (key) =>
        selected === key ||
        aliasGroups[key].some(
          (term) =>
            normalizeText(term) === selected
        )
    );

    // Use the group aliases or the original allergy.
    const terms = groupKey
      ? aliasGroups[groupKey]
      : [allergy];

    // Return the matched ingredient term.
    return (
      terms.find((term) =>
        text.includes(normalizeText(term))
      ) || ""
    );
  }

  // Performs the allergy and halal screening.
  async function screenConfirmedProduct() {
    // Show loading.
    setScreeningLoading(true);

    try {
      // Get the logged-in user.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Stop without a user session.
      if (!user) {
        throw new Error("No signed-in user.");
      }

      // Load the user's preferences.
      const { data: preferences, error } =
        await supabase
          .from("user_preferences")
          .select(
            "prefers_halal, has_allergies, allergies, other_allergy"
          )
          .eq("user_id", user.id)
          .maybeSingle();

      // Stop when preferences cannot be loaded.
      if (error) {
        throw new Error(error.message);
      }

      // Combine all confirmed label fields.
      const allLabelText = [
        ingredients,
        contains,
        mayContain,
      ].join(" ");

      // Keep May Contain separate.
      const mayContainText =
        normalizeText(mayContain);

      // Read the allergy array safely.
      const allergyValues: string[] =
        Array.isArray(preferences?.allergies)
          ? [...preferences.allergies]
          : [];

      // Add the optional custom allergy.
      if (
        preferences?.other_allergy &&
        preferences.other_allergy.trim()
      ) {
        allergyValues.push(
          preferences.other_allergy
        );
      }

      // Find the first allergy match.
      let matchedAllergy = "";
      let matchedIngredient = "";

      for (const allergy of allergyValues) {
        const match = findAllergyMatch(
          allergy,
          allLabelText
        );

        if (match) {
          matchedAllergy = allergy;
          matchedIngredient = match;
          break;
        }
      }

      // Calculate the allergy result.
      let allergyStatus =
        "No selected allergen found";

      let allergyExplanation =
        "No selected allergen was found in the confirmed label information.";

      if (!ingredients.trim()) {
        allergyStatus = "Insufficient information";
        allergyExplanation =
          "A complete ingredient list was not confirmed.";
      } else if (!preferences?.has_allergies) {
        allergyStatus = "No allergy profile selected";
        allergyExplanation =
          "No allergy profile is currently selected.";
      } else if (matchedAllergy) {
        const isMayContain =
          mayContainText.includes(
            normalizeText(matchedIngredient)
          );

        if (isMayContain) {
          allergyStatus = "May contain";
          allergyExplanation =
            `${matchedIngredient} appears in May Contain information and may relate to your ${matchedAllergy} allergy.`;
        } else {
          allergyStatus = "Allergen detected";
          allergyExplanation =
            `${matchedIngredient} was found and may relate to your ${matchedAllergy} allergy.`;
        }
      }

      // Normalize the label for halal checks.
      const halalText = normalizeText(
        allLabelText
      );

      // Strong halal concerns.
      const nonHalalTerms = [
        "pork",
        "porcine",
        "lard",
        "ham",
        "bacon",
        "خنزير",
        "شحم الخنزير",
      ];

      // Ingredients requiring source verification.
      const verificationTerms = [
        "gelatin",
        "alcohol",
        "ethanol",
        "enzymes",
        "gelatine",
        "جيلاتين",
        "كحول",
        "انزيمات",
      ];

      // Find possible halal concerns.
      const nonHalalMatch =
        nonHalalTerms.find((term) =>
          halalText.includes(normalizeText(term))
        );

      const verificationMatch =
        verificationTerms.find((term) =>
          halalText.includes(normalizeText(term))
        );

      // Calculate the halal result.
      let halalStatus =
        "No identified concern from available label information";

      let halalExplanation =
        "No identified concern was found from the available label information.";

      if (!ingredients.trim()) {
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

      // Store the final screening information.
      setScreening({
        allergyStatus,
        allergyExplanation,
        halalStatus,
        halalExplanation,
      });
    } catch {
      // Never show a false safe result if preferences fail.
      setScreening({
        allergyStatus: "Unable to complete screening",
        allergyExplanation:
          "The allergy preferences could not be loaded.",
        halalStatus: "Unable to complete screening",
        halalExplanation:
          "The halal preference could not be loaded.",
      });
    } finally {
      // Stop loading.
      setScreeningLoading(false);
    }
  }

  // Looks up a barcode in the correct order.
  async function lookupBarcode(
    barcodeValue: string
  ) {
    // Show the loading screen.
    setStage("lookup");

    try {
      // Search the approved internal database first.
      const internalProduct =
        await findInternalProduct(barcodeValue);

      // Show the approved product.
      if (internalProduct) {
        fillProductFields(internalProduct);
        setStage("result");
        await screenConfirmedProduct();
        return;
      }

      // Search Open Food Facts second.
      const externalProduct =
        await findOpenFoodFacts(barcodeValue);

      // Show the external product.
      if (externalProduct) {
        fillProductFields(externalProduct);
        setStage("result");
        await screenConfirmedProduct();
        return;
      }

      // Start the ingredient-photo fallback.
      setStage("ingredients");
    } catch {
      // Start the fallback if a provider is unavailable.
      setStage("ingredients");
    }
  }

  // Handles barcode data from the scanner.
  function handleBarcodeScanned(
    result: BarcodeScanningResult
  ) {
    // Ignore duplicate results.
    if (scanned) {
      return;
    }

    // Keep only numbers.
    const cleanedBarcode = result.data
      .replace(/\D/g, "")
      .trim();

    // Ignore invalid barcode lengths.
    if (!isValidBarcode(cleanedBarcode)) {
      return;
    }

    // Prevent another scan.
    setScanned(true);

    // Save the barcode.
    setBarcode(cleanedBarcode);

    // Close the flashlight.
    setTorchEnabled(false);

    // Start the lookup process.
    lookupBarcode(cleanedBarcode);
  }

  // Opens the native phone camera for package photos.
  async function takePackagePhoto() {
    // Prevent repeated button presses.
    if (takingPhoto) {
      return;
    }

    // Show button loading.
    setTakingPhoto(true);

    try {
      // Open the native phone camera.
      const result =
        await ImagePicker.launchCameraAsync({
          // Take a photo.
          mediaTypes:
            ImagePicker.MediaTypeOptions.Images,

          // Do not crop the package image.
          allowsEditing: false,

          // Request high image quality.
          quality: 1,
        });

      // Stop when the user cancels.
      if (result.canceled) {
        return;
      }

      // Read the captured image.
      const photoUri = result.assets?.[0]?.uri;

      // Stop if no image was returned.
      if (!photoUri) {
        Alert.alert(
          "Photo error",
          "The phone did not return a photo."
        );
        return;
      }

      // Save the ingredient-panel photo first.
      if (stage === "ingredients") {
        setIngredientsPhotoUri(photoUri);

        // Move to the front-package instruction screen.
        setStage("front");
        return;
      }

      // Save the front-package photo second.
      if (stage === "front") {
        setFrontPhotoUri(photoUri);

        // Both photos are required.
        if (!ingredientsPhotoUri) {
          Alert.alert(
            "Missing ingredient photo",
            "Please take the ingredient photo first."
          );
          setStage("ingredients");
          return;
        }

        // Show the extraction loading screen.
        setStage("extracting");

        // Send both photos to the AI.
        const extraction: LabelExtraction =
          await extractLabelFromPhotos(
            photoUri,
            ingredientsPhotoUri
          );

        // Convert the AI response into editable product data.
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
        };

        // Fill the review fields.
        fillProductFields(extractedProduct);

        // Wait for user confirmation before screening.
        setStage("review");
      }
    } catch (error) {
  // Show the actual error instead of hiding it.
  const message =
    error instanceof Error
      ? error.message
      : "The photo could not be taken or analyzed.";

  Alert.alert("Photo error", message);
    
    } finally {
      // Re-enable the button.
      setTakingPhoto(false);
    }
  }

  // Confirms edited AI information before analysis.
  async function confirmAndAnalyze() {
    // Ingredients are required.
    if (!ingredients.trim()) {
      Alert.alert(
        "Ingredients required",
        "Please review the ingredient list before continuing."
      );
      return;
    }

    // Save the corrected fields.
    const confirmedProduct: ProductData = {
      barcode: product?.barcode || barcode || null,
      productName: productName.trim(),
      brandName: brandName.trim(),
      variant: variant.trim(),
      ingredients: ingredients.trim(),
      contains: contains.trim(),
      mayContain: mayContain.trim(),
      source:
        product?.source || "AI package-photo extraction",
      frontPhotoUri,
      ingredientsPhotoUri,
    };

    // Save the corrected product.
    setProduct(confirmedProduct);

    // Show results only after confirmation.
    setStage("result");

    // Analyze the corrected fields.
    await screenConfirmedProduct();
  }

  // Saves the confirmed product to the Avoid List.
  async function addToAvoidList() {
    // Stop when product data is missing.
    if (!product) {
      return;
    }

    try {
      // Get the signed-in user.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Require login.
      if (!user) {
        Alert.alert(
          "Login required",
          "Please log in before saving products."
        );
        return;
      }

      // Save the complete confirmed product.
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

      // Handle database errors.
      if (error) {
        if (error.code === "23505") {
          Alert.alert(
            "Already saved",
            "This product is already in your Avoid List."
          );
          return;
        }

        throw error;
      }

      // Confirm that saving worked.
      Alert.alert(
        "Saved",
        "The product was added to your Avoid List."
      );
    } catch {
      // Display a readable error.
      Alert.alert(
        "Could not save",
        "The product could not be added to your Avoid List."
      );
    }
  }

  // Simple Home screen with no Profile button.
  if (stage === "home") {
    return (
      <SafeAreaView style={styles.homePage}>
        <View style={styles.homeContent}>
          {/* Main Home heading. */}
          <Text style={styles.homeTitle}>
            Scan food barcode
          </Text>

          {/* Short explanation. */}
          <Text style={styles.homeSubtitle}>
            Check the product against your allergy and halal preferences.
          </Text>

          {/* Main action button. */}
          <TouchableOpacity
            style={styles.scanButton}
            onPress={openBarcodeCamera}
            activeOpacity={0.8}
          >
            <Text style={styles.scanButtonText}>
              Scan product
            </Text>
          </TouchableOpacity>

          {/* Fallback explanation. */}
          <Text style={styles.homeNote}>
            If the product is not found, the app will ask for
            ingredient and package photos.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Barcode lookup loading screen.
  if (stage === "lookup") {
    return (
      <SafeAreaView style={styles.loadingPage}>
        <ActivityIndicator
          size="large"
          color="#A4C766"
        />

        <Text style={styles.loadingTitle}>
          Analyzing product...
        </Text>

        <Text style={styles.loadingSubtitle}>
          Looking up product information
        </Text>
      </SafeAreaView>
    );
  }

  // AI extraction loading screen.
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

  // Native-camera instruction screen for package photos.
  if (
    stage === "ingredients" ||
    stage === "front"
  ) {
    const isIngredients =
      stage === "ingredients";

    return (
      <SafeAreaView style={styles.photoPage}>
        <View style={styles.photoContent}>
          {/* Step indicator. */}
          <Text style={styles.stepText}>
            {isIngredients ? "Step 1 of 2" : "Step 2 of 2"}
          </Text>

          {/* Current photo instruction. */}
          <Text style={styles.photoTitle}>
            {isIngredients
              ? "Photograph the back label"
              : "Photograph the front package"}
          </Text>

          {/* Helpful instruction. */}
          <Text style={styles.photoSubtitle}>
            {isIngredients
              ? "Capture the complete ingredient and allergen information."
              : "Capture the product name and brand clearly."}
          </Text>

          {/* Simple framing guide. */}
          <View style={styles.photoGuide}>
            <Text style={styles.photoGuideText}>
              Keep the label in focus
            </Text>
          </View>

          {/* Native phone-camera button. */}
          <TouchableOpacity
            style={[
              styles.takePhotoButton,
              takingPhoto &&
                styles.disabledButton,
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

          {/* Go back without taking a photo. */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setStage("home")}
          >
            <Text style={styles.cancelButtonText}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Editable AI review screen.
  if (stage === "review" && product) {
    return (
      <SafeAreaView style={styles.resultPage}>
        <ScrollView
          contentContainerStyle={styles.resultContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Show the front-package image. */}
          {frontPhotoUri && (
            <Image
              source={{ uri: frontPhotoUri }}
              style={styles.resultPhoto}
            />
          )}

          {/* Review heading. */}
          <Text style={styles.resultTitle}>
            Review product information
          </Text>

          <Text style={styles.resultSubtitle}>
            Correct anything the AI extracted incorrectly.
          </Text>

          {/* Brand field. */}
          <Text style={styles.fieldLabel}>
            Brand
          </Text>

          <TextInput
            style={styles.input}
            value={brandName}
            onChangeText={setBrandName}
            placeholder="Brand"
            placeholderTextColor="#AAB8AE"
          />

          {/* Product name field. */}
          <Text style={styles.fieldLabel}>
            Product name
          </Text>

          <TextInput
            style={styles.input}
            value={productName}
            onChangeText={setProductName}
            placeholder="Product name"
            placeholderTextColor="#AAB8AE"
          />

          {/* Variant field. */}
          <Text style={styles.fieldLabel}>
            Variant
          </Text>

          <TextInput
            style={styles.input}
            value={variant}
            onChangeText={setVariant}
            placeholder="Variant"
            placeholderTextColor="#AAB8AE"
          />

          {/* Full ingredient field. */}
          <Text style={styles.fieldLabel}>
            Ingredients
          </Text>

          <TextInput
            style={styles.largeInput}
            value={ingredients}
            onChangeText={setIngredients}
            placeholder="Ingredients"
            placeholderTextColor="#AAB8AE"
            multiline
            textAlignVertical="top"
          />

          {/* Contains field. */}
          <Text style={styles.fieldLabel}>
            Contains
          </Text>

          <TextInput
            style={styles.input}
            value={contains}
            onChangeText={setContains}
            placeholder="Contains"
            placeholderTextColor="#AAB8AE"
          />

          {/* May Contain field. */}
          <Text style={styles.fieldLabel}>
            May contain
          </Text>

          <TextInput
            style={styles.input}
            value={mayContain}
            onChangeText={setMayContain}
            placeholder="May contain"
            placeholderTextColor="#AAB8AE"
          />

          {/* Confirm button. */}
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

  // Final result screen.
  if (stage === "result" && product) {
    return (
      <SafeAreaView style={styles.resultPage}>
        <ScrollView
          contentContainerStyle={styles.resultContent}
        >
          {/* Show the front-package image. */}
          {product.frontPhotoUri && (
            <Image
              source={{
                uri: product.frontPhotoUri,
              }}
              style={styles.resultPhoto}
            />
          )}

          {/* Product name and brand. */}
          <Text style={styles.resultTitle}>
            {productName || "Product result"}
          </Text>

          <Text style={styles.resultBrand}>
            {brandName || "Brand unavailable"}
          </Text>

          {/* Information source. */}
          <Text style={styles.sourceText}>
            Source: {product.source}
          </Text>

          {/* Allergy result. */}
          <View style={styles.statusCard}>
            <Text style={styles.statusHeading}>
              Allergy Screening
            </Text>

            {screeningLoading ? (
              <ActivityIndicator color="#258D4D" />
            ) : (
              <>
                <Text style={styles.statusValue}>
                  {screening?.allergyStatus}
                </Text>

                <Text style={styles.statusExplanation}>
                  {screening?.allergyExplanation}
                </Text>
              </>
            )}
          </View>

          {/* Halal result. */}
          <View style={styles.statusCard}>
            <Text style={styles.statusHeading}>
              Halal Screening
            </Text>

            {screeningLoading ? (
              <ActivityIndicator color="#258D4D" />
            ) : (
              <>
                <Text style={styles.statusValue}>
                  {screening?.halalStatus}
                </Text>

                <Text style={styles.statusExplanation}>
                  {screening?.halalExplanation}
                </Text>
              </>
            )}
          </View>

          {/* Confirmed ingredient information. */}
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

          {/* Avoid List button at the bottom. */}
          <TouchableOpacity
            style={styles.avoidButton}
            onPress={addToAvoidList}
            activeOpacity={0.8}
          >
            <Text style={styles.avoidButtonText}>
              Add to My Avoid List
            </Text>
          </TouchableOpacity>

          {/* Safety warning. */}
          <Text style={styles.resultNote}>
            Always verify the physical package. This is
            screening information and not a safety guarantee.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Barcode scanner screen.
  return (
    <SafeAreaView style={styles.cameraPage}>
      <CameraView
        style={styles.camera}
        facing="back"
        autofocus="on"
        enableTorch={torchEnabled}
        onBarcodeScanned={handleBarcodeScanned}
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
        {/* Barcode-camera controls. */}
        <View style={styles.cameraOverlay}>
          {/* Close button. */}
          <TouchableOpacity
            style={styles.closeCameraButton}
            onPress={closeBarcodeCamera}
            activeOpacity={0.8}
          >
            <Text style={styles.closeCameraText}>
              ×
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

          {/* Scanner instructions. */}
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

          {/* Label fallback. */}
          <TouchableOpacity
            style={styles.fallbackButton}
            onPress={openIngredientsPhoto}
            activeOpacity={0.8}
          >
            <Text style={styles.fallbackText}>
              No barcode? Scan the label
            </Text>
          </TouchableOpacity>
        </View>
      </CameraView>
    </SafeAreaView>
  );
}

// Styles for the complete flow.
const styles = StyleSheet.create({
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

  photoPage: {
    flex: 1,
    backgroundColor: "#F8FBF8",
  },

  photoContent: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
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
    padding: 16,
    marginTop: 16,
  },

  statusHeading: {
    color: "#163D2A",
    fontSize: 17,
    fontWeight: "800",
  },

  statusValue: {
    color: "#176B43",
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

  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#DCE5DE",
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    color: "#1D3829",
    paddingHorizontal: 14,
    fontSize: 14,
  },

  largeInput: {
    minHeight: 145,
    borderWidth: 1,
    borderColor: "#DCE5DE",
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    color: "#1D3829",
    padding: 14,
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