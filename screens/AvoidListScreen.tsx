import { useCallback, useMemo, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { supabase } from "../lib/supabase";

const PHOTO_BUCKET = "avoid-products";

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
  source: string | null;
  front_photo_url?: string | null;
  ingredients_photo_url?: string | null;
  created_at: string;
};

type Preferences = {
  prefers_halal: boolean;
  allergies: string[];
  other_allergy: string | null;
};

function message(title: string, text: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${text}`);
  } else {
    Alert.alert(title, text);
  }
}

function getErrorText(error: any) {
  return (
    error?.message ||
    error?.details ||
    error?.hint ||
    "Something went wrong. Please try again."
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getStoragePath(value: string | null) {
  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    const match = value.match(
      /\/storage\/v1\/object\/(?:public|sign|authenticated)\/avoid-products\/([^?#]+)/
    );

    return match ? decodeURIComponent(match[1]) : null;
  }

  if (/^(file|content|blob|data):/i.test(value)) {
    return null;
  }

  return value.replace(/^\/+/, "");
}

async function getSignedPhotoUrls(
  values: Array<string | null | undefined>
) {
  const paths = [
    ...new Set(
      values
        .map((value) =>
          getStoragePath(value ?? null)
        )
        .filter((value): value is string => Boolean(value))
    ),
  ];

  if (paths.length === 0) {
    return {};
  }

  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(paths, 60 * 60);

  if (error) {
    throw error;
  }

  const result: Record<string, string> = {};

  for (const item of data ?? []) {
    if (item.path && item.signedUrl) {
      result[item.path] = item.signedUrl;
    }
  }

  return result;
}

async function printHtmlOnWeb(html: string) {
  const iframe = document.createElement("iframe");

  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "900px";
  iframe.style.height = "1200px";
  iframe.style.border = "0";

  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = frameWindow?.document;

  if (!frameWindow || !frameDocument) {
    iframe.remove();
    throw new Error("Could not prepare the PDF.");
  }

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  await new Promise<void>((resolve) => {
    setTimeout(resolve, 1000);
  });

  const images = Array.from(frameDocument.images);

  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          image.onload = () => resolve();
          image.onerror = () => resolve();
        })
    )
  );

  frameWindow.focus();
  frameWindow.print();

  setTimeout(() => {
    iframe.remove();
  }, 120000);
}

function ProductImage({
  uri,
  style,
}: {
  uri: string | null;
  style: any;
}) {
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View style={[style, styles.imagePlaceholder]}>
        <Ionicons
          name="image-outline"
          size={28}
          color="#8FB49C"
        />
      </View>
    );
  }

  return (
    <View style={[style, styles.imageFrame]}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

export default function AvoidListScreen({
  navigation,
}: any) {
  const [items, setItems] = useState<AvoidItem[]>([]);
  const [preferences, setPreferences] =
    useState<Preferences | null>(null);
  const [photoUrls, setPhotoUrls] = useState<
    Record<string, string>
  >({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [detailsItem, setDetailsItem] =
    useState<AvoidItem | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(
    null
  );

  const [shareVisible, setShareVisible] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    []
  );
  const [creatingPdf, setCreatingPdf] = useState(false);

  const loadAvoidList = useCallback(async () => {
    setLoading(true);
    setError("");

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

      let result = await supabase
        .from("avoid_list")
        .select(
          [
            "id",
            "barcode",
            "product_name",
            "brand_name",
            "variant",
            "ingredients_text",
            "contains_text",
            "may_contain_text",
            "save_reason",
            "source",
            "front_photo_url",
            "ingredients_photo_url",
            "created_at",
          ].join(", ")
        )
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      // Fallback for databases where photo columns
      // have not been added yet.
      if (
        result.error &&
        /front_photo_url|ingredients_photo_url/i.test(
          result.error.message
        )
      ) {
        result = await supabase
          .from("avoid_list")
          .select(
            [
              "id",
              "barcode",
              "product_name",
              "brand_name",
              "variant",
              "ingredients_text",
              "contains_text",
              "may_contain_text",
              "save_reason",
              "source",
              "created_at",
            ].join(", ")
          )
          .eq("user_id", user.id)
          .order("created_at", {
            ascending: false,
          });
      }

      if (result.error) {
        throw result.error;
      }

      const loaded = (result.data ?? []).map(
        (item: any) => ({
          ...item,
          front_photo_url:
            item.front_photo_url ?? null,
          ingredients_photo_url:
            item.ingredients_photo_url ?? null,
        })
      ) as AvoidItem[];

      setItems(loaded);

      const preferenceResult = await supabase
        .from("user_preferences")
        .select(
          "prefers_halal, allergies, other_allergy"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (preferenceResult.error) {
        throw preferenceResult.error;
      }

      if (preferenceResult.data) {
        setPreferences({
          prefers_halal:
            preferenceResult.data.prefers_halal === true,
          allergies: Array.isArray(
            preferenceResult.data.allergies
          )
            ? preferenceResult.data.allergies
            : [],
          other_allergy:
            preferenceResult.data.other_allergy ?? null,
        });
      }

      const signedUrls = await getSignedPhotoUrls(
        loaded.flatMap((item) => [
          item.front_photo_url,
          item.ingredients_photo_url,
        ])
      );

      setPhotoUrls(signedUrls);
    } catch (loadError: any) {
      console.error("Avoid List error:", loadError);
      setError(getErrorText(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadAvoidList();
    }, [loadAvoidList])
  );

  function getPhotoUrl(value: string | null | undefined) {
    if (!value) {
      return null;
    }

    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    const path = getStoragePath(value);

    return path ? photoUrls[path] ?? null : null;
  }

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

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
        item.save_reason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [items, search]);

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id]
    );
  }

  function selectAll() {
    setSelectedIds(items.map((item) => item.id));
  }

  function clearAll() {
    setSelectedIds([]);
  }

  async function deleteItem(item: AvoidItem) {
    const remove = async () => {
      setDeletingId(item.id);

      try {
        const { error: deleteError } = await supabase
          .from("avoid_list")
          .delete()
          .eq("id", item.id);

        if (deleteError) {
          throw deleteError;
        }

        setItems((current) =>
          current.filter(
            (currentItem) =>
              currentItem.id !== item.id
          )
        );

        setSelectedIds((current) =>
          current.filter((id) => id !== item.id)
        );

        setDetailsItem(null);

        message(
          "Removed",
          "The product was removed from your Avoid List."
        );
      } catch (deleteError: any) {
        message(
          "Could not remove product",
          getErrorText(deleteError)
        );
      } finally {
        setDeletingId(null);
      }
    };

    if (Platform.OS === "web") {
      if (
        window.confirm(
          `Remove ${
            item.product_name || "this product"
          } from your Avoid List?`
        )
      ) {
        await remove();
      }

      return;
    }

    Alert.alert(
      "Remove product",
      `Remove ${
        item.product_name || "this product"
      } from your Avoid List?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void remove();
          },
        },
      ]
    );
  }

  function allergiesText() {
    const standard = preferences?.allergies ?? [];

    const custom =
      preferences?.other_allergy
        ?.split(",")
        .map((item) => item.trim())
        .filter(Boolean) ?? [];

    return (
      [...new Set([...standard, ...custom])].join(
        ", "
      ) || "No allergies selected"
    );
  }

  async function createPdf() {
    const selectedItems = items.filter((item) =>
      selectedIds.includes(item.id)
    );

    if (selectedItems.length === 0) {
      message(
        "Select products",
        "Please select at least one product."
      );
      return;
    }

    setCreatingPdf(true);

    try {
      const productHtml = selectedItems
  .map((item, index) => {
    const image = getPhotoUrl(item.front_photo_url);

    return `
      <tr>
        <td class="number">${index + 1}</td>

        <td class="photo-cell">
          ${
            image
              ? `<img src="${escapeHtml(image)}" />`
              : `<div class="no-photo">No photo</div>`
          }
        </td>

        <td>
          <strong>${escapeHtml(
            item.product_name || "Unnamed product"
          )}</strong>
          <br />
          <span class="muted">
            ${escapeHtml(
              item.brand_name || "Brand unavailable"
            )}
          </span>
        </td>

        <td>
          ${escapeHtml(item.variant || "—")}
        </td>

        <td>
          ${escapeHtml(item.barcode || "—")}
        </td>

        <td class="warning">
          ${escapeHtml(
            item.contains_text ||
              item.may_contain_text ||
              item.save_reason ||
              "Saved for review"
          )}
        </td>

        
      </tr>
    `;
  })
  .join("");

const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />

      <style>
        @page {
          size: A4 landscape;
          margin: 12mm;
        }

        body {
          font-family: Arial, sans-serif;
          color: #1d3829;
          font-size: 10px;
        }

        h1 {
          color: #176b43;
          font-size: 22px;
          margin: 0;
        }

        h2 {
          color: #176b43;
          font-size: 13px;
          margin: 18px 0 7px;
        }

        .header {
          border-bottom: 2px solid #176b43;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }

        .generated {
          color: #63776b;
          font-size: 9px;
          margin-top: 4px;
        }

        .profile {
          background: #eaf5ed;
          border-radius: 7px;
          padding: 9px;
          margin-bottom: 12px;
        }

        .profile p {
          margin: 3px 0;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        th {
          background: #176b43;
          color: white;
          padding: 6px;
          text-align: left;
          font-size: 9px;
        }

        td {
          border-bottom: 1px solid #dce5de;
          padding: 5px;
          vertical-align: middle;
          word-wrap: break-word;
        }

        tr:nth-child(even) {
          background: #f6faf7;
        }

        .number {
          width: 25px;
          text-align: center;
        }

        .photo-cell {
          width: 55px;
          text-align: center;
        }

        .photo-cell img {
          width: 42px;
          height: 42px;
          object-fit: cover;
          border-radius: 5px;
        }

        .no-photo {
          width: 42px;
          height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eef3ef;
          color: #63776b;
          font-size: 7px;
          text-align: center;
          border-radius: 5px;
        }

        .muted {
          color: #63776b;
          font-size: 9px;
        }

        .warning {
          color: #a5281d;
          font-size: 9px;
        }

        .footer {
          color: #63776b;
          font-size: 8px;
          text-align: center;
          margin-top: 14px;
          border-top: 1px solid #dce5de;
          padding-top: 7px;
        }
      </style>
    </head>

    <body>
      <div class="header">
        <h1>LabelLens Avoid List</h1>

        <div class="generated">
          Generated by the LabelLens application —
          ${escapeHtml(new Date().toLocaleString())}
        </div>
      </div>

      <div class="profile">
        <strong>Allergy profile</strong>

        <p>
          <strong>Allergies:</strong>
          ${escapeHtml(allergiesText())}
        </p>

        <p>
          <strong>Halal screening:</strong>
          ${
            preferences?.prefers_halal
              ? "Enabled"
              : "Not enabled"
          }
        </p>
      </div>

      <h2>
        Selected products (${selectedItems.length})
      </h2>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Photo</th>
            <th>Product / Brand</th>
            <th>Variant</th>
            <th>Barcode</th>
            <th>Warning</th>
          </tr>
        </thead>

        <tbody>
          ${productHtml}
        </tbody>
      </table>

      <div class="footer">
        © 2026 LabelLens. All rights reserved.
        This report was generated from the LabelLens application.
        Always check the physical package before consuming a product.
      </div>
    </body>
  </html>
`;

      if (Platform.OS === "web") {
        // This prints the generated HTML, not the current app page.
        await printHtmlOnWeb(html);
      } else {
        const result = await Print.printToFileAsync({
          html,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(result.uri, {
            mimeType: "application/pdf",
            dialogTitle:
              "Share your LabelLens Avoid List",
            UTI: "com.adobe.pdf",
          });
        } else {
          message(
            "PDF created",
            "The PDF was created successfully."
          );
        }
      }

      setShareVisible(false);
    } catch (pdfError: any) {
      console.error("PDF error:", pdfError);

      message(
        "Could not create PDF",
        getErrorText(pdfError)
      );
    } finally {
      setCreatingPdf(false);
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>
              My Avoid List
            </Text>

            <Text style={styles.subtitle}>
              {items.length} product
              {items.length === 1 ? "" : "s"} saved
            </Text>
          </View>

          <TouchableOpacity
            style={styles.shareButton}
            onPress={() => setShareVisible(true)}
          >
            <Ionicons
              name="share-outline"
              size={18}
              color="#176B43"
            />

            <Text style={styles.shareText}>
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
            value={search}
            onChangeText={setSearch}
            placeholder="Search your Avoid List"
            placeholderTextColor="#8A9B90"
          />

          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch("")}
            >
              <Ionicons
                name="close-circle"
                size={19}
                color="#AFC4B5"
              />
            </TouchableOpacity>
          )}
        </View>

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator
              size="large"
              color="#258D4D"
            />

            <Text style={styles.loadingText}>
              Loading your Avoid List...
            </Text>
          </View>
        )}

        {!loading && error !== "" && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>
              Could not load Avoid List
            </Text>

            <Text style={styles.errorText}>
              {error}
            </Text>

            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                void loadAvoidList();
              }}
            >
              <Text style={styles.retryText}>
                Try Again
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading &&
          error === "" &&
          filteredItems.length === 0 && (
            <View style={styles.emptyBox}>
              <Ionicons
                name="shield-checkmark-outline"
                size={38}
                color="#8FB49C"
              />

              <Text style={styles.emptyTitle}>
                {items.length === 0
                  ? "Your Avoid List is empty"
                  : "No products found"}
              </Text>

              <Text style={styles.emptyText}>
                {items.length === 0
                  ? "Products saved after analysis will appear here."
                  : "Try another search term."}
              </Text>
            </View>
          )}

        {!loading &&
          error === "" &&
          filteredItems.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.productCard,
                pressed && styles.pressedCard,
              ]}
              onPress={() => setDetailsItem(item)}
            >
              <ProductImage
                uri={getPhotoUrl(item.front_photo_url)}
                style={styles.productPhoto}
              />

              <View style={styles.productInfo}>
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

                <View style={styles.warningBadge}>
                  <Ionicons
                    name="warning-outline"
                    size={13}
                    color="#C0392B"
                  />

                  <Text
                    style={styles.warningText}
                    numberOfLines={1}
                  >
                    {item.contains_text ||
                      item.may_contain_text ||
                      item.save_reason ||
                      "Saved for review"}
                  </Text>
                </View>

                <Text style={styles.savedText}>
                  Saved {formatDate(item.created_at)}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => {
                  void deleteItem(item);
                }}
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color="#D34A3A"
                />
              </TouchableOpacity>
            </Pressable>
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

          <Text style={styles.scanText}>
            Scan another product
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={detailsItem !== null}
        animationType="slide"
        onRequestClose={() => setDetailsItem(null)}
      >
        <SafeAreaView style={styles.page}>
          <View style={styles.detailHeader}>
            <TouchableOpacity
              onPress={() => setDetailsItem(null)}
            >
              <Ionicons
                name="arrow-back"
                size={23}
                color="#176B43"
              />
            </TouchableOpacity>

            <Text style={styles.detailHeaderTitle}>
              Product details
            </Text>

            <View style={{ width: 23 }} />
          </View>

          {detailsItem && (
            <ScrollView
              contentContainerStyle={styles.detailContent}
            >
              <ProductImage
                uri={getPhotoUrl(
                  detailsItem.front_photo_url
                )}
                style={styles.detailPhoto}
              />

              <Text style={styles.detailName}>
                {detailsItem.product_name ||
                  "Unnamed product"}
              </Text>

              <Text style={styles.detailBrand}>
                {detailsItem.brand_name ||
                  "Brand unavailable"}
              </Text>

              <View style={styles.detailCard}>
                <DetailRow
                  label="Variant"
                  value={detailsItem.variant}
                />

                <DetailRow
                  label="Barcode"
                  value={detailsItem.barcode}
                />

                <DetailRow
                  label="Source"
                  value={detailsItem.source}
                />

                <DetailRow
                  label="Saved"
                  value={formatDate(
                    detailsItem.created_at
                  )}
                />
              </View>

              <DetailSection
                title="Contains allergens"
                value={detailsItem.contains_text}
                empty="None listed"
                color="#FFF0EE"
              />

              <DetailSection
                title="May contain allergens"
                value={detailsItem.may_contain_text}
                empty="None listed"
                color="#FFF8E1"
              />

              <DetailSection
                title="Why it was saved"
                value={detailsItem.save_reason}
                empty="Saved by the user"
                color="#EAF5ED"
              />

              <DetailSection
                title="Full ingredients"
                value={detailsItem.ingredients_text}
                empty="Ingredients unavailable"
                color="#FFFFFF"
              />

              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => {
                  void deleteItem(detailsItem);
                }}
              >
                <Ionicons
                  name="trash-outline"
                  size={20}
                  color="#D34A3A"
                />

                <Text style={styles.removeText}>
                  Remove from Avoid List
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      <Modal
        visible={shareVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setShareVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
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
                  color="#63776B"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Select the products you want to include.
            </Text>

            <View style={styles.selectionRow}>
              <Text style={styles.selectedText}>
                {selectedIds.length} selected
              </Text>

              <View style={styles.selectionButtons}>
                <TouchableOpacity
                  onPress={selectAll}
                >
                  <Text style={styles.selectionText}>
                    Select all
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={clearAll}
                >
                  <Text style={styles.selectionText}>
                    Clear all
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.modalList}>
              {items.map((item) => {
                const selected = selectedIds.includes(
                  item.id
                );

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.modalItem}
                    onPress={() =>
                      toggleSelected(item.id)
                    }
                  >
                    <View
                      style={[
                        styles.checkbox,
                        selected && styles.checkedBox,
                      ]}
                    >
                      {selected && (
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color="#FFFFFF"
                        />
                      )}
                    </View>

                    <ProductImage
                      uri={getPhotoUrl(
                        item.front_photo_url
                      )}
                      style={styles.modalPhoto}
                    />

                    <View>
                      <Text style={styles.modalName}>
                        {item.product_name ||
                          "Unnamed product"}
                      </Text>

                      <Text style={styles.modalBrand}>
                        {item.brand_name ||
                          "Brand unavailable"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.sharePdfButton}
              onPress={() => {
                void createPdf();
              }}
              disabled={creatingPdf}
            >
              {creatingPdf ? (
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

              <Text style={styles.sharePdfText}>
                {creatingPdf
                  ? "Creating PDF..."
                  : `Share selected (${selectedIds.length})`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>
        {label}
      </Text>

      <Text style={styles.detailValue}>
        {value || "Not available"}
      </Text>
    </View>
  );
}

function DetailSection({
  title,
  value,
  empty,
  color,
}: {
  title: string;
  value: string | null;
  empty: string;
  color: string;
}) {
  return (
    <View
      style={[
        styles.detailSection,
        { backgroundColor: color },
      ]}
    >
      <Text style={styles.detailSectionTitle}>
        {title}
      </Text>

      <Text style={styles.detailSectionText}>
        {value || empty}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F8FBF8",
  },

  content: {
    padding: 16,
    paddingBottom: 45,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  title: {
    color: "#176B43",
    fontSize: 25,
    fontWeight: "800",
  },

  subtitle: {
    color: "#63776B",
    fontSize: 13,
    marginTop: 5,
  },

  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EAF5ED",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  shareText: {
    color: "#176B43",
    fontWeight: "800",
    marginLeft: 5,
  },

  searchBox: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE5DE",
    borderRadius: 12,
    paddingHorizontal: 13,
    marginBottom: 16,
  },

  searchInput: {
    flex: 1,
    color: "#1D3829",
    fontSize: 14,
    marginLeft: 8,
  },

  center: {
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
    borderColor: "#D34A3A",
    borderRadius: 14,
    padding: 15,
  },

  errorTitle: {
    color: "#A5281D",
    fontSize: 16,
    fontWeight: "800",
  },

  errorText: {
    color: "#7B3028",
    fontSize: 13,
    marginTop: 7,
  },

  retryButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#258D4D",
    borderRadius: 9,
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
    padding: 25,
  },

  emptyTitle: {
    color: "#176B43",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 8,
  },

  emptyText: {
    color: "#63776B",
    textAlign: "center",
    marginTop: 7,
  },

  productCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E8E2",
    borderRadius: 17,
    padding: 12,
    marginBottom: 12,
  },

  pressedCard: {
    backgroundColor: "#F2F8F3",
  },

  productPhoto: {
    width: 72,
    height: 72,
    borderRadius: 13,
    marginRight: 13,
  },

  imageFrame: {
    overflow: "hidden",
    backgroundColor: "#EAF5ED",
  },

  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF5ED",
  },

  productInfo: {
    flex: 1,
  },

  productName: {
    color: "#163D2A",
    fontSize: 16,
    fontWeight: "800",
  },

  brandName: {
    color: "#63776B",
    fontSize: 13,
    marginTop: 3,
  },

  warningBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#FFE0DF",
    borderRadius: 18,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginTop: 8,
    maxWidth: "100%",
  },

  warningText: {
    color: "#C0392B",
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 4,
    flexShrink: 1,
  },

  savedText: {
    color: "#829487",
    fontSize: 12,
    marginTop: 6,
  },

  deleteButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF0F0",
    borderRadius: 20,
    marginLeft: 8,
  },

  scanButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#258D4D",
    borderRadius: 12,
    marginTop: 12,
  },

  scanText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    marginLeft: 8,
  },

  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E1E8E2",
    padding: 12,
  },

  detailHeaderTitle: {
    color: "#176B43",
    fontSize: 18,
    fontWeight: "800",
  },

  detailContent: {
    padding: 16,
    paddingBottom: 45,
  },

  detailPhoto: {
    width: "100%",
    height: 260,
    borderRadius: 18,
    marginBottom: 16,
  },

  detailName: {
    color: "#163D2A",
    fontSize: 23,
    fontWeight: "800",
  },

  detailBrand: {
    color: "#63776B",
    fontSize: 15,
    marginTop: 4,
  },

  detailCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E8E2",
    borderRadius: 14,
    paddingHorizontal: 14,
    marginTop: 16,
  },

  detailRow: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF3EF",
  },

  detailLabel: {
    width: 90,
    color: "#63776B",
    fontWeight: "700",
  },

  detailValue: {
    flex: 1,
    color: "#1D3829",
  },

  detailSection: {
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
  },

  detailSectionTitle: {
    color: "#176B43",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 7,
  },

  detailSectionText: {
    color: "#1D3829",
    fontSize: 14,
    lineHeight: 21,
  },

  removeButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF0F0",
    borderWidth: 1,
    borderColor: "#F3C6C0",
    borderRadius: 12,
    marginTop: 22,
  },

  removeText: {
    color: "#D34A3A",
    fontWeight: "800",
    marginLeft: 8,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  modalCard: {
    maxHeight: "85%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  modalTitle: {
    color: "#176B43",
    fontSize: 21,
    fontWeight: "800",
  },

  modalSubtitle: {
    color: "#63776B",
    fontSize: 13,
    marginTop: 5,
    marginBottom: 14,
  },

  selectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E5ECE7",
    paddingBottom: 11,
  },

  selectedText: {
    color: "#163D2A",
    fontWeight: "800",
  },

  selectionButtons: {
    flexDirection: "row",
  },

  selectionText: {
    color: "#176B43",
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 12,
  },

  modalList: {
    marginTop: 5,
  },

  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },

  checkbox: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#AFC4B5",
    borderRadius: 6,
  },

  checkedBox: {
    backgroundColor: "#258D4D",
    borderColor: "#258D4D",
  },

  modalPhoto: {
    width: 45,
    height: 45,
    borderRadius: 9,
    marginLeft: 12,
  },

  modalName: {
    color: "#1D3829",
    fontSize: 14,
    fontWeight: "800",
    marginLeft: 12,
  },

  modalBrand: {
    color: "#63776B",
    fontSize: 12,
    marginLeft: 12,
    marginTop: 3,
  },

  sharePdfButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#258D4D",
    borderRadius: 12,
    marginTop: 15,
  },

  sharePdfText: {
    color: "#FFFFFF",
    fontWeight: "800",
    marginLeft: 8,
  },
});