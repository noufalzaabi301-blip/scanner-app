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
  async function sendResetLink() {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail) {
    const message = "Enter your email address.";

    if (Platform.OS === "web") {
      window.alert(message);
    } else {
      Alert.alert("Missing email", message);
    }

    return;
  }

  setLoading(true);

  try {
    const { error } =
      await supabase.auth.resetPasswordForEmail(cleanEmail);

    if (error) {
      if (Platform.OS === "web") {
        window.alert(error.message);
      } else {
        Alert.alert("Reset failed", error.message);
      }

      return;
    }

    const message =
      "If an account exists for this email, a password-reset link has been sent. Check your inbox and spam folder.";

    if (Platform.OS === "web") {
      window.alert(message);
    } else {
      Alert.alert("Check your email", message);
    }
  } catch {
    const message =
      "Could not contact the password-reset service.";

    if (Platform.OS === "web") {
      window.alert(message);
    } else {
      Alert.alert("Connection problem", message);
    }
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
          placeholder="name@example.com"
        />

        <TouchableOpacity
  style={[
    styles.button,
    loading && { opacity: 0.6 },
  ]}
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
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
});