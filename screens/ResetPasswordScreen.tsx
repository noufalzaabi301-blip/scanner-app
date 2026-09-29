import { supabase } from "../lib/supabase";
import { useEffect, useState } from "react";
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

export default function ResetPasswordScreen({ navigation }: any) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  function showMessage(title: string, message: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  useEffect(() => {
  async function startRecoverySession() {
    if (Platform.OS === "web") {
      const hashParameters = new URLSearchParams(
        window.location.hash.substring(1)
      );

      const accessToken = hashParameters.get("access_token");
      const refreshToken = hashParameters.get("refresh_token");

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!error && data.session) {
          window.history.replaceState(
            {},
            document.title,
            "/reset-password"
          );

          setReady(true);
          return;
        }
      }
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    setReady(!!session);
  }

  startRecoverySession();
}, []); 

  async function updatePassword() {
    if (password.length < 8) {
      showMessage(
        "Password too short",
        "Your new password must contain at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      showMessage(
        "Passwords do not match",
        "Enter the same password in both fields."
      );
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        showMessage("Password reset failed", error.message);
        return;
      }

      showMessage(
        "Password updated",
        "Your password has been changed. Please sign in."
      );

      await supabase.auth.signOut();
      navigation.replace("Login");
    } catch {
      showMessage(
        "Connection problem",
        "Could not update your password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.card}>
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.description}>
            This reset link is invalid or has expired. Request a new password-reset link.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>Create a new password</Text>

        <Text style={styles.description}>
          Choose a new password with at least 8 characters.
        </Text>

        <Text style={styles.label}>New password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="New password"
        />

        <Text style={styles.label}>Confirm new password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="Enter the password again"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.disabledButton]}
          onPress={updatePassword}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Updating..." : "Update password"}
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
    alignItems: "center",
    justifyContent: "center",
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
  label: {
    color: "#263E32",
    fontWeight: "600",
    marginBottom: 7,
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
