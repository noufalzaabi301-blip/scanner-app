import { supabase } from "../lib/supabase";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function ProfileSettingsScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  function showMessage(title: string, message: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      showMessage("Sign in required", "Please sign in to edit your profile.");
      navigation.replace("Login");
      return;
    }

    setEmail(user.email ?? "");
    setFirstName(String(user.user_metadata?.first_name ?? ""));
    setLastName(String(user.user_metadata?.last_name ?? ""));
    setLoading(false);
  }

  async function saveProfile() {
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();

    if (!cleanFirstName || !cleanLastName) {
      showMessage("Missing information", "Enter your first and last name.");
      return;
    }

    setSavingProfile(true);

    const { error } = await supabase.auth.updateUser({
      data: {
        first_name: cleanFirstName,
        last_name: cleanLastName,
      },
    });

    setSavingProfile(false);

    if (error) {
      showMessage("Could not save profile", error.message);
      return;
    }

    showMessage("Profile saved", "Your name was updated successfully.");
  }

  async function changePassword() {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      showMessage("Missing information", "Complete every password field.");
      return;
    }

    if (newPassword.length < 8) {
      showMessage(
        "Password too short",
        "Your new password must contain at least 8 characters."
      );
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showMessage(
        "Passwords do not match",
        "Enter the same new password in both fields."
      );
      return;
    }

    setSavingPassword(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      setSavingPassword(false);
      showMessage("Session expired", "Please sign in again.");
      navigation.replace("Login");
      return;
    }

    // Checks that the current password is correct.
    const { error: verificationError } =
      await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

    if (verificationError) {
      setSavingPassword(false);
      showMessage("Incorrect password", "Your current password is incorrect.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSavingPassword(false);

    if (updateError) {
      showMessage("Could not change password", updateError.message);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");

    showMessage(
      "Password changed",
      "Your new password has been saved successfully."
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.page}>
        <ActivityIndicator size="large" color="#176B43" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Profile settings</Text>

          <Text style={styles.sectionTitle}>Your details</Text>

          <Text style={styles.label}>First name</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
          />

          <Text style={styles.label}>Last name</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
          />

          <Text style={styles.label}>Email address</Text>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={email}
            editable={false}
          />

          <TouchableOpacity
            style={[styles.button, savingProfile && styles.disabledButton]}
            onPress={saveProfile}
            disabled={savingProfile}
          >
            <Text style={styles.buttonText}>
              {savingProfile ? "Saving..." : "Save profile"}
            </Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Change password</Text>

          <Text style={styles.label}>Current password</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            placeholder="Enter current password"
          />

          <Text style={styles.label}>New password</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="At least 8 characters"
          />

          <Text style={styles.label}>Confirm new password</Text>
          <TextInput
            style={styles.input}
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            secureTextEntry
            placeholder="Enter new password again"
          />

          <TouchableOpacity
            style={[
              styles.button,
              savingPassword && styles.disabledButton,
            ]}
            onPress={changePassword}
            disabled={savingPassword}
          >
            <Text style={styles.buttonText}>
              {savingPassword ? "Updating..." : "Update password"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F1F7F3",
  },

  content: {
    padding: 20,
  },

  card: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
  },

  title: {
    color: "#17452F",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 26,
  },

  sectionTitle: {
    color: "#17452F",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
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

  disabledInput: {
    backgroundColor: "#F2F5F3",
    color: "#68766F",
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

  disabledButton: {
    opacity: 0.6,
  },

  divider: {
    height: 1,
    backgroundColor: "#E2EAE5",
    marginVertical: 30,
  },
});