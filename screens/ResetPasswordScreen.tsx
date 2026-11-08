// ---------------------------------------------------------------------------
// screens/ResetPasswordScreen.tsx
// Lets the user choose a new password after opening a reset link.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import {
  Platform,
  StyleSheet,
} from "react-native";

import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { showMessage } from "../lib/ui/messages";
import {
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "../components/Themed";

export default function ResetPasswordScreen({ navigation }: any) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Workaround: lib/supabase.ts sets detectSessionInUrl to false, so on
    // the web we read the recovery tokens from the URL hash ourselves and
    // then remove them from the address bar so they are not left visible.
    async function startRecoverySession() {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const hashParameters = new URLSearchParams(
          window.location.hash.substring(1)
        );

        const accessToken = hashParameters.get("access_token");
        const refreshToken = hashParameters.get("refresh_token");

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (!error && data.session) {
            window.history.replaceState({}, document.title, "/reset-password");
            setReady(true);
            return;
          }
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      setReady(!!session);
    }

    startRecoverySession();
  }, []);

  async function updatePassword() {
    if (password.length < 8) {
      showMessage(t("register.shortTitle"), t("reset.shortBody"));
      return;
    }

    if (password !== confirmPassword) {
      showMessage(t("register.mismatchTitle"), t("reset.mismatchBody"));
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        showMessage(t("reset.failed"), error.message);
        return;
      }

      showMessage(t("reset.doneTitle"), t("reset.doneBody"));

      // Sign out so the recovery session cannot be reused.
      await supabase.auth.signOut();
      navigation.replace("Login");
    } catch {
      showMessage(t("common.connectionProblem"), t("reset.connectionBody"));
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.card}>
          <Text style={styles.title}>{t("title.resetPassword")}</Text>
          <Text style={styles.description}>{t("reset.invalid")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>{t("reset.title")}</Text>

        <Text style={styles.description}>{t("reset.description")}</Text>

        <Text style={styles.label}>{t("reset.newPassword")}</Text>

        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder={t("reset.newPassword")}
        />

        <Text style={styles.label}>{t("reset.confirm")}</Text>

        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder={t("reset.confirmPlaceholder")}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.disabledButton]}
          onPress={updatePassword}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? t("reset.updating") : t("reset.update")}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F7F9F7",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 30,
  },
  title: {
    color: "#17452F",
    fontSize: 27,
    fontWeight: "bold",
    textAlign: "center",
  },
  description: {
    color: "#68766F",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 24,
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
  button: {
    backgroundColor: "#176B43",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
});
