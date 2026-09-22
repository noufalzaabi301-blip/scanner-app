import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { supabase } from "../lib/supabase";

const PRIVACY_VERSION = "1.0";

export default function PrivacyNoticeScreen({
  navigation,
}: any) {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  function showMessage(title: string, message: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  async function acceptPrivacyNotice() {
    if (!accepted) {
      showMessage(
        "Consent required",
        "Please confirm that you have read and accepted the privacy notice."
      );
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        showMessage(
          "Session expired",
          "Please log in again."
        );

        navigation.replace("Login");
        return;
      }

      const { error } = await supabase
        .from("user_consents")
        .upsert(
          {
            user_id: user.id,
            privacy_version: PRIVACY_VERSION,
            accepted_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        );

      if (error) {
        showMessage(
          "Could not save consent",
          error.message
        );
        return;
      }

      navigation.replace("Preferences");
    } catch {
      showMessage(
        "Connection problem",
        "Could not save your privacy choice."
      );
    } finally {
      setLoading(false);
    }
  }

  async function declinePrivacyNotice() {
    await supabase.auth.signOut();
    navigation.replace("Login");
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>Privacy Notice</Text>

        <Text style={styles.updated}>
          LabelLens privacy notice — version {PRIVACY_VERSION}
        </Text>

        <Text style={styles.heading}>
          Information we collect
        </Text>

        <Text style={styles.paragraph}>
          LabelLens collects your account email, halal-food
          preference, selected food allergies, and your scan
          history when that feature is enabled.
        </Text>

        <Text style={styles.heading}>
          Why we collect it
        </Text>

        <Text style={styles.paragraph}>
          We use your preferences to highlight products that may
          be relevant to your dietary needs and to personalize
          product results.
        </Text>

        <Text style={styles.heading}>
          Important allergy warning
        </Text>

        <Text style={styles.paragraph}>
          Product information may be incomplete, outdated, or
          incorrect. LabelLens does not guarantee that a product
          is safe. Always read the product label and contact the
          manufacturer when necessary.
        </Text>

        <Text style={styles.heading}>
          How information is stored
        </Text>

        <Text style={styles.paragraph}>
          Account and preference information is stored using
          Supabase. Access controls are used so each user can
          access only their own saved preferences.
        </Text>

        <Text style={styles.heading}>Your choices</Text>

        <Text style={styles.paragraph}>
          You can request to view, change, or delete your saved
          preferences. You can also stop using the service and
          request deletion of your account.
        </Text>

        <TouchableOpacity
          style={styles.consentRow}
          onPress={() => setAccepted((value) => !value)}
        >
          <View
            style={[
              styles.checkbox,
              accepted && styles.checkedBox,
            ]}
          >
            {accepted && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </View>

          <Text style={styles.consentText}>
            I have read and accept the Privacy Notice.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.acceptButton,
            (!accepted || loading) &&
              styles.disabledButton,
          ]}
          onPress={acceptPrivacyNotice}
          disabled={!accepted || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.acceptButtonText}>
              Accept and continue
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.declineButton}
          onPress={declinePrivacyNotice}
          disabled={loading}
        >
          <Text style={styles.declineText}>
            Decline and log out
          </Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          This notice is a starter draft and should be reviewed
          before releasing LabelLens publicly.
        </Text>
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
    maxWidth: 560,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 30,
  },

  title: {
    color: "#17452F",
    fontSize: 29,
    fontWeight: "bold",
    textAlign: "center",
  },

  updated: {
    color: "#68766F",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 25,
  },

  heading: {
    color: "#263E32",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 17,
    marginBottom: 6,
  },

  paragraph: {
    color: "#526159",
    fontSize: 15,
    lineHeight: 22,
  },

  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 28,
  },

  checkbox: {
    width: 25,
    height: 25,
    borderWidth: 2,
    borderColor: "#879D91",
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  checkedBox: {
    backgroundColor: "#176B43",
    borderColor: "#176B43",
  },

  checkmark: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },

  consentText: {
    flex: 1,
    color: "#263E32",
    lineHeight: 21,
  },

  acceptButton: {
    backgroundColor: "#176B43",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
    marginTop: 25,
  },

  disabledButton: {
    opacity: 0.45,
  },

  acceptButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },

  declineButton: {
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },

  declineText: {
    color: "#A33838",
    fontWeight: "600",
  },

  footer: {
    color: "#7A8981",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 20,
  },
});