// ---------------------------------------------------------------------------
// screens/GuestPreferencesScreen.tsx
// Guest onboarding: "Set your preferences before scanning".
//
// Opened from Welcome → "Continue as guest" (and from the scanner / Profile
// to edit later). The guest must answer both questions before the scanner
// opens:
//   1. Do you have any food allergies?  Yes (choose at least one) / No allergies
//   2. Do you prefer halal food?        Yes / No
// Answers are saved ONLY on this device (lib/guestPreferences.ts). Nothing
// is written to Supabase and guests never submit products for review.
// Going back without saving returns to Welcome; the scanner never opens
// with unanswered questions.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";

import {
  addAllergyEntries,
  batchFeedback,
  remainingInput,
} from "../lib/allergyBatch";
import { ROUTES } from "../lib/constants";
import {
  guestSetupProblem,
  loadGuestPreferences,
  saveGuestPreferences,
  type GuestPreferences,
} from "../lib/guestPreferences";
import { useI18n } from "../lib/i18n";
import { usePageInsets } from "../lib/layout";
import { useFormTokens } from "../lib/theme";
import { showMessage } from "../lib/ui/messages";
import AllergyEditor, { AnswerButtons } from "../components/AllergyEditor";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "../components/Themed";

export default function GuestPreferencesScreen({ navigation, route }: any) {
  const { t } = useI18n();
  const pageInsets = usePageInsets();
  const c = useFormTokens(); // explicit light / dark form colours
  // "edit": opened from the scanner or Profile → go back after saving.
  const isEdit = route?.params?.mode === "edit";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasAllergies, setHasAllergies] = useState<boolean | null>(null);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [customAllergies, setCustomAllergies] = useState<string[]>([]);
  const [prefersHalal, setPrefersHalal] = useState<boolean | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [customError, setCustomError] = useState("");
  const [problem, setProblem] = useState<string>("");

  // Earlier answers on this device are shown again for editing.
  useEffect(() => {
    let active = true;

    loadGuestPreferences().then((saved) => {
      if (!active) {
        return;
      }

      setHasAllergies(saved.hasAllergies);
      setAllergies(saved.allergies);
      setCustomAllergies(saved.customAllergies);
      setPrefersHalal(saved.prefersHalal);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  function chooseAllergies(value: boolean) {
    setHasAllergies(value);
    setProblem("");

    if (!value) {
      setAllergies([]);
      setCustomAllergies([]);
      setCustomInput("");
      setCustomError("");
    }
  }

  // "Add" beside a common allergy: it moves into "Your selected allergies".
  function addStandardAllergy(value: string) {
    setProblem("");
    setAllergies((current) => (current.includes(value) ? current : [...current, value]));
  }

  // Same as the account allergy editor: several allergies at once
  // ("Milk, Eggs, Peanuts" or one per line), each validated separately;
  // duplicates skipped, invalid ones kept in the field with their reason.
  function addCustomAllergy() {
    const result = addAllergyEntries(customInput, allergies, customAllergies);

    setAllergies(result.selected);
    setCustomAllergies(result.custom);
    setCustomInput(remainingInput(result));
    setCustomError(batchFeedback(result, t));

    if (result.added.length > 0) {
      setProblem("");
    }

    return result;
  }

  // Delete removes exactly this allergy (standard or custom).
  function removeAllergy(value: string) {
    setAllergies((current) => current.filter((item) => item !== value));
    setCustomAllergies((current) => current.filter((item) => item !== value));
  }

  async function saveAndContinue() {
    let standardToSave = allergies;
    let customToSave = customAllergies;

    // Text still in the field counts too; invalid entries stop the save.
    if (hasAllergies === true && customInput.trim()) {
      const result = addCustomAllergy();

      if (result.rejected.length > 0) {
        setProblem(t("prefs.someNotAdded"));
        return;
      }

      standardToSave = result.selected;
      customToSave = result.custom;
    }

    const prefs: GuestPreferences = {
      version: 1,
      hasAllergies,
      allergies: standardToSave,
      customAllergies: customToSave,
      prefersHalal,
      updatedAt: null,
    };
    const missing = guestSetupProblem(prefs);

    if (missing) {
      const message =
        missing === "allergy-question"
          ? t("guest.answerAllergies")
          : missing === "allergy-list-empty"
          ? t("guest.chooseOneAllergy")
          : t("guest.answerHalal");
      setProblem(message);
      showMessage(t("guest.incompleteTitle"), message);
      return;
    }

    setSaving(true);

    try {
      await saveGuestPreferences(prefs);

      if (isEdit && navigation.canGoBack()) {
        navigation.goBack();
      } else {
        // Welcome stays below, so Back from the scanner returns there.
        navigation.reset({
          index: 1,
          routes: [{ name: ROUTES.Welcome }, { name: ROUTES.Home }],
        });
      }
    } catch {
      showMessage(t("guest.saveFailedTitle"), t("guest.saveFailedBody"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.page, styles.center]}>
        <ActivityIndicator size="large" color="#176B43" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.page, pageInsets]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          {t("guest.title")}
        </Text>
        <Text style={styles.subtitle}>{t("guest.subtitle")}</Text>

        {/* 1. Allergies */}
        <Text style={styles.question}>{t("guest.allergyQuestion")}</Text>
        <AnswerButtons
          value={hasAllergies}
          onChange={chooseAllergies}
          yesLabel={t("common.yes")}
          noLabel={t("guest.noAllergies")}
          accessibilityLabel={t("guest.allergyQuestion")}
        />

        {hasAllergies === false && (
          <Text style={styles.notice}>{t("guest.matchingOffNotice")}</Text>
        )}

        {hasAllergies === true && (
          <AllergyEditor
            selected={allergies}
            custom={customAllergies}
            onAddStandard={addStandardAllergy}
            onRemove={removeAllergy}
            input={customInput}
            onChangeInput={(value) => {
              setCustomInput(value);
              setCustomError("");
            }}
            onAdd={addCustomAllergy}
            error={customError}
          />
        )}

        {/* 2. Halal */}
        <Text style={styles.question}>{t("guest.halalQuestion")}</Text>
        <AnswerButtons
          value={prefersHalal}
          onChange={(value) => {
            setPrefersHalal(value);
            setProblem("");
          }}
          yesLabel={t("common.yes")}
          noLabel={t("common.no")}
          accessibilityLabel={t("guest.halalQuestion")}
        />

        {problem ? (
          <Text style={[styles.errorText, { color: c.errorText }]} accessibilityRole="alert">
            {problem}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.disabledButton]}
          onPress={saveAndContinue}
          disabled={saving}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>
              {isEdit ? t("prefs.saveChanges") : t("guest.startScanning")}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.deviceNote}>{t("guest.savedOnDevice")}</Text>
        <Text style={styles.warning}>{t("prefs.warning")}</Text>
      </View>
    </ScrollView>
  );
}

// Same look as the account allergy editor (screens/PreferencesScreen.tsx);
// colours follow the light / dark theme through components/Themed.
const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: "#F7F9F7", alignItems: "center", paddingVertical: 20 },
  center: { flex: 1, justifyContent: "center" },
  content: { width: "100%" },
  title: { color: "#176B43", fontSize: 25, fontWeight: "800", marginBottom: 7 },
  subtitle: { color: "#63776B", fontSize: 14, lineHeight: 21, marginBottom: 16 },
  question: { color: "#17452F", fontSize: 15, fontWeight: "800", marginTop: 16, marginBottom: 9 },
  notice: {
    color: "#7A4B00",
    backgroundColor: "#FFF4DB",
    borderColor: "#F0C36D",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  errorText: { color: "#B42318", fontSize: 13, lineHeight: 18, marginTop: 8 },
  saveButton: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: "#176B43",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  disabledButton: { opacity: 0.6 },
  saveButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  deviceNote: { color: "#4E6358", fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 14 },
  warning: { color: "#8A5A50", fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 10 },
});
