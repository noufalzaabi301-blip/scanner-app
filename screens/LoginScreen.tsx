// ---------------------------------------------------------------------------
// screens/LoginScreen.tsx
// Email/password sign-in. After login, users who have never saved
// preferences are sent to Preferences first; everyone else goes to Home.
// ---------------------------------------------------------------------------

import { useState } from "react";
import {
  StyleSheet,
} from "react-native";

import LanguageSwitch from "../components/LanguageSwitch";
import { hasAcceptedCurrentPrivacy } from "../lib/constants";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { showMessage } from "../lib/ui/messages";
import { hasSavedPreferences } from "../lib/userPreferences";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "../components/Themed";

export default function LoginScreen({ navigation }: any) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      showMessage(t("login.missingTitle"), t("login.missingBody"));
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      // Security: one generic message, so the screen never reveals whether
      // an email address is registered.
      if (error) {
        showMessage(t("login.failedTitle"), t("login.failedBody"));
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        showMessage(t("login.failedTitle"), t("login.accountLoadFailed"));
        return;
      }

      // Privacy gate: nobody reaches Preferences or Home without having
      // accepted the current Privacy Notice (for example an account created
      // before this check existed, or after the notice version changes).
      if (!hasAcceptedCurrentPrivacy(user.user_metadata)) {
        navigation.reset({
          index: 0,
          routes: [{ name: "PrivacyNotice", params: { fromLogin: true } }],
        });
        return;
      }

      let hasPreferences: boolean;

      try {
        hasPreferences = await hasSavedPreferences(user.id);
      } catch (preferencesError: any) {
        showMessage(t("login.prefsLoadFailed"), preferencesError?.message);
        return;
      }

      navigation.replace(hasPreferences ? "Home" : "Preferences");
    } catch {
      showMessage(t("common.connectionProblem"), t("login.connectionBody"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        <LanguageSwitch />

        <Text style={styles.title}>{t("login.title")}</Text>

        <Text style={styles.subtitle}>{t("login.subtitle")}</Text>

        <Text style={styles.label}>{t("common.email")}</Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#AAB8AE"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>{t("common.password")}</Text>

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#AAB8AE"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={styles.showPasswordButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Text style={styles.showPasswordText}>
              {showPassword ? t("login.hide") : t("login.show")}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")}>
          <Text style={styles.forgot}>{t("login.forgot")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.disabledButton]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? t("login.signingIn") : t("common.signIn")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Register")}>
          <Text style={styles.createAccount}>
            {t("login.noAccount")}
            <Text style={styles.createAccountLink}>
              {t("common.createAccount")}
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// Styles used by the Login screen.
const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    backgroundColor: "#F7F9F7",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 30,
  },

  content: {
    width: "100%",
    maxWidth: 320,
  },

  title: {
    color: "#17452F",
    fontSize: 24,
    fontWeight: "700",
  },

  subtitle: {
    color: "#63776B",
    fontSize: 13,
    marginTop: 5,
    marginBottom: 21,
  },

  label: {
    color: "#17452F",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 7,
  },

  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#DCE5DE",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#17452F",
    marginBottom: 15,
  },

  passwordContainer: {
    position: "relative",
    marginBottom: 15,
  },

  passwordInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#DCE5DE",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingEnd: 65, // room for "Show" (left side in Arabic)
    fontSize: 14,
    color: "#17452F",
  },

  showPasswordButton: {
    position: "absolute",
    end: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },

  showPasswordText: {
    color: "#176B43",
    fontSize: 13,
    fontWeight: "600",
  },

  forgot: {
    color: "#176B43",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "right",
    marginTop: -3,
    marginBottom: 21,
  },

  button: {
    minHeight: 48,
    backgroundColor: "#176B43",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  disabledButton: {
    opacity: 0.6,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  createAccount: {
    color: "#63776B",
    fontSize: 13,
    textAlign: "center",
    marginTop: 20,
  },

  createAccountLink: {
    color: "#176B43",
    fontWeight: "700",
  },
});