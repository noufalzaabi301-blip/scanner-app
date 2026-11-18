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
  MAX_ALLERGY_LENGTH,
  validateCustomAllergy,
} from "../lib/allergyValidation";
import { ALLERGY_OPTIONS, allergyLabel, ROUTES } from "../lib/constants";
import {
  guestSetupProblem,
  loadGuestPreferences,
  saveGuestPreferences,
  type GuestPreferences,
} from "../lib/guestPreferences";
import { useI18n } from "../lib/i18n";
import { usePageInsets } from "../lib/layout";
import { showMessage } from "../lib/ui/messages";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "../components/Themed";

const ALLERGY_VALUES = ALLERGY_OPTIONS.map((option) => option.value);

export default function GuestPreferencesScreen({ navigation, route }: any) {
  const { t } = useI18n();
  const pageInsets = usePageInsets();
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

  function toggleAllergy(value: string) {
    setProblem("");
    setAllergies((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }

  // Same validation as the account allergy editor.
  function addCustomAllergy() {
    const result = validateCustomAllergy(customInput, allergies, customAllergies);

    if (!result.ok) {
      setCustomError(t(result.message));
      return;
    }

    setCustomError("");
    setProblem("");

    if (result.standardOption) {
      const standard = result.standardOption;
      setAllergies((current) => (current.includes(standard) ? current : [...current, standard]));
    } else {
      setCustomAllergies((current) => [...current, result.value]);
    }

    setCustomInput("");
  }

  function removeCustomAllergy(value: string) {
    setCustomAllergies((current) => current.filter((item) => item !== value));
  }

  async function saveAndContinue() {
    const prefs: GuestPreferences = {
      version: 1,
      hasAllergies,
      allergies,
      customAllergies,
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

  const answer = (selected: boolean) => [
    styles.answerButton,
    selected && styles.selectedAnswer,
  ];
  const answerText = (selected: boolean) => [
    styles.answerText,
    selected && styles.selectedAnswerText,
  ];

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
        <View style={styles.answerRow}>
          <TouchableOpacity
            style={answer(hasAllergies === true)}
            onPress={() => chooseAllergies(true)}
            accessibilityRole="radio"
            accessibilityState={{ selected: hasAllergies === true }}
          >
            <Text style={answerText(hasAllergies === true)}>{t("common.yes")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={answer(hasAllergies === false)}
            onPress={() => chooseAllergies(false)}
            accessibilityRole="radio"
            accessibilityState={{ selected: hasAllergies === false }}
          >
            <Text style={answerText(hasAllergies === false)}>
              {t("guest.noAllergies")}
            </Text>
          </TouchableOpacity>
        </View>

        {hasAllergies === false && (
          <Text style={styles.notice}>{t("guest.matchingOffNotice")}</Text>
        )}

        {hasAllergies === true && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("prefs.selectAll")}</Text>

            {ALLERGY_VALUES.map((value) => {
              const selected = allergies.includes(value);

              return (
                <TouchableOpacity
                  key={value}
                  style={styles.checkboxRow}
                  onPress={() => toggleAllergy(value)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                >
                  <View style={[styles.checkbox, selected && styles.checkedBox]}>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>{allergyLabel(value, t)}</Text>
                </TouchableOpacity>
              );
            })}

            {customAllergies.map((value) => (
              <View key={`custom-${value}`} style={styles.allergyRow}>
                <Text style={styles.allergyRowText}>{allergyLabel(value, t)}</Text>
                <TouchableOpacity
                  onPress={() => removeCustomAllergy(value)}
                  accessibilityRole="button"
                  accessibilityLabel={t("prefs.deleteAllergy", {
                    name: allergyLabel(value, t),
                  })}
                >
                  <Text style={styles.deleteText}>🗑</Text>
                </TouchableOpacity>
              </View>
            ))}

            <Text style={styles.otherLabel}>{t("prefs.addAllergy")}</Text>
            <View style={styles.customInputRow}>
              <TextInput
                style={[styles.customInput, customError ? styles.customInputError : null]}
                value={customInput}
                onChangeText={(value) => {
                  setCustomInput(value);
                  setCustomError("");
                }}
                placeholder={t("prefs.addPlaceholder")}
                placeholderTextColor="#9AA9A0"
                maxLength={MAX_ALLERGY_LENGTH + 10}
                autoCorrect={false}
                onSubmitEditing={addCustomAllergy}
                accessibilityLabel={t("prefs.addAllergy")}
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={addCustomAllergy}
                accessibilityRole="button"
              >
                <Text style={styles.addButtonText}>{t("prefs.add")}</Text>
              </TouchableOpacity>
            </View>
            {customError ? (
              <Text style={styles.errorText}>{customError}</Text>
            ) : (
              <Text style={styles.hint}>{t("prefs.allergyHint")}</Text>
            )}
          </View>
        )}

        {/* 2. Halal */}
        <Text style={styles.question}>{t("guest.halalQuestion")}</Text>
        <View style={styles.answerRow}>
          <TouchableOpacity
            style={answer(prefersHalal === true)}
            onPress={() => {
              setPrefersHalal(true);
              setProblem("");
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: prefersHalal === true }}
          >
            <Text style={answerText(prefersHalal === true)}>{t("common.yes")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={answer(prefersHalal === false)}
            onPress={() => {
              setPrefersHalal(false);
              setProblem("");
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: prefersHalal === false }}
          >
            <Text style={answerText(prefersHalal === false)}>{t("common.no")}</Text>
          </TouchableOpacity>
        </View>

        {problem ? <Text style={styles.errorText}>{problem}</Text> : null}

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
  answerRow: { flexDirection: "row", gap: 9, marginBottom: 8 },
  answerButton: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#B8CDBE",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
  },
  selectedAnswer: { backgroundColor: "#176B43", borderColor: "#176B43" },
  answerText: { color: "#176B43", fontSize: 14, fontWeight: "700", textAlign: "center" },
  selectedAnswerText: { color: "#FFFFFF" },
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
  section: { marginTop: 5 },
  sectionTitle: { color: "#17452F", fontSize: 14, fontWeight: "800", marginBottom: 10 },
  checkboxRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: "#AFC4B5",
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkedBox: { backgroundColor: "#176B43", borderColor: "#176B43" },
  checkmark: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  checkboxLabel: { color: "#17452F", fontSize: 14 },
  allergyRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#E8F5E9",
    borderRadius: 9,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  allergyRowText: { color: "#17452F", fontSize: 14, fontWeight: "600" },
  deleteText: { color: "#C0392B", fontSize: 18 },
  otherLabel: { color: "#17452F", fontSize: 13, fontWeight: "700", marginTop: 14, marginBottom: 7 },
  customInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  customInput: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#B8CDBE",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 13,
    color: "#17452F",
    fontSize: 14,
  },
  customInputError: { borderColor: "#B42318" },
  addButton: {
    flexShrink: 0,
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#176B43",
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  hint: { color: "#68766F", fontSize: 12, lineHeight: 17, marginTop: 6 },
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
