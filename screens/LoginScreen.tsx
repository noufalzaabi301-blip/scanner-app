// Import the Supabase client used for user authentication.
import { supabase } from "../lib/supabase";

// Import React state management.
import { useState } from "react";

// Import the React Native components used on this screen.
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

export default function LoginScreen({ navigation }: any) {
  // Store the email typed by the user.
  const [email, setEmail] = useState("");

  // Store the password typed by the user.
  const [password, setPassword] = useState("");

  // Decide whether the password should be visible.
  const [showPassword, setShowPassword] = useState(false);

  // Show a loading state while login is processing.
  const [loading, setLoading] = useState(false);

  // Display messages correctly on web, Android, and iOS.
  function showMessage(title: string, message: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  // Handle the login process.
  async function handleLogin() {
    // Remove spaces and make the email lowercase.
    const cleanEmail = email.trim().toLowerCase();

    // Check that both fields contain information.
    if (!cleanEmail || !password) {
      showMessage(
        "Missing information",
        "Please enter your email and password."
      );
      return;
    }

    // Disable the button while the request is running.
    setLoading(true);

    try {
      // Sign in using the user's email and password.
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      // Show a generic error if the login details are incorrect.
      if (error) {
        showMessage(
          "Login failed",
          "The email or password is incorrect."
        );
        return;
      }

      // Get the currently logged-in user.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Stop if the user could not be loaded.
      if (!user) {
        showMessage(
          "Login failed",
          "Could not load your account."
        );
        return;
      }

      // Check whether the user has completed the preferences page.
      const {
        data: preferences,
        error: preferencesError,
      } = await supabase
        .from("user_preferences")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      // Show the database error if preferences cannot be loaded.
      if (preferencesError) {
        showMessage(
          "Could not load preferences",
          preferencesError.message
        );
        return;
      }

      // Send users with preferences to Home.
      // Otherwise, send them to the Preferences screen.
      navigation.replace(
        preferences ? "Home" : "Preferences"
      );
    } catch {
      // Handle connection or unexpected errors.
      showMessage(
        "Connection problem",
        "Could not connect to the login service."
      );
    } finally {
      // Re-enable the login button after the request finishes.
      setLoading(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        {/* Main welcome heading. */}
        <Text style={styles.title}>Welcome back</Text>

        {/* Short description below the heading. */}
        <Text style={styles.subtitle}>
          Sign in to your LabelLens account
        </Text>

        {/* Email field label. */}
        <Text style={styles.label}>Email</Text>

        {/* Email input field. */}
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

        {/* Password field label. */}
        <Text style={styles.label}>Password</Text>

        {/* Password input and Show/Hide button container. */}
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

          {/* Toggle the password between hidden and visible. */}
          <TouchableOpacity
            style={styles.showPasswordButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Text style={styles.showPasswordText}>
              {showPassword ? "Hide" : "Show"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Navigate to the password-reset screen. */}
        <TouchableOpacity
          onPress={() =>
            navigation.navigate("ForgotPassword")
          }
        >
          <Text style={styles.forgot}>
            Forgot password?
          </Text>
        </TouchableOpacity>

        {/* Submit the login form. */}
        <TouchableOpacity
          style={[
            styles.button,
            loading && styles.disabledButton,
          ]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Signing in..." : "Sign In"}
          </Text>
        </TouchableOpacity>

        {/* Navigate new users to the privacy notice before signup. */}
        <TouchableOpacity
          onPress={() =>
            navigation.navigate("PrivacyNotice", {
              fromSignup: true,
            })
          }
        >
          <Text style={styles.createAccount}>
            {"Don't have an account? "}
            <Text style={styles.createAccountLink}>
              Create Account
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// Styles used by the login screen.
const styles = StyleSheet.create({
  // Main page layout.
  page: {
    flexGrow: 1,
    backgroundColor: "#FCFDFB",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 30,
  },

  // Keeps the form at a readable width.
  content: {
    width: "100%",
    maxWidth: 320,
  },

  // Main page title.
  title: {
    color: "#163D2A",
    fontSize: 24,
    fontWeight: "700",
  },

  // Text below the title.
  subtitle: {
    color: "#63776B",
    fontSize: 13,
    marginTop: 5,
    marginBottom: 21,
  },

  // Email and password labels.
  label: {
    color: "#264C37",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 7,
  },

  // Normal email input style.
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

  // Holds the password input and Show/Hide button.
  passwordContainer: {
    position: "relative",
    marginBottom: 15,
  },

  // Password input with extra right padding for the button.
  passwordInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#DCE5DE",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingRight: 65,
    fontSize: 14,
    color: "#1D3829",
  },

  // Positions the Show/Hide button inside the password field.
  showPasswordButton: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },

  // Show/Hide button text.
  showPasswordText: {
    color: "#197640",
    fontSize: 13,
    fontWeight: "600",
  },

  // Forgot-password link.
  forgot: {
    color: "#197640",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "right",
    marginTop: -3,
    marginBottom: 21,
  },

  // Login button.
  button: {
    minHeight: 48,
    backgroundColor: "#258D4D",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  // Makes the button look disabled while loading.
  disabledButton: {
    opacity: 0.6,
  },

  // Login button text.
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  // Create-account text.
  createAccount: {
    color: "#63776B",
    fontSize: 13,
    textAlign: "center",
    marginTop: 20,
  },

  // Create-account link text.
  createAccountLink: {
    color: "#197640",
    fontWeight: "700",
  },
});