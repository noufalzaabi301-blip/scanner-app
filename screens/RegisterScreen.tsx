// ---------------------------------------------------------------------------
// screens/RegisterScreen.tsx
// Registration flow:
//   1. The user fills in the form and presses Continue (validated here).
//   2. The account is created.
//   3. Session returned  -> Privacy Notice (if this version was not
//                           accepted yet) -> allergy + halal setup -> Scan.
//      Email confirmation -> Login; after logging in, the same steps.
// The Privacy Notice is never shown before Login / Create account
// (lib/postAuthRoute.ts).
// The password stays in this screen's state; it is never put in route
// params. The product-submission choice is NOT asked here: it lives only in
// Preferences and is off until the user turns it on.
// ---------------------------------------------------------------------------

import { useRef, useState } from "react";

import {
  StyleSheet,
} from "react-native";

import LanguageSwitch from "../components/LanguageSwitch";
import { routeAfterSignIn } from "../lib/postAuthRoute";
import { deviceAcceptanceMetadata } from "../lib/privacyConsent";
import { usePageInsets } from "../lib/layout";
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
}: any) {
  const { t } = useI18n();
  // Shared responsive side padding (lib/layout.ts).
  const pageInsets = usePageInsets();

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

  // Already accepted on this device (e.g. when the app first opened)?
  // Then it is not shown a second time; the same acceptance is recorded
  // on the new account.
  // Step 1 -> 2: validate, then create the account. The Privacy Notice is
  // shown AFTER the account is signed in (lib/postAuthRoute.ts), never
  // before Login / Create account.
  async function submitRegistration() {
    if (loading || !validateForm()) {
      return;
    }

    await createAccount();
  }

  async function createAccount() {
    const values = validateForm();

    if (!values || creatingRef.current) {
      return;
    }

    const { cleanFirstName, cleanLastName, cleanEmail } = values;

    creatingRef.current = true;
    setLoading(true);

    try {
      // Only when this version was already accepted on this device (with
      // its real date). Otherwise the notice is shown once the account is
      // signed in, and accepting it there records it on the account.
      const privacy = (await deviceAcceptanceMetadata()) ?? {};

      const { data, error } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              first_name: cleanFirstName,
              last_name: cleanLastName,
              full_name: `${cleanFirstName} ${cleanLastName}`,
              // Recorded only if the user explicitly accepted the notice
              // on this device before.
              ...privacy,
            },
          },
        });

      if (error) {
        showMessage(t("register.failedTitle"), error.message);
        return;
      }

      if (data.session && data.user) {
        // Signed in: Privacy Notice (if not accepted yet), then the
        // first-time allergy + halal setup (cannot be skipped with
        // back/swipe).
        const next = await routeAfterSignIn(data.user);
        navigation.reset({ index: 0, routes: [next] });
      } else {
        // Email confirmation is on: after confirming, Login shows the
        // Privacy Notice and the first-time setup.
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
      contentContainerStyle={[styles.page, pageInsets]}
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
          onPress={() => void submitRegistration()}
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
    // Full width of the shared page column (lib/layout.ts).
    width: "100%",
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