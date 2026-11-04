import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { savePendingSubmissionConsent } from "../lib/productSubmissionConsent";

const PRIVACY_VERSION = "1.2";

const PRIVACY_NOTICE_KEY =
  "labellens_privacy_notice_accepted_v1";

export default function PrivacyNoticeScreen({
  navigation,
  route,
}: any) {
  const fromAppStart =
    route?.params?.fromAppStart === true;

  const fromSignup =
    route?.params?.fromSignup === true;

  const readOnly =
    route?.params?.readOnly === true;

  const showConsentControls =
    (fromAppStart || fromSignup) && !readOnly;

  // Required: Privacy Notice acceptance.
  const [accepted, setAccepted] = useState(false);

  // Optional: product submission for verification (default: off).
  const [submitProducts, setSubmitProducts] =
    useState(false);

  function showMessage(
    title: string,
    message: string
  ) {
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
        "Please confirm that you have read and accepted the Privacy Notice."
      );
      return;
    }

    try {
      await AsyncStorage.setItem(
        PRIVACY_NOTICE_KEY,
        "true"
      );

      if (fromSignup) {
        // Signed in: PreferencesScreen saves the choice to
        // user_preferences.submit_products_for_review.
        navigation.replace("Preferences", {
          submitProductsForReview: submitProducts,
        });
      } else {
        // No account yet: keep the choice only until Register uses it.
        await savePendingSubmissionConsent(submitProducts);
        navigation.replace("Welcome");
      }
    } catch {
      showMessage(
        "Could not save your choice",
        "Please try again."
      );
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <Text style={styles.title}>
          Privacy Notice
        </Text>

        <Text style={styles.updated}>
          LabelLens privacy notice — version{" "}
          {PRIVACY_VERSION}
        </Text>

        <Text style={styles.heading}>
          Information We Collect
        </Text>

        <Text style={styles.paragraph}>
          LabelLens may collect your first and last name,
          account email address, dietary preferences,
          including halal-food preferences, selected food
          allergies, and scan history when the scan-history
          feature is enabled.
        </Text>

        <Text style={styles.heading}>
          Why We Collect Information
        </Text>

        <Text style={styles.paragraph}>
          We collect this information to save and apply
          your preferences, making it easier to review
          products you have previously scanned.
        </Text>

        <Text style={styles.heading}>
          Important Allergy Warning
        </Text>

        <Text style={styles.paragraph}>
          Some product information may be incomplete,
          outdated, or inaccurate. LabelLens does not
          guarantee that any product is safe for your
          dietary needs or allergies. Always read and
          verify the current product packaging.
        </Text>

        <Text style={styles.heading}>
          How Information Is Stored
        </Text>

        <Text style={styles.paragraph}>
          Account and preference information is stored
          using Supabase. Access controls help protect
          your account-related information.
        </Text>

        <Text style={styles.heading}>
          Optional Product Submissions
        </Text>

        <Text style={styles.paragraph}>
          If you choose to help improve LabelLens, products
          you scan may be sent to LabelLens for developer
          verification. This can include the barcode, the
          product information read from the label (name,
          brand, ingredients and allergen statements) and
          the package photos. Your allergy profile is not
          sent. This is optional, off by default, and can be
          changed at any time in your preferences.
        </Text>

        <Text style={styles.heading}>
          Your Choices
        </Text>

        <Text style={styles.paragraph}>
          You may request access to, correction of, or
          deletion of your saved preferences and account
          information.
        </Text>

        {showConsentControls && (
          <>
            <TouchableOpacity
              style={styles.consentRow}
              onPress={() =>
                setAccepted((value) => !value)
              }
              accessibilityRole="checkbox"
              accessibilityState={{ checked: accepted }}
            >
              <View
                style={[
                  styles.checkbox,
                  accepted && styles.checkedBox,
                ]}
              >
                {accepted && (
                  <Text style={styles.checkmark}>
                    ✓
                  </Text>
                )}
              </View>

              <Text style={styles.consentText}>
                I have read and accept the Privacy Notice.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.consentRow}
              onPress={() =>
                setSubmitProducts((value) => !value)
              }
              accessibilityRole="checkbox"
              accessibilityState={{ checked: submitProducts }}
            >
              <View
                style={[
                  styles.checkbox,
                  submitProducts && styles.checkedBox,
                ]}
              >
                {submitProducts && (
                  <Text style={styles.checkmark}>
                    ✓
                  </Text>
                )}
              </View>

              <View style={styles.consentTextBlock}>
                <Text style={styles.consentText}>
                  Optional: Help improve LabelLens by sending
                  scanned products for verification.
                </Text>

                <Text style={styles.consentHint}>
                  Not required to use LabelLens.
                </Text>
              </View>
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
    marginTop: 22,
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

  consentTextBlock: {
    flex: 1,
  },

  consentText: {
    flex: 1,
    color: "#263E32",
    lineHeight: 21,
  },

  consentHint: {
    color: "#68766F",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
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
});