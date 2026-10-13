// Import the Supabase client used for authentication.
import { supabase } from "../lib/supabase";

// Import React state management.
import { useState } from "react";

// Import React Native components.
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
  // Stores the email entered by the user.
  const [email, setEmail] = useState("");

  // Stores the password entered by the user.
  const [password, setPassword] = useState("");

  // Controls whether the password is visible.
  const [showPassword, setShowPassword] = useState(false);

  // Shows a loading state during login.
  const [loading, setLoading] = useState(false);

  // Displays messages on web, iOS, and Android.
  function showMessage(title: string, message: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  // Handles the login process.
  async function handleLogin() {
    // Clean the email before sending it to Supabase.
    const cleanEmail = email.trim().toLowerCase();

    // Make sure both fields contain information.
    if (!cleanEmail || !password) {
      showMessage(
        "Missing information",
        "Please enter your email and password."
      );
      return;
    }

    // Disable the button while login is processing.
    setLoading(true);

    try {
      // Sign in using the user's email and password.
      const { error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      // Show an error if the login information is incorrect.
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

      // Check whether the user has saved preferences.
      const {
        data: preferences,
        error: preferencesError,
      } = await supabase
        .from("user_preferences")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      // Display a message if preferences cannot be loaded.
      if (preferencesError) {
        showMessage(
          "Could not load preferences",
          preferencesError.message
        );
        return;
      }

      // Users with preferences go to Home.
      // New users go to Preferences first.
      navigation.replace(
        preferences ? "Home" : "Preferences"
      );
    } catch {
      // Handles connection and unexpected errors.
      showMessage(
        "Connection problem",
        "Could not connect to the login service."
      );
    } finally {
      // Enable the button again after login finishes.
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

        {/* Email label. */}
        <Text style={styles.label}>Email</Text>

        {/* Email input. */}
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

        {/* Password label. */}
        <Text style={styles.label}>Password</Text>

        {/* Password input and Show/Hide button. */}
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

          {/* Shows or hides the password. */}
          <TouchableOpacity
            style={styles.showPasswordButton}
            onPress={() =>
              setShowPassword(!showPassword)
            }
          >
            <Text style={styles.showPasswordText}>
              {showPassword ? "Hide" : "Show"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Opens the password-reset screen. */}
        <TouchableOpacity
          onPress={() =>
            navigation.navigate("ForgotPassword")
          }
        >
          <Text style={styles.forgot}>
            Forgot password?
          </Text>
        </TouchableOpacity>

        {/* Submits the login form. */}
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

        {/* Opens the privacy notice before account creation. */}
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

// Styles used by the Login screen.
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
    paddingRight: 65,
    fontSize: 14,
    color: "#1D3829",
  },

  showPasswordButton: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },

  showPasswordText: {
    color: "#197640",
    fontSize: 13,
    fontWeight: "600",
  },

  forgot: {
    color: "#197640",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "right",
    marginTop: -3,
    marginBottom: 21,
  },

  button: {
    minHeight: 48,
    backgroundColor: "#258D4D",
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
    color: "#197640",
    fontWeight: "700",
  },
});