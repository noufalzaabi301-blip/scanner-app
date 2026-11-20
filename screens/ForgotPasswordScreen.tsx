// ---------------------------------------------------------------------------
// screens/ForgotPasswordScreen.tsx
// Password reset with a SIX-DIGIT CODE from the email. Everything happens
// on this one screen; no reset link, URL hash or exchangeCodeForSession:
//   1. Enter email → supabase.auth.resetPasswordForEmail(email).
//      The screen STAYS here (it does not go to Login).
//   2. The six-digit code, new password and confirm-password fields appear.
//   3. supabase.auth.verifyOtp({ email, token: code, type: "recovery" }).
//   4. Only if that succeeds: supabase.auth.updateUser({ password }).
//   5. Only if that succeeds: sign out and go to Login.
//
// Requires the Supabase "Reset Password" email template to show {{ .Token }}
// and NOT {{ .ConfirmationURL }} (see README → Password reset). If the
// template still contains the link, users get a link that opens Login
// instead of a code, which is the "reset loop".
//
// For privacy, step 1 never says whether an email is registered.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";

import { usePageInsets } from "../lib/layout";
import { useI18n } from "../lib/i18n";
import PasswordInput from "../components/PasswordInput";
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

export default function ForgotPasswordScreen({ navigation, route }: any) {
  const { t } = useI18n();
  // Shared responsive side padding (lib/layout.ts).
  const pageInsets = usePageInsets();
  const [step, setStep] = useState<"email" | "code">("email");
  // Profile Settings passes the signed-in email (only fills the field in).
  const [email, setEmail] = useState(
    typeof route?.params?.email === "string" ? route.params.email : ""
  );
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

    if (!/^\d{6}$/.test(cleanCode)) {
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
      // 3. Verify the code. This signs the user in for the reset only.
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: cleanCode,
        type: "recovery",
      });

      if (verifyError) {
        showMessage(t("forgot.codeTitle"), t("forgot.codeWrong"));
        return;
      }

      // 4. Save the new password (only after the code was accepted).
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        showMessage(t("reset.failed"), updateError.message);
        return;
      }

      // 5. Success: sign out, then Login with the new password.
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
        contentContainerStyle={[styles.scroll, pageInsets]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>{t("forgot.title")}</Text>

          {step === "email" ? (
            <>
              <Text style={styles.description}>{t("forgot.description")}</Text>

              <Text style={styles.label}>{t("forgot.emailLabel")}</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#AAB8AE"
                placeholder="name@example.com"
                accessibilityLabel={t("forgot.emailLabel")}
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

              <Text style={styles.label}>{t("forgot.codeLabel")}</Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                accessibilityLabel={t("forgot.codeLabel")}
                placeholderTextColor="#AAB8AE"
                placeholder="123456"
              />

              <Text style={styles.label}>{t("reset.newPassword")}</Text>
              <PasswordInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={t("reset.newPasswordPlaceholder")}
              />

              <Text style={styles.label}>{t("reset.confirm")}</Text>
              <PasswordInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
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
    // Digits always read left to right, also in Arabic.
    writingDirection: "ltr",
  },
  label: {
    color: "#17452F",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
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
    // Full width of the shared page column (lib/layout.ts).
    width: "100%",
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