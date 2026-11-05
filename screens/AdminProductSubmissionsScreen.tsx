// ---------------------------------------------------------------------------
// screens/AdminProductSubmissionsScreen.tsx
// DEVELOPER review screen (route "AdminProductSubmissions" in App.tsx).
// This is the only developer page in the app; Netlify web builds and the
// phone app both use it.
//
// Who can use it: users listed in the USER database table admin_users.
// App.tsx only registers the route for them, and this screen re-checks it.
//
// Buttons and where they write:
//   Save draft          → USER database public.product_submissions only
//   Approve for scanner → supabase.functions.invoke("approve-product-submission")
//                         The Edge Function (server) inserts into the FOOD
//                         database public.products with the food service-role
//                         key. The app never writes to public.products.
//   Reject              → reject-product-submission Edge Function
//   Refresh             → reloads pending submissions
//
// Security: hiding this screen is only a convenience. RLS on
// product_submissions and the admin checks inside the Edge Functions are
// what actually protect the data.
// ---------------------------------------------------------------------------

import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
} from "react-native";

import {
  approveSubmissionForScanner,
  callReviewFunction,
  isCurrentUserAdmin,
  saveSubmissionDraft,
  type SubmissionDraft,
} from "../lib/adminAccess";
import { useI18n, type TranslationKey } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { confirmAction } from "../lib/ui/messages";
import {
  ContextSafeAreaView as SafeAreaView,
  Ionicons,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "../components/Themed";

type Submission = SubmissionDraft & {
  id: string;
  front_photo_url: string | null;
  ingredients_photo_url: string | null;
  source: string | null;
  created_at: string;
};

type Banner = { kind: "success" | "error"; text: string } | null;
type BusyAction = "save" | "approve" | "reject";

const BUCKET = "product-submissions";

// Set by netlify.toml (EXPO_PUBLIC_BUILD_ID=$COMMIT_REF) so you can confirm
// which GitHub commit the deployed developer page was built from.
const BUILD_ID = (process.env.EXPO_PUBLIC_BUILD_ID ?? "").slice(0, 7) || "local";

const DRAFT_FIELDS: {
  key: keyof SubmissionDraft;
  label: TranslationKey;
  multiline?: boolean;
  numeric?: boolean;
}[] = [
  { key: "product_name", label: "admin.fieldName" },
  { key: "brand_name", label: "admin.fieldBrand" },
  { key: "variant", label: "admin.fieldVariant" },
  { key: "barcode", label: "admin.fieldBarcode", numeric: true },
  { key: "ingredients_text", label: "admin.ingredients", multiline: true },
  { key: "contains_text", label: "admin.contains", multiline: true },
  { key: "may_contain_text", label: "admin.mayContain", multiline: true },
];

function toDraft(row: Submission): SubmissionDraft {
  return {
    barcode: row.barcode ?? "",
    product_name: row.product_name ?? "",
    brand_name: row.brand_name ?? "",
    variant: row.variant ?? "",
    ingredients_text: row.ingredients_text ?? "",
    contains_text: row.contains_text ?? "",
    may_contain_text: row.may_contain_text ?? "",
  };
}

function sameDraft(a: SubmissionDraft, b: SubmissionDraft): boolean {
  return DRAFT_FIELDS.every(({ key }) => a[key].trim() === b[key].trim());
}

// Storage paths become signed URLs; web URLs (Open Food Facts) stay as-is.
async function photoUrl(value: string | null): Promise<string | null> {
  if (!value) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(value, 3600);

  return data?.signedUrl ?? null;
}

export default function AdminProductSubmissionsScreen({ navigation }: any) {
  const { t } = useI18n();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [drafts, setDrafts] = useState<Record<string, SubmissionDraft>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<{ id: string; action: BusyAction } | null>(
    null
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<Banner>(null);

  // ----- Load pending submissions (user database) ------------------------

  const loadSubmissions = useCallback(async () => {
    setLoading(true);

    try {
      // Developers are identified ONLY through user-database admin_users.
      const admin = await isCurrentUserAdmin();
      setAuthorized(admin);

      if (!admin) {
        setSubmissions([]);
        return;
      }

      const { data, error } = await supabase
        .from("product_submissions")
        .select(
          "id, barcode, product_name, brand_name, variant, ingredients_text, contains_text, may_contain_text, front_photo_url, ingredients_photo_url, source, created_at"
        )
        .eq("verification_status", "pending")
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      const rows = await Promise.all(
        ((data ?? []) as any[]).map(async (row) => ({
          ...row,
          ...toDraft(row),
          front_photo_url: await photoUrl(row.front_photo_url),
          ingredients_photo_url: await photoUrl(row.ingredients_photo_url),
        }))
      );

      setSubmissions(rows as Submission[]);
      setDrafts(Object.fromEntries(rows.map((row) => [row.id, toDraft(row as Submission)])));
    } catch (error: any) {
      setBanner({
        kind: "error",
        text: error?.message || t("admin.loadFailed"),
      });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSubmissions();
    }, [loadSubmissions])
  );

  function updateDraft(id: string, key: keyof SubmissionDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], [key]: value },
    }));
  }

  // ----- Save draft: USER database only -----------------------------------

  async function saveDraft(item: Submission) {
    if (busy) {
      return;
    }

    setBusy({ id: item.id, action: "save" });
    setBanner(null);

    try {
      await saveSubmissionDraft(item.id, drafts[item.id] ?? toDraft(item));
      setBanner({ kind: "success", text: t("admin.draftSaved") });
      await loadSubmissions();
    } catch (error: any) {
      setBanner({ kind: "error", text: error?.message || t("admin.draftFailed") });
    } finally {
      setBusy(null);
    }
  }

  // ----- Approve for scanner: Edge Function only --------------------------

  async function approve(item: Submission) {
    if (busy) {
      return;
    }

    const draft = drafts[item.id] ?? toDraft(item);

    const confirmed = await confirmAction(
      t("admin.approveTitle"),
      t("admin.approveBody", {
        name: draft.product_name || t("admin.thisProduct"),
      })
    );

    if (!confirmed) {
      return;
    }

    setBusy({ id: item.id, action: "approve" });
    setBanner(null);

    try {
      // Unsaved corrections are first saved to product_submissions, because
      // the Edge Function reads the submission from the user database.
      if (!sameDraft(draft, toDraft(item))) {
        await saveSubmissionDraft(item.id, draft);
      }

      // Calls supabase.functions.invoke("approve-product-submission",
      //   { body: { submission_id: item.id } })
      await approveSubmissionForScanner(item.id);

      setBanner({ kind: "success", text: t("admin.approvedSuccess") });
    } catch (error: any) {
      // The submission stays pending; show the real error from the server.
      setBanner({ kind: "error", text: error?.message || t("admin.approveFailed") });
    } finally {
      setBusy(null);
      await loadSubmissions();
    }
  }

  // ----- Reject: Edge Function only ---------------------------------------

  async function reject(item: Submission) {
    if (busy) {
      return;
    }

    const confirmed = await confirmAction(
      t("admin.rejectTitle"),
      t("admin.rejectBody", {
        name: item.product_name || t("admin.thisProduct"),
      }),
      { destructive: true, confirmText: t("admin.reject") }
    );

    if (!confirmed) {
      return;
    }

    setBusy({ id: item.id, action: "reject" });
    setBanner(null);

    try {
      await callReviewFunction("reject-product-submission", {
        submission_id: item.id,
        review_notes: (notes[item.id] ?? "").trim(),
      });

      setBanner({ kind: "success", text: t("admin.rejectedSuccess") });
      setNotes((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    } catch (error: any) {
      setBanner({ kind: "error", text: error?.message || t("admin.rejectFailed") });
    } finally {
      setBusy(null);
      await loadSubmissions();
    }
  }

  // ----- Not a developer -----
  if (authorized === false) {
    return (
      <SafeAreaView style={styles.centerPage} edges={["left", "right", "bottom"]}>
        <Text style={styles.deniedTitle}>{t("admin.notAuthorized")}</Text>
        <Text style={styles.deniedText}>{t("admin.notAuthorizedBody")}</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>{t("admin.goBack")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{t("admin.title")}</Text>
            <Text style={styles.subtitle}>{t("admin.subtitle")}</Text>
          </View>

          <TouchableOpacity
            style={[styles.refreshButton, (loading || !!busy) && styles.disabled]}
            onPress={() => {
              setBanner(null);
              void loadSubmissions();
            }}
            disabled={loading || !!busy}
            accessibilityLabel={t("admin.refresh")}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#176B43" />
            ) : (
              <Ionicons name="refresh" size={18} color="#176B43" />
            )}
            <Text style={styles.refreshText}>{t("admin.refresh")}</Text>
          </TouchableOpacity>
        </View>

        {banner ? (
          <View
            style={[
              styles.banner,
              banner.kind === "success" ? styles.bannerSuccess : styles.bannerError,
            ]}
          >
            <Text
              style={
                banner.kind === "success"
                  ? styles.bannerSuccessText
                  : styles.bannerErrorText
              }
            >
              {banner.text}
            </Text>
          </View>
        ) : null}

        {loading && submissions.length === 0 ? (
          <ActivityIndicator size="large" color="#176B43" style={styles.loader} />
        ) : null}

        {!loading && submissions.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{t("admin.empty")}</Text>
          </View>
        ) : null}

        {submissions.map((item) => {
          const draft = drafts[item.id] ?? toDraft(item);
          const itemBusy = busy?.id === item.id ? busy.action : null;
          const locked = !!busy;
          const changed = !sameDraft(draft, toDraft(item));

          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.photoRow}>
                {[item.front_photo_url, item.ingredients_photo_url].map(
                  (uri, index) =>
                    uri ? (
                      <Image
                        key={`${item.id}-${index}`}
                        source={{ uri }}
                        style={styles.photo}
                      />
                    ) : (
                      <View
                        key={`${item.id}-${index}`}
                        style={[styles.photo, styles.photoPlaceholder]}
                      >
                        <Text style={styles.placeholderText}>
                          {index === 0 ? t("admin.noFront") : t("admin.noIngredients")}
                        </Text>
                      </View>
                    )
                )}
              </View>

              <Text style={styles.meta}>
                {t("admin.source", { value: item.source || t("admin.notRecorded") })}
              </Text>

              {/* Editable draft: saved only to product_submissions. */}
              {DRAFT_FIELDS.map((field) => (
                <View key={field.key}>
                  <Text style={styles.heading}>{t(field.label)}</Text>
                  <TextInput
                    style={[styles.fieldInput, field.multiline && styles.fieldMultiline]}
                    value={draft[field.key]}
                    onChangeText={(value) => updateDraft(item.id, field.key, value)}
                    multiline={field.multiline}
                    keyboardType={field.numeric ? "number-pad" : "default"}
                    editable={!locked}
                    placeholderTextColor="#8A9A91"
                    placeholder={t("admin.notRecorded")}
                  />
                </View>
              ))}

              {changed ? (
                <Text style={styles.unsaved}>{t("admin.unsavedChanges")}</Text>
              ) : null}

              <TouchableOpacity
                style={[styles.draftButton, locked && styles.disabled]}
                onPress={() => void saveDraft(item)}
                disabled={locked}
              >
                {itemBusy === "save" ? (
                  <ActivityIndicator color="#176B43" />
                ) : (
                  <Text style={styles.draftText}>{t("admin.saveDraft")}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.approveButton, locked && styles.disabled]}
                onPress={() => void approve(item)}
                disabled={locked}
              >
                {itemBusy === "approve" ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.approveText}>{t("admin.approve")}</Text>
                )}
              </TouchableOpacity>

              <TextInput
                style={styles.notesInput}
                value={notes[item.id] ?? ""}
                onChangeText={(value) =>
                  setNotes((current) => ({ ...current, [item.id]: value }))
                }
                placeholder={t("admin.notesPlaceholder")}
                placeholderTextColor="#8A9A91"
                multiline
                editable={!locked}
              />

              <TouchableOpacity
                style={[styles.rejectButton, locked && styles.disabled]}
                onPress={() => void reject(item)}
                disabled={locked}
              >
                {itemBusy === "reject" ? (
                  <ActivityIndicator color="#B42318" />
                ) : (
                  <Text style={styles.rejectText}>{t("admin.reject")}</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

        <Text style={styles.buildMarker}>
          {t("admin.buildMarker", { build: BUILD_ID })}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F7F9F7" },
  content: { padding: 16, paddingBottom: 40 },
  centerPage: {
    flex: 1,
    backgroundColor: "#F7F9F7",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  headerText: { flex: 1 },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#176B43",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  refreshText: { color: "#176B43", fontWeight: "700", fontSize: 13 },
  fieldInput: {
    borderWidth: 1,
    borderColor: "#B9C9BD",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#17452F",
    fontSize: 13,
    backgroundColor: "#FFFFFF",
  },
  fieldMultiline: { minHeight: 70, textAlignVertical: "top" },
  unsaved: { color: "#755515", fontSize: 12, marginTop: 10 },
  draftButton: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#176B43",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  draftText: { color: "#176B43", fontWeight: "800" },
  buildMarker: {
    color: "#8A9A91",
    fontSize: 11,
    textAlign: "center",
    marginTop: 16,
  },
  title: { color: "#176B43", fontSize: 24, fontWeight: "800" },
  subtitle: { color: "#63776B", fontSize: 13, marginTop: 4, marginBottom: 14 },
  banner: { borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1 },
  bannerSuccess: { backgroundColor: "#E8F5E9", borderColor: "#8FC9A5" },
  bannerError: { backgroundColor: "#FDECEA", borderColor: "#E89A94" },
  bannerSuccessText: { color: "#176B43", fontWeight: "700" },
  bannerErrorText: { color: "#9B1C1C", fontWeight: "700" },
  loader: { marginTop: 30 },
  emptyBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
  },
  emptyText: { color: "#63776B", fontSize: 14 },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE7E0",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  photoRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  photo: {
    flex: 1,
    height: 150,
    borderRadius: 10,
    backgroundColor: "#F1F5F2",
    resizeMode: "contain",
  },
  photoPlaceholder: { alignItems: "center", justifyContent: "center" },
  placeholderText: { color: "#8A9A91", fontSize: 11, textAlign: "center" },
  name: { color: "#176B43", fontSize: 19, fontWeight: "800", marginBottom: 6 },
  meta: { color: "#45624B", fontSize: 13, marginTop: 2 },
  heading: {
    color: "#17452F",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 12,
    marginBottom: 3,
  },
  body: { color: "#17452F", fontSize: 13, lineHeight: 19 },
  notesInput: {
    minHeight: 60,
    borderWidth: 1,
    borderColor: "#B9C9BD",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    color: "#17452F",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginTop: 14,
    textAlignVertical: "top",
  },
  approveButton: {
    minHeight: 48,
    borderRadius: 11,
    backgroundColor: "#176B43",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  approveText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  rejectButton: {
    minHeight: 46,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#F04438",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  rejectText: { color: "#B3261E", fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.55 },
  deniedTitle: { color: "#B3261E", fontSize: 20, fontWeight: "800" },
  deniedText: { color: "#63776B", fontSize: 14, textAlign: "center", marginTop: 8 },
  backButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#176B43",
  },
  backButtonText: { color: "#FFFFFF", fontWeight: "800" },
});