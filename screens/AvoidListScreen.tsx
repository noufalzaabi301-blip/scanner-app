// ---------------------------------------------------------------------------
// screens/AvoidListScreen.tsx
// The user's Avoid List: view, select, delete, and share as PDF or text.
//
// Sections: text sharing, PDF data, PDF HTML, web printing, then the screen.
// Labels in the shared text and PDF follow the selected language; product
// data (names, brands, ingredients, barcodes) is always shown as saved.
// ---------------------------------------------------------------------------

import { useFocusEffect } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Share,
  StyleSheet,
} from "react-native";

import BottomNavigation from "../components/BottomNavigation";
import { allergyLabelList, joinList } from "../lib/constants";
import {
  prepareAllergyLabels,
  translateFoodTexts,
  useFoodTranslator,
} from "../lib/foodTranslation";
import {
  getCurrentLanguage,
  translate,
  useI18n,
  type TFunction,
} from "../lib/i18n";
import { downloadPhotoAsDataUrl } from "../lib/photoStorage";
import { fetchOpenFoodFactsImage } from "../lib/productProviders";
import { cleanTagText } from "../lib/text";
import {
  localizeScreeningText,
  localizeSourceLabel,
} from "../lib/i18n/screeningText";
import { ITEM_SEPARATORS, splitTopLevel } from "../lib/screening";
import { supabase } from "../lib/supabase";
import { confirmAction, showMessage } from "../lib/ui/messages";
import { fetchCurrentUserPreferences } from "../lib/userPreferences";
import {
  DirectionView,
  Ionicons,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "../components/Themed";

// Translates engine/database sentences (statuses, reasons) for display.
type Localize = (text: string | null | undefined) => string;

// Translates label text (e.g. "Milk" → "حليب") for display.
type TrLabel = (text: string) => string;

const identity: TrLabel = (text) => text;

// Right-to-left mark: makes chat apps (WhatsApp etc.) show each Arabic line
// right-to-left even when it starts with English text or a number.
const RLM = "‏";

// save_reason is stored (in English) as
//   `${headline} — ${source}: "${statement}"` joined with "; ".
// It is split into separate lines so each one can be shown clearly.
type SavedReason = { headline: string; source: string; statement: string };

function parseReasons(value: string | null): SavedReason[] {
  return String(value ?? "")
    .split("; ")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const match =
        /^(.+?) — (Ingredients|Contains|May contain|Product name|Brand): "(.*)"$/.exec(
          segment
        );

      return match
        ? { headline: match[1], source: match[2], statement: match[3] }
        : { headline: segment, source: "", statement: "" };
    });
}

// Splits a Contains / May contain value into clean, de-duplicated items.
// Raw tags such as "en:milk" are cleaned first.
function labelItems(value: string | null): string[] {
  const seen = new Set<string>();

  return cleanTagText(value ?? "")
    .replace(/\s+/g, " ")
    .split(/\s*[,;،]+\s*/)
    .map((item) => item.replace(/[.]+$/, "").trim())
    .filter((item) => {
      const key = item.toLowerCase();

      if (!item || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

// Builds a translator for the Contains / May contain items of these
// products (identity in English; glossary + AI translation in Arabic).
async function labelTranslatorFor(items: AvoidItem[]): Promise<TrLabel> {
  if (getCurrentLanguage() !== "ar") {
    return identity;
  }

  const texts = items.flatMap((item) => [
    ...labelItems(item.contains_text),
    ...labelItems(item.may_contain_text),
  ]);

  try {
    const map = await translateFoodTexts(texts);
    return (text) => map.get(text.trim()) ?? text;
  } catch {
    return identity;
  }
}

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

type ShareFormat = "pdf" | "text" | "copy";

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
function cleanList(value: string | null, t: TFunction, tr: TrLabel): string {
  const items = labelItems(value);

  return items.length > 0
    ? `${joinList(items.map(tr))}.`
    : t("avoid.noneRecorded");
}

// Halal status values that only mean "not checked".
const HALAL_NOT_SELECTED = /halal screening not selected/i;

function buildShareText(
  selectedItems: AvoidItem[],
  prefersHalal: boolean,
  t: TFunction,
  localize: Localize,
  tr: TrLabel
): string {
  const divider = "━━━━━━━━━━━━━━━━━━━━";

  const sections = selectedItems.map((item, index) => {
    const name = (
      cleanLine(item.product_name) || t("avoid.unnamed")
    ).toUpperCase();

    const lines = [
      divider,
      `${index + 1}. ${name}`,
      divider,
      t("avoid.brandLine", {
        value: cleanLine(item.brand_name) || t("avoid.notRecorded"),
      }),
    ];

    const variant = cleanLine(item.variant);

    if (variant) {
      lines.push(t("avoid.variantLine", { value: variant }));
    }

    lines.push(
      t("avoid.containsLine", { value: cleanList(item.contains_text, t, tr) }),
      t("avoid.mayContainLine", {
        value: cleanList(item.may_contain_text, t, tr),
      })
    );

    if (prefersHalal) {
      const halal = cleanLine(item.halal_status);

      lines.push(
        t("avoid.halalLine", {
          value:
            halal && !HALAL_NOT_SELECTED.test(halal)
              ? localize(halal)
              : t("avoid.notRecorded"),
        })
      );
    }

    return lines.join("\n");
  });

  const count = selectedItems.length;

  const text = [
    t("avoid.shareTitle"),
    count === 1
      ? t("avoid.productCountOne")
      : t("avoid.productCountMany", { count }),
    "",
    sections.join("\n\n"),
    "",
    t("avoid.createdWith"),
  ].join("\n");

  // Arabic: force every line to read right-to-left in chat apps.
  return getCurrentLanguage() === "ar"
    ? text
        .split("\n")
        .map((line) => (line ? `${RLM}${line}` : line))
        .join("\n")
    : text;
}

// ---------------------------------------------------------------------------
// PDF DATA
// ---------------------------------------------------------------------------

// Loads the user's allergy profile and halal setting
// (used by the PDF summary page and the text summary).
// Falls back to "no allergies / halal off" so sharing never fails.
async function loadPdfProfile(): Promise<{
  allergies: string[];
  prefersHalal: boolean;
}> {
  try {
    const preferences = await fetchCurrentUserPreferences();

    // So the PDF lists the allergies in the selected language.
    await prepareAllergyLabels(preferences.allergies);

    return {
      allergies: preferences.allergies,
      prefersHalal: preferences.prefersHalal,
    };
  } catch (error) {
    console.warn("PDF profile could not be loaded:", error);
    return { allergies: [], prefersHalal: false };
  }
}

// Downloads one photo to a local file (phones) and converts it to a base64
// data URL for the PDF (lib/photoStorage.ts). Returns null if the photo
// cannot be downloaded, so the PDF shows "Image unavailable".
async function photoToDataUrl(url: string): Promise<string | null> {
  return downloadPhotoAsDataUrl(url, 10000);
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
        // Embedded copy first; if the photo cannot be downloaded (for
        // example a browser CORS block), the HTTPS link is used directly.
        imageDataUrl =
          (await photoToDataUrl(url)) ?? (url.startsWith("https://") ? url : null);
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

// One compact table for ALL selected products:
//   # | Photo | Product | Screening summary
// Rows never split across pages, the header row repeats on every page and
// the table simply continues onto the next page. Long explanations, full
// ingredients, "why it was saved" and dates are intentionally left out.
//
// `isRTL` sets the document direction for Arabic. Barcodes are wrapped in
// dir="ltr" and product text uses dir="auto" so Latin label text stays
// readable inside an Arabic page.
function createAvoidListPdfHtml(
  items: PdfAvoidItem[],
  allergies: string[],
  prefersHalal: boolean,
  t: TFunction,
  localize: Localize,
  isRTL: boolean,
  tr: TrLabel = identity
): string {
  const label = (key: Parameters<TFunction>[0]) => escapeHtml(t(key));

  const rows = items
    .map((item, index) => {
      const photo = item.imageDataUrl
        ? `<img class="photo" src="${item.imageDataUrl}" alt="${label(
            "pdf.productImage"
          )}">`
        : `<div class="no-photo">${label("pdf.imageUnavailable")}</div>`;

      const halal = String(item.halal_status ?? "").trim();
      const halalText =
        halal && !HALAL_NOT_SELECTED.test(halal)
          ? escapeHtml(localize(halal))
          : label("pdf.notRecorded");

      return `
        <tr>
          <td class="col-num">${index + 1}</td>
          <td class="col-photo">${photo}</td>
          <td class="col-product">
            <div class="name"><span dir="auto">${escapeHtml(
              item.product_name || t("avoid.unnamed")
            )}</span></div>
            <div class="line"><span class="lbl">${label("pdf.brand")}</span>
              <span dir="auto">${escapeHtml(
                item.brand_name || t("pdf.notRecorded")
              )}</span></div>
            ${
              item.variant
                ? `<div class="line"><span class="lbl">${label(
                    "pdf.variant"
                  )}</span> <span dir="auto">${escapeHtml(
                    item.variant
                  )}</span></div>`
                : ""
            }
            ${
              item.barcode
                ? `<div class="line"><span class="lbl">${label(
                    "pdf.barcode"
                  )}</span> <span dir="ltr">${escapeHtml(
                    item.barcode
                  )}</span></div>`
                : ""
            }
          </td>
          <td class="col-summary">
            <div class="line"><span class="lbl">${label("pdf.contains")}</span>
              <span dir="auto">${escapeHtml(
                labelItems(item.contains_text).length > 0
                  ? joinList(labelItems(item.contains_text).map(tr))
                  : t("pdf.noneRecorded")
              )}</span></div>
            <div class="line"><span class="lbl">${label("pdf.mayContain")}</span>
              <span dir="auto">${escapeHtml(
                labelItems(item.may_contain_text).length > 0
                  ? joinList(labelItems(item.may_contain_text).map(tr))
                  : t("pdf.noneRecorded")
              )}</span></div>
            <div class="line"><span class="lbl">${label("pdf.halal")}</span>
              ${halalText}</div>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html dir="${isRTL ? "rtl" : "ltr"}" lang="${isRTL ? "ar" : "en"}">
<head>
  <meta charset="UTF-8">
  <title>${label("pdf.docTitle")}</title>

  <style>
    @page { size: A4; margin: 22px; }

    /* Keep the green header and row shading when printing / saving PDF. */
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      margin: 0;
      color: #173d2a;
      background: #ffffff;
      font-family: Arial, "Geeza Pro", "Noto Naskh Arabic", Tahoma, sans-serif;
      font-size: 10.5px;
    }

    .title {
      color: #176b43;
      font-size: 22px;
      font-weight: 800;
      margin: 0 0 4px;
    }

    .selected-count {
      color: #40584a;
      font-size: 11px;
      margin-bottom: 12px;
    }

    .profile {
      display: flex;
      gap: 10px;
      margin-bottom: 14px;
    }

    .profile-box {
      flex: 1;
      border: 1px solid #d7e3da;
      border-radius: 7px;
      padding: 8px 10px;
    }

    .profile-heading {
      color: #176b43;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.4px;
      margin-bottom: 3px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    /* Repeat the header row on every printed page. */
    thead { display: table-header-group; }

    /* Keep each product in one piece; the table continues naturally. */
    tr { page-break-inside: avoid; break-inside: avoid; }

    th {
      background: #176b43;
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      text-align: start;
      padding: 7px 8px;
    }

    td {
      border-bottom: 1px solid #e1e9e3;
      padding: 8px;
      vertical-align: top;
      line-height: 1.45;
    }

    tbody tr:nth-child(even) td { background: #f7faf8; }

    .col-num { width: 26px; text-align: center; font-weight: 700; color: #176b43; }
    th.col-num { color: #ffffff; }
    .col-photo { width: 78px; }
    .col-product { width: 34%; }

    .photo {
      display: block;
      width: 62px;
      height: 62px;
      object-fit: contain;
      border-radius: 6px;
      background: #f1f5f2;
    }

    .no-photo {
      width: 62px;
      height: 62px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      border-radius: 6px;
      background: #f1f5f2;
      color: #738277;
      font-size: 8.5px;
      padding: 3px;
    }

    .name {
      color: #176b43;
      font-size: 12px;
      font-weight: 800;
      margin-bottom: 3px;
    }

    .line { color: #1d3829; margin: 2px 0; }

    .lbl { color: #40584a; font-weight: 700; }

    .footer {
      border-top: 1px solid #d7e3da;
      margin-top: 14px;
      padding-top: 8px;
      color: #40584a;
      font-size: 9px;
      line-height: 1.4;
    }

    .footer strong { color: #176b43; }
  </style>
</head>

<body>
  <h1 class="title">${label("pdf.docTitle")}</h1>

  <div class="selected-count">
    ${escapeHtml(
      items.length === 1
        ? t("pdf.selectedOne")
        : t("pdf.selectedMany", { count: items.length })
    )}
  </div>

  <div class="profile">
    <div class="profile-box">
      <div class="profile-heading">${label("pdf.allergyProfile")}</div>
      <div>${
        allergies.length > 0
          ? escapeHtml(joinList(allergyLabelList(allergies, t)))
          : label("pdf.noAllergies")
      }</div>
    </div>

    <div class="profile-box">
      <div class="profile-heading">${label("pdf.halalScreening")}</div>
      <div>${prefersHalal ? label("pdf.on") : label("pdf.off")}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="col-num">${label("pdf.colNumber")}</th>
        <th class="col-photo">${label("pdf.colPhoto")}</th>
        <th class="col-product">${label("pdf.colProduct")}</th>
        <th>${label("pdf.colSummary")}</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="footer">
    <strong>${label("pdf.generatedBy")}</strong>
    ${label("pdf.footerNote")}
  </div>
</body>
</html>
  `;
}

// Web: expo-print cannot create a PDF file in the browser, so the
// formatted list opens in the browser print window ("Save as PDF").
function printHtmlOnWeb(html: string) {
  const doc = (globalThis as any).document;

  if (!doc?.body) {
    throw new Error(translate("pdf.notAvailableBrowser"));
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
    throw new Error(translate("pdf.notAvailableBrowser"));
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
  const { t, language, isRTL } = useI18n();
  const localize: Localize = (text) =>
    localizeScreeningText(text, t, language);

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

  // Product details popup: label text shown in the app language.
  const detailIngredients = selectedItem
    ? splitTopLevel(selectedItem.ingredients_text ?? "", ITEM_SEPARATORS)
    : [];
  const detailContains = selectedItem ? labelItems(selectedItem.contains_text) : [];
  const detailMayContain = selectedItem
    ? labelItems(selectedItem.may_contain_text)
    : [];
  const detailReasons = selectedItem ? parseReasons(selectedItem.save_reason) : [];
  const trDetail = useFoodTranslator([
    ...detailIngredients,
    ...detailContains,
    ...detailMayContain,
    ...detailReasons.flatMap((reason) => (reason.statement ? [reason.statement] : [])),
  ]);


  const loadAvoidList = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(t("avoid.sessionExpired"));
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

          // Items saved from the LabelLens food database before photos were
          // supported have no photo: show the Open Food Facts photo for the
          // same barcode instead (display only, nothing is changed).
          if (!frontPhotoUrl && item.barcode) {
            frontPhotoUrl = await fetchOpenFoodFactsImage(item.barcode);
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
          : t("avoid.loadFailed")
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
      t("avoid.deleteTitle"),
      t("avoid.deleteBody", {
        name: item.product_name || t("avoid.thisProduct"),
      }),
      { confirmText: t("common.delete"), destructive: true }
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
        throw new Error(t("avoid.sessionExpired"));
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
        // RLS returns zero rows instead of an error when a delete is not
        // allowed, so the .select() above is what proves it really worked.
        throw new Error(t("avoid.notDeleted"));
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

      showMessage(t("avoid.deletedTitle"), t("avoid.deletedBody"));
    } catch (error) {
      console.error("Avoid List delete failed:", error);

      showMessage(
        t("avoid.deleteFailed"),
        error instanceof Error
          ? error.message
          : (error as any)?.message || t("avoid.tryAgain")
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
    const message = await buildShareMessage(selectedItems);

    if (Platform.OS === "web") {
      const nav = (globalThis as any).navigator;

      if (nav?.share) {
        try {
          await nav.share({
            title: t("pdf.docTitle"),
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
        showMessage(t("avoid.copiedTitle"), t("avoid.copiedBody"));
        return;
      }

      throw new Error(t("avoid.shareUnavailableBrowser"));
    }

    await Share.share({
      title: t("pdf.docTitle"),
      message,
    });
  }

  // Text summary in the current language (shared by "Share" and "Copy").
  async function buildShareMessage(selectedItems: AvoidItem[]) {
    // The halal line is only included when halal screening is on.
    const [profile, tr] = await Promise.all([
      loadPdfProfile(),
      labelTranslatorFor(selectedItems),
    ]);

    return buildShareText(selectedItems, profile.prefersHalal, t, localize, tr);
  }

  async function copyAsText(selectedItems: AvoidItem[]) {
    const message = await buildShareMessage(selectedItems);
    await Clipboard.setStringAsync(message);
    showMessage(t("avoid.copiedTitle"), t("avoid.copiedReady"));
  }

  async function shareAsPdf(selectedItems: AvoidItem[]) {
    // A missing or broken photo never stops the PDF.
    const [pdfItems, profile, tr] = await Promise.all([
      toPdfItems(selectedItems).catch((error) => {
        console.warn("PDF photos could not be loaded:", error);
        return selectedItems.map((item) => ({
          ...item,
          imageDataUrl: null,
        })) as PdfAvoidItem[];
      }),
      loadPdfProfile(),
      labelTranslatorFor(selectedItems),
    ]);

    const html = createAvoidListPdfHtml(
      pdfItems,
      profile.allergies,
      profile.prefersHalal,
      t,
      localize,
      isRTL,
      tr
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
      throw new Error(t("avoid.shareUnavailableDevice"));
    }

    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: t("avoid.shareDialogTitle"),
    });
  }

  async function shareSelectedItems(format: ShareFormat) {
    if (sharingFormat) {
      return;
    }

    const selectedItems = getSelectedItems();

    if (selectedItems.length === 0) {
      showMessage(
        t("avoid.nothingSelectedTitle"),
        t("avoid.nothingSelectedBody")
      );
      return;
    }

    setSharingFormat(format);

    try {
      // On phones, the share sheet cannot open on top of the popup,
      // so the popup closes first.
      if (Platform.OS !== "web" && format !== "copy") {
        setShareVisible(false);
        await wait(350);
      }

      if (format === "pdf") {
        await shareAsPdf(selectedItems);
      } else if (format === "copy") {
        await copyAsText(selectedItems);
      } else {
        await shareAsText(selectedItems);
      }

      setShareVisible(false);
      clearSelection();
    } catch (error) {
      console.error("Avoid List share failed:", error);

      showMessage(
        t("avoid.shareFailed"),
        error instanceof Error ? error.message : t("avoid.tryAgain")
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
            <Text style={styles.title}>{t("title.avoidList")}</Text>

            <Text style={styles.subtitle}>{t("avoid.subtitle")}</Text>
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

            <Text style={styles.shareButtonText}>{t("avoid.share")}</Text>
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
            placeholder={t("avoid.searchPlaceholder")}
            placeholderTextColor="#8A9A91"
          />
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator
              size="large"
              color="#176B43"
            />

            <Text style={styles.loadingText}>{t("avoid.loading")}</Text>
          </View>
        ) : null}

        {!loading && errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>{t("avoid.loadFailed")}</Text>

            <Text style={styles.errorText}>
              {errorMessage}
            </Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => void loadAvoidList()}
            >
              <Text style={styles.retryText}>{t("common.retry")}</Text>
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
                ? t("avoid.noMatches")
                : t("avoid.empty")}
            </Text>

            <Text style={styles.emptyText}>
              {searchText.trim()
                ? t("avoid.tryAnotherSearch")
                : t("avoid.emptyBody")}
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
                  {item.product_name || t("avoid.unnamed")}
                </Text>

                <Text
                  style={styles.brandName}
                  numberOfLines={1}
                >
                  {item.brand_name || t("avoid.brandUnavailable")}
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
                      {localize(item.save_reason)}
                    </Text>
                  </View>
                ) : null}
              </View>

              <TouchableOpacity
                style={styles.deleteIconButton}
                disabled={deletingId === item.id}
                accessibilityLabel={t("avoid.deleteA11y", {
                  name: item.product_name || t("avoid.thisProduct"),
                })}
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

          <Text style={styles.scanButtonText}>{t("avoid.scanAnother")}</Text>
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
        <DirectionView>
        <View style={styles.overlay}>
          <View style={styles.detailsModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("avoid.detailsTitle")}</Text>

              <TouchableOpacity
                onPress={() => setSelectedItem(null)}
              >
                <Ionicons
                  name="close"
                  size={25}
                  color="#17452F"
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
                  {selectedItem.product_name || t("avoid.unnamed")}
                </Text>

                <Text style={styles.detailsBrand}>
                  {selectedItem.brand_name || t("avoid.brandUnavailable")}
                </Text>

                {selectedItem.variant ? (
                  <Text style={styles.detailText}>
                    {t("avoid.variantLine", { value: selectedItem.variant })}
                  </Text>
                ) : null}

                {selectedItem.barcode ? (
                  <Text style={styles.detailText}>
                    {t("admin.barcode", { value: selectedItem.barcode })}
                  </Text>
                ) : null}

                <Text style={styles.detailHeading}>{t("avoid.whySaved")}</Text>

                {detailReasons.length === 0 ? (
                  <Text style={styles.detailText}>
                    {t("avoid.savedFromAnalysis")}
                  </Text>
                ) : (
                  detailReasons.map((reason, index) => (
                    <Text
                      key={`${reason.headline}-${index}`}
                      style={styles.reasonLine}
                    >
                      {"• "}
                      {localize(reason.headline)}
                      {reason.source
                        ? ` — ${localizeSourceLabel(reason.source, t)}: «${trDetail(
                            reason.statement
                          )}»`
                        : ""}
                    </Text>
                  ))
                )}

                <Text style={styles.detailHeading}>{t("avoid.halal")}</Text>

                <Text style={styles.halalText}>
                  {localize(selectedItem.halal_status) ||
                    t("avoid.halalNotRecorded")}
                </Text>

                <Text style={styles.detailHeading}>{t("home.contains")}</Text>

                <Text style={styles.detailText}>
                  {detailContains.length > 0
                    ? joinList(detailContains.map(trDetail))
                    : t("avoid.noneRecorded")}
                </Text>

                <Text style={styles.detailHeading}>{t("home.mayContain")}</Text>

                <Text style={styles.detailText}>
                  {detailMayContain.length > 0
                    ? joinList(detailMayContain.map(trDetail))
                    : t("avoid.noneRecorded")}
                </Text>

                <Text style={styles.detailHeading}>{t("home.ingredients")}</Text>

                <Text style={styles.detailText}>
                  {detailIngredients.length > 0
                    ? joinList(detailIngredients.map(trDetail))
                    : t("avoid.ingredientsUnavailable")}
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
        </DirectionView>
      </Modal>

      {/* ----- Share popup (checkboxes only here) ----- */}
      <Modal
        visible={shareVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setShareVisible(false)}
      >
        <DirectionView>
        <View style={styles.overlay}>
          <View style={styles.shareModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("avoid.shareDialogTitle")}</Text>

              <TouchableOpacity
                onPress={() => setShareVisible(false)}
              >
                <Ionicons
                  name="close"
                  size={25}
                  color="#17452F"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.shareSubtitle}>{t("avoid.selectToShare")}</Text>

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

              <Text style={styles.selectAllText}>{t("avoid.selectAll")}</Text>
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
                    {item.product_name || t("avoid.unnamed")}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.selectedCount}>
              {t("avoid.selectedCount", {
                selected: selectedIds.length,
                total: filteredItems.length,
              })}
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

                <Text style={styles.shareSelectedText}>{t("avoid.shareAsPdf")}</Text>
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
                  {t("avoid.shareAsText")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Copies the same compact text summary to the clipboard. */}
            <TouchableOpacity
              style={[
                styles.copyButton,
                shareDisabled && styles.disabledButton,
              ]}
              onPress={() => void shareSelectedItems("copy")}
              disabled={shareDisabled}
            >
              {sharingFormat === "copy" ? (
                <ActivityIndicator size="small" color="#176B43" />
              ) : (
                <Ionicons name="copy-outline" size={18} color="#176B43" />
              )}

              <Text style={styles.shareTextButtonText}>
                {t("avoid.copyText")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        </DirectionView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F7F9F7",
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
    paddingEnd: 10,
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
    color: "#17452F",
    fontSize: 14,
    marginStart: 8,
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
    backgroundColor: "#176B43",
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
    marginStart: 11,
  },

  productName: {
    color: "#17452F",
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
    marginStart: 4,
    flexShrink: 1,
  },

  deleteIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF0EE",
    marginStart: 6,
  },

  scanButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#176B43",
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
    backgroundColor: "#F7F9F7",
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
    color: "#17452F",
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
    color: "#17452F",
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
    color: "#17452F",
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
    color: "#17452F",
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
    backgroundColor: "#176B43",
    borderRadius: 10,
    marginTop: 15,
  },

  copyButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#E1E9E3",
    borderRadius: 10,
    marginTop: 10,
  },

  reasonLine: {
    color: "#4F6357",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },

  shareTextButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#176B43",
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