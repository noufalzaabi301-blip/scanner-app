import { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const PRIVACY_VERSION = "1.0";

export default function PrivacyNoticeScreen({
  navigation,
  route,
}: any) {
  const fromSignup = route?.params?.fromSignup === true;
  const readOnly = route?.params?.readOnly === true;
  const showConsentControls = fromSignup && !readOnly;

  const [accepted, setAccepted] = useState(false);

  function showMessage(title: string, message: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  function acceptPrivacyNotice() {
    if (!accepted) {
      showMessage(
        "Consent required",
        "Please confirm that you have read and accepted the Privacy Notice."
      );
      return;
    }

    navigation.replace("Register", {
      privacyAccepted: true,
    });
  }

  function declinePrivacyNotice() {
    navigation.replace("Welcome");
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>Privacy Notice</Text>

        <Text style={styles.updated}>
          LabelLens privacy notice — version {PRIVACY_VERSION}
        </Text>

        <Text style={styles.heading}>
          Information We Collect
        </Text>

        <Text style={styles.paragraph}>
          LabelLens may collect your first and last name, account
          email address, dietary preferences, including halal-food
          preferences, selected food allergies, and scan history
          when the scan-history feature is enabled.
        </Text>

        <Text style={styles.heading}>
          Why We Collect Information
        </Text>

        <Text style={styles.paragraph}>
          We collect this information to save and apply your
          preferences, making it easier to review products you have
          previously scanned without needing to scan them again.
          Your profile information is used to associate your
          preferences with your account and to identify your account
          within the application.
        </Text>

        <Text style={styles.heading}>
          Important Allergy Warning
        </Text>

        <Text style={styles.paragraph}>
          Some product information may be incomplete, outdated, or
          inaccurate. LabelLens does not guarantee that any product
          is safe for your dietary needs or allergies. Always read
          and verify the current ingredient list and allergen
          information on the product’s packaging before consuming or
          purchasing a product.
        </Text>

        <Text style={styles.heading}>
          How Information Is Stored
        </Text>

        <Text style={styles.paragraph}>
          Account and preference information is stored using
          Supabase. Access controls are used to help ensure that
          each user can access only their own saved preferences and
          account-related information.
        </Text>

        <Text style={styles.heading}>Your Choices</Text>

        <Text style={styles.paragraph}>
          You may request access to, correction of, or deletion of
          your saved preferences and account information. You may
          also stop using the service at any time and request
          deletion of your account.
        </Text>

        {showConsentControls && (
          <>
            <TouchableOpacity
              style={styles.consentRow}
              onPress={() =>
                setAccepted((value) => !value)
              }
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
                !accepted && styles.disabledButton,
              ]}
              onPress={acceptPrivacyNotice}
              disabled={!accepted}
            >
              <Text style={styles.acceptButtonText}>
                Accept and continue
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.declineButton}
              onPress={declinePrivacyNotice}
            >
              <Text style={styles.declineText}>
                Decline and return
              </Text>
            </TouchableOpacity>
          </>
        )}
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
});