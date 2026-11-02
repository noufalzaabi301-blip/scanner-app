// ---------------------------------------------------------------------------
// components/ProductSubmissionPreference.tsx
// One-time setting: "Help improve LabelLens by sending scanned products
// for verification". Loads and saves user_preferences.submit_products_for_review.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { supabase } from "../lib/supabase";

function showMessage(title: string, message: string) {
  if (Platform.OS === "web") {
    (globalThis as any).alert?.(`${title}\n\n${message}`);
    return;
  }

  Alert.alert(title, message);
}

export default function ProductSubmissionPreference() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          return;
        }

        const { data, error } = await supabase
          .from("user_preferences")
          .select("submit_products_for_review")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (active) {
          setEnabled(data?.submit_products_for_review === true);
        }
      } catch (error: any) {
        console.warn(
          "Could not load submission preference:",
          error?.message ?? "unknown error"
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  async function changePreference(next: boolean) {
    const previous = enabled;
    setEnabled(next);
    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Not signed in.");
      }

      // Update the existing preferences row; create it if there is none.
      const { data: updated, error: updateError } = await supabase
        .from("user_preferences")
        .update({ submit_products_for_review: next })
        .eq("user_id", user.id)
        .select("user_id");

      if (updateError) {
        throw updateError;
      }

      if (!updated || updated.length === 0) {
        const { error: insertError } = await supabase
          .from("user_preferences")
          .insert({ user_id: user.id, submit_products_for_review: next });

        if (insertError) {
          throw insertError;
        }
      }
    } catch (error: any) {
      setEnabled(previous);
      console.warn(
        "Could not save submission preference:",
        error?.message ?? "unknown error"
      );
      showMessage(
        "Could not save",
        "Your choice could not be saved. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>
          Help improve LabelLens by sending scanned products for verification
        </Text>

        {loading || saving ? (
          <ActivityIndicator color="#258D4D" />
        ) : (
          <Switch
            value={enabled}
            onValueChange={(value) => void changePreference(value)}
            trackColor={{ false: "#C9D4CC", true: "#8FC9A5" }}
            thumbColor={enabled ? "#258D4D" : "#F4F6F5"}
            accessibilityLabel="Send scanned products for verification"
          />
        )}
      </View>

      <Text style={styles.explanation}>
        When this is on, the barcode, the product information read from the
        label (name, brand, ingredients and allergen statements) and the
        package photos may be sent to LabelLens so the developer can verify
        the product and add it to the database. Your allergy profile is not
        sent. This is off unless you turn it on, and you can turn it off at
        any time.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE7E0",
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    flex: 1,
    color: "#163D2A",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  explanation: {
    color: "#63776B",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
});