import { supabase } from "../lib/supabase";
import React, { useState } from "react";
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
    const { error } =
      await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

    if (error) {
      showMessage(
        "Login failed",
        "The email or password is incorrect."
      );
      return;
    }

  const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) {
  showMessage(
    "Login failed",
    "Could not load your account."
  );
  return;
}
const { data: consent, error: consentError } =
  await supabase
    .from("user_consents")
    .select("privacy_version")
    .eq("user_id", user.id)
    .maybeSingle();

if (consentError) {
  showMessage(
    "Could not load privacy consent",
    consentError.message
  );
  return;
}

if (!consent) {
  navigation.replace("PrivacyNotice");
  return;
}
const { data: preferences, error: preferencesError } =
  await supabase
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

if (preferences) {
  navigation.replace("Home");
} else {
  navigation.replace("Preferences");
}
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
      <View style={styles.card}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>✓</Text>
        </View>
        <Text style={styles.title}>LabelLens</Text>
        <Text style={styles.subtitle}>
    Scan products and check their halal & allergy status 
        </Text>
        <Text style={styles.label}>Email address</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="name@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          secureTextEntry
        />
        <TouchableOpacity
  onPress={() => navigation.navigate("ForgotPassword")}
>
  <Text style={styles.forgot}>Forgot password?</Text>
</TouchableOpacity>
        <TouchableOpacity
  style={[
    styles.loginButton,
    loading && { opacity: 0.6 },
  ]}
  onPress={handleLogin}
  disabled={loading}
>
  <Text style={styles.loginText}>
    {loading ? "Logging in..." : "Log in"}
  </Text>
</TouchableOpacity>
        <TouchableOpacity
  onPress={() => navigation.navigate("Register")}
>
  <Text style={styles.register}>
    Don&apos;t have an account?{" "}
    <Text style={styles.greenText}>Create account</Text>
  </Text>
</TouchableOpacity>
        <TouchableOpacity
  style={styles.guestButton}
  onPress={() => navigation.navigate("Home")}
>
  <Text style={styles.greenText}>Continue as guest</Text>
</TouchableOpacity>
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
 page: {
  flexGrow: 1,
  backgroundColor: "#F1F7F3",
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 20,
  paddingVertical: 40,
},
  card: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 30,
    shadowColor: "#163A29",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 5,
  },
  logo: {
    alignSelf: "center",
    width: 65,
    height: 65,
    borderRadius: 33,
    backgroundColor: "#176B43",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "bold",
  },
  title: {
    color: "#17452F",
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 14,
  },
  subtitle: {
    color: "#68766F",
    fontSize: 15,
    textAlign: "center",
    marginTop: 7,
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
  forgot: {
    color: "#176B43",
    textAlign: "right",
    fontWeight: "600",
    marginTop: -7,
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: "#176B43",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
  },
  loginText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  register: {
    color: "#68766F",
    textAlign: "center",
    marginTop: 22,
  },
  guestButton: {
    borderColor: "#176B43",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 20,
  },
  greenText: {
    color: "#176B43",
    fontWeight: "bold",
  },
});