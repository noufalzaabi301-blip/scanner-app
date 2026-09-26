import { supabase } from "../lib/supabase";
import { useState } from "react";
import {
  Alert,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function ForgotPasswordScreen() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  function showMessage(title: string, message: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  async function sendResetLink() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      showMessage("Missing email", "Enter your email address.");
      return;
    }

    setLoading(true);

    try {
      const { data: accountExists, error: checkError } =
        await supabase.rpc("is_registered_email", {
          check_email: cleanEmail,
        });

      if (checkError) {
        showMessage("Check failed", checkError.message);
        return;
      }

      if (!accountExists) {
        showMessage(
          "Account not found",
          "No account is registered with this email address."
        );
        return;
      }

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(cleanEmail);

      if (resetError) {
        showMessage("Reset failed", resetError.message);
        return;
      }

      showMessage(
        "Check your email",
        "A password-reset link has been sent. Check your inbox and spam folder."
      );
    } catch {
      showMessage(
        "Connection problem",
        "Could not contact the password-reset service."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>Forgot your password?</Text>

        <Text style={styles.description}>
          Enter your account email and we will send you a reset link.
        </Text>

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
            {loading ? "Sending..." : "Send reset link"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F1F7F3",
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