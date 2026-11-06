// ---------------------------------------------------------------------------
// screens/ProfileSettingsScreen.tsx
// Profile settings:
//   1. Preferences – halal preference and "Send scanned products for
//      verification". This is the ONLY place these two switches exist
//      (the allergy editor does not show them). Each switch loads from and
//      saves immediately to public.user_preferences, so the value is kept
//      after restarting the app.
//   2. Your details – first / last name (Supabase auth user metadata);
//      the email is read-only because changing it needs verification.
//   3. Change password.
// ---------------------------------------------------------------------------

import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  StyleSheet,
} from "react-native";

import SettingsRow, {
  SettingsDivider,
  SettingsGroup,
} from "../components/SettingsRow";
import { COLORS, ROUTES } from "../lib/constants";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { showMessage } from "../lib/ui/messages";
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
  TextInput,
  TouchableOpacity,
  View,
} from "../components/Themed";

type ToggleField = "prefers_halal" | "submit_products_for_review";

type Status = { kind: "success" | "error"; text: string } | null;

export default function ProfileSettingsScreen({ navigation }: any) {
  const { t } = useI18n();

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Inline messages under each form, in addition to the alert.
  const [profileStatus, setProfileStatus] = useState<Status>(null);
  const [passwordStatus, setPasswordStatus] = useState<Status>(null);

  // Halal + submission consent (from public.user_preferences).
  const [userId, setUserId] = useState<string | null>(null);
  const [preferences, setPreferences] =
    useState<UserPreferences>(EMPTY_PREFERENCES);
  const [savingField, setSavingField] = useState<ToggleField | null>(null);
  const [preferenceStatus, setPreferenceStatus] = useState<Status>(null);

  // Reload whenever the screen is shown, so values are always current.
  useFocusEffect(
    useCallback(() => {
      void loadUser();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  async function loadUser() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      showMessage(
        t("settings.signInRequiredTitle"),
        t("settings.signInRequiredBody")
      );
      navigation.replace("Login");
      return;
    }

    setUserId(user.id);
    setEmail(user.email ?? "");
    setFirstName(String(user.user_metadata?.first_name ?? ""));
    setLastName(String(user.user_metadata?.last_name ?? ""));

    try {
      setPreferences(await fetchPreferencesForUser(user.id));
    } catch {
      setPreferenceStatus({ kind: "error", text: t("profile.loadFailed") });
    }

    setLoading(false);
  }

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
    setPreferenceStatus(null);

    try {
      const { data, error } = await supabase
        .from("user_preferences")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .select("user_id");

      if (error || !data || data.length === 0) {
        throw error ?? new Error("No row updated");
      }

      setPreferenceStatus({ kind: "success", text: t("profile.savedSetting") });
    } catch {
      setPreferences(previous);
      setPreferenceStatus({ kind: "error", text: t("profile.saveSettingFailed") });
    } finally {
      setSavingField(null);
    }
  }

  const switchTrack = { false: "#C9D4CC", true: "#8FC9A5" };

  async function saveProfile() {
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();

    setProfileStatus(null);

    if (!cleanFirstName || !cleanLastName) {
      setProfileStatus({ kind: "error", text: t("settings.missingName") });
      showMessage(t("login.missingTitle"), t("settings.missingName"));
      return;
    }

    setSavingProfile(true);

    const { error } = await supabase.auth.updateUser({
      data: {
        first_name: cleanFirstName,
        last_name: cleanLastName,
        full_name: `${cleanFirstName} ${cleanLastName}`,
      },
    });

    setSavingProfile(false);

    if (error) {
      setProfileStatus({ kind: "error", text: error.message });
      showMessage(t("settings.saveFailed"), error.message);
      return;
    }

    setFirstName(cleanFirstName);
    setLastName(cleanLastName);
    setProfileStatus({ kind: "success", text: t("settings.savedBody") });
    showMessage(t("settings.savedTitle"), t("settings.savedBody"));
  }

  async function changePassword() {
    setPasswordStatus(null);

    function fail(title: string, body: string) {
      setPasswordStatus({ kind: "error", text: body });
      showMessage(title, body);
    }

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      fail(t("login.missingTitle"), t("settings.missingPasswords"));
      return;
    }

    // Matches the Supabase Auth minimum password length.
    if (newPassword.length < 8) {
      fail(t("register.shortTitle"), t("reset.shortBody"));
      return;
    }

    if (newPassword !== confirmNewPassword) {
      fail(t("register.mismatchTitle"), t("settings.mismatchBody"));
      return;
    }

    setSavingPassword(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      setSavingPassword(false);
      showMessage(t("prefs.sessionExpiredTitle"), t("settings.sessionExpiredBody"));
      navigation.replace("Login");
      return;
    }

    // Security: re-check the current password before allowing a change, so
    // someone holding an unlocked phone cannot silently take over the
    // account.
    const { error: verificationError } =
      await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

    if (verificationError) {
      setSavingPassword(false);
      fail(t("settings.incorrectTitle"), t("settings.incorrectBody"));
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSavingPassword(false);

    if (updateError) {
      fail(t("settings.passwordFailed"), updateError.message);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");

    setPasswordStatus({ kind: "success", text: t("settings.passwordChangedBody") });
    showMessage(
      t("settings.passwordChangedTitle"),
      t("settings.passwordChangedBody")
    );
  }

  function StatusText({ status }: { status: Status }) {
    if (!status) {
      return null;
    }

    return (
      <Text
        style={[
          styles.status,
          status.kind === "success" ? styles.statusSuccess : styles.statusError,
        ]}
      >
        {status.text}
      </Text>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.page, styles.loadingPage]}>
        <ActivityIndicator size="large" color="#176B43" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>{t("title.profileSettings")}</Text>

          {/* 1. Preferences: the only place these two switches exist. */}
          <Text style={styles.sectionTitle}>{t("settings.preferences")}</Text>

          <SettingsGroup>
            <SettingsRow
              icon="restaurant-outline"
              title={t("profile.halal")}
              right={
                savingField === "prefers_halal" ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <Switch
                    trackColor={switchTrack}
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
                    trackColor={switchTrack}
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

          <Text style={styles.preferenceNote}>
            {preferences.exists
              ? t("prefs.submitBody")
              : t("profile.setupPreferences")}
          </Text>

          <StatusText status={preferenceStatus} />

          <View style={styles.divider} />

          {/* 2. Your details */}
          <Text style={styles.sectionTitle}>{t("settings.details")}</Text>

          <Text style={styles.label}>{t("settings.firstName")}</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder={t("settings.firstName")}
            autoCapitalize="words"
          />

          <Text style={styles.label}>{t("settings.lastName")}</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder={t("settings.lastName")}
            autoCapitalize="words"
          />

          <Text style={styles.label}>{t("settings.email")}</Text>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={email}
            editable={false}
          />
          <Text style={styles.hint}>{t("settings.emailHint")}</Text>

          <TouchableOpacity
            style={[styles.button, savingProfile && styles.disabledButton]}
            onPress={saveProfile}
            disabled={savingProfile}
          >
            {savingProfile ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>{t("settings.saveProfile")}</Text>
            )}
          </TouchableOpacity>

          <StatusText status={profileStatus} />

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>{t("settings.changePassword")}</Text>

          <Text style={styles.label}>{t("settings.currentPassword")}</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            placeholder={t("settings.currentPlaceholder")}
          />

          <Text style={styles.label}>{t("reset.newPassword")}</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder={t("settings.newPlaceholder")}
          />

          <Text style={styles.label}>{t("reset.confirm")}</Text>
          <TextInput
            style={styles.input}
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            secureTextEntry
            placeholder={t("settings.confirmPlaceholder")}
          />

          <TouchableOpacity
            style={[styles.button, savingPassword && styles.disabledButton]}
            onPress={changePassword}
            disabled={savingPassword}
          >
            {savingPassword ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>{t("reset.update")}</Text>
            )}
          </TouchableOpacity>

          <StatusText status={passwordStatus} />
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

  preferenceNote: {
    color: "#68766F",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },

  loadingPage: {
    alignItems: "center",
    justifyContent: "center",
  },

  hint: {
    color: "#68766F",
    fontSize: 12,
    lineHeight: 17,
    marginTop: -10,
    marginBottom: 18,
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
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 26,
  },

  sectionTitle: {
    color: "#17452F",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },

  label: {
    color: "#17452F",
    fontWeight: "600",
    marginBottom: 7,
  },

  input: {
    borderColor: "#C9D8CF",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 18,
  },

  disabledInput: {
    backgroundColor: "#F2F5F3",
    color: "#68766F",
  },

  button: {
    backgroundColor: "#176B43",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },

  disabledButton: {
    opacity: 0.6,
  },

  divider: {
    height: 1,
    backgroundColor: "#E2EAE5",
    marginVertical: 30,
  },
});