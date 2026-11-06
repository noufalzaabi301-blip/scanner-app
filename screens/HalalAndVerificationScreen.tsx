// ---------------------------------------------------------------------------
// screens/HalalAndVerificationScreen.tsx
// Halal preference and "Send scanned products for verification".
//
// This is the ONLY screen that shows these two switches (not Profile,
// Profile settings or the allergy editor). Each switch loads from and saves
// immediately to public.user_preferences, so the value is kept after
// restarting the app. No name, email, password or allergy data is shown.
//
// Opened from Profile → Preferences → "Halal and product verification".
// ---------------------------------------------------------------------------

import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";

import SettingsRow, {
  SettingsDivider,
  SettingsGroup,
} from "../components/SettingsRow";
import { COLORS, ROUTES } from "../lib/constants";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import {
  EMPTY_PREFERENCES,
  fetchPreferencesForUser,
  type UserPreferences,
} from "../lib/userPreferences";
import {
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "../components/Themed";

type ToggleField = "prefers_halal" | "submit_products_for_review";

type Status = { kind: "success" | "error"; text: string } | null;

const SWITCH_TRACK = { false: "#C9D4CC", true: "#8FC9A5" };

export default function HalalAndVerificationScreen({ navigation }: any) {
  const { t } = useI18n();

  const [userId, setUserId] = useState<string | null>(null);
  const [preferences, setPreferences] =
    useState<UserPreferences>(EMPTY_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<ToggleField | null>(null);
  const [status, setStatus] = useState<Status>(null);

  // ----- Loading -----------------------------------------------------------

  const load = useCallback(async () => {
    setLoading(true);
    setStatus(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;

    if (!user) {
      navigation.replace(ROUTES.Login);
      return;
    }

    setUserId(user.id);

    try {
      setPreferences(await fetchPreferencesForUser(user.id));
    } catch {
      setStatus({ kind: "error", text: t("profile.loadFailed") });
    } finally {
      setLoading(false);
    }
  }, [navigation, t]);

  // Reload whenever the screen is shown, so values are always current.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // ----- Saving ------------------------------------------------------------

  // Saves one switch immediately. Row Level Security limits the update to
  // the user's own row; .select() confirms a row was really changed.
  async function toggleSetting(field: ToggleField, value: boolean) {
    if (!userId || savingField) {
      return;
    }

    // The row is created by the allergy setup; send the user there first.
    if (!preferences.exists) {
      navigation.navigate(ROUTES.Preferences);
      return;
    }

    const previous = preferences;

    setPreferences(
      field === "prefers_halal"
        ? { ...preferences, prefersHalal: value }
        : { ...preferences, submitProducts: value }
    );
    setSavingField(field);
    setStatus(null);

    try {
      const { data, error } = await supabase
        .from("user_preferences")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .select("user_id");

      if (error || !data || data.length === 0) {
        throw error ?? new Error("No row updated");
      }

      setStatus({ kind: "success", text: t("profile.savedSetting") });
    } catch {
      setPreferences(previous);
      setStatus({ kind: "error", text: t("profile.saveSettingFailed") });
    } finally {
      setSavingField(null);
    }
  }

  // ----- Render ------------------------------------------------------------

  if (loading) {
    return (
      <SafeAreaView style={[styles.page, styles.loadingPage]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>{t("profile.halalAndVerification")}</Text>

          <SettingsGroup>
            <SettingsRow
              icon="restaurant-outline"
              title={t("profile.halal")}
              right={
                savingField === "prefers_halal" ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <Switch
                    trackColor={SWITCH_TRACK}
                    thumbColor={preferences.prefersHalal ? "#176B43" : "#F4F6F5"}
                    value={preferences.prefersHalal}
                    onValueChange={(value) => toggleSetting("prefers_halal", value)}
                    disabled={savingField !== null}
                    accessibilityLabel={t("profile.halal")}
                  />
                )
              }
            />

            <SettingsDivider />

            <SettingsRow
              icon="cloud-upload-outline"
              title={t("profile.submissions")}
              subtitle={t("profile.submissionsHint")}
              right={
                savingField === "submit_products_for_review" ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <Switch
                    trackColor={SWITCH_TRACK}
                    thumbColor={preferences.submitProducts ? "#176B43" : "#F4F6F5"}
                    value={preferences.submitProducts}
                    onValueChange={(value) =>
                      toggleSetting("submit_products_for_review", value)
                    }
                    disabled={savingField !== null}
                    accessibilityLabel={t("prefs.submitA11y")}
                  />
                )
              }
            />
          </SettingsGroup>

          {preferences.exists ? (
            <Text style={styles.note}>{t("prefs.submitBody")}</Text>
          ) : (
            <>
              <Text style={styles.note}>{t("profile.setupPreferences")}</Text>
              <TouchableOpacity
                style={styles.button}
                onPress={() => navigation.navigate(ROUTES.Preferences)}
                accessibilityRole="button"
              >
                <Text style={styles.buttonText}>
                  {t("halalVerify.setupButton")}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {status && (
            <Text
              style={[
                styles.status,
                status.kind === "success" ? styles.statusSuccess : styles.statusError,
              ]}
            >
              {status.text}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F7F9F7",
  },

  loadingPage: {
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    padding: 20,
  },

  card: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
  },

  title: {
    color: "#17452F",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 22,
  },

  note: {
    color: "#68766F",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },

  button: {
    backgroundColor: "#176B43",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
    marginTop: 14,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },

  status: {
    fontSize: 13,
    lineHeight: 19,
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    overflow: "hidden",
  },

  statusSuccess: {
    color: "#176B43",
    backgroundColor: "#E8F5E9",
  },

  statusError: {
    color: "#B42318",
    backgroundColor: "#FDECEA",
  },
});
