// ---------------------------------------------------------------------------
// screens/HomeScreen.tsx
// Workflow: home -> barcode -> lookup -> ingredient photo -> front photo
//           -> AI extraction -> review -> allergy + halal results
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";
import { extractLabelFromPhotos } from "../lib/labelExtraction";
import { cleanBarcode, isValidBarcode } from "../lib/barcode";
import {
  lookupProduct,
  withTimeout,
  type LookupResult,
  type ProductInfo,
} from "../lib/productLookup";
import {
  internalProvider,
  openFoodFactsProvider,
} from "../lib/productProviders";
import {
  ITEM_SEPARATORS,
  applyIngredientCorrections,
  normalizeText,
  parseUncertainIngredients,
  screenProduct,
  splitTopLevel,
  type Level,
  type ScreeningData,
  type ScreeningSection,
  type UncertainIngredient,
} from "../lib/screening";

// ---------------------------------------------------------------------------
// TYPES + CONSTANTS
// ---------------------------------------------------------------------------

// Workflow stages shown inside this one screen.
type Stage =
  | "home"
  | "barcode"
  | "lookup"
  | "ingredients"
  | "front"
  | "extracting"
  | "review"
  | "result";

// Product information used by the review and result stages.
// Barcode is nullable because photo-only products may not have a barcode.
type ProductData = Omit<ProductInfo, "barcode"> & {
  barcode: string | null;
  frontPhotoUri: string | null;
  ingredientsPhotoUri: string | null;
};

// Message shown on a photo screen after a failed step.
type PhotoError = {
  message: string;
  retryable: boolean; // true = photo is fine, just try the analysis again
};

// Exact messages requested for unreadable photos.
const FRONT_PHOTO_MESSAGE =
  "The front photo could not be read. Please take another clear photo showing the product name and brand.";
const INGREDIENT_PHOTO_MESSAGE =
  "The ingredient label could not be read. Please take another clear photo of the full ingredient list.";
const NETWORK_MESSAGE =
  "We couldn't analyze the photos. Check your internet connection and try again.";
const UNAVAILABLE_MESSAGE =
  "Product information unavailable — photograph the package label.";
const NOT_FOUND_MESSAGE =
  "Product not found — photograph the package label.";

const EXTRACTION_TIMEOUT_MS = 90000; // AI extraction can never hang forever
const SOURCE_PHOTO = "AI package-photo extraction";

// The stack header already covers the top inset, so pages skip it.
const PAGE_EDGES: Edge[] = ["left", "right", "bottom"];

// Colors for each result level.
const LEVEL_COLORS: Record<Level, { main: string; bg: string }> = {
  direct: { main: "#C62828", bg: "#FDECEA" }, // red
  may: { main: "#E65100", bg: "#FFF1E0" }, // orange
  clear: { main: "#258D4D", bg: "#E8F5E9" }, // green
  verify: { main: "#8A6A00", bg: "#FFF8D6" }, // yellow
  none: { main: "#5F6B64", bg: "#F0F2F1" }, // gray
  error: { main: "#5F6B64", bg: "#F0F2F1" }, // gray
};

// Safely turns any value into trimmed text (AI / database fields may be missing).
function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// True if this navigator (or a parent navigator) has the route.
function hasRoute(nav: any, name: string): boolean {
  let current = nav;

  while (current) {
    const names: string[] = current.getState?.()?.routeNames ?? [];

    if (names.includes(name)) {
      return true;
    }

    current = current.getParent?.();
  }

  return false;
}

// Decides which photo to ask for again, from the extraction error text.
function classifyExtractionError(
  error: unknown
): "front" | "ingredients" | "network" {
  const text = (error instanceof Error ? error.message : "").toLowerCase();

  if (/network|timed out|too long|failed to fetch|offline|internet/.test(text)) {
    return "network";
  }

  if (text.includes("ingredient")) {
    return "ingredients";
  }

  return "front"; // e.g. "A valid front package photo is required"
}

// Loads the CURRENT user's allergies and halal setting from Supabase.
async function fetchUserPreferences(): Promise<{
  allergies: string[];
  prefersHalal: boolean;
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("No signed-in user.");
  }

  const { data, error } = await supabase
    .from("user_preferences")
    .select("allergies, other_allergy, prefers_halal")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const allergies: string[] = Array.isArray(data?.allergies)
    ? data.allergies
        .filter((item: unknown): item is string => typeof item === "string")
        .map((item: string) => item.trim())
        .filter(Boolean)
    : [];

  // "Other allergy" may contain several comma-separated items.
  if (typeof data?.other_allergy === "string") {
    data.other_allergy
      .split(/[,;،\n]+/)
      .map((item: string) => item.trim())
      .filter(Boolean)
      .forEach((item: string) => allergies.push(item));
  }

  return {
    allergies: [...new Set(allergies)],
    prefersHalal: data?.prefers_halal === true,
  };
}

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------

export default function HomeScreen({ navigation }: any) {
  const [stage, setStage] = useState<Stage>("home");

  // Barcode scanner state.
  const [scanned, setScanned] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [manualBarcode, setManualBarcode] = useState("");
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // Photos. The ingredient photo is kept when only the front photo is retaken.
  const [ingredientsPhotoUri, setIngredientsPhotoUri] =
    useState<string | null>(null);
  const [frontPhotoUri, setFrontPhotoUri] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<PhotoError | null>(null);
  const [takingPhoto, setTakingPhoto] = useState(false);

  // Ignore results from a cancelled/outdated lookup, extraction or screening.
  const extractionRunId = useRef(0);
  const lookupRunId = useRef(0);
  const screeningRunId = useRef(0);

  // Product information (editable on the review page).
  const [product, setProduct] = useState<ProductData | null>(null);
  const [brandName, setBrandName] = useState("");
  const [productName, setProductName] = useState("");
  const [variant, setVariant] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [contains, setContains] = useState("");
  const [mayContain, setMayContain] = useState("");
  const [lowConfidence, setLowConfidence] = useState(false);

  // Uncertain ingredient rows on the review page.
  const [uncertainItems, setUncertainItems] = useState<UncertainIngredient[]>(
    []
  );
  const [editingUncertainIndex, setEditingUncertainIndex] =
    useState<number | null>(null);

  // True only when results were reached through the review page.
  const [hasReview, setHasReview] = useState(false);

  // User preferences (banner).
  const [userAllergies, setUserAllergies] = useState<string[]>([]);
  const [prefersHalal, setPrefersHalal] = useState(false);

  // Lookup + screening state.
  const [lookupMessage, setLookupMessage] = useState("");
  const [screening, setScreening] = useState<ScreeningData | null>(null);
  const [screeningLoading, setScreeningLoading] = useState(false);
  const [allergyOpen, setAllergyOpen] = useState(false);
  const [halalOpen, setHalalOpen] = useState(false);

  // Avoid List saving.
  const [savingAvoid, setSavingAvoid] = useState(false);
  const [savedAvoid, setSavedAvoid] = useState(false);

  // -------------------------------------------------------------------------
  // PREFERENCES (banner)
  // -------------------------------------------------------------------------

  const loadUserPreferences = useCallback(async () => {
    try {
      const prefs = await fetchUserPreferences();
      setUserAllergies(prefs.allergies);
      setPrefersHalal(prefs.prefersHalal);
    } catch (error) {
      // Guests / offline: the banner keeps its last value.
      console.warn("Could not load preferences:", error);
    }
  }, []);

  // Loads on open and again when the screen regains focus
  // (for example after editing the Allergy Profile).
  useEffect(() => {
    void loadUserPreferences();
    const unsubscribe = navigation?.addListener?.("focus", () => {
      void loadUserPreferences();
    });
    return unsubscribe;
  }, [navigation, loadUserPreferences]);

  // -------------------------------------------------------------------------
  // NAVIGATION
  // -------------------------------------------------------------------------

  // Goes back exactly one workflow step.
  function goBack() {
    setPhotoError(null);

    if (stage === "barcode") {
      closeBarcodeCamera();
    } else if (stage === "ingredients") {
      setScanned(false); // re-enable scanning when returning to the camera
      setStage("barcode");
    } else if (stage === "front") {
      setStage("ingredients");
    } else if (stage === "extracting") {
      cancelExtraction();
    } else if (stage === "lookup") {
      cancelLookup();
    } else if (stage === "review") {
      setStage("front");
    } else if (stage === "result") {
      setStage(hasReview ? "review" : "home");
    }
  }

  // Always point at the latest goBack / stage, so the hardware
  // back button never uses stale values.
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;
  const stageRef = useRef(stage);
  stageRef.current = stage;

  // Android hardware back button follows the same steps.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (stageRef.current === "home") {
            return false; // let the app handle it normally
          }

          goBackRef.current();
          return true;
        }
      );

      return () => subscription.remove();
    }, [])
  );

  // Opens a screen only if it is registered, so a missing route can't crash.
  function openScreen(name: string, params?: Record<string, unknown>) {
    if (hasRoute(navigation, name)) {
      navigation.navigate(name, params);
    } else {
      Alert.alert("Not available yet", `The ${name} screen is not set up yet.`);
    }
  }

  // -------------------------------------------------------------------------
  // SMALL UI HELPERS
  // -------------------------------------------------------------------------

  // Allergy list on home, photo, review and result pages (NOT on the camera).
  function renderAllergyBanner() {
    return (
      <View style={styles.allergyBanner}>
        <View style={styles.allergyTextContainer}>
          <Text style={styles.allergyTitle}>Your allergy profile</Text>
          <Text style={styles.allergyValue}>
            {userAllergies.length > 0
              ? userAllergies.join(", ")
              : "No allergies selected"}
          </Text>
          <Text style={styles.halalPreference}>
            Halal screening: {prefersHalal ? "On" : "Off"}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => openScreen("Preferences", { mode: "edit" })}
          activeOpacity={0.8}
          accessibilityLabel="Edit allergy profile"
        >
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Back-arrow header.
  function renderTopBar(title: string) {
    return (
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={goBack}
          activeOpacity={0.8}
          accessibilityLabel="Go back"
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{title}</Text>
        <View style={styles.topBarSpacer} />
      </View>
    );
  }

  // Bottom navigation.
  // Scan is currently the only active section.
  // Profile and Avoid List are intentionally disabled for now.
  function renderBottomNav() {
    return (
      <View style={styles.bottomNav}>
        {/* Active Scan section: always starts a clean new scan. */}
        <TouchableOpacity
          style={[styles.bottomNavItem, styles.activeBottomNavItem]}
          onPress={() => {
            void startNewScan();
          }}
          activeOpacity={0.8}
          accessibilityLabel="Scan"
        >
          <Text style={styles.activeBottomNavIcon}>▣</Text>
          <Text style={styles.activeBottomNavText}>Scan</Text>
        </TouchableOpacity>

        {/* Opens the user's saved Avoid List. */}
<TouchableOpacity
  style={styles.bottomNavItem}
  onPress={() => navigation.navigate("Avoid")}
  activeOpacity={0.8}
  accessibilityLabel="Open Avoid List"
>
  <Text style={styles.disabledBottomNavIcon}>▤</Text>
  <Text style={styles.disabledBottomNavText}>
    Avoid List
  </Text>
</TouchableOpacity>

        {/* Profile placeholder. It cannot be opened yet. */}
        <View style={[styles.bottomNavItem, styles.disabledBottomNavItem]}>
          <Text style={styles.disabledBottomNavIcon}>☺</Text>
          <Text style={styles.disabledBottomNavText}>Profile</Text>
        </View>
      </View>
    );
  }

  // Warning on review and result pages.
  function renderPackageWarning() {
    return (
      <View style={styles.warningBanner}>
        <Text style={styles.warningText}>
          Always check this result against the physical package. LabelLens only
          reads label text and can make mistakes, so it can never guarantee a
          product is safe.
        </Text>
      </View>
    );
  }

  // Compact result card; details appear only after "+ Show explanation".
  function renderScreeningCard(
    title: string,
    section: ScreeningSection,
    open: boolean,
    toggle: () => void
  ) {
    const colors = LEVEL_COLORS[section.level] ?? LEVEL_COLORS.error;
    const findings = section.findings ?? [];

    return (
      <View
        style={[
          styles.statusCard,
          { borderLeftColor: colors.main, backgroundColor: colors.bg },
        ]}
      >
        <Text style={styles.statusHeading}>{title}</Text>
        <Text style={[styles.statusValue, { color: colors.main }]}>
          {section.status}
        </Text>

        <Text style={styles.statusHint}>
          Tap + to see what this result means.
        </Text>

        <TouchableOpacity
          style={styles.expandButton}
          onPress={toggle}
          activeOpacity={0.8}
          accessibilityLabel={open ? "Hide explanation" : "Show explanation"}
        >
          <Text style={[styles.expandText, { color: colors.main }]}>
            {open ? "− Hide explanation" : "+ Show explanation"}
          </Text>
        </TouchableOpacity>

        {open && (
          <View>
            <Text style={styles.statusExplanation}>{section.explanation}</Text>

            {findings.map((finding, index) => (
              <View
                key={`${finding.statement}-${index}`}
                style={styles.findingRow}
              >
                <Text style={[styles.findingTitle, { color: colors.main }]}>
                  {finding.headline}
                </Text>
                <Text style={styles.findingSource}>
                  Found in: {finding.sourceLabel}
                </Text>
                <Text style={styles.findingStatement}>
                  "{finding.statement}"
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // BARCODE
  // -------------------------------------------------------------------------

  // Opens the barcode camera (it stays closed until this is pressed).
  async function openBarcodeCamera() {
    try {
      if (!permission?.granted) {
        const result = await requestPermission();

        if (!result.granted) {
          Alert.alert(
            "Camera permission needed",
            "Please allow camera access in your phone settings.",
            [
              { text: "Not now", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ]
          );
          return;
        }
      }
    } catch (error) {
      console.warn("Camera permission request failed:", error);
      Alert.alert("Camera error", "The camera could not be started.");
      return;
    }

    setScanned(false);
    setBarcode("");
    setManualBarcode("");
    setTorchEnabled(false);
    setStage("barcode");
  }

  function closeBarcodeCamera() {
    setTorchEnabled(false);
    setStage("home");
  }

  // Clears the previous result + photos, then opens the scanner.
  // Used by "Scan product", the bottom Scan tab and "Scan another product".
  async function startNewScan() {
    resetWorkflow();
    await openBarcodeCamera();
  }

  // Back to a clean home page.
  function resetWorkflow() {
    // Any late lookup / extraction / screening result is ignored.
    lookupRunId.current += 1;
    extractionRunId.current += 1;
    screeningRunId.current += 1;

    // Barcode.
    setScanned(false);
    setBarcode("");
    setManualBarcode("");
    setTorchEnabled(false);

    // Photos.
    setIngredientsPhotoUri(null);
    setFrontPhotoUri(null);
    setPhotoError(null);
    setTakingPhoto(false);

    // Product + review.
    setProduct(null);
    setBrandName("");
    setProductName("");
    setVariant("");
    setIngredients("");
    setContains("");
    setMayContain("");
    setLowConfidence(false);
    setUncertainItems([]);
    setEditingUncertainIndex(null);
    setHasReview(false);

    // Result.
    setLookupMessage("");
    setScreening(null);
    setScreeningLoading(false);
    setAllergyOpen(false);
    setHalalOpen(false);
    setSavingAvoid(false);
    setSavedAvoid(false);

    setStage("home");
  }

  // "No barcode? Photograph the label": starts the two-photo flow.
  function openIngredientsPhoto() {
    lookupRunId.current += 1;
    extractionRunId.current += 1;
    setTorchEnabled(false);
    setIngredientsPhotoUri(null);
    setFrontPhotoUri(null);
    setPhotoError(null);
    setUncertainItems([]);
    setEditingUncertainIndex(null);
    setLowConfidence(false);
    setHasReview(false);
    setBarcode("");
    setLookupMessage("");
    setStage("ingredients");
  }

  // Handles a camera barcode result (stops after the first valid one).
  function handleBarcodeScanned(result: BarcodeScanningResult) {
    if (scanned) {
      return;
    }

    const cleaned = cleanBarcode(result.data);

    if (!isValidBarcode(cleaned)) {
      return;
    }

    setScanned(true);
    setBarcode(cleaned);
    setTorchEnabled(false);
    void lookupBarcode(cleaned);
  }

  // Handles manual barcode entry.
  function submitManualBarcode() {
    const cleaned = cleanBarcode(manualBarcode);

    if (!isValidBarcode(cleaned)) {
      Alert.alert("Invalid barcode", "Enter an 8 to 14 digit barcode.");
      return;
    }

    setScanned(true);
    setBarcode(cleaned);
    setTorchEnabled(false);
    void lookupBarcode(cleaned);
  }

  // -------------------------------------------------------------------------
  // PRODUCT LOOKUP
  // -------------------------------------------------------------------------

  // Loads product data into the screen fields.
  function fillProductFields(next: ProductData) {
    setProduct(next);
    setBrandName(asText(next.brandName));
    setProductName(asText(next.productName));
    setVariant(asText(next.variant));
    setIngredients(asText(next.ingredients));
    setContains(asText(next.contains));
    setMayContain(asText(next.mayContain));
    setEditingUncertainIndex(null);
  }

  function cancelLookup() {
    lookupRunId.current += 1;
    setScanned(false);
    setStage("home");
  }

  // Approved LabelLens products first, Open Food Facts second, photos last.
  async function lookupBarcode(barcodeValue: string) {
    const runId = ++lookupRunId.current;

    // Every lookup starts with clean photo/review/result state.
    screeningRunId.current += 1;
    setIngredientsPhotoUri(null);
    setFrontPhotoUri(null);
    setPhotoError(null);
    setHasReview(false);
    setProduct(null);
    setScreening(null);
    setScreeningLoading(false);
    setUncertainItems([]);
    setLowConfidence(false);
    setAllergyOpen(false);
    setHalalOpen(false);
    setSavedAvoid(false);
    setLookupMessage("");
    setStage("lookup");

    let result: LookupResult;

    try {
      result = await lookupProduct(
        barcodeValue,
        { internal: internalProvider, external: openFoodFactsProvider },
        {
          onStep: (message) => {
            if (runId === lookupRunId.current) {
              setLookupMessage(message);
            }
          },
          isCancelled: () => runId !== lookupRunId.current,
        }
      );
    } catch (error) {
      console.warn("Product lookup failed:", error);
      result = { kind: "unavailable" };
    }

    // The user pressed back/cancel while waiting.
    if (runId !== lookupRunId.current) {
      return;
    }

    if (result.kind === "found") {
      const found: ProductData = {
        ...result.product,
        frontPhotoUri: null,
        ingredientsPhotoUri: null,
      };

      fillProductFields(found);
      setUncertainItems([]);
      setStage("result");
      await screenConfirmedProduct(found);
      return;
    }

    // Everything else needs the package photos.
    if (result.kind === "incomplete") {
      setLookupMessage(
        "Product found, but ingredients are incomplete. Photograph the package label."
      );
    } else if (result.kind === "notfound") {
      setLookupMessage(NOT_FOUND_MESSAGE);
    } else {
      setLookupMessage(UNAVAILABLE_MESSAGE);
    }

    setStage("ingredients");
  }

  // -------------------------------------------------------------------------
  // PHOTOS + AI EXTRACTION
  // -------------------------------------------------------------------------

  // Friendly error + back to the correct photo screen. Never stays on "extracting".
  function failExtraction(kind: "front" | "ingredients" | "network") {
    if (kind === "ingredients") {
      setIngredientsPhotoUri(null);
      setPhotoError({ message: INGREDIENT_PHOTO_MESSAGE, retryable: false });
      setStage("ingredients");
    } else if (kind === "network") {
      // Photos are fine: keep them and allow "try again".
      setPhotoError({ message: NETWORK_MESSAGE, retryable: true });
      setStage("front");
    } else {
      // Clear ONLY the invalid front photo; the ingredient photo is kept.
      setFrontPhotoUri(null);
      setPhotoError({ message: FRONT_PHOTO_MESSAGE, retryable: false });
      setStage("front");
    }
  }

  // Cancels a running extraction and returns to the front photo screen.
  function cancelExtraction() {
    extractionRunId.current += 1; // any late result is ignored
    setPhotoError(null);
    setStage("front");
  }

  // Runs AI extraction on the two photos. Always ends on a valid screen.
  async function analyzePhotos(frontUri: string) {
    const ingredientsUri = ingredientsPhotoUri;

    if (!ingredientsUri) {
      setStage("ingredients");
      return;
    }

    const runId = ++extractionRunId.current;

    setPhotoError(null);
    setFrontPhotoUri(frontUri);
    setStage("extracting");

    try {
      const extraction = await withTimeout(
        extractLabelFromPhotos(frontUri, ingredientsUri),
        EXTRACTION_TIMEOUT_MS
      );

      if (runId !== extractionRunId.current) {
        return; // cancelled
      }

      const name = asText(extraction?.product_name);
      const brand = asText(extraction?.brand);
      const text = asText(extraction?.ingredients);

      // Nothing readable on the front photo.
      if (!name && !brand) {
        failExtraction("front");
        return;
      }

      // Ingredients missing: the INGREDIENT photo is the problem.
      if (!text) {
        failExtraction("ingredients");
        return;
      }

      const extracted: ProductData = {
        barcode: barcode || null,
        productName: name,
        brandName: brand,
        variant: asText(extraction.variant),
        ingredients: text,
        contains: asText(extraction.contains),
        mayContain: asText(extraction.may_contain),
        source: SOURCE_PHOTO,
        imageUrl: null,
        frontPhotoUri: frontUri,
        ingredientsPhotoUri: ingredientsUri,
      };

      fillProductFields(extracted);
      setUncertainItems(parseUncertainIngredients(extraction.unclear_text));
      setLowConfidence(extraction.confidence === "low");
      setScreening(null);
      setHasReview(true);
      setStage("review");
    } catch (error) {
      if (runId !== extractionRunId.current) {
        return;
      }

      // Technical details are only logged, never shown to the user.
      console.warn("Photo extraction failed:", error);
      failExtraction(classifyExtractionError(error));
    }
  }

  // Opens the phone's native camera for a package photo.
  async function takePackagePhoto() {
    if (takingPhoto) {
      return;
    }

    setTakingPhoto(true);

    // Set only when a new front photo should be analyzed.
    let frontToAnalyze: string | null = null;

    try {
      const permissionResult =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          "Camera permission needed",
          "Allow camera access in Settings to photograph the package label.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.6, // keeps uploads small enough for AI extraction
        exif: false,
        base64: false,
      });

      if (result.canceled) {
        return; // user closed the camera
      }

      const photoUri = result.assets?.[0]?.uri;

      if (!photoUri) {
        Alert.alert("Photo error", "The phone did not return a photo.");
        return;
      }

      // Step 1: ingredient label photo.
      if (stage === "ingredients") {
        setIngredientsPhotoUri(photoUri);
        setPhotoError(null);
        setStage("front");
        return;
      }

      // Step 2: front package photo.
      if (stage === "front") {
        if (!ingredientsPhotoUri) {
          setStage("ingredients");
          return;
        }

        frontToAnalyze = photoUri;
      }
    } catch (error) {
      console.warn("Camera failed:", error);
      Alert.alert(
        "Camera not available",
        "The camera could not be opened. Please try again."
      );
    } finally {
      setTakingPhoto(false); // always release the button
    }

    // Runs AFTER the button is released, so it can never stay disabled.
    if (frontToAnalyze) {
      await analyzePhotos(frontToAnalyze);
    }
  }

  // -------------------------------------------------------------------------
  // REVIEW + SCREENING
  // -------------------------------------------------------------------------

  // Allergy + halal screening of the confirmed product.
  async function screenConfirmedProduct(confirmed: ProductData) {
    const runId = ++screeningRunId.current;
    setScreeningLoading(true);

    try {
      // Always load the CURRENT user's saved preferences.
      const prefs = await fetchUserPreferences();

      if (runId !== screeningRunId.current) {
        return; // a new scan started meanwhile
      }

      setUserAllergies(prefs.allergies);
      setPrefersHalal(prefs.prefersHalal);

      setScreening(
        screenProduct({
          allergies: prefs.allergies,
          prefersHalal: prefs.prefersHalal,
          ingredients: confirmed.ingredients,
          contains: confirmed.contains,
          mayContain: confirmed.mayContain,
        })
      );
    } catch (error) {
      if (runId !== screeningRunId.current) {
        return;
      }

      // Never show a false "safe" result if something fails.
      console.warn("Screening failed:", error);
      setScreening({
        allergy: {
          level: "error",
          status: "Screening could not be completed",
          explanation:
            "Your allergy profile could not be loaded. Please log in and try again, and check the physical package yourself.",
          findings: [],
        },
        halal: null,
      });
    } finally {
      if (runId === screeningRunId.current) {
        setScreeningLoading(false);
      }
    }
  }

  // Confirms the review page and runs the analysis.
  async function confirmAndAnalyze() {
    if (!ingredients.trim()) {
      Alert.alert(
        "Ingredients required",
        "Please retake the ingredient photo. No ingredients were read."
      );
      return;
    }

    if (uncertainItems.some((item) => !item.confirmed)) {
      Alert.alert(
        "Please check the uncertain ingredients",
        "Edit an ingredient if needed, then tick “It is correct” for every item."
      );
      return;
    }

    if (uncertainItems.some((item) => !item.value.trim())) {
      Alert.alert(
        "Empty ingredient",
        "Please type the ingredient as it appears on the package."
      );
      return;
    }

    const confirmedIngredients = applyIngredientCorrections(
      ingredients,
      uncertainItems
    ).trim();

    setIngredients(confirmedIngredients);

    const confirmed: ProductData = {
      barcode: product?.barcode || barcode || null,
      productName: productName.trim(),
      brandName: brandName.trim(),
      variant: variant.trim(),
      ingredients: confirmedIngredients,
      contains: contains.trim(),
      mayContain: mayContain.trim(),
      source: product?.source || SOURCE_PHOTO,
      imageUrl: product?.imageUrl ?? null,
      frontPhotoUri,
      ingredientsPhotoUri,
    };

    setProduct(confirmed);
    setScreening(null);
    setEditingUncertainIndex(null);
    setAllergyOpen(false);
    setHalalOpen(false);
    setSavedAvoid(false);
    setStage("result");

    await screenConfirmedProduct(confirmed);
  }

  // Saves the confirmed product + the reason for the warning.
  async function addToAvoidList() {
    if (!product || savingAvoid || savedAvoid) {
      return;
    }

    setSavingAvoid(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert("Login required", "Please log in before saving products.");
        return;
      }

      // Reason = the headlines of the warnings that were found.
      const reasons = [
        ...(screening?.allergy.findings ?? []),
        ...(screening?.halal?.findings ?? []),
      ].map((finding) => finding.headline);

      const reason =
        reasons.length > 0
          ? reasons.join(" ")
          : screening?.allergy.status || "Saved by the user.";

      const { error } = await supabase.from("avoid_list").insert({
        user_id: user.id,
        barcode: product.barcode ?? null,
        product_name: productName.trim(),
        brand_name: brandName.trim(),
        variant: variant.trim(),
        ingredients_text: ingredients.trim(),
        contains_text: contains.trim(),
        may_contain_text: mayContain.trim(),
        save_reason: reason,
        source: product.source,
      });

      if (error) {
        throw error;
      }

      setSavedAvoid(true);
      Alert.alert("Saved", "The product was added to your Avoid List.");
    } catch (error) {
      console.warn("Avoid List save failed:", error);
      Alert.alert(
        "Could not save",
        "The product could not be added to your Avoid List."
      );
    } finally {
      setSavingAvoid(false);
    }
  }

  // -------------------------------------------------------------------------
  // SCREENS
  // -------------------------------------------------------------------------

  // ----- Home -----
  if (stage === "home") {
    return (
      <SafeAreaView style={styles.homePage} edges={PAGE_EDGES}>
        <View style={styles.homeContent}>
          {renderAllergyBanner()}

          <Text style={styles.homeTitle}>Scan food barcode</Text>
          <Text style={styles.homeSubtitle}>
            Check the product against your allergy and halal preferences.
          </Text>

          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => {
              void startNewScan();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.scanButtonText}>Scan product</Text>
          </TouchableOpacity>

          <Text style={styles.homeNote}>
            If the product is not found, the app will ask for ingredient and
            package photos.
          </Text>
        </View>

        {renderBottomNav()}
      </SafeAreaView>
    );
  }

  // ----- Barcode lookup loading (Cancel, so never a dead end) -----
  if (stage === "lookup") {
    return (
      <SafeAreaView style={styles.loadingPage} edges={PAGE_EDGES}>
        <ActivityIndicator size="large" color="#A4C766" />
        <Text style={styles.loadingTitle}>Checking product...</Text>
        <Text style={styles.loadingSubtitle}>{lookupMessage}</Text>

        <TouchableOpacity
          style={styles.loadingCancelButton}
          onPress={cancelLookup}
          activeOpacity={0.8}
        >
          <Text style={styles.loadingCancelText}>Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ----- AI extraction loading (Cancel, so never a dead end) -----
  if (stage === "extracting") {
    return (
      <SafeAreaView style={styles.loadingPage} edges={PAGE_EDGES}>
        <ActivityIndicator size="large" color="#A4C766" />
        <Text style={styles.loadingTitle}>Analyzing ingredients...</Text>
        <Text style={styles.loadingSubtitle}>Reading the package photos</Text>

        <TouchableOpacity
          style={styles.loadingCancelButton}
          onPress={cancelExtraction}
          activeOpacity={0.8}
        >
          <Text style={styles.loadingCancelText}>Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ----- Ingredient photo (step 1) and front photo (step 2) -----
  if (stage === "ingredients" || stage === "front") {
    const isIngredients = stage === "ingredients";
    const currentPhoto = isIngredients ? ingredientsPhotoUri : frontPhotoUri;
    const retryable = photoError?.retryable === true;

    // Button says "Retake photo" whenever a photo exists or a read failed.
    const buttonText = takingPhoto
      ? "Opening camera..."
      : currentPhoto || photoError
      ? "Retake photo"
      : "Take photo";

    return (
      <SafeAreaView style={styles.photoPage} edges={PAGE_EDGES}>
        <ScrollView contentContainerStyle={styles.photoContent}>
          {renderTopBar(isIngredients ? "Ingredient label" : "Front package")}
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

          {/* Friendly lookup message, for example "Product not found". */}
          {isIngredients && lookupMessage && !photoError ? (
            <Text style={styles.infoText}>{lookupMessage}</Text>
          ) : null}

          {/* Friendly error. No technical text is ever shown. */}
          {photoError ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>{photoError.message}</Text>
            </View>
          ) : null}

          {!currentPhoto && (
            <View style={styles.photoGuide}>
              <Text style={styles.photoGuideText}>Keep the label in focus</Text>
            </View>
          )}

          {currentPhoto ? (
            <Image source={{ uri: currentPhoto }} style={styles.photoPreview} />
          ) : null}

          {/* Confirms the ingredient photo is kept during a front retake. */}
          {!isIngredients && ingredientsPhotoUri ? (
            <View style={styles.keptPhotoRow}>
              <Image
                source={{ uri: ingredientsPhotoUri }}
                style={styles.keptPhotoThumb}
              />
              <Text style={styles.keptPhotoText}>
                Ingredient photo saved. You only need to retake the front photo.
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.takePhotoButton, takingPhoto && styles.disabledButton]}
            onPress={takePackagePhoto}
            disabled={takingPhoto}
            activeOpacity={0.8}
          >
            <Text style={styles.takePhotoButtonText}>{buttonText}</Text>
          </TouchableOpacity>

          {/* Continue with the ingredient photo already taken. */}
          {isIngredients && ingredientsPhotoUri ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setPhotoError(null);
                setStage("front");
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>
                Continue with this photo
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Analyze a front photo that is fine (after cancel or a network problem). */}
          {!isIngredients && frontPhotoUri ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => analyzePhotos(frontPhotoUri)}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>
                {retryable ? "Try again" : "Analyze this photo"}
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.cancelButton} onPress={goBack}>
            <Text style={styles.cancelButtonText}>Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ----- Review -----
  if (stage === "review" && product) {
    // Live preview of the ingredient list with the user's edits applied.
    const previewIngredients = applyIngredientCorrections(
      ingredients,
      uncertainItems
    );

    const confirmedCount = uncertainItems.filter((i) => i.confirmed).length;
    const allConfirmed = confirmedCount === uncertainItems.length;

    return (
      <SafeAreaView style={styles.resultPage} edges={PAGE_EDGES}>
        <ScrollView
          contentContainerStyle={styles.resultContent}
          keyboardShouldPersistTaps="handled"
        >
          {renderTopBar("Review label")}
          {renderAllergyBanner()}
          {renderPackageWarning()}

          {frontPhotoUri ? (
            <Image source={{ uri: frontPhotoUri }} style={styles.resultPhoto} />
          ) : null}

          <Text style={styles.resultTitle}>Review product information</Text>
          <Text style={styles.resultSubtitle}>
            Check the details below against the physical package.
          </Text>

          {/* Brand and product name can be corrected. */}
          <Text style={styles.fieldLabel}>Brand</Text>
          <TextInput
            style={styles.textField}
            value={brandName}
            onChangeText={setBrandName}
            placeholder="Brand"
            placeholderTextColor="#8A9A8F"
          />

          <Text style={styles.fieldLabel}>Product name</Text>
          <TextInput
            style={styles.textField}
            value={productName}
            onChangeText={setProductName}
            placeholder="Product name"
            placeholderTextColor="#8A9A8F"
          />

          {/* Only ingredients the AI marked as uncertain appear here. */}
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
                  {editingUncertainIndex !== index ? (
                    <Text style={styles.uncertainItemText}>{item.value}</Text>
                  ) : (
                    <TextInput
                      style={styles.singleIngredientInput}
                      value={item.value}
                      onChangeText={(value) =>
                        setUncertainItems((current) =>
                          current.map((c, i) =>
                            i === index ? { ...c, value, confirmed: false } : c
                          )
                        )
                      }
                      autoFocus
                      accessibilityLabel={`Edit ${item.original}`}
                    />
                  )}

                  <View style={styles.uncertainActions}>
                    <TouchableOpacity
                      style={styles.smallEditButton}
                      onPress={() =>
                        setEditingUncertainIndex(
                          editingUncertainIndex === index ? null : index
                        )
                      }
                    >
                      <Text style={styles.smallEditButtonText}>
                        {editingUncertainIndex === index ? "Done" : "Edit"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.correctCheckbox}
                      onPress={() =>
                        setUncertainItems((current) =>
                          current.map((c, i) =>
                            i === index ? { ...c, confirmed: !c.confirmed } : c
                          )
                        )
                      }
                    >
                      <Text style={styles.checkboxSymbol}>
                        {item.confirmed ? "☑" : "☐"}
                      </Text>
                      <Text style={styles.checkboxText}>It is correct</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <Text style={styles.progressText}>
                {confirmedCount} of {uncertainItems.length} checked
              </Text>
            </View>
          )}

          {/* The AI said the photo was hard to read but listed nothing specific. */}
          {uncertainItems.length === 0 && lowConfidence && (
            <View style={styles.uncertaintyCard}>
              <Text style={styles.uncertaintySubtitle}>
                Some text was hard to read. Please compare every ingredient
                below with the physical package.
              </Text>
            </View>
          )}

          {/* Full ingredient list in a readable format. */}
          <Text style={styles.fieldLabel}>Ingredients</Text>
          <View style={styles.ingredientListCard}>
            {splitTopLevel(previewIngredients, ITEM_SEPARATORS).map(
              (ingredient, index) => (
                <View key={`${ingredient}-${index}`} style={styles.ingredientRow}>
                  <Text style={styles.ingredientBullet}>•</Text>
                  <Text style={styles.ingredientText}>{ingredient}</Text>
                </View>
              )
            )}
          </View>

          <Text style={styles.fieldLabel}>Contains</Text>
          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyValue}>
              {contains || "None extracted"}
            </Text>
          </View>

          <Text style={styles.fieldLabel}>May contain</Text>
          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyValue}>
              {mayContain || "None extracted"}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.confirmButton, !allConfirmed && styles.confirmButtonDisabled]}
            onPress={confirmAndAnalyze}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmButtonText}>Confirm and Analyze</Text>
          </TouchableOpacity>

          {!allConfirmed && (
            <Text style={styles.resultNote}>
              Tick “It is correct” for every uncertain ingredient to continue.
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ----- Result -----
  if (stage === "result" && product) {
    // Ingredient rows that matched a warning are highlighted.
    const flagged = screening
      ? [
          ...screening.allergy.findings,
          ...(screening.halal?.findings ?? []),
        ]
          .filter((finding) => finding.sourceLabel === "Ingredients")
          .map((finding) => normalizeText(finding.statement))
      : [];

    const ingredientRows = splitTopLevel(ingredients, ITEM_SEPARATORS);
    const imageUri = product.frontPhotoUri || product.imageUrl;

    return (
      <SafeAreaView style={styles.resultPage} edges={PAGE_EDGES}>
        <ScrollView contentContainerStyle={styles.resultContent}>
          {renderTopBar("Analysis result")}
          {renderAllergyBanner()}
          {renderPackageWarning()}

          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.resultPhoto} />
          ) : (
            <View style={styles.noImage}>
              <Text style={styles.noImageText}>No product image available</Text>
            </View>
          )}

          <Text style={styles.resultTitle}>{productName || "Product result"}</Text>
          <Text style={styles.resultBrand}>{brandName || "Brand unavailable"}</Text>
          <Text style={styles.sourceText}>Source: {product.source}</Text>

          {screeningLoading || !screening ? (
            <View style={styles.statusCard}>
              <Text style={styles.statusHeading}>Screening</Text>
              <ActivityIndicator color="#258D4D" style={styles.statusLoader} />
            </View>
          ) : (
            <>
              {renderScreeningCard(
                "Allergy Screening",
                screening.allergy,
                allergyOpen,
                () => setAllergyOpen((open) => !open)
              )}

              {/* Halal appears only when the user selected halal screening. */}
              {screening.halal &&
                renderScreeningCard(
                  "Halal Screening",
                  screening.halal,
                  halalOpen,
                  () => setHalalOpen((open) => !open)
                )}
            </>
          )}

          <Text style={styles.detailHeading}>Ingredients</Text>
          <View style={styles.ingredientListCard}>
            {ingredientRows.length === 0 ? (
              <Text style={styles.detailText}>Not available</Text>
            ) : (
              ingredientRows.map((ingredient, index) => (
                <View key={`${ingredient}-${index}`} style={styles.ingredientRow}>
                  <Text style={styles.ingredientBullet}>•</Text>
                  <Text
                    style={[
                      styles.ingredientText,
                      flagged.includes(normalizeText(ingredient)) &&
                        styles.ingredientFlagged,
                    ]}
                  >
                    {ingredient}
                  </Text>
                </View>
              ))
            )}
          </View>

          <Text style={styles.detailHeading}>Contains</Text>
          <Text style={styles.detailText}>{contains || "None listed"}</Text>

          <Text style={styles.detailHeading}>May contain</Text>
          <Text style={styles.detailText}>{mayContain || "None listed"}</Text>

          <TouchableOpacity
            style={[
              styles.avoidButton,
              (savingAvoid || savedAvoid) && styles.disabledButton,
            ]}
            onPress={addToAvoidList}
            disabled={savingAvoid || savedAvoid}
            activeOpacity={0.8}
          >
            <Text style={styles.avoidButtonText}>
              {savingAvoid
                ? "Saving..."
                : savedAvoid
                ? "Added to My Avoid List"
                : "Add to My Avoid List"}
            </Text>
          </TouchableOpacity>

          {/* Clears this result and its photos, then opens the scanner. */}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              void startNewScan();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>Scan another product</Text>
          </TouchableOpacity>

          <Text style={styles.resultNote}>
            Always verify the physical package. This is screening information
            and not a safety guarantee or a halal certification.
          </Text>
        </ScrollView>

        {renderBottomNav()}
      </SafeAreaView>
    );
  }

  // ----- Barcode camera (no allergy banner, no bottom nav) -----
  if (stage === "barcode") {
    return (
      <SafeAreaView style={styles.cameraPage} edges={[]}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          autofocus="on"
          enableTorch={torchEnabled}
          // Stops scanning after the first valid barcode.
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          onMountError={(error) => {
            console.warn("Camera mount error:", error.message);
            Alert.alert("Camera error", "The camera could not be started.");
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
        />

        {/* Overlay sits ABOVE the camera (not inside it) for reliability. */}
        <KeyboardAvoidingView
          style={styles.cameraOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={styles.closeCameraButton}
            onPress={closeBarcodeCamera}
            activeOpacity={0.8}
            accessibilityLabel="Close camera"
          >
            <Text style={styles.closeCameraText}>‹</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.flashButton}
            onPress={() => setTorchEnabled((on) => !on)}
            activeOpacity={0.8}
            accessibilityLabel="Flashlight"
          >
            <Text style={styles.flashButtonText}>{torchEnabled ? "☼" : "♧"}</Text>
          </TouchableOpacity>

          <View style={styles.cameraHeading} pointerEvents="none">
            <Text style={styles.cameraTitle}>Scan food barcode</Text>
            <Text style={styles.cameraInstructions}>
              Point the camera at a barcode
            </Text>
          </View>

          <View style={styles.barcodeFrame} pointerEvents="none" />

          <View style={styles.cameraBottom}>
            <View style={styles.manualBarcodeContainer}>
              <TextInput
                style={styles.manualBarcodeInput}
                value={manualBarcode}
                onChangeText={setManualBarcode}
                placeholder="Enter barcode manually"
                placeholderTextColor="#C7D0C8"
                keyboardType="number-pad"
                maxLength={14}
                returnKeyType="done"
                onSubmitEditing={submitManualBarcode}
              />
              <TouchableOpacity
                style={styles.manualBarcodeButton}
                onPress={submitManualBarcode}
                activeOpacity={0.8}
              >
                <Text style={styles.manualBarcodeButtonText}>Check</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.fallbackButton}
              onPress={openIngredientsPhoto}
              activeOpacity={0.8}
            >
              <Text style={styles.fallbackText}>
                No barcode? Photograph the label
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ----- Safety net: any unexpected state returns to a usable screen -----
  return (
    <SafeAreaView style={styles.loadingPage} edges={PAGE_EDGES}>
      <Text style={styles.loadingTitle}>Something went wrong</Text>
      <TouchableOpacity
        style={styles.loadingCancelButton}
        onPress={resetWorkflow}
        activeOpacity={0.8}
      >
        <Text style={styles.loadingCancelText}>Back to start</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// STYLES
// ---------------------------------------------------------------------------
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
  backButton: { width: 42, height: 42, justifyContent: "center", alignItems: "center" },
  backArrow: { color: "#176B43", fontSize: 36, lineHeight: 38 },
  topBarTitle: { color: "#163D2A", fontSize: 17, fontWeight: "800" },
  topBarSpacer: { width: 42 },

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
  allergyTextContainer: { flex: 1, paddingRight: 10 },
  allergyTitle: { color: "#315D35", fontSize: 12, fontWeight: "800" },
  allergyValue: { color: "#45624B", fontSize: 13, marginTop: 4 },
  halalPreference: { color: "#45624B", fontSize: 12, marginTop: 3 },
  editText: { color: "#176B43", fontSize: 13, fontWeight: "800" },

  warningBanner: {
    backgroundColor: "#FFF8D6",
    borderWidth: 1,
    borderColor: "#E0B83F",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  warningText: { color: "#6B5200", fontSize: 13, lineHeight: 19, fontWeight: "600" },

  // Bottom navigation container.
  bottomNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E9E3",
  },
  // Each navigation item has equal width.
  bottomNavItem: {
    flex: 1,
    minHeight: 54,
    marginHorizontal: 4,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  // Highlighted active section.
  activeBottomNavItem: { backgroundColor: "#E8F5E9" },
  activeBottomNavIcon: { color: "#176B43", fontSize: 20, marginBottom: 3 },
  activeBottomNavText: { color: "#176B43", fontSize: 12, fontWeight: "800" },
  // Disabled sections remain visible but cannot be pressed.
  disabledBottomNavItem: { opacity: 0.42 },
  disabledBottomNavIcon: { color: "#63776B", fontSize: 20, marginBottom: 3 },
  disabledBottomNavText: { color: "#63776B", fontSize: 12, fontWeight: "600" },

  homePage: { flex: 1, backgroundColor: "#F8FBF8" },
  homeContent: { flex: 1, justifyContent: "center", padding: 24 },
  homeTitle: { color: "#176B43", fontSize: 30, fontWeight: "800", textAlign: "center" },
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
  scanButtonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  homeNote: {
    color: "#63776B",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 20,
  },

  cameraPage: { flex: 1, backgroundColor: "#000000" },
  cameraOverlay: { flex: 1, alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.18)" },
  closeCameraButton: {
    position: "absolute",
    top: 48,
    left: 18,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeCameraText: { color: "#FFFFFF", fontSize: 30 },
  flashButton: {
    position: "absolute",
    top: 48,
    right: 18,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  flashButtonText: { color: "#FFFFFF", fontSize: 22 },
  cameraHeading: { position: "absolute", top: 110, left: 25, right: 25, alignItems: "center" },
  cameraTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  cameraInstructions: { color: "#FFFFFF", fontSize: 14, marginTop: 8 },
  barcodeFrame: {
    position: "absolute",
    top: "38%",
    width: "84%",
    height: 145,
    borderWidth: 2,
    borderColor: "#D9F0B0",
    borderRadius: 16,
  },
  cameraBottom: { position: "absolute", bottom: 34, left: 20, right: 20, alignItems: "center" },
  manualBarcodeContainer: { flexDirection: "row", alignItems: "center", width: "100%" },
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
  manualBarcodeButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  fallbackButton: {
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 11,
    marginTop: 14,
  },
  fallbackText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },

  photoPage: { flex: 1, backgroundColor: "#F8FBF8" },
  photoContent: { padding: 24, paddingBottom: 40 },
  stepText: { color: "#8FAE54", fontSize: 14, fontWeight: "800", textAlign: "center" },
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
  infoText: {
    color: "#176B43",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 12,
  },
  errorCard: {
    backgroundColor: "#FDECEA",
    borderWidth: 1,
    borderColor: "#C62828",
    borderRadius: 12,
    padding: 14,
    marginTop: 18,
  },
  errorTitle: { color: "#9B1C1C", fontSize: 15, lineHeight: 22, fontWeight: "800" },
  photoGuide: {
    height: 260,
    borderWidth: 2,
    borderColor: "#A9C778",
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 30,
  },
  photoGuideText: { color: "#63776B", fontSize: 14 },
  photoPreview: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    resizeMode: "cover",
    marginTop: 24,
    marginBottom: 12,
  },
  keptPhotoRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF7E7",
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
  },
  keptPhotoThumb: { width: 44, height: 44, borderRadius: 8, marginRight: 10 },
  keptPhotoText: { flex: 1, color: "#315D35", fontSize: 12, lineHeight: 17, fontWeight: "600" },
  takePhotoButton: {
    backgroundColor: "#258D4D",
    minHeight: 56,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  takePhotoButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#258D4D",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  secondaryButtonText: { color: "#258D4D", fontSize: 15, fontWeight: "800" },
  cancelButton: { minHeight: 50, justifyContent: "center", alignItems: "center", marginTop: 6 },
  cancelButtonText: { color: "#63776B", fontSize: 15, fontWeight: "700" },
  disabledButton: { opacity: 0.55 },

  loadingPage: {
    flex: 1,
    backgroundColor: "#071007",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginTop: 20 },
  loadingSubtitle: { color: "#A7B1A6", fontSize: 14, textAlign: "center", marginTop: 8 },
  loadingCancelButton: {
    marginTop: 28,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#A4C766",
  },
  loadingCancelText: { color: "#A4C766", fontSize: 15, fontWeight: "800" },

  resultPage: { flex: 1, backgroundColor: "#F8FBF8" },
  resultContent: { padding: 20, paddingBottom: 30 },
  resultPhoto: {
    width: "100%",
    height: 250,
    borderRadius: 16,
    resizeMode: "cover",
    marginBottom: 18,
  },
  noImage: {
    height: 90,
    borderRadius: 16,
    backgroundColor: "#EEF2EF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  noImageText: { color: "#7A877F", fontSize: 13 },
  resultTitle: { color: "#163D2A", fontSize: 25, fontWeight: "800" },
  resultSubtitle: { color: "#63776B", fontSize: 14, lineHeight: 20, marginTop: 8 },
  resultBrand: { color: "#63776B", fontSize: 16, marginTop: 5 },
  sourceText: { color: "#176B43", fontSize: 12, marginTop: 10 },

  statusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderLeftWidth: 6,
    borderLeftColor: "#258D4D",
    padding: 16,
    marginTop: 16,
  },
  statusLoader: { marginTop: 12 },
  statusHeading: { color: "#163D2A", fontSize: 17, fontWeight: "800" },
  statusValue: { fontSize: 16, fontWeight: "800", marginTop: 10 },
  statusHint: { color: "#63776B", fontSize: 12, marginTop: 8 },
  expandButton: { paddingVertical: 8 },
  expandText: { fontSize: 14, fontWeight: "800" },
  statusExplanation: { color: "#4A5A50", fontSize: 14, lineHeight: 20, marginTop: 4 },
  findingRow: { backgroundColor: "#FFFFFF", borderRadius: 10, padding: 10, marginTop: 10 },
  findingTitle: { fontSize: 14, fontWeight: "800" },
  findingSource: { color: "#63776B", fontSize: 12, marginTop: 3 },
  findingStatement: { color: "#1D3829", fontSize: 14, lineHeight: 20, marginTop: 4 },

  fieldLabel: {
    color: "#264C37",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 7,
  },
  textField: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#B9C9BD",
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    color: "#1D3829",
    paddingHorizontal: 14,
    fontSize: 15,
  },

  uncertaintyCard: {
    backgroundColor: "#FFF8E1",
    borderWidth: 1,
    borderColor: "#E0B83F",
    borderRadius: 14,
    padding: 14,
    marginTop: 18,
  },
  uncertaintyTitle: { color: "#755000", fontSize: 16, fontWeight: "800" },
  uncertaintySubtitle: {
    color: "#755000",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
    marginBottom: 10,
  },
  uncertainItem: { backgroundColor: "#FFFFFF", borderRadius: 11, padding: 12, marginTop: 8 },
  uncertainItemText: { color: "#352B14", fontSize: 15, fontWeight: "700", lineHeight: 21 },
  uncertainActions: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  smallEditButton: {
    backgroundColor: "#258D4D",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  smallEditButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  correctCheckbox: { flexDirection: "row", alignItems: "center", marginLeft: 14, paddingVertical: 5 },
  checkboxSymbol: { color: "#176B43", fontSize: 22 },
  checkboxText: { color: "#315D35", fontSize: 13, fontWeight: "700", marginLeft: 5 },
  singleIngredientInput: {
    minHeight: 44,
    borderWidth: 2,
    borderColor: "#D7A928",
    borderRadius: 9,
    backgroundColor: "#FFFDF4",
    color: "#1D3829",
    paddingHorizontal: 10,
    fontSize: 14,
  },
  progressText: { color: "#755000", fontSize: 12, fontWeight: "700", marginTop: 12 },

  ingredientListCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE5DE",
    borderRadius: 12,
    padding: 14,
  },
  ingredientRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  ingredientBullet: { color: "#258D4D", fontSize: 18, lineHeight: 20, marginRight: 8 },
  ingredientText: { flex: 1, color: "#1D3829", fontSize: 14, lineHeight: 20 },
  ingredientFlagged: { color: "#C62828", fontWeight: "800" },
  readOnlyField: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#DCE5DE",
    borderRadius: 11,
    backgroundColor: "#F3F7F3",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  readOnlyValue: { color: "#1D3829", fontSize: 14, lineHeight: 21 },
  detailHeading: {
    color: "#264C37",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 6,
  },
  detailText: { color: "#1D3829", fontSize: 14, lineHeight: 21 },

  confirmButton: {
    backgroundColor: "#258D4D",
    minHeight: 54,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 28,
  },
  confirmButtonDisabled: { backgroundColor: "#9DB8A8" },
  confirmButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  avoidButton: {
    backgroundColor: "#258D4D",
    minHeight: 56,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 28,
  },
  avoidButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  resultNote: {
    color: "#63776B",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 18,
  },
  bottomNav: {
  minHeight: 70,
  backgroundColor: "#FFFFFF",
  borderTopWidth: 1,
  borderTopColor: "#DDE7E0",
  flexDirection: "row",
  justifyContent: "space-around",
  alignItems: "center",
},

navItem: {
  minWidth: 72,
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: 10,
},

navIcon: {
  color: "#76857C",
  fontSize: 21,
},

activeNavIcon: {
  color: "#176B43",
},

navText: {
  color: "#76857C",
  fontSize: 12,
  marginTop: 3,
},

activeNavText: {
  color: "#176B43",
  fontWeight: "700",
},
});
