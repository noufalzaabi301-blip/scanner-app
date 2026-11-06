// ---------------------------------------------------------------------------
// screens/ForgotPasswordScreen.tsx
// Simple password reset with a code from the email (no links to open):
//   Step 1  Enter email → Supabase emails a reset code.
//   Step 2  Enter the code + new password → password is changed → Login.
//
// Why a code instead of a link: reset links must open the app or the right
// web page, which often fails on phones. A code works everywhere.
// Requires the Supabase "Reset Password" email template to contain
// {{ .Token }} (see README → Password reset).
//
// For privacy, step 1 never says whether an email is registered.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";

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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen({ navigation }: any) {
  const { t } = useI18n();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ----- Step 1: send the code ---------------------------------------------

  async function sendCode() {
    const cleanEmail = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(cleanEmail)) {
      showMessage(t("forgot.missingTitle"), t("forgot.missingBody"));
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);

      // Too many requests is the only error worth showing; anything else
      // would reveal whether the email is registered.
      if (error && /rate|limit|seconds/i.test(error.message)) {
        showMessage(t("forgot.resetFailed"), error.message);
        return;
      }

      setEmail(cleanEmail);
      setStep("code");
    } catch {
      showMessage(t("common.connectionProblem"), t("forgot.connectionBody"));
    } finally {
      setLoading(false);
    }
  }

  // ----- Step 2: verify the code and save the new password -----------------

  async function resetPassword() {
    const cleanCode = code.replace(/\s/g, "");

    if (!/^\d{6,10}$/.test(cleanCode)) {
      showMessage(t("forgot.codeTitle"), t("forgot.codeInvalid"));
      return;
    }

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
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: cleanCode,
        type: "recovery",
      });

      if (verifyError) {
        showMessage(t("forgot.codeTitle"), t("forgot.codeWrong"));
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        showMessage(t("reset.failed"), updateError.message);
        return;
      }

      // Sign out so the user logs in with the new password.
      await supabase.auth.signOut();
      showMessage(t("reset.doneTitle"), t("reset.doneBody"));
      navigation.reset({ index: 0, routes: [{ name: "Login" }] });
    } catch {
      showMessage(t("common.connectionProblem"), t("reset.connectionBody"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>{t("forgot.title")}</Text>

          {step === "email" ? (
            <>
              <Text style={styles.description}>{t("forgot.description")}</Text>

              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#AAB8AE"
                placeholder="name@example.com"
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.disabledButton]}
                onPress={sendCode}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>{t("forgot.sendCode")}</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.description}>
                {t("forgot.codeSent", { email })}
              </Text>

              <TextInput
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={10}
                placeholderTextColor="#AAB8AE"
                placeholder="123456"
              />

              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor="#AAB8AE"
                placeholder={t("reset.newPassword")}
              />

              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholderTextColor="#AAB8AE"
                placeholder={t("reset.confirmPlaceholder")}
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.disabledButton]}
                onPress={resetPassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>{t("reset.update")}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                onPress={sendCode}
                disabled={loading}
              >
                <Text style={styles.linkText}>{t("forgot.resend")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => {
                  setStep("email");
                  setCode("");
                }}
                disabled={loading}
              >
                <Text style={styles.linkText}>{t("forgot.changeEmail")}</Text>
              </TouchableOpacity>
            </>
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
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  codeInput: {
    fontSize: 22,
    letterSpacing: 6,
    textAlign: "center",
  },
  linkButton: {
    alignItems: "center",
    paddingVertical: 10,
    marginTop: 4,
  },
  linkText: {
    color: "#176B43",
    fontWeight: "700",
    textAlign: "center",
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