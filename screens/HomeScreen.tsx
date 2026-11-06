// ---------------------------------------------------------------------------
// screens/HomeScreen.tsx
// Workflow: home -> barcode -> lookup -> ingredient photo -> front photo
//           -> AI extraction -> (review only if needed) -> allergy + halal results
//
// Lookup order: approved LabelLens food database -> Open Food Facts
// (shown as "not verified") -> package photos read by AI.
// All UI text comes from lib/i18n; product names, brands, ingredients and
// barcodes are always shown exactly as read from the label/database.
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
  Linking,
  Modal,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { type Edge } from "react-native-safe-area-context";

import BottomNavigation from "../components/BottomNavigation";
import { allergyLabelList, joinList } from "../lib/constants";
import {
  allergiesForScreening,
  prepareAllergyLabels,
  useFoodTranslator,
} from "../lib/foodTranslation";
import { translate, useI18n, type TranslationKey } from "../lib/i18n";
import {
  localizeScreeningText,
  localizeSourceLabel,
} from "../lib/i18n/screeningText";
import { supabase } from "../lib/supabase";
import { showMessage } from "../lib/ui/messages";
import { fetchCurrentUserPreferences } from "../lib/userPreferences";
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
import { submitProductForReview } from "../lib/productSubmission";
import {
  ITEM_SEPARATORS,
  applyIngredientCorrections,
  isIngredientHighlighted,
  parseUncertainIngredients,
  screenProduct,
  splitTopLevel,
  type Level,
  type MatchType,
  type ScreeningData,
  type ScreeningSection,
  type UncertainIngredient,
} from "../lib/screening";
import { asText, cleanTagText } from "../lib/text";
import {
  ContextSafeAreaView as SafeAreaView,
  KeyboardAvoidingView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "../components/Themed";

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

// Messages for unreadable photos / lookups (translation keys).
const FRONT_PHOTO_MESSAGE: TranslationKey = "home.frontUnreadable";
const INGREDIENT_PHOTO_MESSAGE: TranslationKey = "home.ingredientsUnreadable";
const NETWORK_MESSAGE: TranslationKey = "home.networkPhotos";
const UNAVAILABLE_MESSAGE: TranslationKey = "home.unavailable";
const NOT_FOUND_MESSAGE: TranslationKey = "home.notFound";

const EXTRACTION_TIMEOUT_MS = 90000; // AI extraction can never hang forever
// Stored with Avoid List items and submissions (data, not UI text), so it
// stays in English.
const SOURCE_PHOTO = "AI package-photo extraction";

// Zoom viewer limits.
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;

// The stack header already covers the top inset, so pages skip it.
const PAGE_EDGES: Edge[] = ["left", "right", "bottom"];

// Colors for each result level.
const LEVEL_COLORS: Record<Level, { main: string; bg: string }> = {
  direct: { main: "#C62828", bg: "#FDECEA" }, // red
  may: { main: "#E65100", bg: "#FFF1E0" }, // orange
  clear: { main: "#176B43", bg: "#E8F5E9" }, // green
  verify: { main: "#8A6A00", bg: "#FFF8D6" }, // yellow
  none: { main: "#5F6B64", bg: "#F0F2F1" }, // gray
  error: { main: "#5F6B64", bg: "#F0F2F1" }, // gray
};

// How each finding type is explained inside the expanded card.
const HALAL_CODE_CHECK_URL = "https://halalcodecheck.com/ecodes-database/";

// "Milk, Peanuts; Soybeans" → ["Milk", "Peanuts", "Soybeans"].
function splitLabelList(value: string): string[] {
  return value
    .split(/\s*[,;،]\s*/)
    .map((item) => item.replace(/\.$/, "").trim())
    .filter(Boolean);
}

const MATCH_TYPE_LABELS: Record<MatchType, TranslationKey> = {
  direct: "home.matchDirect",
  possible: "home.matchPossible",
  verify: "home.matchVerify",
};


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

// ---------------------------------------------------------------------------
// REVIEW DECISION
// The review page is shown only when the user may need to correct something.
// ---------------------------------------------------------------------------

// Words and marks that suggest the reader was not sure about the text.
const UNCLEAR_WORDS =
  /\b(unclear|unreadable|illegible|unknown|not visible|not legible|cannot read|can't read|could not be read|could not read|n\/a|blurry|blurred|cut off|partially visible)\b/i;

function looksUnclear(text: string): boolean {
  return (
    UNCLEAR_WORDS.test(text) ||
    text.includes("?") ||
    text.includes("…") ||
    text.includes("...") ||
    /\*{2,}|_{2,}|#{2,}/.test(text)
  );
}

// Product name / brand that is very short, has no letters, or looks unclear.
function looksSuspiciousName(text: string): boolean {
  return (
    text.length < 2 ||
    !/\p{L}/u.test(text) ||
    looksUnclear(text) ||
    /\[|\]/.test(text)
  );
}

// Collects any notes / warnings the label reader may have returned.
function readerNotes(extraction: any): string[] {
  const keys = [
    "notes",
    "note",
    "warnings",
    "warning",
    "issues",
    "problems",
    "quality_notes",
    "unreadable",
    "unreadable_text",
  ];

  const notes: string[] = [];

  for (const key of keys) {
    const value = extraction?.[key];

    if (typeof value === "string" && value.trim()) {
      notes.push(value.trim());
    } else if (Array.isArray(value)) {
      value
        .filter((v): v is string => typeof v === "string" && Boolean(v.trim()))
        .forEach((v) => notes.push(v.trim()));
    }
  }

  return notes;
}

const POOR_PHOTO_VALUES = ["poor", "low", "bad", "blurry", "unclear", "dark"];

function photoNeedsCorrection(extraction: any, which: "front" | "ingredients") {
  const quality = asText(
    extraction?.[`${which}_photo_quality`] ??
      extraction?.[`${which}_quality`] ??
      ""
  ).toLowerCase();

  return (
    POOR_PHOTO_VALUES.includes(quality) ||
    extraction?.[`retake_${which}`] === true ||
    extraction?.[`${which}_needs_retake`] === true
  );
}

// Returns the reasons the user should review the extracted text, already
// translated. An empty list means the analysis can continue automatically.
function reviewReasonsFor(
  extraction: any,
  name: string,
  brand: string,
  ingredientsText: string,
  uncertainCount: number
): string[] {
  const reasons: string[] = [];

  if (!name || looksSuspiciousName(name)) {
    reasons.push(translate("home.reasonName"));
  }

  if (!brand || looksSuspiciousName(brand)) {
    reasons.push(translate("home.reasonBrand"));
  }

  if (!ingredientsText || looksUnclear(ingredientsText)) {
    reasons.push(translate("home.reasonIngredients"));
  }

  if (asText(extraction?.confidence).toLowerCase() === "low") {
    reasons.push(translate("home.reasonLowConfidence"));
  }

  if (uncertainCount > 0) {
    reasons.push(
      uncertainCount === 1
        ? translate("home.reasonUncertainOne")
        : translate("home.reasonUncertainMany", { count: uncertainCount })
    );
  }

  if (readerNotes(extraction).length > 0) {
    reasons.push(translate("home.reasonNotes"));
  }

  const overallQuality = asText(
    extraction?.photo_quality ?? extraction?.image_quality ?? ""
  ).toLowerCase();

  if (POOR_PHOTO_VALUES.includes(overallQuality)) {
    reasons.push(translate("home.reasonPhotos"));
  } else {
    if (photoNeedsCorrection(extraction, "front")) {
      reasons.push(translate("home.reasonFront"));
    }

    if (photoNeedsCorrection(extraction, "ingredients")) {
      reasons.push(translate("home.reasonIngredientPhoto"));
    }
  }

  return [...new Set(reasons)];
}

// Loads the CURRENT user's allergies, halal setting and product-submission
// consent from Supabase (the database is the source of truth).
async function fetchUserPreferences(): Promise<{
  allergies: string[];
  prefersHalal: boolean;
  submitProducts: boolean;
}> {
  const preferences = await fetchCurrentUserPreferences();

  return {
    allergies: preferences.allergies,
    prefersHalal: preferences.prefersHalal,
    submitProducts: preferences.submitProducts,
  };
}

// Uploads one product photo to the "avoid-products" Storage bucket.
// Returns the Storage path (AvoidListScreen converts it into a signed URL).
// HTTPS URLs (for example Open Food Facts images) are returned unchanged.
async function uploadAvoidPhoto(
  userId: string,
  photoUri: string | null,
  photoName: string
): Promise<string | null> {
  if (!photoUri) {
    return null;
  }

  // Already-uploaded HTTPS URLs do not need uploading again.
  if (/^https?:\/\//i.test(photoUri)) {
    return photoUri;
  }

  const response = await fetch(photoUri);
  const fileData = await response.arrayBuffer();

  const filePath = `${userId}/${Date.now()}-${photoName}.jpg`;

  const { error } = await supabase.storage
    .from("avoid-products")
    .upload(filePath, fileData, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return filePath;
}

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------

export default function HomeScreen({ navigation }: any) {
  const { t, language, isRTL } = useI18n();
  const [stage, setStage] = useState<Stage>("home");

  // Screening sentences come from the engine in English; show them in the
  // selected language (see lib/i18n/screeningText.ts).
  const localize = (text: string | null | undefined) =>
    localizeScreeningText(text, t, language);

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

  // Why the review page is being shown (empty = no review needed).
  const [reviewReasons, setReviewReasons] = useState<string[]>([]);

  // True only when results were reached through the review page.
  const [hasReview, setHasReview] = useState(false);

  // Full-screen photo zoom (review page). Photos are never changed.
  const [zoomImageUri, setZoomImageUri] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(MIN_ZOOM);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

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

  // Label text shown on the result page, translated to Arabic when Arabic
  // is selected. Screening and highlighting always use the original text.
  const containsItems = splitLabelList(cleanTagText(contains));
  const mayContainItems = splitLabelList(cleanTagText(mayContain));
  const resultLabelTexts =
    stage === "result"
      ? [
          ...splitTopLevel(ingredients, ITEM_SEPARATORS),
          ...containsItems,
          ...mayContainItems,
        ]
      : [];
  const trLabel = useFoodTranslator(resultLabelTexts);

  // -------------------------------------------------------------------------
  // PREFERENCES (banner)
  // -------------------------------------------------------------------------

  const loadUserPreferences = useCallback(async () => {
    try {
      const prefs = await fetchUserPreferences();
      await prepareAllergyLabels(prefs.allergies);
      setUserAllergies(prefs.allergies);
      setPrefersHalal(prefs.prefersHalal);
    } catch (error) {
      // Guests / offline: the banner keeps its last value.
      console.warn("Could not load preferences:", error);
    }
  }, []);

  // Latest stage / product / screening function, read by the focus listener.
  // Using refs means the listener is added once and can never loop or use
  // stale values.
  const focusStageRef = useRef(stage);
  focusStageRef.current = stage;
  const focusProductRef = useRef(product);
  focusProductRef.current = product;
  const screenConfirmedProductRef = useRef(screenConfirmedProduct);
  screenConfirmedProductRef.current = screenConfirmedProduct;

  // Loads on open and again when the screen regains focus
  // (for example after editing the Allergy Profile).
  // If a result is showing, the product is screened again with the
  // CURRENT saved preferences — no new scan or photos needed.
  useEffect(() => {
    void loadUserPreferences();

    const unsubscribe = navigation?.addListener?.("focus", () => {
      void loadUserPreferences();

      const currentProduct = focusProductRef.current;

      if (focusStageRef.current === "result" && currentProduct) {
        void screenConfirmedProductRef.current(currentProduct);
      }
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
  const zoomOpenRef = useRef(false);
  zoomOpenRef.current = zoomImageUri !== null;

  // Android hardware back button follows the same steps.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          // Close the zoom viewer first.
          if (zoomOpenRef.current) {
            setZoomImageUri(null);
            return true;
          }

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
      showMessage(t("home.notAvailableTitle"), t("home.notAvailableBody"));
    }
  }

  // -------------------------------------------------------------------------
  // ZOOM VIEWER
  // -------------------------------------------------------------------------

  function openZoom(uri: string | null) {
    if (!uri) {
      return;
    }

    setZoomScale(MIN_ZOOM);
    setZoomImageUri(uri);
  }

  function closeZoom() {
    setZoomImageUri(null);
    setZoomScale(MIN_ZOOM);
  }

  function changeZoom(step: number) {
    setZoomScale((current) =>
      Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + step))
    );
  }

  // -------------------------------------------------------------------------
  // SMALL UI HELPERS
  // -------------------------------------------------------------------------

  // Allergy list on home, photo, review and result pages (NOT on the camera).
  function renderAllergyBanner() {
    return (
      <View style={styles.allergyBanner}>
        <View style={styles.allergyTextContainer}>
          <Text style={styles.allergyTitle}>{t("home.allergyProfile")}</Text>
          <Text style={styles.allergyValue}>
            {userAllergies.length > 0
              ? joinList(allergyLabelList(userAllergies, t))
              : t("home.noAllergies")}
          </Text>
          <Text style={styles.halalPreference}>
            {prefersHalal ? t("home.halalOn") : t("home.halalOff")}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => openScreen("Preferences", { mode: "edit" })}
          activeOpacity={0.8}
          accessibilityLabel={t("home.editProfileA11y")}
        >
          <Text style={styles.editText}>{t("home.edit")}</Text>
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
          accessibilityLabel={t("home.goBack")}
        >
          {/* Glyphs are not mirrored by the RTL layout, so swap the arrow. */}
          <Text style={styles.backArrow}>{isRTL ? "›" : "‹"}</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{title}</Text>
        <View style={styles.topBarSpacer} />
      </View>
    );
  }

  // Warning on review and result pages.
  function renderPackageWarning() {
    return (
      <View style={styles.warningBanner}>
        <Text style={styles.warningText}>{t("home.packageWarning")}</Text>
      </View>
    );
  }

  // Full-screen photo viewer.
  // iOS: pinch to zoom (ScrollView zoom). All platforms: − / + buttons,
  // then drag to move around the enlarged photo.
  function renderZoomViewer() {
    const viewerWidth = windowWidth;
    const viewerHeight = Math.max(240, windowHeight * 0.72);

    return (
      <Modal
        visible={zoomImageUri !== null}
        animationType="fade"
        onRequestClose={closeZoom}
        transparent={false}
      >
        <View style={styles.zoomPage}>
          <View style={styles.zoomTopBar}>
            <Text style={styles.zoomTitle}>{t("home.zoom")}</Text>

            <TouchableOpacity
              style={styles.zoomCloseButton}
              onPress={closeZoom}
              activeOpacity={0.8}
              accessibilityLabel={t("home.closeZoom")}
            >
              <Text style={styles.zoomCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.zoomScroll}
            contentContainerStyle={styles.zoomScrollContent}
            maximumZoomScale={5}
            minimumZoomScale={1}
            centerContent
            bouncesZoom
            pinchGestureEnabled
            showsVerticalScrollIndicator={false}
          >
            <ScrollView
              horizontal
              contentContainerStyle={styles.zoomScrollContent}
              centerContent
              showsHorizontalScrollIndicator={false}
            >
              {zoomImageUri ? (
                <Image
                  source={{ uri: zoomImageUri }}
                  style={{
                    width: viewerWidth * zoomScale,
                    height: viewerHeight * zoomScale,
                  }}
                  resizeMode="contain"
                  accessibilityLabel={t("home.zoomedPhoto")}
                />
              ) : null}
            </ScrollView>
          </ScrollView>

          <View style={styles.zoomControls}>
            <TouchableOpacity
              style={[
                styles.zoomControlButton,
                zoomScale <= MIN_ZOOM && styles.disabledButton,
              ]}
              onPress={() => changeZoom(-ZOOM_STEP)}
              disabled={zoomScale <= MIN_ZOOM}
              accessibilityLabel={t("home.zoomOut")}
            >
              <Text style={styles.zoomControlText}>−</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setZoomScale(MIN_ZOOM)}
              accessibilityLabel={t("home.resetZoom")}
            >
              <Text style={styles.zoomLevelText}>
                {Math.round(zoomScale * 100)}%
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.zoomControlButton,
                zoomScale >= MAX_ZOOM && styles.disabledButton,
              ]}
              onPress={() => changeZoom(ZOOM_STEP)}
              disabled={zoomScale >= MAX_ZOOM}
              accessibilityLabel={t("home.zoomIn")}
            >
              <Text style={styles.zoomControlText}>+</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.zoomHelpText}>
            {Platform.OS === "ios"
              ? t("home.zoomHelpIos")
              : t("home.zoomHelp")}
          </Text>
        </View>
      </Modal>
    );
  }

  // Compact result card; details appear only after "+ Show explanation".
  function renderScreeningCard(
    title: string,
    section: ScreeningSection,
    open: boolean,
    toggle: () => void,
    isHalal = false
  ) {
    const colors = LEVEL_COLORS[section.level] ?? LEVEL_COLORS.error;
    const findings = section.findings ?? [];

    // E-numbers mentioned in halal findings, for the HalalCodeCheck links.
    const eCodes = isHalal
      ? [
          ...new Set(
            findings
              .flatMap((finding) =>
                `${finding.matchedTerm ?? ""} ${finding.statement ?? ""}`.match(
                  /\bE\s?\d{3,4}[a-z]?\b/gi
                ) ?? []
              )
              .map((code) => code.replace(/\s/g, "").toUpperCase())
          ),
        ]
      : [];

    return (
      <View
        style={[
          styles.statusCard,
          { borderStartColor: colors.main, backgroundColor: colors.bg },
        ]}
      >
        <Text style={styles.statusHeading}>{title}</Text>
        <Text style={[styles.statusValue, { color: colors.main }]}>
          {localize(section.status)}
        </Text>

        <Text style={styles.statusHint}>{t("home.tapToSee")}</Text>

        <TouchableOpacity
          style={styles.expandButton}
          onPress={toggle}
          activeOpacity={0.8}
          accessibilityLabel={
            open ? t("home.hideExplanationA11y") : t("home.showExplanationA11y")
          }
        >
          <Text style={[styles.expandText, { color: colors.main }]}>
            {open ? t("home.hideExplanation") : t("home.showExplanation")}
          </Text>
        </TouchableOpacity>

        {open && (
          <View>
            <Text style={styles.statusExplanation}>
              {localize(section.explanation)}
            </Text>

            {/* Every finding: allergy name, source, match type, exact text. */}
            {findings.map((finding, index) => (
              <View
                key={`${finding.sourceLabel}-${finding.statement}-${index}`}
                style={styles.findingRow}
              >
                <Text style={[styles.findingTitle, { color: colors.main }]}>
                  {localize(finding.headline)}
                </Text>
                <Text style={styles.findingSource}>
                  {t("home.foundIn", {
                    source: localizeSourceLabel(finding.sourceLabel, t),
                  })}
                </Text>
                {finding.matchType ? (
                  <Text style={styles.findingSource}>
                    {t("home.match", {
                      type: t(MATCH_TYPE_LABELS[finding.matchType]),
                    })}
                  </Text>
                ) : null}
                {/* The matched label text is shown exactly as printed. */}
                <Text style={styles.findingStatement}>
                  {t("home.matchedText", { text: finding.statement })}
                </Text>
              </View>
            ))}

            {/* Halal: look up flagged E-numbers on HalalCodeCheck. */}
            {isHalal && section.level !== "clear" ? (
              <View style={styles.halalLinks}>
                <Text style={styles.halalLinksTitle}>
                  {t("home.halalCheckTitle")}
                </Text>

                {(eCodes.length > 0 ? eCodes : [""]).map((code) => (
                  <TouchableOpacity
                    key={code || "all"}
                    style={styles.halalLinkButton}
                    onPress={() =>
                      void Linking.openURL(
                        code
                          ? `${HALAL_CODE_CHECK_URL}?search=${encodeURIComponent(code)}`
                          : HALAL_CODE_CHECK_URL
                      )
                    }
                    accessibilityRole="link"
                  >
                    <Text style={styles.halalLinkText}>
                      {code
                        ? t("home.halalCheckCode", { code })
                        : t("home.halalCheckDatabase")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
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
          if (Platform.OS === "web") {
            showMessage(
              t("home.cameraPermissionTitle"),
              t("home.cameraPermissionWeb")
            );
          } else {
            Alert.alert(
              t("home.cameraPermissionTitle"),
              t("home.cameraPermissionPhone"),
              [
                { text: t("home.notNow"), style: "cancel" },
                { text: t("home.openSettings"), onPress: () => Linking.openSettings() },
              ]
            );
          }
          return;
        }
      }
    } catch (error) {
      console.warn("Camera permission request failed:", error);
      showMessage(t("home.cameraErrorTitle"), t("home.cameraErrorBody"));
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
  // Used by "Scan product" and "Scan another product".
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
    setZoomImageUri(null);

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
    setReviewReasons([]);
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
    setReviewReasons([]);
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
      showMessage(t("home.invalidBarcodeTitle"), t("home.invalidBarcodeBody"));
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
    setReviewReasons([]);
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
      setLookupMessage(t("home.incomplete"));
    } else if (result.kind === "notfound") {
      setLookupMessage(t(NOT_FOUND_MESSAGE));
    } else {
      setLookupMessage(t(UNAVAILABLE_MESSAGE));
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
      setPhotoError({ message: t(INGREDIENT_PHOTO_MESSAGE), retryable: false });
      setStage("ingredients");
    } else if (kind === "network") {
      // Photos are fine: keep them and allow "try again".
      setPhotoError({ message: t(NETWORK_MESSAGE), retryable: true });
      setStage("front");
    } else {
      // Clear ONLY the invalid front photo; the ingredient photo is kept.
      setFrontPhotoUri(null);
      setPhotoError({ message: t(FRONT_PHOTO_MESSAGE), retryable: false });
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
  // Goes straight to the result when nothing needs correcting;
  // otherwise opens the review page and explains why.
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

      const uncertain = parseUncertainIngredients(extraction.unclear_text);
      const reasons = reviewReasonsFor(
        extraction,
        name,
        brand,
        text,
        uncertain.length
      );

      fillProductFields(extracted);
      setScreening(null);
      setAllergyOpen(false);
      setHalalOpen(false);
      setSavedAvoid(false);

      // Something may need correcting: show the review page.
      if (reasons.length > 0) {
        setUncertainItems(uncertain);
        setLowConfidence(extraction.confidence === "low");
        setReviewReasons(reasons);
        setHasReview(true);
        setStage("review");
        return;
      }

      // Everything looks clear: continue to the analysis automatically.
      setUncertainItems([]);
      setLowConfidence(false);
      setReviewReasons([]);
      setHasReview(false);
      setStage("result");
      await screenConfirmedProduct(extracted);
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
        if (Platform.OS === "web") {
          showMessage(
            t("home.cameraPermissionTitle"),
            t("home.cameraPermissionLabelWeb")
          );
        } else {
          Alert.alert(
            t("home.cameraPermissionTitle"),
            t("home.cameraPermissionLabelPhone"),
            [
              { text: t("home.notNow"), style: "cancel" },
              { text: t("home.openSettings"), onPress: () => Linking.openSettings() },
            ]
          );
        }
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
        showMessage(t("home.photoErrorTitle"), t("home.photoErrorBody"));
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
      showMessage(
        t("home.cameraUnavailableTitle"),
        t("home.cameraUnavailableBody")
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
  // Checks ingredients, Contains, May contain, product name and brand.
  // Afterwards, the product is sent for verification in the background
  // ONLY when user_preferences.submit_products_for_review is true.
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

      // Allergies typed in Arabic (e.g. "سكر") are matched as English
      // ("sugar"), because product labels are read in English.
      const screeningAllergies = await allergiesForScreening(prefs.allergies);

      if (runId !== screeningRunId.current) {
        return;
      }

      setScreening(
        screenProduct({
          allergies: screeningAllergies,
          prefersHalal: prefs.prefersHalal,
          ingredients: asText(confirmed.ingredients),
          contains: asText(confirmed.contains),
          mayContain: asText(confirmed.mayContain),
          productName: asText(confirmed.productName),
          brandName: asText(confirmed.brandName),
        })
      );

      // Background submission: only when the saved preference is on.
      // Never awaited, never shows errors, never blocks analysis or the
      // Avoid List. Duplicates are skipped inside the helper.
      if (prefs.submitProducts) {
        void submitProductForReview(
          {
            barcode: confirmed.barcode,
            productName: asText(confirmed.productName),
            brandName: asText(confirmed.brandName),
            variant: asText(confirmed.variant),
            ingredients: asText(confirmed.ingredients),
            contains: asText(confirmed.contains),
            mayContain: asText(confirmed.mayContain),
            source: asText(confirmed.source),
            frontPhotoUri: confirmed.frontPhotoUri,
            ingredientsPhotoUri: confirmed.ingredientsPhotoUri,
            imageUrl: confirmed.imageUrl ?? null,
          },
          { preferenceConfirmed: true }
        );
      }
    } catch (error) {
      if (runId !== screeningRunId.current) {
        return;
      }

      // Never show a false "safe" result if something fails.
      // (English on purpose: it is translated for display by localize().)
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
      showMessage(
        t("home.ingredientsRequiredTitle"),
        t("home.ingredientsRequiredBody")
      );
      return;
    }

    if (uncertainItems.some((item) => !item.confirmed)) {
      showMessage(
        t("home.checkUncertainTitle"),
        t("home.checkUncertainBody")
      );
      return;
    }

    if (uncertainItems.some((item) => !item.value.trim())) {
      showMessage(
        t("home.emptyIngredientTitle"),
        t("home.emptyIngredientBody")
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

  // Saves the confirmed product, its photos, the full warning reason
  // and the actual halal screening status.
  async function addToAvoidList() {
    if (!product || savingAvoid || savedAvoid) {
      return;
    }

    // Tell the user instead of silently ignoring the tap.
    if (screeningLoading || !screening) {
      showMessage(t("home.pleaseWaitTitle"), t("home.pleaseWaitBody"));
      return;
    }

    setSavingAvoid(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(t("home.sessionExpired"));
      }

      // Photo upload problems are reported but do not block the save.
      let frontPhotoPath: string | null = null;
      let ingredientsPhotoPath: string | null = null;
      let photoWarning = "";

      try {
        // Local front photo first; otherwise the Open Food Facts image.
        frontPhotoPath = await uploadAvoidPhoto(
          user.id,
          product.frontPhotoUri || product.imageUrl || null,
          "front"
        );

        ingredientsPhotoPath = await uploadAvoidPhoto(
          user.id,
          product.ingredientsPhotoUri,
          "ingredients"
        );
      } catch (photoError: any) {
        console.error("Avoid List photo upload failed:", photoError);
        photoWarning = `\n\n${t("home.photosNotSaved", {
          reason: photoError?.message || t("home.uploadFailed"),
        })}`;
      }

      // Reason = every finding with its source and the exact label text.
      // Stored in English (database content); AvoidList translates it for
      // display.
      const reasons = [
        ...new Set(
          [
            ...(screening.allergy.findings ?? []),
            ...(screening.halal?.findings ?? []),
          ].map(
            (finding) =>
              `${finding.headline} — ${finding.sourceLabel}: "${finding.statement}"`
          )
        ),
      ];

      const saveReason =
        reasons.length > 0
          ? reasons.join("; ")
          : screening.allergy.status || "Saved by the user.";

      const { error: insertError } = await supabase
        .from("avoid_list")
        .insert({
          user_id: user.id,
          barcode: product.barcode ?? null,
          product_name: asText(product.productName),
          brand_name: asText(product.brandName),
          variant: asText(product.variant),
          ingredients_text: asText(product.ingredients),
          contains_text: asText(product.contains),
          may_contain_text: asText(product.mayContain),
          save_reason: saveReason,
          source: product.source,

          // The actual halal result shown on the card.
          halal_status:
            screening.halal?.status ||
            (prefersHalal
              ? "Halal screening could not be completed"
              : "Halal screening not selected"),

          front_photo_url: frontPhotoPath,
          ingredients_photo_url: ingredientsPhotoPath,
        });

      if (insertError) {
        throw insertError;
      }

      setSavedAvoid(true);

      showMessage(t("home.addedTitle"), `${t("home.addedBody")}${photoWarning}`);
    } catch (error: any) {
      console.error("Avoid List save failed:", error);

      showMessage(
        t("home.saveFailedTitle"),
        error?.message || t("home.saveFailedBody")
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
        <ScrollView
          contentContainerStyle={styles.homeContent}
          showsVerticalScrollIndicator={false}
        >
          {renderAllergyBanner()}

          <Text style={styles.homeTitle}>{t("home.title")}</Text>
          <Text style={styles.homeSubtitle}>{t("home.subtitle")}</Text>

          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => {
              void startNewScan();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.scanButtonText}>{t("home.scanProduct")}</Text>
          </TouchableOpacity>

          <Text style={styles.homeNote}>{t("home.note")}</Text>
        </ScrollView>

        <BottomNavigation navigation={navigation} activeTab="Home" />
      </SafeAreaView>
    );
  }

  // ----- Barcode lookup loading (Cancel, so never a dead end) -----
  if (stage === "lookup") {
    return (
      <SafeAreaView style={styles.loadingPage} edges={PAGE_EDGES}>
        <ActivityIndicator size="large" color="#176B43" />
        <Text style={styles.loadingTitle}>{t("home.checkingProduct")}</Text>
        <Text style={styles.loadingSubtitle}>{lookupMessage}</Text>

        <TouchableOpacity
          style={styles.loadingCancelButton}
          onPress={cancelLookup}
          activeOpacity={0.8}
        >
          <Text style={styles.loadingCancelText}>{t("common.cancel")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ----- AI extraction loading (Cancel, so never a dead end) -----
  if (stage === "extracting") {
    return (
      <SafeAreaView style={styles.loadingPage} edges={PAGE_EDGES}>
        <ActivityIndicator size="large" color="#176B43" />
        <Text style={styles.loadingTitle}>{t("home.analyzing")}</Text>
        <Text style={styles.loadingSubtitle}>{t("home.readingPhotos")}</Text>

        <TouchableOpacity
          style={styles.loadingCancelButton}
          onPress={cancelExtraction}
          activeOpacity={0.8}
        >
          <Text style={styles.loadingCancelText}>{t("common.cancel")}</Text>
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
      ? t("home.openingCamera")
      : currentPhoto || photoError
      ? t("home.retakePhoto")
      : t("home.takePhoto");

    return (
      <SafeAreaView style={styles.photoPage} edges={PAGE_EDGES}>
        <ScrollView contentContainerStyle={styles.photoContent}>
          {renderTopBar(
            isIngredients ? t("home.ingredientLabel") : t("home.frontPackage")
          )}
          {renderAllergyBanner()}

          <Text style={styles.stepText}>
            {isIngredients ? t("home.step1") : t("home.step2")}
          </Text>

          <Text style={styles.photoTitle}>
            {isIngredients
              ? t("home.photographIngredients")
              : t("home.photographFront")}
          </Text>

          <Text style={styles.photoSubtitle}>
            {isIngredients
              ? t("home.captureIngredients")
              : t("home.captureFront")}
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
              <Text style={styles.photoGuideText}>{t("home.keepInFocus")}</Text>
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
              <Text style={styles.keptPhotoText}>{t("home.ingredientSaved")}</Text>
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
                {t("home.continueWithPhoto")}
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
                {retryable ? t("common.retry") : t("home.analyzeThisPhoto")}
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.cancelButton} onPress={goBack}>
            <Text style={styles.cancelButtonText}>{t("common.back")}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ----- Review (only shown when something may need correcting) -----
  if (stage === "review" && product) {
    // Live preview of the ingredient list with the user's edits applied.
    const previewIngredients = applyIngredientCorrections(
      ingredients,
      uncertainItems
    );

    const confirmedCount = uncertainItems.filter((i) => i.confirmed).length;
    const allConfirmed = confirmedCount === uncertainItems.length;
    const canConfirm = allConfirmed && ingredients.trim().length > 0;

    return (
      <SafeAreaView style={styles.resultPage} edges={PAGE_EDGES}>
        <ScrollView
          contentContainerStyle={styles.resultContent}
          keyboardShouldPersistTaps="handled"
        >
          {renderTopBar(t("home.reviewLabel"))}
          {renderAllergyBanner()}
          {renderPackageWarning()}

          {/* Tap either photo to open the zoom viewer. */}
          {frontPhotoUri ? (
            <TouchableOpacity
              onPress={() => openZoom(frontPhotoUri)}
              activeOpacity={0.85}
              accessibilityLabel={t("home.zoomFrontA11y")}
            >
              <Image source={{ uri: frontPhotoUri }} style={styles.resultPhoto} />
            </TouchableOpacity>
          ) : null}

          {ingredientsPhotoUri ? (
            <TouchableOpacity
              onPress={() => openZoom(ingredientsPhotoUri)}
              activeOpacity={0.85}
              accessibilityLabel={t("home.zoomIngredientsA11y")}
            >
              <Text style={styles.photoCaption}>
                {t("home.ingredientPhotoCaption")}
              </Text>
              <Image
                source={{ uri: ingredientsPhotoUri }}
                style={styles.reviewIngredientPhoto}
              />
            </TouchableOpacity>
          ) : null}

          {frontPhotoUri || ingredientsPhotoUri ? (
            <Text style={styles.zoomHint}>{t("home.tapToZoom")}</Text>
          ) : null}

          <Text style={styles.resultTitle}>{t("home.reviewTitle")}</Text>
          <Text style={styles.resultSubtitle}>{t("home.reviewSubtitle")}</Text>

          {/* Why the review page is being shown. */}
          {reviewReasons.length > 0 ? (
            <View style={styles.reviewReasonCard}>
              <Text style={styles.reviewReasonTitle}>{t("home.checkBefore")}</Text>

              {reviewReasons.map((reason, index) => (
                <Text key={`${reason}-${index}`} style={styles.reviewReasonText}>
                  • {reason}
                </Text>
              ))}
            </View>
          ) : null}

          {/* Brand and product name can be corrected. */}
          <Text style={styles.fieldLabel}>{t("home.brand")}</Text>
          <TextInput
            style={styles.textField}
            value={brandName}
            onChangeText={setBrandName}
            placeholder={t("home.brand")}
            placeholderTextColor="#8A9A8F"
          />

          <Text style={styles.fieldLabel}>{t("home.productName")}</Text>
          <TextInput
            style={styles.textField}
            value={productName}
            onChangeText={setProductName}
            placeholder={t("home.productName")}
            placeholderTextColor="#8A9A8F"
          />

          {/* Only ingredients the AI marked as uncertain appear here. */}
          {uncertainItems.length > 0 && (
            <View style={styles.uncertaintyCard}>
              <Text style={styles.uncertaintyTitle}>{t("home.notSure")}</Text>
              <Text style={styles.uncertaintySubtitle}>
                {t("home.checkAgainst")}
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
                      accessibilityLabel={t("home.editItemA11y", {
                        name: item.original,
                      })}
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
                        {editingUncertainIndex === index
                          ? t("home.done")
                          : t("home.edit")}
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
                      <Text style={styles.checkboxText}>
                        {t("home.itIsCorrect")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <Text style={styles.progressText}>
                {t("home.checkedProgress", {
                  done: confirmedCount,
                  total: uncertainItems.length,
                })}
              </Text>
            </View>
          )}

          {/* The AI said the photo was hard to read but listed nothing specific. */}
          {uncertainItems.length === 0 && lowConfidence && (
            <View style={styles.uncertaintyCard}>
              <Text style={styles.uncertaintySubtitle}>{t("home.hardToRead")}</Text>
            </View>
          )}

          {/* Full ingredient list in a readable format. */}
          <Text style={styles.fieldLabel}>{t("home.ingredients")}</Text>
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

          <Text style={styles.fieldLabel}>{t("home.contains")}</Text>
          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyValue}>
              {contains || t("home.noneExtracted")}
            </Text>
          </View>

          <Text style={styles.fieldLabel}>{t("home.mayContain")}</Text>
          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyValue}>
              {mayContain || t("home.noneExtracted")}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
            onPress={confirmAndAnalyze}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmButtonText}>{t("home.confirmAnalyze")}</Text>
          </TouchableOpacity>

          {!allConfirmed && (
            <Text style={styles.resultNote}>{t("home.tickAll")}</Text>
          )}

          {!ingredients.trim() && (
            <Text style={styles.resultNote}>{t("home.noIngredientsRead")}</Text>
          )}
        </ScrollView>

        {renderZoomViewer()}
      </SafeAreaView>
    );
  }

  // ----- Result -----
  if (stage === "result" && product) {
    const ingredientRows = splitTopLevel(ingredients, ITEM_SEPARATORS);
    const imageUri = product.frontPhotoUri || product.imageUrl;

    // The button always responds; addToAvoidList explains if it must wait.
    const avoidDisabled = savingAvoid || savedAvoid;

    return (
      <SafeAreaView style={styles.resultPage} edges={PAGE_EDGES}>
        <ScrollView contentContainerStyle={styles.resultContent}>
          {renderTopBar(t("home.analysisResult"))}
          {renderAllergyBanner()}
          {renderPackageWarning()}

          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.resultPhoto} />
          ) : (
            <View style={styles.noImage}>
              <Text style={styles.noImageText}>{t("home.noImage")}</Text>
            </View>
          )}

          <Text style={styles.resultTitle}>
            {productName || t("home.productResult")}
          </Text>
          <Text style={styles.resultBrand}>
            {brandName || t("home.brandUnavailable")}
          </Text>
          <Text style={styles.sourceText}>
            {t("home.source", { source: localize(product.source) })}
          </Text>

          {screeningLoading || !screening ? (
            <View style={styles.statusCard}>
              <Text style={styles.statusHeading}>{t("home.screening")}</Text>
              <ActivityIndicator color="#176B43" style={styles.statusLoader} />
            </View>
          ) : (
            <>
              {renderScreeningCard(
                t("home.allergyScreening"),
                screening.allergy,
                allergyOpen,
                () => setAllergyOpen((open) => !open)
              )}

              {/* Halal appears only when the user selected halal screening. */}
              {screening.halal &&
                renderScreeningCard(
                  t("home.halalScreening"),
                  screening.halal,
                  halalOpen,
                  () => setHalalOpen((open) => !open),
                  true
                )}
            </>
          )}

          {/* Every ingredient related to ANY finding is highlighted,
              including findings from Contains and May contain. */}
          <Text style={styles.detailHeading}>{t("home.ingredients")}</Text>
          <View style={styles.ingredientListCard}>
            {ingredientRows.length === 0 ? (
              <Text style={styles.detailText}>{t("home.notAvailable")}</Text>
            ) : (
              ingredientRows.map((ingredient, index) => (
                <View key={`${ingredient}-${index}`} style={styles.ingredientRow}>
                  <Text style={styles.ingredientBullet}>•</Text>
                  <Text
                    style={[
                      styles.ingredientText,
                      isIngredientHighlighted(ingredient, screening) &&
                        styles.ingredientFlagged,
                    ]}
                  >
                    {trLabel(ingredient)}
                  </Text>
                </View>
              ))
            )}
          </View>

          <Text style={styles.detailHeading}>{t("home.contains")}</Text>
          <Text style={styles.detailText}>
            {containsItems.length > 0
              ? joinList(containsItems.map(trLabel))
              : t("home.noneListed")}
          </Text>

          <Text style={styles.detailHeading}>{t("home.mayContain")}</Text>
          <Text style={styles.detailText}>
            {mayContainItems.length > 0
              ? joinList(mayContainItems.map(trLabel))
              : t("home.noneListed")}
          </Text>

          <TouchableOpacity
            style={[styles.avoidButton, avoidDisabled && styles.disabledButton]}
            onPress={addToAvoidList}
            disabled={avoidDisabled}
            activeOpacity={0.8}
          >
            <Text style={styles.avoidButtonText}>
              {savingAvoid
                ? t("common.saving")
                : savedAvoid
                ? t("home.addedToAvoid")
                : t("home.addToAvoid")}
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
            <Text style={styles.secondaryButtonText}>{t("home.scanAnother")}</Text>
          </TouchableOpacity>

          <Text style={styles.resultNote}>{t("home.resultNote")}</Text>
        </ScrollView>

        <BottomNavigation navigation={navigation} activeTab="Home" />
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
            showMessage(t("home.cameraErrorTitle"), t("home.cameraErrorBody"));
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
            accessibilityLabel={t("home.closeCamera")}
          >
            <Text style={styles.closeCameraText}>‹</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.flashButton}
            onPress={() => setTorchEnabled((on) => !on)}
            activeOpacity={0.8}
            accessibilityLabel={t("home.flashlight")}
          >
            <Text style={styles.flashButtonText}>{torchEnabled ? "☼" : "♧"}</Text>
          </TouchableOpacity>

          <View style={styles.cameraHeading} pointerEvents="none">
            <Text style={styles.cameraTitle}>{t("home.title")}</Text>
            <Text style={styles.cameraInstructions}>{t("home.pointCamera")}</Text>
          </View>

          <View style={styles.barcodeFrame} pointerEvents="none" />

          <View style={styles.cameraBottom}>
            <View style={styles.manualBarcodeContainer}>
              <TextInput
                style={styles.manualBarcodeInput}
                value={manualBarcode}
                onChangeText={setManualBarcode}
                placeholder={t("home.enterManually")}
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
                <Text style={styles.manualBarcodeButtonText}>{t("home.check")}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.fallbackButton}
              onPress={openIngredientsPhoto}
              activeOpacity={0.8}
            >
              <Text style={styles.fallbackText}>{t("home.noBarcode")}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ----- Safety net: any unexpected state returns to a usable screen -----
  return (
    <SafeAreaView style={styles.loadingPage} edges={PAGE_EDGES}>
      <Text style={styles.loadingTitle}>{t("common.error")}</Text>
      <TouchableOpacity
        style={styles.loadingCancelButton}
        onPress={resetWorkflow}
        activeOpacity={0.8}
      >
        <Text style={styles.loadingCancelText}>{t("home.backToStart")}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// STYLES
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  halalLinks: {
    borderTopWidth: 1,
    borderTopColor: "#E1E9E3",
    marginTop: 10,
    paddingTop: 10,
  },
  halalLinksTitle: { color: "#4F6357", fontSize: 12, marginBottom: 6 },
  halalLinkButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#176B43",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 6,
  },
  halalLinkText: { color: "#176B43", fontSize: 12, fontWeight: "700" },

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
  topBarTitle: { color: "#17452F", fontSize: 17, fontWeight: "800" },
  topBarSpacer: { width: 42 },

  allergyBanner: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#E8F5E9",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  allergyTextContainer: { flex: 1, paddingEnd: 10 },
  allergyTitle: { color: "#17452F", fontSize: 12, fontWeight: "800" },
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

  homePage: { flex: 1, backgroundColor: "#F7F9F7" },
  homeContent: { flexGrow: 1, justifyContent: "center", padding: 24 },
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
    backgroundColor: "#176B43",
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
    borderColor: "#E8F5E9",
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
    marginEnd: 8,
  },
  manualBarcodeButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#176B43",
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

  photoPage: { flex: 1, backgroundColor: "#F7F9F7" },
  photoContent: { padding: 24, paddingBottom: 40 },
  stepText: { color: "#176B43", fontSize: 14, fontWeight: "800", textAlign: "center" },
  photoTitle: {
    color: "#17452F",
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
    borderColor: "#176B43",
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
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
  },
  keptPhotoThumb: { width: 44, height: 44, borderRadius: 8, marginEnd: 10 },
  keptPhotoText: { flex: 1, color: "#17452F", fontSize: 12, lineHeight: 17, fontWeight: "600" },
  takePhotoButton: {
    backgroundColor: "#176B43",
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
    borderColor: "#176B43",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  secondaryButtonText: { color: "#176B43", fontSize: 15, fontWeight: "800" },
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
    borderColor: "#176B43",
  },
  loadingCancelText: { color: "#176B43", fontSize: 15, fontWeight: "800" },

  resultPage: { flex: 1, backgroundColor: "#F7F9F7" },
  resultContent: {
    padding: 20,
    paddingBottom: 170,
  },
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
  resultTitle: { color: "#17452F", fontSize: 25, fontWeight: "800" },
  resultSubtitle: { color: "#63776B", fontSize: 14, lineHeight: 20, marginTop: 8 },
  resultBrand: { color: "#63776B", fontSize: 16, marginTop: 5 },
  sourceText: { color: "#176B43", fontSize: 12, marginTop: 10 },

  // Review page: ingredient photo, zoom hint and review reasons.
  photoCaption: { color: "#17452F", fontSize: 13, fontWeight: "700", marginBottom: 6 },
  reviewIngredientPhoto: {
    width: "100%",
    height: 150,
    borderRadius: 14,
    resizeMode: "cover",
    marginBottom: 8,
  },
  zoomHint: {
    color: "#63776B",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 16,
  },
  reviewReasonCard: {
    backgroundColor: "#FFF8E1",
    borderWidth: 1,
    borderColor: "#E0B83F",
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  reviewReasonTitle: { color: "#755000", fontSize: 15, fontWeight: "800", marginBottom: 6 },
  reviewReasonText: { color: "#755000", fontSize: 13, lineHeight: 19, marginTop: 3 },

  // Zoom viewer.
  zoomPage: { flex: 1, backgroundColor: "#000000" },
  zoomTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 54 : 24,
    paddingBottom: 10,
  },
  zoomTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "800" },
  zoomCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomCloseText: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  zoomScroll: { flex: 1 },
  zoomScrollContent: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  zoomControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
    paddingTop: 12,
  },
  zoomControlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomControlText: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", lineHeight: 30 },
  zoomLevelText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", minWidth: 54, textAlign: "center" },
  zoomHelpText: {
    color: "#C7D0C8",
    fontSize: 12,
    textAlign: "center",
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 34 : 18,
  },

  statusCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderStartWidth: 6,
    borderStartColor: "#176B43",
    padding: 16,
    marginTop: 16,
  },
  statusLoader: { marginTop: 12 },
  statusHeading: { color: "#17452F", fontSize: 17, fontWeight: "800" },
  statusValue: { fontSize: 16, fontWeight: "800", marginTop: 10 },
  statusHint: { color: "#63776B", fontSize: 12, marginTop: 8 },
  expandButton: { paddingVertical: 8 },
  expandText: { fontSize: 14, fontWeight: "800" },
  statusExplanation: { color: "#4A5A50", fontSize: 14, lineHeight: 20, marginTop: 4 },
  findingRow: { backgroundColor: "#FFFFFF", borderRadius: 10, padding: 10, marginTop: 10 },
  findingTitle: { fontSize: 14, fontWeight: "800" },
  findingSource: { color: "#63776B", fontSize: 12, marginTop: 3 },
  findingStatement: { color: "#17452F", fontSize: 14, lineHeight: 20, marginTop: 4 },

  fieldLabel: {
    color: "#17452F",
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
    color: "#17452F",
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
    backgroundColor: "#176B43",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  smallEditButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  correctCheckbox: { flexDirection: "row", alignItems: "center", marginStart: 14, paddingVertical: 5 },
  checkboxSymbol: { color: "#176B43", fontSize: 22 },
  checkboxText: { color: "#17452F", fontSize: 13, fontWeight: "700", marginStart: 5 },
  singleIngredientInput: {
    minHeight: 44,
    borderWidth: 2,
    borderColor: "#D7A928",
    borderRadius: 9,
    backgroundColor: "#FFFDF4",
    color: "#17452F",
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
  ingredientBullet: { color: "#176B43", fontSize: 18, lineHeight: 20, marginEnd: 8 },
  ingredientText: { flex: 1, color: "#17452F", fontSize: 14, lineHeight: 20 },
  ingredientFlagged: { color: "#C62828", fontWeight: "800" },
  readOnlyField: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#DCE5DE",
    borderRadius: 11,
    backgroundColor: "#F7F9F7",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  readOnlyValue: { color: "#17452F", fontSize: 14, lineHeight: 21 },
  detailHeading: {
    color: "#17452F",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 6,
  },
  detailText: { color: "#17452F", fontSize: 14, lineHeight: 21 },

  confirmButton: {
    backgroundColor: "#176B43",
    minHeight: 54,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 28,
  },
  confirmButtonDisabled: { backgroundColor: "#9DB8A8" },
  confirmButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  avoidButton: {
    backgroundColor: "#176B43",
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
});