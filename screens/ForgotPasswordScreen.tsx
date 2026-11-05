// ---------------------------------------------------------------------------
// screens/ForgotPasswordScreen.tsx
// Sends a Supabase password-reset email.
// ---------------------------------------------------------------------------

import { useState } from "react";
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

export default function ForgotPasswordScreen() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  async function sendResetLink() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      showMessage(t("forgot.missingTitle"), t("forgot.missingBody"));
      return;
    }

    setLoading(true);

    try {
      const { data: accountExists, error: checkError } = await supabase.rpc(
        "is_registered_email",
        { check_email: cleanEmail }
      );

      if (checkError) {
        showMessage(t("forgot.checkFailed"), checkError.message);
        return;
      }

      if (!accountExists) {
        showMessage(t("forgot.notFoundTitle"), t("forgot.notFoundBody"));
        return;
      }

      // Workaround: `window.location` only exists on the web build. On
      // iOS/Android reading it would crash, so there we let Supabase use the
      // project's default Site URL from the dashboard.
      const redirectOptions =
        Platform.OS === "web" && typeof window !== "undefined"
          ? { redirectTo: `${window.location.origin}/reset-password` }
          : undefined;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        redirectOptions
      );

      if (resetError) {
        showMessage(t("forgot.resetFailed"), resetError.message);
        return;
      }

      showMessage(t("forgot.sentTitle"), t("forgot.sentBody"));
    } catch {
      showMessage(t("common.connectionProblem"), t("forgot.connectionBody"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>{t("forgot.title")}</Text>

        <Text style={styles.description}>{t("forgot.description")}</Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="name@example.com"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.disabledButton]}
          onPress={sendResetLink}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? t("forgot.sending") : t("forgot.send")}
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
    justifyContent: "center",
    alignItems: "center",
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