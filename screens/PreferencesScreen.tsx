// ---------------------------------------------------------------------------
// screens/PreferencesScreen.tsx
// Allergy editor (first-time setup and "Edit allergy preferences"):
// allergy yes/no, the standard allergy list, custom allergies, Save.
//
// The halal preference and the product-submission consent are NOT edited
// here; they live only in HalalAndVerificationScreen. This
// screen never overwrites them: on edit they are left out of the save, and
// a brand-new row starts with both turned off.
// ---------------------------------------------------------------------------

import { useCallback, useState } from "react";

import { useFocusEffect } from "@react-navigation/native";

import {
  ActivityIndicator,
  StyleSheet,
} from "react-native";

import {
  MAX_ALLERGY_LENGTH,
  validateCustomAllergy,
} from "../lib/allergyValidation";
import { ALLERGY_OPTIONS, allergyLabel } from "../lib/constants";
import { prepareAllergyLabels } from "../lib/foodTranslation";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { showMessage } from "../lib/ui/messages";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "../components/Themed";

const ALLERGY_VALUES = ALLERGY_OPTIONS.map((option) => option.value);


type SavedPreferences = {
  has_allergies: boolean | null;
  allergies: unknown;
  other_allergy: string | null;
};

function splitCustomAllergies(
  value: string
): string[] {
  return [
    ...new Set(
      value
        .split(/[,;،|]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
}

export default function PreferencesScreen({
  navigation,
  route,
}: any) {
  const { t } = useI18n();

  const isEditMode =
    route?.params?.mode === "edit";

  const [hasAllergies, setHasAllergies] =
    useState<boolean | null>(null);

  const [selectedAllergies, setSelectedAllergies] =
    useState<string[]>([]);

  const [customAllergies, setCustomAllergies] =
    useState<string[]>([]);

  const [customInput, setCustomInput] =
    useState("");
  // Validation message shown under the custom allergy field.
  const [customError, setCustomError] = useState("");

  // True when this user already has a user_preferences row.
  const [hasSavedRow, setHasSavedRow] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingSaved, setLoadingSaved] =
    useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadSavedPreferences = useCallback(
    async () => {
      setLoadingSaved(true);
      setLoadError(false);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          return;
        }

        const { data, error } = await supabase
          .from("user_preferences")
          .select("has_allergies, allergies, other_allergy")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        setHasSavedRow(!!data);

        if (!data) {
          return;
        }

        const saved =
          data as SavedPreferences;

        const standardAllergies =
          Array.isArray(saved.allergies)
            ? saved.allergies
                .filter(
                  (item): item is string =>
                    typeof item === "string"
                )
                .map((item) => item.trim())
                .filter(Boolean)
            : [];

        const savedCustomAllergies =
          typeof saved.other_allergy === "string"
            ? splitCustomAllergies(
                saved.other_allergy
              )
            : [];

        setHasAllergies(
          typeof saved.has_allergies === "boolean"
            ? saved.has_allergies
            : standardAllergies.length > 0 ||
              savedCustomAllergies.length > 0
        );

        // Lets allergies typed in either language show in the current one.
        await prepareAllergyLabels([
          ...standardAllergies,
          ...savedCustomAllergies,
        ]);

        setSelectedAllergies(
          standardAllergies
        );

        setCustomAllergies(
          savedCustomAllergies
        );

        setCustomInput("");
      } catch (error: any) {
        console.warn(
          "Could not load preferences:",
          error
        );
        setLoadError(true);
      } finally {
        setLoadingSaved(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      void loadSavedPreferences();
    }, [loadSavedPreferences])
  );

  function selectAllergyAnswer(
    value: boolean
  ) {
    setHasAllergies(value);

    if (!value) {
      setSelectedAllergies([]);
      setCustomAllergies([]);
      setCustomInput("");
    }
  }

  function toggleStandardAllergy(
    allergy: string
  ) {
    setSelectedAllergies((current) => {
      if (current.includes(allergy)) {
        return current.filter(
          (item) => item !== allergy
        );
      }

      return [...current, allergy];
    });
  }

  // Adds a custom allergy ONLY after it passes validation
  // (lib/allergyValidation.ts). Invalid text is never added; the reason is
  // shown under the field and in an alert.
  function addCustomAllergy() {
    const result = validateCustomAllergy(
      customInput,
      selectedAllergies,
      customAllergies
    );

    if (!result.ok) {
      setCustomError(t(result.message));
      showMessage(t(result.title), t(result.message));
      return;
    }

    setCustomError("");

    const value = result.value;
    const standardMatch = result.standardOption;

    if (standardMatch) {
      setSelectedAllergies((current) => [
        ...current,
        standardMatch,
      ]);
    } else {
      setCustomAllergies((current) => [
        ...current,
        value,
      ]);
    }

    setHasAllergies(true);
    setCustomInput("");
  }

  function removeAllergy(allergy: string) {
    setSelectedAllergies((current) =>
      current.filter((item) => item !== allergy)
    );

    setCustomAllergies((current) =>
      current.filter((item) => item !== allergy)
    );
  }

  async function savePreferences() {
    if (hasAllergies === null) {
      showMessage(
        t("prefs.chooseAllergyTitle"),
        t("prefs.chooseAllergyBody")
      );
      return;
    }

    if (
      hasAllergies &&
      selectedAllergies.length === 0 &&
      customAllergies.length === 0
    ) {
      showMessage(
        t("prefs.selectAllergyTitle"),
        t("prefs.selectAllergyBody")
      );
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        showMessage(
          t("prefs.sessionExpiredTitle"),
          t("prefs.sessionExpiredBody")
        );

        navigation.replace("Login");
        return;
      }

      // Only allergy columns are written for an existing row, so the halal
      // preference and submission consent set in Profile settings are kept.
      // A first-time row starts with both off (changeable in Profile
      // settings at any time).
      const { error } = await supabase
        .from("user_preferences")
        .upsert(
          {
            user_id: user.id,
            ...(hasSavedRow
              ? {}
              : {
                  prefers_halal: false,
                  submit_products_for_review: false,
                }),
            has_allergies: hasAllergies,
            allergies: hasAllergies
              ? selectedAllergies
              : [],
            other_allergy:
              hasAllergies &&
              customAllergies.length > 0
                ? customAllergies.join(", ")
                : null,
            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        );

      if (error) {
        throw error;
      }

      showMessage(t("prefs.savedTitle"), t("prefs.savedBody"));

      if (isEditMode) {
        navigation.goBack();
      } else {
        navigation.replace("Home");
      }
    } catch (error: any) {
      showMessage(
        t("prefs.saveFailedTitle"),
        error?.message || t("prefs.tryAgain")
      );
    } finally {
      setLoading(false);
    }
  }

  const allCurrentAllergies = [
    ...selectedAllergies,
    ...customAllergies,
  ];

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.content}>
        <Text style={styles.title}>
          {isEditMode
            ? t("title.editPreferences")
            : t("title.yourPreferences")}
        </Text>

        <Text style={styles.subtitle}>{t("prefs.subtitle")}</Text>

        {loadError && (
          <Text style={styles.loadError}>{t("prefs.loadFailed")}</Text>
        )}

        <Text style={styles.question}>{t("prefs.allergyQuestion")}</Text>

        <View style={styles.answerRow}>
          <TouchableOpacity
            style={[
              styles.answerButton,
              hasAllergies === true &&
                styles.selectedAnswer,
            ]}
            onPress={() =>
              selectAllergyAnswer(true)
            }
          >
            <Text
              style={[
                styles.answerText,
                hasAllergies === true &&
                  styles.selectedAnswerText,
              ]}
            >
              {t("common.yes")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.answerButton,
              hasAllergies === false &&
                styles.selectedAnswer,
            ]}
            onPress={() =>
              selectAllergyAnswer(false)
            }
          >
            <Text
              style={[
                styles.answerText,
                hasAllergies === false &&
                  styles.selectedAnswerText,
              ]}
            >
              {t("common.no")}
            </Text>
          </TouchableOpacity>
        </View>

        {hasAllergies === true && (
          <View style={styles.allergySection}>
            <Text style={styles.sectionTitle}>
              {isEditMode
                ? t("prefs.currentAllergies")
                : t("prefs.selectAll")}
            </Text>

            {!isEditMode &&
              ALLERGY_VALUES.map((allergy) => {
                const selected =
                  selectedAllergies.includes(
                    allergy
                  );

                return (
                  <TouchableOpacity
                    key={allergy}
                    style={styles.checkboxRow}
                    onPress={() =>
                      toggleStandardAllergy(
                        allergy
                      )
                    }
                  >
                    <View
                      style={[
                        styles.checkbox,
                        selected &&
                          styles.checkedBox,
                      ]}
                    >
                      {selected && (
                        <Text
                          style={styles.checkmark}
                        >
                          ✓
                        </Text>
                      )}
                    </View>

                    <Text
                      style={styles.checkboxLabel}
                    >
                      {allergyLabel(allergy, t)}
                    </Text>
                  </TouchableOpacity>
                );
              })}

            {isEditMode &&
              allCurrentAllergies.map(
                (allergy) => (
                  <View
                    key={`saved-${allergy}`}
                    style={styles.allergyRow}
                  >
                    <Text
                      style={styles.allergyRowText}
                    >
                      {allergyLabel(allergy, t)}
                    </Text>

                    <TouchableOpacity
                      onPress={() =>
                        removeAllergy(allergy)
                      }
                      accessibilityLabel={t("prefs.deleteAllergy", {
                        name: allergyLabel(allergy, t),
                      })}
                    >
                      <Text style={styles.deleteText}>
                        🗑
                      </Text>
                    </TouchableOpacity>
                  </View>
                )
              )}

            {!isEditMode &&
              customAllergies.map(
                (allergy) => (
                  <View
                    key={`custom-${allergy}`}
                    style={styles.allergyRow}
                  >
                    <Text
                      style={styles.allergyRowText}
                    >
                      {allergyLabel(allergy, t)}
                    </Text>

                    <TouchableOpacity
                      onPress={() =>
                        removeAllergy(allergy)
                      }
                      accessibilityLabel={t("prefs.deleteAllergy", {
                        name: allergyLabel(allergy, t),
                      })}
                    >
                      <Text style={styles.deleteText}>
                        🗑
                      </Text>
                    </TouchableOpacity>
                  </View>
                )
              )}

            <Text style={styles.otherLabel}>{t("prefs.addAllergy")}</Text>

            <View style={styles.customInputRow}>
              <TextInput
                style={[
                  styles.customInput,
                  customError ? styles.customInputError : null,
                ]}
                value={customInput}
                onChangeText={(value) => {
                  setCustomInput(value);
                  setCustomError("");
                }}
                placeholder={t("prefs.addPlaceholder")}
                placeholderTextColor="#9AA9A0"
                maxLength={MAX_ALLERGY_LENGTH + 10}
                autoCorrect={false}
                onSubmitEditing={
                  addCustomAllergy
                }
              />

              <TouchableOpacity
                style={styles.addButton}
                onPress={addCustomAllergy}
              >
                <Text style={styles.addButtonText}>{t("prefs.add")}</Text>
              </TouchableOpacity>
            </View>

            {customError ? (
              <Text style={styles.customErrorText}>{customError}</Text>
            ) : (
              <Text style={styles.customHint}>{t("prefs.allergyHint")}</Text>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.saveButton,
            (loading || loadingSaved) &&
              styles.disabledButton,
          ]}
          onPress={savePreferences}
          disabled={loading || loadingSaved}
        >
          {loading || loadingSaved ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>
              {isEditMode
                ? t("prefs.saveChanges")
                : t("prefs.saveContinue")}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.warning}>{t("prefs.warning")}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  customInputError: {
    borderColor: "#B42318",
  },

  customErrorText: {
    color: "#B42318",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },

  customHint: {
    color: "#68766F",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },

  loadError: {
    color: "#B42318",
    backgroundColor: "#FDECEA",
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },

  page: {
    flexGrow: 1,
    backgroundColor: "#F7F9F7",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
  },

  content: {
    width: "100%",
    maxWidth: 420,
  },

  title: {
    color: "#176B43",
    fontSize: 25,
    fontWeight: "800",
    marginBottom: 7,
  },

  subtitle: {
    color: "#63776B",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 24,
  },

  question: {
    color: "#17452F",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 13,
    marginBottom: 9,
  },

  answerRow: {
    flexDirection: "row",
    gap: 9,
    marginBottom: 12,
  },

  answerButton: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#B8CDBE",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  selectedAnswer: {
    backgroundColor: "#176B43",
    borderColor: "#176B43",
  },

  answerText: {
    color: "#176B43",
    fontSize: 14,
    fontWeight: "700",
  },

  selectedAnswerText: {
    color: "#FFFFFF",
  },

  allergySection: {
    marginTop: 5,
  },

  sectionTitle: {
    color: "#17452F",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 10,
  },

  // `gap` (not margins) so the spacing is correct in both LTR and RTL.
  checkboxRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: "#AFC4B5",
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
    fontSize: 14,
    fontWeight: "800",
  },

  checkboxLabel: {
    color: "#17452F",
    fontSize: 14,
  },

  allergyRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#E8F5E9",
    borderRadius: 9,
    paddingHorizontal: 12,
    marginBottom: 8,
  },

  allergyRowText: {
    color: "#17452F",
    fontSize: 14,
    fontWeight: "600",
  },

  deleteText: {
    color: "#C0392B",
    fontSize: 18,
  },

  otherLabel: {
    color: "#17452F",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 7,
  },

  customInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

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

  addButton: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#176B43",
    justifyContent: "center",
    alignItems: "center",
  },

  addButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },





  saveButton: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: "#176B43",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 25,
  },

  disabledButton: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  warning: {
    color: "#8A5A50",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 18,
  },
});