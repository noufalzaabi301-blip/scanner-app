// ---------------------------------------------------------------------------
// screens/ProfileSettingsScreen.tsx
// Profile settings (account details only):
//   1. Your details – first / last name (Supabase auth user metadata);
//      the email is read-only because changing it needs verification.
//   2. Change password.
// Halal and product-verification switches are NOT here; they live only in
// HalalAndVerificationScreen.tsx.
// ---------------------------------------------------------------------------

import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  StyleSheet,
} from "react-native";

import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { showMessage } from "../lib/ui/messages";
import {
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "../components/Themed";

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

    setEmail(user.email ?? "");
    setFirstName(String(user.user_metadata?.first_name ?? ""));
    setLastName(String(user.user_metadata?.last_name ?? ""));

    setLoading(false);
  }

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

          {/* 1. Your details */}
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

          {/* 2. Change password */}
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