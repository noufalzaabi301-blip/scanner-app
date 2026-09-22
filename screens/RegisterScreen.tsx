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
//comment test
export default function RegisterScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function showMessage(title: string, message: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  async function createAccount() {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !password || !confirmPassword) {
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

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
  });

  setLoading(false);

  if (error) {
    showMessage("Account creation failed", error.message);
    return;
  }

  if (!data.session) {
    showMessage(
      "Verify your email",
      "We sent a verification link to your email address."
    );
  } else {
    showMessage(
      "Account created",
      "Your account was created successfully."
    );
  }

  navigation.replace("Login");
}

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>Create your account</Text>

        <Text style={styles.subtitle}>
          Save your scans and product history
        </Text>

        <Text style={styles.label}>Email address</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="name@example.com"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="At least 8 characters"
        />

        <Text style={styles.label}>Confirm password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="Enter password again"
        />

        <TouchableOpacity
  style={[
    styles.button,
    loading && { opacity: 0.6 },
  ]}
  onPress={createAccount}
  disabled={loading}
>
  <Text style={styles.buttonText}>
    {loading ? "Creating account..." : "Create account"}
  </Text>
</TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>
            Already have an account? Log in
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
    backgroundColor: "#FFFFFF",
    width: "100%",
    maxWidth: 430,
    borderRadius: 24,
    padding: 30,
  },
  title: {
    color: "#17452F",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
  },
  subtitle: {
    color: "#68766F",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 28,
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
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  link: {
    color: "#176B43",
    textAlign: "center",
    fontWeight: "600",
    marginTop: 22,
  },
});