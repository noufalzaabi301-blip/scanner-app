import { useEffect, useMemo, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

import type { LabelExtraction } from "../lib/labelExtraction";

type ReviewRouteParams = {
  barcode: string | null;
  frontPhotoUri: string;
  ingredientsPhotoUri: string;
  extraction: LabelExtraction;
};

// Zoom viewer limits.
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;

// ---------------------------------------------------------------------------
// REVIEW DECISION
// This screen is only shown when the user may need to correct something.
// ---------------------------------------------------------------------------

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

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

// Returns the reasons the user should review the extracted text.
// An empty list means the analysis can continue automatically.
function reviewReasonsFor(
  extraction: any,
  unclearCount: number
): string[] {
  const name = asText(extraction?.product_name);
  const brand = asText(extraction?.brand);
  const ingredientsText = asText(extraction?.ingredients);

  const reasons: string[] = [];

  if (!name || looksSuspiciousName(name)) {
    reasons.push("The product name is missing or may not have been read correctly.");
  }

  if (!brand || looksSuspiciousName(brand)) {
    reasons.push("The brand is missing or may not have been read correctly.");
  }

  if (!ingredientsText) {
    reasons.push("No ingredients were read. Please type them or retake the photo.");
  } else if (looksUnclear(ingredientsText)) {
    reasons.push("Some ingredient text may not have been read correctly.");
  }

  if (asText(extraction?.confidence).toLowerCase() === "low") {
    reasons.push("The label reader reported low confidence for these photos.");
  }

  if (unclearCount > 0) {
    reasons.push(
      `${unclearCount} item${unclearCount === 1 ? "" : "s"} could not be read clearly.`
    );
  }

  if (readerNotes(extraction).length > 0) {
    reasons.push("The label reader reported that some text could not be read.");
  }

  const overallQuality = asText(
    extraction?.photo_quality ?? extraction?.image_quality ?? ""
  ).toLowerCase();

  if (POOR_PHOTO_VALUES.includes(overallQuality)) {
    reasons.push("The photos may be unclear and may need correcting.");
  } else {
    if (photoNeedsCorrection(extraction, "front")) {
      reasons.push("The front photo may need correcting.");
    }

    if (photoNeedsCorrection(extraction, "ingredients")) {
      reasons.push("The ingredient photo may need correcting.");
    }
  }

  return [...new Set(reasons)];
}

// ---------------------------------------------------------------------------
// SCREEN
// ---------------------------------------------------------------------------

export default function LabelReviewScreen({
  navigation,
  route,
}: any) {
  const {
    barcode,
    frontPhotoUri,
    ingredientsPhotoUri,
    extraction,
  } = route.params as ReviewRouteParams;

  const [brand, setBrand] = useState(
    extraction?.brand ?? ""
  );

  const [productName, setProductName] = useState(
    extraction?.product_name ?? ""
  );

  const [variant, setVariant] = useState(
    extraction?.variant ?? ""
  );

  const [ingredients, setIngredients] = useState(
    extraction?.ingredients ?? ""
  );

  const [contains, setContains] = useState(
    extraction?.contains ?? ""
  );

  const [mayContain, setMayContain] = useState(
    extraction?.may_contain ?? ""
  );

  // Full-screen photo zoom. Photos are never changed or uploaded.
  const [zoomImageUri, setZoomImageUri] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(MIN_ZOOM);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Supports both an array and an older string response.
  const unclearItems: string[] = Array.isArray(
    extraction?.unclear_text
  )
    ? extraction.unclear_text
        .map((item) => String(item).trim())
        .filter(Boolean)
    : extraction?.unclear_text
      ? String(extraction.unclear_text)
          .split(/[,;\n]+/)
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  // Decided once from the original extraction.
  const reviewReasons = useMemo(
    () => reviewReasonsFor(extraction, unclearItems.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extraction]
  );

  const needsReview = reviewReasons.length > 0;

  function buildProduct() {
    return {
      barcode: barcode ?? null,
      brand: brand.trim(),
      productName: productName.trim(),
      variant: variant.trim(),
      ingredients: ingredients.trim(),
      contains: contains.trim(),
      mayContain: mayContain.trim(),
      frontPhotoUri,
      ingredientsPhotoUri,
      source: "AI photo extraction",
    };
  }

  function goToAnalysis(replace: boolean) {
    const params = { product: buildProduct() };

    if (replace && typeof navigation.replace === "function") {
      navigation.replace("AnalysisResults", params);
    } else {
      navigation.navigate("AnalysisResults", params);
    }
  }

  // No concern: skip this screen and continue to the analysis.
  useEffect(() => {
    if (!needsReview) {
      goToAnalysis(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsReview]);

  function confirmAndAnalyze() {
    if (!ingredients.trim()) {
      Alert.alert(
        "Ingredients required",
        "Please review the ingredient list before continuing."
      );
      return;
    }

    // Alert buttons do not work on web, so web continues directly.
    if (Platform.OS === "web") {
      goToAnalysis(false);
      return;
    }

    Alert.alert(
      "Information confirmed",
      "The product is ready for allergy and halal analysis.",
      [
        {
          text: "Analyze",
          onPress: () => goToAnalysis(false),
        },
      ]
    );
  }

  // ----- Zoom viewer -----

  function openZoom(uri: string | null | undefined) {
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
            <Text style={styles.zoomTitle}>Zoom</Text>

            <TouchableOpacity
              style={styles.zoomCloseButton}
              onPress={closeZoom}
              activeOpacity={0.8}
              accessibilityLabel="Close zoom"
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
                  accessibilityLabel="Zoomed product photo"
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
              accessibilityLabel="Zoom out"
            >
              <Text style={styles.zoomControlText}>−</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setZoomScale(MIN_ZOOM)}
              accessibilityLabel="Reset zoom"
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
              accessibilityLabel="Zoom in"
            >
              <Text style={styles.zoomControlText}>+</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.zoomHelpText}>
            {Platform.OS === "ios"
              ? "Pinch or use − and + to zoom. Drag to move around."
              : "Use − and + to zoom. Drag to move around."}
          </Text>
        </View>
      </Modal>
    );
  }

  // While skipping straight to the analysis.
  if (!needsReview) {
    return (
      <SafeAreaView style={[styles.page, styles.centerPage]}>
        <ActivityIndicator size="large" color="#258D4D" />
        <Text style={styles.subtitle}>Analyzing product...</Text>
      </SafeAreaView>
    );
  }

  const canConfirm = ingredients.trim().length > 0;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>
          Review product information
        </Text>

        <Text style={styles.subtitle}>
          Please check the information extracted from the package
          photos. Edit anything that looks incorrect.
        </Text>

        {/* Why this screen is being shown. */}
        <View style={styles.reasonBox}>
          <Text style={styles.reasonTitle}>
            Please check before we analyze
          </Text>

          {reviewReasons.map((reason, index) => (
            <Text key={`${reason}-${index}`} style={styles.reasonText}>
              • {reason}
            </Text>
          ))}
        </View>

        <Text style={styles.sectionTitle}>
          Front-package photo
        </Text>

        <TouchableOpacity
          onPress={() => openZoom(frontPhotoUri)}
          activeOpacity={0.85}
          accessibilityLabel="Zoom front package photo"
        >
          <Image
            source={{ uri: frontPhotoUri }}
            style={styles.photo}
          />
        </TouchableOpacity>

        <Text style={styles.zoomHint}>
          🔍 Tap the image to zoom
        </Text>

        <Text style={styles.sectionTitle}>
          Ingredient-label photo
        </Text>

        <TouchableOpacity
          onPress={() => openZoom(ingredientsPhotoUri)}
          activeOpacity={0.85}
          accessibilityLabel="Zoom ingredient label photo"
        >
          <Image
            source={{ uri: ingredientsPhotoUri }}
            style={styles.photo}
          />
        </TouchableOpacity>

        <Text style={styles.zoomHint}>
          🔍 Tap the image to zoom
        </Text>

        <View style={styles.confidenceBox}>
          <Text style={styles.confidenceLabel}>
            AI confidence
          </Text>

          <Text style={styles.confidenceValue}>
            {extraction?.confidence ?? "low"}
          </Text>
        </View>

        {unclearItems.length > 0 && (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>
              Please check these unclear items
            </Text>

            <Text style={styles.warningText}>
              {unclearItems.map((item, index) => (
                <Text key={`${item}-${index}`}>
                  {item}
                  {index < unclearItems.length - 1
                    ? "\n"
                    : ""}
                </Text>
              ))}
            </Text>
          </View>
        )}

        <Text style={styles.label}>Brand</Text>

        <TextInput
          style={styles.input}
          value={brand}
          onChangeText={setBrand}
          placeholder="Brand name"
          placeholderTextColor="#AAB8AE"
        />

        <Text style={styles.label}>Product name</Text>

        <TextInput
          style={styles.input}
          value={productName}
          onChangeText={setProductName}
          placeholder="Product name"
          placeholderTextColor="#AAB8AE"
        />

        <Text style={styles.label}>Variant</Text>

        <TextInput
          style={styles.input}
          value={variant}
          onChangeText={setVariant}
          placeholder="Variant or flavor"
          placeholderTextColor="#AAB8AE"
        />

        <Text style={styles.label}>Ingredients</Text>

        <TextInput
          style={styles.largeInput}
          value={ingredients}
          onChangeText={setIngredients}
          placeholder="Complete ingredient list"
          placeholderTextColor="#AAB8AE"
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>Contains</Text>

        <TextInput
          style={styles.input}
          value={contains}
          onChangeText={setContains}
          placeholder="Contains allergens"
          placeholderTextColor="#AAB8AE"
        />

        <Text style={styles.label}>May contain</Text>

        <TextInput
          style={styles.input}
          value={mayContain}
          onChangeText={setMayContain}
          placeholder="May contain allergens"
          placeholderTextColor="#AAB8AE"
        />

        <TouchableOpacity
          style={[
            styles.confirmButton,
            !canConfirm && styles.confirmButtonDisabled,
          ]}
          onPress={confirmAndAnalyze}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmButtonText}>
            Confirm and Analyze
          </Text>
        </TouchableOpacity>

        {!canConfirm && (
          <Text style={styles.note}>
            Type the ingredient list (or retake the photo) to continue.
          </Text>
        )}

        <TouchableOpacity
          style={styles.retakeButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Text style={styles.retakeButtonText}>
            Retake Photos
          </Text>
        </TouchableOpacity>

        <Text style={styles.note}>
          Always compare the extracted information with the
          physical package before confirming.
        </Text>
      </ScrollView>

      {renderZoomViewer()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F8FBF8",
  },

  centerPage: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  content: {
    padding: 22,
    paddingBottom: 45,
  },

  title: {
    color: "#176B43",
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 8,
  },

  subtitle: {
    color: "#63776B",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },

  reasonBox: {
    backgroundColor: "#FFF8E1",
    borderWidth: 1,
    borderColor: "#E0B83F",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },

  reasonTitle: {
    color: "#755000",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 6,
  },

  reasonText: {
    color: "#755000",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },

  sectionTitle: {
    color: "#163D2A",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 10,
    marginBottom: 8,
  },

  photo: {
    width: "100%",
    height: 190,
    borderRadius: 14,
    resizeMode: "cover",
    marginBottom: 6,
  },

  zoomHint: {
    color: "#63776B",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 12,
  },

  confidenceBox: {
    backgroundColor: "#EAF5ED",
    borderRadius: 12,
    padding: 13,
    marginVertical: 12,
  },

  confidenceLabel: {
    color: "#63776B",
    fontSize: 13,
  },

  confidenceValue: {
    color: "#176B43",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 3,
    textTransform: "capitalize",
  },

  label: {
    color: "#264C37",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 13,
    marginBottom: 7,
  },

  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#DCE5DE",
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    color: "#1D3829",
    fontSize: 14,
  },

  largeInput: {
    minHeight: 150,
    borderWidth: 1,
    borderColor: "#DCE5DE",
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#1D3829",
    fontSize: 14,
    lineHeight: 21,
  },

  warningBox: {
    backgroundColor: "#FFF5DF",
    borderRadius: 12,
    padding: 14,
    marginTop: 18,
  },

  warningTitle: {
    color: "#9A6500",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6,
  },

  warningText: {
    color: "#755000",
    fontSize: 13,
    lineHeight: 20,
  },

  confirmButton: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: "#258D4D",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },

  confirmButtonDisabled: {
    backgroundColor: "#9DB8A8",
  },

  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  retakeButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#258D4D",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },

  retakeButtonText: {
    color: "#258D4D",
    fontSize: 15,
    fontWeight: "700",
  },

  note: {
    color: "#63776B",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 20,
  },

  disabledButton: {
    opacity: 0.45,
  },

  // Zoom viewer.
  zoomPage: {
    flex: 1,
    backgroundColor: "#000000",
  },

  zoomTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 54 : 24,
    paddingBottom: 10,
  },

  zoomTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },

  zoomCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  zoomCloseText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },

  zoomScroll: {
    flex: 1,
  },

  zoomScrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },

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

  zoomControlText: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 30,
  },

  zoomLevelText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    minWidth: 54,
    textAlign: "center",
  },

  zoomHelpText: {
    color: "#C7D0C8",
    fontSize: 12,
    textAlign: "center",
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 34 : 18,
  },
});