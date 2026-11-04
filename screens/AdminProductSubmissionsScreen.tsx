// ---------------------------------------------------------------------------
// screens/AdminProductSubmissionsScreen.tsx
// Admin-only review of pending product submissions.
// ---------------------------------------------------------------------------

import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { callReviewFunction, isCurrentUserAdmin } from "../lib/adminAccess";
import { supabase } from "../lib/supabase";

type Submission = {
  id: string;
  barcode: string | null;
  product_name: string | null;
  brand_name: string | null;
  variant: string | null;
  ingredients_text: string | null;
  contains_text: string | null;
  may_contain_text: string | null;
  front_photo_url: string | null;
  ingredients_photo_url: string | null;
  source: string | null;
  created_at: string;
};

type Banner = { kind: "success" | "error"; text: string } | null;

const BUCKET = "product-submissions";

function confirmAction(title: string, message: string): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(
      (globalThis as any).confirm?.(`${title}\n\n${message}`) === true
    );
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Continue", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
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
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<Banner>(null);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);

    try {
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
        ((data ?? []) as Submission[]).map(async (row) => ({
          ...row,
          front_photo_url: await photoUrl(row.front_photo_url),
          ingredients_photo_url: await photoUrl(row.ingredients_photo_url),
        }))
      );

      setSubmissions(rows);
    } catch (error: any) {
      setBanner({
        kind: "error",
        text: error?.message || "Submissions could not be loaded.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSubmissions();
    }, [loadSubmissions])
  );

  async function approve(item: Submission) {
    if (busyId) {
      return;
    }

    const confirmed = await confirmAction(
      "Approve product",
      `Add "${item.product_name || "this product"}" to the food database?`
    );

    if (!confirmed) {
      return;
    }

    setBusyId(item.id);
    setBanner(null);

    try {
      const message = await callReviewFunction("approve-product-submission", {
        submission_id: item.id,
      });

      setBanner({ kind: "success", text: message });
    } catch (error: any) {
      setBanner({ kind: "error", text: error?.message || "Approval failed." });
    } finally {
      setBusyId(null);
      await loadSubmissions();
    }
  }

  async function reject(item: Submission) {
    if (busyId) {
      return;
    }

    const confirmed = await confirmAction(
      "Reject submission",
      `Reject "${item.product_name || "this product"}"?`
    );

    if (!confirmed) {
      return;
    }

    setBusyId(item.id);
    setBanner(null);

    try {
      const message = await callReviewFunction("reject-product-submission", {
        submission_id: item.id,
        review_notes: (notes[item.id] ?? "").trim(),
      });

      setBanner({ kind: "success", text: message });
      setNotes((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    } catch (error: any) {
      setBanner({ kind: "error", text: error?.message || "Rejection failed." });
    } finally {
      setBusyId(null);
      await loadSubmissions();
    }
  }

  // ----- Not an admin -----
  if (authorized === false) {
    return (
      <SafeAreaView style={styles.centerPage} edges={["left", "right", "bottom"]}>
        <Text style={styles.deniedTitle}>Not authorized</Text>
        <Text style={styles.deniedText}>
          Only LabelLens administrators can review submissions.
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Pending submissions</Text>
        <Text style={styles.subtitle}>
          Check each product against its photos before approving.
        </Text>

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
          <ActivityIndicator
            size="large"
            color="#258D4D"
            style={styles.loader}
          />
        ) : null}

        {!loading && submissions.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No pending submissions.</Text>
          </View>
        ) : null}

        {submissions.map((item) => {
          const busy = busyId === item.id;

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
                          {index === 0 ? "No front photo" : "No ingredient photo"}
                        </Text>
                      </View>
                    )
                )}
              </View>

              <Text style={styles.name}>
                {item.product_name || "Unnamed product"}
              </Text>

              <Text style={styles.meta}>
                Brand: {item.brand_name || "Not recorded"}
              </Text>
              <Text style={styles.meta}>
                Barcode: {item.barcode || "Not recorded"}
              </Text>
              {item.variant ? (
                <Text style={styles.meta}>Variant: {item.variant}</Text>
              ) : null}
              <Text style={styles.meta}>
                Source: {item.source || "Not recorded"}
              </Text>

              <Text style={styles.heading}>Ingredients</Text>
              <Text style={styles.body}>
                {item.ingredients_text || "Not recorded"}
              </Text>

              <Text style={styles.heading}>Contains</Text>
              <Text style={styles.body}>
                {item.contains_text || "None recorded"}
              </Text>

              <Text style={styles.heading}>May contain</Text>
              <Text style={styles.body}>
                {item.may_contain_text || "None recorded"}
              </Text>

              <TextInput
                style={styles.notesInput}
                value={notes[item.id] ?? ""}
                onChangeText={(value) =>
                  setNotes((current) => ({ ...current, [item.id]: value }))
                }
                placeholder="Reviewer notes (optional, used when rejecting)"
                placeholderTextColor="#8A9A91"
                multiline
                editable={!busy}
              />

              <TouchableOpacity
                style={[styles.approveButton, busy && styles.disabled]}
                onPress={() => void approve(item)}
                disabled={busy || busyId !== null}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.approveText}>
                    Approve and add to food database
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.rejectButton, busy && styles.disabled]}
                onPress={() => void reject(item)}
                disabled={busy || busyId !== null}
              >
                <Text style={styles.rejectText}>Reject</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F8FBF8" },
  content: { padding: 16, paddingBottom: 40 },
  centerPage: {
    flex: 1,
    backgroundColor: "#F8FBF8",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
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
    color: "#264C37",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 12,
    marginBottom: 3,
  },
  body: { color: "#1D3829", fontSize: 13, lineHeight: 19 },
  notesInput: {
    minHeight: 60,
    borderWidth: 1,
    borderColor: "#B9C9BD",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    color: "#1D3829",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginTop: 14,
    textAlignVertical: "top",
  },
  approveButton: {
    minHeight: 48,
    borderRadius: 11,
    backgroundColor: "#258D4D",
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
    backgroundColor: "#258D4D",
  },
  backButtonText: { color: "#FFFFFF", fontWeight: "800" },
});