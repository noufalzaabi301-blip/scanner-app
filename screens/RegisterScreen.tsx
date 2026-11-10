// ---------------------------------------------------------------------------
// screens/RegisterScreen.tsx
// Registration flow:
//   1. The user fills in the form and presses Continue (validated here).
//   2. The Privacy Notice opens (PrivacyNotice, fromSignup: true).
//   3. Only after the user ticks and accepts it does the notice return here
//      with privacyAccepted: true, and the account is created.
//   4. Session returned  -> Preferences.
//      Email confirmation -> Login (the notice was already accepted in 2).
// The password stays in this screen's state; it is never put in route
// params. The product-submission choice is NOT asked here: it lives only in
// Preferences and is off until the user turns it on.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";

import {
  StyleSheet,
} from "react-native";

import LanguageSwitch from "../components/LanguageSwitch";
import { PRIVACY_VERSION } from "../lib/constants";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { showMessage } from "../lib/ui/messages";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "../components/Themed";

export default function RegisterScreen({
  navigation,
  route,
}: any) {
  const { t } = useI18n();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);

  // Prevents a second sign-up if the accepted param is delivered twice.
  const creatingRef = useRef(false);

  // Returns the cleaned form values, or null after showing a message.
  function validateForm() {
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (
      !cleanFirstName ||
      !cleanLastName ||
      !cleanEmail ||
      !password ||
      !confirmPassword
    ) {
      showMessage(t("login.missingTitle"), t("register.missingBody"));
      return null;
    }

    // Same minimum as the Supabase Auth password policy, checked here first
    // so the user gets a clear message before any network request.
    if (password.length < 8) {
      showMessage(t("register.shortTitle"), t("register.shortBody"));
      return null;
    }

    if (password !== confirmPassword) {
      showMessage(t("register.mismatchTitle"), t("register.mismatchBody"));
      return null;
    }

    return { cleanFirstName, cleanLastName, cleanEmail };
  }

  // Step 1 -> 2: validate, then show the Privacy Notice. No account yet.
  function continueToPrivacyNotice() {
    if (loading || !validateForm()) {
      return;
    }

    navigation.navigate("PrivacyNotice", { fromSignup: true });
  }

  // Step 3: the Privacy Notice sends privacyAccepted: true back here only
  // after the user explicitly accepted it.
  useEffect(() => {
    if (route?.params?.privacyAccepted !== true) {
      return;
    }

    navigation.setParams({ privacyAccepted: undefined });
    void createAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.privacyAccepted]);

  async function createAccount() {
    const values = validateForm();

    if (!values || creatingRef.current) {
      return;
    }

    const { cleanFirstName, cleanLastName, cleanEmail } = values;

    creatingRef.current = true;
    setLoading(true);

    try {
      const { data, error } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              first_name: cleanFirstName,
              last_name: cleanLastName,
              full_name: `${cleanFirstName} ${cleanLastName}`,
              // Recorded only because the user has just accepted the
              // notice on the previous screen.
              privacy_accepted: true,
              privacy_version: PRIVACY_VERSION,
              privacy_accepted_at:
                new Date().toISOString(),
            },
          },
        });

      if (error) {
        showMessage(t("register.failedTitle"), error.message);
        return;
      }

      if (data.session) {
        // Step 4: first-time setup (cannot be skipped with back/swipe).
        navigation.reset({
          index: 0,
          routes: [{ name: "Preferences" }],
        });
      } else {
        // Email confirmation is on: the notice was already accepted.
        showMessage(t("register.verifyTitle"), t("register.verifyBody"));

        navigation.reset({
          index: 0,
          routes: [{ name: "Login" }],
        });
      }
    } catch (error: any) {
      showMessage(
        t("common.connectionProblem"),
        error?.message || t("register.connectionBody")
      );
    } finally {
      creatingRef.current = false;
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

        <Text style={styles.title}>{t("register.title")}</Text>

        <Text style={styles.subtitle}>{t("register.subtitle")}</Text>

        <Text style={styles.label}>{t("register.firstName")}</Text>

        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder={t("register.firstNamePlaceholder")}
          placeholderTextColor="#AAB8AE"
          autoCapitalize="words"
          autoCorrect={false}
        />

        <Text style={styles.label}>{t("register.lastName")}</Text>

        <TextInput
          style={styles.input}
          value={lastName}
          onChangeText={setLastName}
          placeholder={t("register.lastNamePlaceholder")}
          placeholderTextColor="#AAB8AE"
          autoCapitalize="words"
          autoCorrect={false}
        />

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
            placeholder={t("register.passwordPlaceholder")}
            placeholderTextColor="#AAB8AE"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={styles.showButton}
            onPress={() =>
              setShowPassword((current) => !current)
            }
            activeOpacity={0.8}
          >
            <Text style={styles.showButtonText}>
              {showPassword ? t("login.hide") : t("login.show")}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>{t("register.confirmPassword")}</Text>

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t("register.confirmPlaceholder")}
            placeholderTextColor="#AAB8AE"
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={styles.showButton}
            onPress={() =>
              setShowConfirmPassword(
                (current) => !current
              )
            }
            activeOpacity={0.8}
          >
            <Text style={styles.showButtonText}>
              {showConfirmPassword ? t("login.hide") : t("login.show")}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.privacyHint}>{t("register.privacyHint")}</Text>

        <TouchableOpacity
          style={[
            styles.button,
            loading && styles.disabledButton,
          ]}
          onPress={continueToPrivacyNotice}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {loading ? t("register.creating") : t("common.continue")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginLinkButton}
          onPress={() =>
            navigation.replace("Login")
          }
          activeOpacity={0.8}
        >
          <Text style={styles.loginLinkText}>
            {t("register.haveAccount")}
            <Text style={styles.loginLinkGreen}>{t("register.logIn")}</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

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
    paddingEnd: 68, // room for "Show" (left side in Arabic)
    fontSize: 14,
    color: "#17452F",
  },

  showButton: {
    position: "absolute",
    end: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },

  showButtonText: {
    color: "#176B43",
    fontSize: 13,
    fontWeight: "700",
  },

  button: {
    minHeight: 48,
    backgroundColor: "#176B43",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },

  disabledButton: {
    opacity: 0.6,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  privacyHint: {
    color: "#68766F",
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },

  loginLinkButton: {
    alignItems: "center",
    marginTop: 22,
  },

  loginLinkText: {
    color: "#68766F",
    fontSize: 14,
  },

  loginLinkGreen: {
    color: "#176B43",
    fontWeight: "bold",
  },
});