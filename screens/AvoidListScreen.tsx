import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import BottomNavigation from "../components/BottomNavigation";
import { supabase } from "../lib/supabase";

type AvoidItem = {
  id: string;
  barcode: string | null;
  product_name: string | null;
  brand_name: string | null;
  variant: string | null;
  ingredients_text: string | null;
  contains_text: string | null;
  may_contain_text: string | null;
  save_reason: string | null;
  halal_status: string | null;
  source: string | null;
  front_photo_url: string | null;
  ingredients_photo_url: string | null;
  created_at: string;
};

type ShareFormat = "pdf" | "text";

type PdfAvoidItem = {
  product_name: string | null;
  brand_name: string | null;
  variant: string | null;
  barcode: string | null;
  save_reason: string | null;
  contains_text: string | null;
  may_contain_text: string | null;
  halal_status: string | null;
  ingredients_text: string | null;
  imageDataUrl?: string | null;
};

// ---------------------------------------------------------------------------
// CROSS-PLATFORM MESSAGES
// Alert.alert with buttons does nothing on web, so web uses the browser's
// own confirm / alert dialogs.
// ---------------------------------------------------------------------------

function showMessage(title: string, message: string) {
  if (Platform.OS === "web") {
    (globalThis as any).alert?.(`${title}\n\n${message}`);
    return;
  }

  Alert.alert(title, message);
}

function confirmAction(
  title: string,
  message: string,
  confirmText: string
): Promise<boolean> {
  if (Platform.OS === "web") {
    const confirmed = (globalThis as any).confirm?.(
      `${title}\n\n${message}`
    );
    return Promise.resolve(confirmed === true);
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => resolve(false),
        },
        {
          text: confirmText,
          style: "destructive",
          onPress: () => resolve(true),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => resolve(false),
      }
    );
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// TEXT SHARING (compact summary)
// Per product: number + name, brand, variant (if any), contains,
// may contain, and halal screening (only when halal screening is on).
// No barcode, reasons, ingredients, findings or dates.
// ---------------------------------------------------------------------------

// Trimmed single-line text.
function cleanLine(value: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

// Comma-separated list without repeated items, ending with a full stop.
// Empty lists become "None recorded."
function cleanList(value: string | null): string {
  const seen = new Set<string>();

  const items = cleanLine(value)
    .split(/[,;]+/)
    .map((item) => item.trim().replace(/[.]+$/, "").trim())
    .filter((item) => {
      const key = item.toLowerCase();

      if (!item || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });

  return items.length > 0 ? `${items.join(", ")}.` : "None recorded.";
}

// Halal status values that only mean "not checked".
const HALAL_NOT_SELECTED = /halal screening not selected/i;

function buildShareText(
  selectedItems: AvoidItem[],
  prefersHalal: boolean
): string {
  const divider = "━━━━━━━━━━━━━━━━━━━━";

  const sections = selectedItems.map((item, index) => {
    const name = (
      cleanLine(item.product_name) || "Unnamed product"
    ).toUpperCase();

    const lines = [
      divider,
      `${index + 1}. ${name}`,
      divider,
      `Brand: ${cleanLine(item.brand_name) || "Not recorded"}`,
    ];

    const variant = cleanLine(item.variant);

    if (variant) {
      lines.push(`Variant: ${variant}`);
    }

    lines.push(
      `Contains: ${cleanList(item.contains_text)}`,
      `May contain: ${cleanList(item.may_contain_text)}`
    );

    if (prefersHalal) {
      const halal = cleanLine(item.halal_status);

      lines.push(
        `Halal screening: ${
          halal && !HALAL_NOT_SELECTED.test(halal)
            ? halal
            : "Not recorded"
        }`
      );
    }

    return lines.join("\n");
  });

  const count = selectedItems.length;

  return [
    "LabelLens – My Avoid List",
    `${count} product${count === 1 ? "" : "s"}`,
    "",
    sections.join("\n\n"),
    "",
    "Created with LabelLens.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// PDF DATA
// ---------------------------------------------------------------------------

// Loads the user's allergy profile and halal setting
// (used by the PDF summary page and the text summary).
async function loadPdfProfile(): Promise<{
  allergies: string[];
  prefersHalal: boolean;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { allergies: [], prefersHalal: false };
    }

    const { data, error } = await supabase
      .from("user_preferences")
      .select("allergies, other_allergy, prefers_halal")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const allergies: string[] = Array.isArray(data?.allergies)
      ? data.allergies
          .filter((item: unknown): item is string => typeof item === "string")
          .map((item: string) => item.trim())
          .filter(Boolean)
      : [];

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
  } catch (error) {
    console.warn("PDF profile could not be loaded:", error);
    return { allergies: [], prefersHalal: false };
  }
}

// Downloads one photo and converts it to a base64 data URL.
// Returns null if the photo cannot be loaded.
async function photoToDataUrl(url: string): Promise<string | null> {
  if (url.startsWith("data:image/")) {
    return url;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();

    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });

    // Only real data URLs are used; anything else shows the placeholder.
    if (!dataUrl || !dataUrl.startsWith("data:")) {
      return null;
    }

    // Some servers send images as "application/octet-stream".
    return dataUrl.replace(
      /^data:(application\/octet-stream|binary\/octet-stream)?;/,
      "data:image/jpeg;"
    );
  } catch {
    return null;
  }
}

// Adds a base64 front photo to every selected product.
// Supabase Storage photos are already signed https URLs at this point;
// Open Food Facts URLs are used directly. null = "Image unavailable".
async function toPdfItems(
  selectedItems: AvoidItem[]
): Promise<PdfAvoidItem[]> {
  return Promise.all(
    selectedItems.map(async (item) => {
      const url = item.front_photo_url?.trim();

      let imageDataUrl: string | null = null;

      if (url) {
        imageDataUrl = await photoToDataUrl(url);
      }

      return {
        product_name: item.product_name,
        brand_name: item.brand_name,
        variant: item.variant,
        barcode: item.barcode,
        save_reason: item.save_reason,
        contains_text: item.contains_text,
        may_contain_text: item.may_contain_text,
        halal_status: item.halal_status,
        ingredients_text: item.ingredients_text,
        imageDataUrl,
      };
    })
  );
}

// ---------------------------------------------------------------------------
// PDF HTML
// ---------------------------------------------------------------------------

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function shortenIngredients(
  value: string | null
): string {
  const text = String(value ?? "").trim();

  if (text.length <= 420) {
    return text;
  }

  return `${text.slice(0, 420).trim()}...`;
}

function createAvoidListPdfHtml(
  items: PdfAvoidItem[],
  allergies: string[],
  prefersHalal: boolean
): string {
  const productSummary = items
    .map((item, index) => {
      const productName =
        item.product_name || "Unnamed product";

      const brand = item.brand_name
        ? ` — ${item.brand_name}`
        : "";

      return `
        <div class="summary-product">
          <strong>${index + 1}.</strong>
          ${escapeHtml(productName)}
          ${escapeHtml(brand)}
        </div>
      `;
    })
    .join("");

  const productPages = items
    .map((item, index) => {
      const productName =
        item.product_name || "Unnamed product";

      const image = item.imageDataUrl
        ? `
          <img
            class="product-image"
            src="${item.imageDataUrl}"
            alt="Product image"
          >
        `
        : `
          <div class="image-placeholder">
            Image unavailable
          </div>
        `;

      return `
        <section class="product-page">
          <div class="product-card">
            ${image}

            <h2>
              ${index + 1}. ${escapeHtml(productName)}
            </h2>

            ${
              item.brand_name
                ? `<p><strong>Brand:</strong>
                    ${escapeHtml(item.brand_name)}</p>`
                : ""
            }

            ${
              item.variant
                ? `<p><strong>Variant:</strong>
                    ${escapeHtml(item.variant)}</p>`
                : ""
            }

            ${
              item.barcode
                ? `<p><strong>Barcode:</strong>
                    ${escapeHtml(item.barcode)}</p>`
                : ""
            }

            ${
              item.save_reason
                ? `
                  <div class="warning-box">
                    <strong>Why it was saved:</strong>
                    <br>
                    ${escapeHtml(item.save_reason)}
                  </div>
                `
                : ""
            }

            ${
              item.contains_text
                ? `
                  <p>
                    <strong>Contains:</strong>
                    ${escapeHtml(item.contains_text)}
                  </p>
                `
                : ""
            }

            ${
              item.may_contain_text
                ? `
                  <p>
                    <strong>May contain:</strong>
                    ${escapeHtml(item.may_contain_text)}
                  </p>
                `
                : ""
            }

            ${
              item.halal_status
                ? `
                  <p>
                    <strong>Halal screening:</strong>
                    ${escapeHtml(item.halal_status)}
                  </p>
                `
                : ""
            }

            ${
              item.ingredients_text
                ? `
                  <div class="ingredients-box">
                    <strong>Ingredients:</strong>
                    <br>
                    ${escapeHtml(
                      shortenIngredients(
                        item.ingredients_text
                      )
                    )}
                  </div>
                `
                : ""
            }
          </div>
        </section>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>LabelLens Avoid List</title>

  <style>
    @page {
      size: A4;
      margin: 24px;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: #173d2a;
      background: #ffffff;
      font-family: Arial, sans-serif;
      font-size: 11px;
    }

    .summary-page {
      min-height: 100vh;
      padding: 4px 0;
    }

    .title {
      color: #176b43;
      font-size: 24px;
      font-weight: 800;
      margin: 0 0 5px;
    }

    .selected-count {
      color: #40584a;
      font-size: 11px;
      margin-bottom: 22px;
    }

    .summary-box {
      border: 1px solid #d7e3da;
      border-radius: 8px;
      padding: 13px;
      margin-bottom: 12px;
    }

    .summary-heading {
      color: #176b43;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.4px;
      margin-bottom: 5px;
    }

    .summary-text {
      color: #1d3829;
      font-size: 11px;
      line-height: 1.5;
    }

    .products-heading {
      color: #176b43;
      font-size: 14px;
      font-weight: 800;
      border-bottom: 2px solid #176b43;
      padding-bottom: 5px;
      margin-top: 25px;
      margin-bottom: 7px;
    }

    .summary-product {
      color: #1d3829;
      font-size: 11px;
      padding: 6px 0;
      border-bottom: 1px solid #e4ebe6;
    }

    .footer {
      border-top: 1px solid #d7e3da;
      margin-top: 20px;
      padding-top: 10px;
      color: #176b43;
      font-size: 9px;
      line-height: 1.4;
    }

    .footer-note {
      color: #40584a;
    }

    .product-page {
      page-break-before: always;
      padding-top: 4px;
    }

    .product-card {
      border: 1px solid #d7e3da;
      border-radius: 9px;
      padding: 14px;
      page-break-inside: avoid;
    }

    .product-image {
      display: block;
      width: 150px;
      height: 150px;
      object-fit: contain;
      margin: 0 auto 14px;
      border-radius: 8px;
      background: #f1f5f2;
    }

    .image-placeholder {
      width: 150px;
      height: 150px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      margin: 0 auto 14px;
      border-radius: 8px;
      background: #f1f5f2;
      color: #738277;
      font-size: 11px;
    }

    h2 {
      color: #176b43;
      font-size: 18px;
      margin: 0 0 12px;
    }

    p {
      color: #1d3829;
      font-size: 11px;
      line-height: 1.5;
      margin: 7px 0;
    }

    .warning-box {
      background: #fff3d6;
      border-radius: 7px;
      padding: 9px;
      margin: 12px 0;
      color: #604b00;
      line-height: 1.5;
    }

    .ingredients-box {
      border: 1px solid #d7e3da;
      border-radius: 7px;
      padding: 9px;
      margin-top: 12px;
      color: #1d3829;
      font-size: 10px;
      line-height: 1.5;
    }
  </style>
</head>

<body>
  <section class="summary-page">
    <h1 class="title">LabelLens Avoid List</h1>

    <div class="selected-count">
      ${items.length} product${
        items.length === 1 ? "" : "s"
      } selected
    </div>

    <div class="summary-box">
      <div class="summary-heading">
        ALLERGY PROFILE
      </div>

      <div class="summary-text">
        ${
          allergies.length > 0
            ? escapeHtml(allergies.join(", "))
            : "No allergies recorded"
        }
      </div>
    </div>

    <div class="summary-box">
      <div class="summary-heading">
        HALAL SCREENING
      </div>

      <div class="summary-text">
        ${prefersHalal ? "On" : "Off"}
      </div>
    </div>

    <div class="products-heading">
      Selected products
    </div>

    ${productSummary}

    <div class="footer">
      <strong>Generated by LabelLens.</strong>
      <br>
      <span class="footer-note">
        This information is for screening support only.
        Always check the physical package.
      </span>
    </div>
  </section>

  ${productPages}
</body>
</html>
  `;
}

// Web: expo-print cannot create a PDF file in the browser, so the
// formatted list opens in the browser print window ("Save as PDF").
function printHtmlOnWeb(html: string) {
  const doc = (globalThis as any).document;

  if (!doc?.body) {
    throw new Error("PDF sharing is not available in this browser.");
  }

  const iframe = doc.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  doc.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = frameWindow?.document;

  if (!frameWindow || !frameDoc) {
    iframe.remove();
    throw new Error("PDF sharing is not available in this browser.");
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  const cleanUp = () => {
    try {
      iframe.remove();
    } catch {
      // already removed
    }
  };

  frameWindow.onafterprint = cleanUp;
  setTimeout(cleanUp, 120000);

  // Photos are data URLs, so a short delay is enough for them to render.
  setTimeout(() => {
    frameWindow.focus();
    frameWindow.print();
  }, 400);
}

// ---------------------------------------------------------------------------
// SCREEN
// ---------------------------------------------------------------------------

export default function AvoidListScreen({
  navigation,
}: any) {
  const [items, setItems] = useState<AvoidItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [searchText, setSearchText] = useState("");
  const [selectedItem, setSelectedItem] =
    useState<AvoidItem | null>(null);
  const [shareVisible, setShareVisible] =
    useState(false);
  const [selectedIds, setSelectedIds] =
    useState<string[]>([]);
  const [sharingFormat, setSharingFormat] =
    useState<ShareFormat | null>(null);
  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const loadAvoidList = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Your login session expired. Please log in again."
        );
      }

      const { data, error } = await supabase
        .from("avoid_list")
        .select(
          `
          id,
          barcode,
          product_name,
          brand_name,
          variant,
          ingredients_text,
          contains_text,
          may_contain_text,
          save_reason,
          halal_status,
          source,
          front_photo_url,
          ingredients_photo_url,
          created_at
        `
        )
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as AvoidItem[];

      const withPhotoUrls = await Promise.all(
        rows.map(async (item) => {
          let frontPhotoUrl =
            item.front_photo_url;

          let ingredientsPhotoUrl =
            item.ingredients_photo_url;

          // Storage paths become signed URLs.
          // Open Food Facts https URLs are used as they are.
          if (
            frontPhotoUrl &&
            !frontPhotoUrl.startsWith("http")
          ) {
            const { data: signedPhoto } =
              await supabase.storage
                .from("avoid-products")
                .createSignedUrl(
                  frontPhotoUrl,
                  3600
                );

            frontPhotoUrl =
              signedPhoto?.signedUrl ?? null;
          }

          if (
            ingredientsPhotoUrl &&
            !ingredientsPhotoUrl.startsWith("http")
          ) {
            const { data: signedPhoto } =
              await supabase.storage
                .from("avoid-products")
                .createSignedUrl(
                  ingredientsPhotoUrl,
                  3600
                );

            ingredientsPhotoUrl =
              signedPhoto?.signedUrl ?? null;
          }

          return {
            ...item,
            front_photo_url: frontPhotoUrl,
            ingredients_photo_url:
              ingredientsPhotoUrl,
          };
        })
      );

      setItems(withPhotoUrls);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load Avoid List."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadAvoidList();
    }, [loadAvoidList])
  );

  const filteredItems = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    if (!query) {
      return items;
    }

    return items.filter((item) =>
      [
        item.product_name,
        item.brand_name,
        item.variant,
        item.barcode,
        item.ingredients_text,
        item.contains_text,
        item.may_contain_text,
        item.halal_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [items, searchText]);

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter(
            (selectedId) => selectedId !== id
          )
        : [...current, id]
    );
  }

  function selectAll() {
    setSelectedIds(
      filteredItems.map((item) => item.id)
    );
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  // -------------------------------------------------------------------------
  // DELETE (only from the trash icon on each card)
  // -------------------------------------------------------------------------

  async function deleteItem(item: AvoidItem) {
    if (deletingId) {
      return;
    }

    const confirmed = await confirmAction(
      "Delete product",
      `Remove ${
        item.product_name || "this product"
      } from your Avoid List?`,
      "Delete"
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(item.id);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "Your login session expired. Please log in again."
        );
      }

      const {
        data: deletedRows,
        error,
      } = await supabase
        .from("avoid_list")
        .delete()
        .eq("id", item.id)
        .eq("user_id", user.id)
        .select("id");

      if (error) {
        throw error;
      }

      if (!deletedRows || deletedRows.length === 0) {
        throw new Error(
          "The product was not deleted. Check the Avoid List delete policy."
        );
      }

      setItems((current) =>
        current.filter(
          (currentItem) =>
            currentItem.id !== item.id
        )
      );

      setSelectedIds((current) =>
        current.filter(
          (selectedId) => selectedId !== item.id
        )
      );

      setSelectedItem(null);

      showMessage(
        "Deleted",
        "The product was removed from your Avoid List."
      );
    } catch (error) {
      console.error("Avoid List delete failed:", error);

      showMessage(
        "Could not delete",
        error instanceof Error
          ? error.message
          : (error as any)?.message || "Please try again."
      );
    } finally {
      setDeletingId(null);
    }
  }

  // -------------------------------------------------------------------------
  // SHARE
  // -------------------------------------------------------------------------

  function getSelectedItems(): AvoidItem[] {
    return items.filter((item) =>
      selectedIds.includes(item.id)
    );
  }

  async function shareAsText(selectedItems: AvoidItem[]) {
    // The halal line is only included when halal screening is on.
    const profile = await loadPdfProfile();
    const message = buildShareText(selectedItems, profile.prefersHalal);

    if (Platform.OS === "web") {
      const nav = (globalThis as any).navigator;

      if (nav?.share) {
        try {
          await nav.share({
            title: "LabelLens Avoid List",
            text: message,
          });
          return;
        } catch (error: any) {
          if (error?.name === "AbortError") {
            return; // user closed the share sheet
          }
        }
      }

      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(message);
        showMessage(
          "Copied",
          "This browser cannot share directly, so the list was copied. Paste it into any app."
        );
        return;
      }

      throw new Error("Sharing is not available in this browser.");
    }

    await Share.share({
      title: "LabelLens Avoid List",
      message,
    });
  }

  async function shareAsPdf(selectedItems: AvoidItem[]) {
    // A missing or broken photo never stops the PDF.
    const [pdfItems, profile] = await Promise.all([
      toPdfItems(selectedItems).catch((error) => {
        console.warn("PDF photos could not be loaded:", error);
        return selectedItems.map((item) => ({
          ...item,
          imageDataUrl: null,
        })) as PdfAvoidItem[];
      }),
      loadPdfProfile(),
    ]);

    const html = createAvoidListPdfHtml(
      pdfItems,
      profile.allergies,
      profile.prefersHalal
    );

    if (Platform.OS === "web") {
      printHtmlOnWeb(html);
      return;
    }

    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    const canShare = await Sharing.isAvailableAsync();

    if (!canShare) {
      throw new Error("Sharing is not available on this device.");
    }

    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: "Share Avoid List",
    });
  }

  async function shareSelectedItems(format: ShareFormat) {
    if (sharingFormat) {
      return;
    }

    const selectedItems = getSelectedItems();

    if (selectedItems.length === 0) {
      showMessage(
        "Nothing selected",
        "Select at least one product first."
      );
      return;
    }

    setSharingFormat(format);

    try {
      // On phones, the share sheet cannot open on top of the popup,
      // so the popup closes first.
      if (Platform.OS !== "web") {
        setShareVisible(false);
        await wait(350);
      }

      if (format === "pdf") {
        await shareAsPdf(selectedItems);
      } else {
        await shareAsText(selectedItems);
      }

      setShareVisible(false);
      clearSelection();
    } catch (error) {
      console.error("Avoid List share failed:", error);

      showMessage(
        "Could not share",
        error instanceof Error
          ? error.message
          : "Please try again."
      );
    } finally {
      setSharingFormat(null);
    }
  }

  const allSelected =
    filteredItems.length > 0 &&
    selectedIds.length === filteredItems.length;

  const shareDisabled =
    selectedIds.length === 0 || sharingFormat !== null;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>
              My Avoid List
            </Text>

            <Text style={styles.subtitle}>
              Products saved because they may not match
              your preferences.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.shareButton}
            onPress={() => setShareVisible(true)}
          >
            <Ionicons
              name="share-outline"
              size={17}
              color="#176B43"
            />

            <Text style={styles.shareButtonText}>
              Share
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBox}>
          <Ionicons
            name="search-outline"
            size={20}
            color="#176B43"
          />

          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search your Avoid List"
            placeholderTextColor="#8A9A91"
          />
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator
              size="large"
              color="#258D4D"
            />

            <Text style={styles.loadingText}>
              Loading Avoid List...
            </Text>
          </View>
        ) : null}

        {!loading && errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>
              Could not load Avoid List
            </Text>

            <Text style={styles.errorText}>
              {errorMessage}
            </Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => void loadAvoidList()}
            >
              <Text style={styles.retryText}>
                Try Again
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading &&
        !errorMessage &&
        filteredItems.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons
              name="receipt-outline"
              size={40}
              color="#8A9A91"
            />

            <Text style={styles.emptyTitle}>
              {searchText.trim()
                ? "No matching products"
                : "Your Avoid List is empty"}
            </Text>

            <Text style={styles.emptyText}>
              {searchText.trim()
                ? "Try another search."
                : "Products you save will appear here."}
            </Text>
          </View>
        ) : null}

        {!loading &&
          !errorMessage &&
          filteredItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => setSelectedItem(item)}
            >
              {item.front_photo_url ? (
                <Image
                  source={{
                    uri: item.front_photo_url,
                  }}
                  style={styles.productImage}
                />
              ) : (
                <View style={styles.imageFallback}>
                  <Ionicons
                    name="image-outline"
                    size={27}
                    color="#8A9A91"
                  />
                </View>
              )}

              <View style={styles.cardInfo}>
                <Text
                  style={styles.productName}
                  numberOfLines={2}
                >
                  {item.product_name ||
                    "Unnamed product"}
                </Text>

                <Text
                  style={styles.brandName}
                  numberOfLines={1}
                >
                  {item.brand_name ||
                    "Brand unavailable"}
                </Text>

                {item.save_reason ? (
                  <View style={styles.reasonBadge}>
                    <Ionicons
                      name="warning-outline"
                      size={13}
                      color="#B3261E"
                    />

                    <Text
                      style={styles.reasonText}
                      numberOfLines={2}
                    >
                      {item.save_reason}
                    </Text>
                  </View>
                ) : null}
              </View>

              <TouchableOpacity
                style={styles.deleteIconButton}
                disabled={deletingId === item.id}
                onPress={(event) => {
                  event.stopPropagation();
                  void deleteItem(item);
                }}
              >
                {deletingId === item.id ? (
                  <ActivityIndicator
                    size="small"
                    color="#B3261E"
                  />
                ) : (
                  <Ionicons
                    name="trash-outline"
                    size={21}
                    color="#B3261E"
                  />
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          ))}

        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => navigation.navigate("Home")}
        >
          <Ionicons
            name="scan-outline"
            size={18}
            color="#FFFFFF"
          />

          <Text style={styles.scanButtonText}>
            Scan another product
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomNavigation
        navigation={navigation}
        activeTab="Avoid"
      />

      {/* ----- Product details (view only; delete is on the card) ----- */}
      <Modal
        visible={selectedItem !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.detailsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Product details
              </Text>

              <TouchableOpacity
                onPress={() => setSelectedItem(null)}
              >
                <Ionicons
                  name="close"
                  size={25}
                  color="#163D2A"
                />
              </TouchableOpacity>
            </View>

            {selectedItem ? (
              <ScrollView contentContainerStyle={styles.detailsContent}>
                {selectedItem.front_photo_url ? (
                  <Image
                    source={{
                      uri: selectedItem.front_photo_url,
                    }}
                    style={styles.detailsImage}
                  />
                ) : null}

                <Text style={styles.detailsName}>
                  {selectedItem.product_name ||
                    "Unnamed product"}
                </Text>

                <Text style={styles.detailsBrand}>
                  {selectedItem.brand_name ||
                    "Brand unavailable"}
                </Text>

                {selectedItem.variant ? (
                  <Text style={styles.detailText}>
                    Variant: {selectedItem.variant}
                  </Text>
                ) : null}

                {selectedItem.barcode ? (
                  <Text style={styles.detailText}>
                    Barcode: {selectedItem.barcode}
                  </Text>
                ) : null}

                <Text style={styles.detailHeading}>
                  Why it was saved
                </Text>

                <Text style={styles.detailText}>
                  {selectedItem.save_reason ||
                    "Saved from product analysis."}
                </Text>

                <Text style={styles.detailHeading}>
                  Halal screening
                </Text>

                <Text style={styles.halalText}>
                  {selectedItem.halal_status ||
                    "Halal status was not recorded for this product."}
                </Text>

                <Text style={styles.detailHeading}>
                  Contains
                </Text>

                <Text style={styles.detailText}>
                  {selectedItem.contains_text ||
                    "None recorded."}
                </Text>

                <Text style={styles.detailHeading}>
                  May contain
                </Text>

                <Text style={styles.detailText}>
                  {selectedItem.may_contain_text ||
                    "None recorded."}
                </Text>

                <Text style={styles.detailHeading}>
                  Ingredients
                </Text>

                <Text style={styles.detailText}>
                  {selectedItem.ingredients_text ||
                    "Ingredients unavailable."}
                </Text>

                {selectedItem.ingredients_photo_url ? (
                  <Image
                    source={{
                      uri: selectedItem.ingredients_photo_url,
                    }}
                    style={styles.detailsImage}
                  />
                ) : null}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ----- Share popup (checkboxes only here) ----- */}
      <Modal
        visible={shareVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setShareVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.shareModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Share Avoid List
              </Text>

              <TouchableOpacity
                onPress={() => setShareVisible(false)}
              >
                <Ionicons
                  name="close"
                  size={25}
                  color="#163D2A"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.shareSubtitle}>
              Select products to share.
            </Text>

            <TouchableOpacity
              style={styles.selectAll}
              onPress={() => {
                if (allSelected) {
                  clearSelection();
                } else {
                  selectAll();
                }
              }}
            >
              <Ionicons
                name={
                  allSelected
                    ? "checkbox"
                    : "square-outline"
                }
                size={22}
                color="#176B43"
              />

              <Text style={styles.selectAllText}>
                Select all
              </Text>
            </TouchableOpacity>

            <ScrollView style={styles.shareItems}>
              {filteredItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.shareItem}
                  onPress={() =>
                    toggleSelected(item.id)
                  }
                >
                  <Ionicons
                    name={
                      selectedIds.includes(item.id)
                        ? "checkbox"
                        : "square-outline"
                    }
                    size={22}
                    color={
                      selectedIds.includes(item.id)
                        ? "#176B43"
                        : "#8A9A91"
                    }
                  />

                  <Text style={styles.shareItemText}>
                    {item.product_name ||
                      "Unnamed product"}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.selectedCount}>
              {selectedIds.length} of {filteredItems.length}{" "}
              selected
            </Text>

            <View style={styles.shareFormatRow}>
              <TouchableOpacity
                style={[
                  styles.shareSelectedButton,
                  styles.shareFormatButton,
                  shareDisabled && styles.disabledButton,
                ]}
                onPress={() => void shareSelectedItems("pdf")}
                disabled={shareDisabled}
              >
                {sharingFormat === "pdf" ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color="#FFFFFF"
                  />
                )}

                <Text style={styles.shareSelectedText}>
                  Share as PDF
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.shareTextButton,
                  styles.shareFormatButton,
                  shareDisabled && styles.disabledButton,
                ]}
                onPress={() => void shareSelectedItems("text")}
                disabled={shareDisabled}
              >
                {sharingFormat === "text" ? (
                  <ActivityIndicator
                    size="small"
                    color="#176B43"
                  />
                ) : (
                  <Ionicons
                    name="chatbox-ellipses-outline"
                    size={18}
                    color="#176B43"
                  />
                )}

                <Text style={styles.shareTextButtonText}>
                  Share as text
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F8FBF8",
  },

  content: {
    padding: 14,
    paddingBottom: 28,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 15,
  },

  headerText: {
    flex: 1,
    paddingRight: 10,
  },

  title: {
    color: "#176B43",
    fontSize: 25,
    fontWeight: "800",
  },

  subtitle: {
    color: "#63776B",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },

  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    gap: 5,
  },

  shareButtonText: {
    color: "#176B43",
    fontSize: 12,
    fontWeight: "800",
  },

  searchBox: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D6E1D9",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },

  searchInput: {
    flex: 1,
    color: "#1D3829",
    fontSize: 14,
    marginLeft: 8,
  },

  centerBox: {
    alignItems: "center",
    paddingVertical: 35,
  },

  loadingText: {
    color: "#63776B",
    marginTop: 10,
  },

  errorBox: {
    backgroundColor: "#FFF0EE",
    borderWidth: 1,
    borderColor: "#F04438",
    borderRadius: 12,
    padding: 15,
  },

  errorTitle: {
    color: "#B3261E",
    fontSize: 16,
    fontWeight: "800",
  },

  errorText: {
    color: "#7A271A",
    marginTop: 6,
  },

  retryButton: {
    minHeight: 43,
    backgroundColor: "#258D4D",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },

  retryText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  emptyBox: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 30,
  },

  emptyTitle: {
    color: "#176B43",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 10,
  },

  emptyText: {
    color: "#63776B",
    marginTop: 5,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE7E0",
    borderRadius: 14,
    padding: 11,
    marginBottom: 10,
  },

  productImage: {
    width: 58,
    height: 58,
    borderRadius: 10,
    backgroundColor: "#EEF4EF",
  },

  imageFallback: {
    width: 58,
    height: 58,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF4EF",
  },

  cardInfo: {
    flex: 1,
    marginLeft: 11,
  },

  productName: {
    color: "#163D2A",
    fontSize: 15,
    fontWeight: "800",
  },

  brandName: {
    color: "#63776B",
    fontSize: 12,
    marginTop: 3,
  },

  reasonBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FFE3E1",
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 7,
  },

  reasonText: {
    color: "#B3261E",
    fontSize: 11,
    marginLeft: 4,
    flexShrink: 1,
  },

  deleteIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF0EE",
    marginLeft: 6,
  },

  scanButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#258D4D",
    borderRadius: 10,
    marginTop: 8,
    gap: 7,
  },

  scanButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },

  detailsModal: {
    maxHeight: "90%",
    backgroundColor: "#F8FBF8",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
  },

  detailsContent: {
    paddingBottom: 24,
  },

  shareModal: {
    maxHeight: "78%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },

  modalTitle: {
    color: "#176B43",
    fontSize: 20,
    fontWeight: "800",
  },

  detailsImage: {
    width: "100%",
    height: 190,
    borderRadius: 14,
    resizeMode: "cover",
    marginBottom: 14,
    marginTop: 8,
  },

  detailsName: {
    color: "#163D2A",
    fontSize: 22,
    fontWeight: "800",
  },

  detailsBrand: {
    color: "#63776B",
    fontSize: 14,
    marginTop: 4,
  },

  detailHeading: {
    color: "#176B43",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 18,
    marginBottom: 5,
  },

  detailText: {
    color: "#1D3829",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },

  halalText: {
    color: "#8A6A00",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },

  shareSubtitle: {
    color: "#63776B",
    fontSize: 13,
    marginBottom: 12,
  },

  selectAll: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#DDE7E0",
    gap: 8,
  },

  selectAllText: {
    color: "#163D2A",
    fontWeight: "800",
  },

  shareItems: {
    maxHeight: 270,
  },

  shareItem: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF3EF",
    gap: 8,
  },

  shareItemText: {
    flex: 1,
    color: "#1D3829",
    fontSize: 13,
  },

  selectedCount: {
    color: "#176B43",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 12,
  },

  shareFormatRow: {
    flexDirection: "row",
    gap: 10,
  },

  shareFormatButton: {
    flex: 1,
    flexDirection: "row",
    gap: 7,
  },

  shareSelectedButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#258D4D",
    borderRadius: 10,
    marginTop: 15,
  },

  shareTextButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#258D4D",
    borderRadius: 10,
    marginTop: 15,
  },

  shareTextButtonText: {
    color: "#176B43",
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.45,
  },

  shareSelectedText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});