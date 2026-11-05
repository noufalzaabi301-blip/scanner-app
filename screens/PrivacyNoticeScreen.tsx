// ---------------------------------------------------------------------------
// screens/PrivacyNoticeScreen.tsx
// Shows the Privacy Notice.
// - fromSignup:   shown by Register BEFORE the account is created. The user
//                 must tick and accept; only then does it return to Register
//                 (privacyAccepted: true), which creates the account.
// - fromLogin:    signed-in user who has not accepted the current notice.
//                 Accepting saves it to the account, then continues to
//                 Preferences or Home. "Log out" is the only other way out.
// - fromAppStart: first launch on this device (Welcome flow).
// - readOnly:     opened from Profile, no buttons.
// The product-submission choice is not asked here; it lives only in
// Preferences.
// ---------------------------------------------------------------------------

import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  StyleSheet,
} from "react-native";

import { PRIVACY_VERSION, STORAGE_KEYS } from "../lib/constants";
import { useI18n, type TranslationKey } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { showMessage } from "../lib/ui/messages";
import { hasSavedPreferences } from "../lib/userPreferences";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "../components/Themed";

const SECTIONS: { title: TranslationKey; body: TranslationKey }[] = [
  { title: "privacy.collectTitle", body: "privacy.collectBody" },
  { title: "privacy.whyTitle", body: "privacy.whyBody" },
  { title: "privacy.warningTitle", body: "privacy.warningBody" },
  { title: "privacy.storageTitle", body: "privacy.storageBody" },
  { title: "privacy.submissionsTitle", body: "privacy.submissionsBody" },
  { title: "privacy.choicesTitle", body: "privacy.choicesBody" },
];

export default function PrivacyNoticeScreen({ navigation, route }: any) {
  const { t } = useI18n();

  const fromAppStart = route?.params?.fromAppStart === true;
  const fromSignup = route?.params?.fromSignup === true;
  const fromLogin = route?.params?.fromLogin === true;
  const readOnly = route?.params?.readOnly === true;

  const showConsentControls =
    (fromAppStart || fromSignup || fromLogin) && !readOnly;

  // Required: explicit acceptance. Never set automatically.
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  // Signed-in user: record the acceptance on the account, then continue.
  async function acceptForSignedInUser() {
    const { error } = await supabase.auth.updateUser({
      data: {
        privacy_accepted: true,
        privacy_version: PRIVACY_VERSION,
        privacy_accepted_at: new Date().toISOString(),
      },
    });

    if (error) {
      throw error;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const hasPreferences = user ? await hasSavedPreferences(user.id) : false;

    navigation.reset({
      index: 0,
      routes: [{ name: hasPreferences ? "Home" : "Preferences" }],
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  }

  async function acceptPrivacyNotice() {
    if (!accepted) {
      showMessage(
        t("privacy.consentRequiredTitle"),
        t("privacy.consentRequiredBody")
      );
      return;
    }

    setSaving(true);

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.privacyNoticeAccepted, "true");

      if (fromLogin) {
        await acceptForSignedInUser();
      } else if (fromSignup) {
        // Back to the SAME Register screen (its form is kept) so it can
        // finish creating the account. popTo avoids a second Register.
        navigation.popTo("Register", { privacyAccepted: true });
      } else {
        navigation.replace("Welcome");
      }
    } catch {
      showMessage(t("privacy.saveFailedTitle"), t("privacy.saveFailedBody"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <Text style={styles.title}>{t("title.privacyNotice")}</Text>

        <Text style={styles.updated}>
          {t("privacy.version", { version: PRIVACY_VERSION })}
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.title}>
            <Text style={styles.heading}>{t(section.title)}</Text>
            <Text style={styles.paragraph}>{t(section.body)}</Text>
          </View>
        ))}

        {showConsentControls && (
          <>
            <TouchableOpacity
              style={styles.consentRow}
              onPress={() => setAccepted((value) => !value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: accepted }}
            >
              <View style={[styles.checkbox, accepted && styles.checkedBox]}>
                {accepted && <Text style={styles.checkmark}>✓</Text>}
              </View>

              <Text style={styles.consentText}>
                {t("privacy.acceptCheckbox")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.acceptButton,
                (!accepted || saving) && styles.disabledButton,
              ]}
              onPress={acceptPrivacyNotice}
              disabled={!accepted || saving}
            >
              <Text style={styles.acceptButtonText}>
                {saving ? t("common.saving") : t("privacy.acceptButton")}
              </Text>
            </TouchableOpacity>

            {fromLogin && (
              <TouchableOpacity
                style={styles.signOutButton}
                onPress={() => void signOut()}
                disabled={saving}
              >
                <Text style={styles.signOutText}>{t("profile.logout")}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    backgroundColor: "#F7F9F7",
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
    color: "#17452F",
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
    gap: 12,
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
    color: "#17452F",
    lineHeight: 21,
  },

  signOutButton: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 8,
  },

  signOutText: {
    color: "#B42318",
    fontWeight: "700",
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