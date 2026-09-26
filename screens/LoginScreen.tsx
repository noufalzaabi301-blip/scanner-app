import { supabase } from "../lib/supabase";
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

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function showMessage(title: string, message: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  async function handleLogin() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      showMessage(
        "Missing information",
        "Please enter your email and password."
      );
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        showMessage("Login failed", "The email or password is incorrect.");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        showMessage("Login failed", "Could not load your account.");
        return;
      }

      const { data: consent, error: consentError } = await supabase
        .from("user_consents")
        .select("privacy_version")
        .eq("user_id", user.id)
        .maybeSingle();

      if (consentError) {
        showMessage("Could not load privacy consent", consentError.message);
        return;
      }

      if (!consent) {
        navigation.replace("PrivacyNotice");
        return;
      }

      const { data: preferences, error: preferencesError } = await supabase
        .from("user_preferences")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (preferencesError) {
        showMessage(
          "Could not load preferences",
          preferencesError.message
        );
        return;
      }

      navigation.replace(preferences ? "Home" : "Preferences");
    } catch {
      showMessage(
        "Connection problem",
        "Could not connect to the login service."
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
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your LabelLens account</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />

        <TouchableOpacity
          onPress={() => navigation.navigate("ForgotPassword")}
        >
          <Text style={styles.forgot}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, loading && styles.disabledButton]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Signing in..." : "Sign In"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Register")}>
          <Text style={styles.createAccount}>
            Don&apos;t have an account?{" "}
            <Text style={styles.createAccountLink}>Create Account</Text>
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