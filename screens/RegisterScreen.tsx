import { useState } from "react";

import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { supabase } from "../lib/supabase";
import {
  clearPendingSubmissionConsent,
  readPendingSubmissionConsent,
} from "../lib/productSubmissionConsent";

export default function RegisterScreen({
  navigation,
  route,
}: any) {
  // Consent passed directly (if any). Otherwise the choice saved on the
  // Privacy Notice before the account existed is used.
  const routeConsent: boolean | undefined =
    typeof route?.params?.submitProductsForReview === "boolean"
      ? route.params.submitProductsForReview
      : undefined;

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

  function showMessage(
    title: string,
    message: string
  ) {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  async function createAccount() {
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
      showMessage(
        "Missing information",
        "Please complete every field."
      );
      return;
    }

    if (password.length < 8) {
      showMessage(
        "Password too short",
        "Your password must contain at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      showMessage(
        "Passwords do not match",
        "Enter the same password in both password fields."
      );
      return;
    }

    setLoading(true);

    try {
      const submitProductsForReview =
        routeConsent ??
        (await readPendingSubmissionConsent()) ??
        false;

      const { data, error } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              first_name: cleanFirstName,
              last_name: cleanLastName,
              full_name: `${cleanFirstName} ${cleanLastName}`,
              privacy_accepted: true,
              privacy_version: "1.2",
              privacy_accepted_at:
                new Date().toISOString(),
              // Kept with the account so the choice survives email
              // verification. PreferencesScreen saves it to
              // user_preferences, which is the final source of truth.
              submit_products_for_review:
                submitProductsForReview,
            },
          },
        });

      if (error) {
        showMessage(
          "Account creation failed",
          error.message
        );
        return;
      }

      // The account now holds the choice; the phone copy is no longer needed.
      await clearPendingSubmissionConsent();

      if (data.session) {
        navigation.replace("Preferences", {
          submitProductsForReview,
        });
      } else {
        showMessage(
          "Verify your email",
          "We sent a verification link to your email address."
        );

        navigation.replace("Login");
      }
    } catch (error: any) {
      showMessage(
        "Connection problem",
        error?.message ||
          "Could not create your account. Please try again."
      );
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
        <Text style={styles.title}>
          Get started
        </Text>

        <Text style={styles.subtitle}>
          Create your free LabelLens account
        </Text>

        <Text style={styles.label}>
          First Name
        </Text>

        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="Your first name"
          placeholderTextColor="#AAB8AE"
          autoCapitalize="words"
          autoCorrect={false}
        />

        <Text style={styles.label}>
          Last Name
        </Text>

        <TextInput
          style={styles.input}
          value={lastName}
          onChangeText={setLastName}
          placeholder="Your last name"
          placeholderTextColor="#AAB8AE"
          autoCapitalize="words"
          autoCorrect={false}
        />

        <Text style={styles.label}>
          Email
        </Text>

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

        <Text style={styles.label}>
          Password
        </Text>

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
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
              {showPassword ? "Hide" : "Show"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>
          Confirm Password
        </Text>

        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Enter your password again"
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
              {showConfirmPassword ? "Hide" : "Show"}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            loading && styles.disabledButton,
          ]}
          onPress={createAccount}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {loading
              ? "Creating account..."
              : "Continue"}
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
            Already have an account?{" "}
            <Text style={styles.loginLinkGreen}>
              Log in
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    backgroundColor: "#FCFDFB",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 30,
  },

  content: {
    width: "100%",
    maxWidth: 320,
  },

  title: {
    color: "#163D2A",
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
    color: "#264C37",
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
    color: "#1D3829",
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
    paddingRight: 68,
    fontSize: 14,
    color: "#1D3829",
  },

  showButton: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },

  showButtonText: {
    color: "#197640",
    fontSize: 13,
    fontWeight: "700",
  },

  button: {
    minHeight: 48,
    backgroundColor: "#258D4D",
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