// ---------------------------------------------------------------------------
// screens/PreferencesScreen.tsx
// First-time setup and later editing of allergies, halal preference and the
// optional product-submission consent. Everything is saved to the
// user_preferences row, which is the source of truth for the whole app.
// ---------------------------------------------------------------------------

import { useCallback, useState } from "react";

import { useFocusEffect } from "@react-navigation/native";

import {
  ActivityIndicator,
  StyleSheet,
} from "react-native";

import {
  ALLERGY_OPTIONS,
  allergyEnglishName,
  allergyLabel,
  findAllergyOption,
} from "../lib/constants";
import { prepareAllergyLabels } from "../lib/foodTranslation";

// True when two allergy names mean the same thing, in any language.
function sameAllergy(a: string, b: string): boolean {
  const key = (value: string) => {
    const english = (allergyEnglishName(value) ?? value).toLowerCase();
    return findAllergyOption(english)?.value.toLowerCase() ?? english;
  };

  return key(a) === key(b);
}
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { showMessage } from "../lib/ui/messages";
import {
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "../components/Themed";

const ALLERGY_VALUES = ALLERGY_OPTIONS.map((option) => option.value);


type SavedPreferences = {
  prefers_halal: boolean | null;
  has_allergies: boolean | null;
  allergies: unknown;
  other_allergy: string | null;
  submit_products_for_review: boolean | null;
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

  // Consent passed from Register (via the Privacy Notice), if any.
  const routeConsent: boolean | undefined =
    typeof route?.params?.submitProductsForReview === "boolean"
      ? route.params.submitProductsForReview
      : undefined;

  const [prefersHalal, setPrefersHalal] =
    useState<boolean | null>(null);

  const [hasAllergies, setHasAllergies] =
    useState<boolean | null>(null);

  const [selectedAllergies, setSelectedAllergies] =
    useState<string[]>([]);

  const [customAllergies, setCustomAllergies] =
    useState<string[]>([]);

  const [customInput, setCustomInput] =
    useState("");

  // Optional product-submission consent (default: off).
  const [submitProducts, setSubmitProducts] =
    useState(false);

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

        // Consent chosen at sign-up (kept with the account), used only
        // until a value has been saved to user_preferences.
        const signUpConsent =
          user.user_metadata?.submit_products_for_review === true;

        const fallbackConsent =
          routeConsent ?? signUpConsent;

        const { data, error } = await supabase
          .from("user_preferences")
          .select(
            "prefers_halal, has_allergies, allergies, other_allergy, submit_products_for_review"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!data) {
          setSubmitProducts(fallbackConsent);
          return;
        }

        const saved =
          data as SavedPreferences;

        // Edit mode: the database value is the source of truth.
        // First setup: the choice just made on the Privacy Notice wins.
        if (!isEditMode && routeConsent !== undefined) {
          setSubmitProducts(routeConsent);
        } else if (
          typeof saved.submit_products_for_review === "boolean"
        ) {
          setSubmitProducts(saved.submit_products_for_review);
        } else {
          setSubmitProducts(fallbackConsent);
        }

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

        setPrefersHalal(
          typeof saved.prefers_halal === "boolean"
            ? saved.prefers_halal
            : null
        );

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
    [isEditMode, routeConsent]
  );

  useFocusEffect(
    useCallback(() => {
      void loadSavedPreferences();
    }, [loadSavedPreferences])
  );

  function selectHalal(value: boolean) {
    setPrefersHalal(value);
  }

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

  function addCustomAllergy() {
    const value = customInput.trim();

    if (!value) {
      showMessage(
        t("prefs.enterAllergyTitle"),
        t("prefs.enterAllergyBody")
      );
      return;
    }

    // Compare by meaning, not spelling: "حليب", "milk" and "Milk" are the
    // same allergy, so it cannot be added twice in two languages.
    const alreadyExists = [
      ...selectedAllergies,
      ...customAllergies,
    ].some((item) => sameAllergy(item, value));

    if (alreadyExists) {
      showMessage(
        t("prefs.alreadyAddedTitle"),
        t("prefs.alreadyAddedBody")
      );
      return;
    }

    // Typing a standard allergy in either language (e.g. "بيض" or "egg")
    // ticks the standard option instead of adding a custom one.
    const standardMatch = findAllergyOption(
      allergyEnglishName(value) ?? value
    )?.value;

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
    if (prefersHalal === null) {
      showMessage(
        t("prefs.chooseHalalTitle"),
        t("prefs.chooseHalalBody")
      );
      return;
    }

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

      const { error } = await supabase
        .from("user_preferences")
        .upsert(
          {
            user_id: user.id,
            prefers_halal: prefersHalal,
            has_allergies: hasAllergies,
            allergies: hasAllergies
              ? selectedAllergies
              : [],
            other_allergy:
              hasAllergies &&
              customAllergies.length > 0
                ? customAllergies.join(", ")
                : null,
            // Always saved as true or false.
            submit_products_for_review:
              submitProducts === true,
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

        <Text style={styles.question}>{t("prefs.halalQuestion")}</Text>

        <View style={styles.answerRow}>
          <TouchableOpacity
            style={[
              styles.answerButton,
              prefersHalal === true &&
                styles.selectedAnswer,
            ]}
            onPress={() => selectHalal(true)}
          >
            <Text
              style={[
                styles.answerText,
                prefersHalal === true &&
                  styles.selectedAnswerText,
              ]}
            >
              {t("common.yes")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.answerButton,
              prefersHalal === false &&
                styles.selectedAnswer,
            ]}
            onPress={() => selectHalal(false)}
          >
            <Text
              style={[
                styles.answerText,
                prefersHalal === false &&
                  styles.selectedAnswerText,
              ]}
            >
              {t("common.no")}
            </Text>
          </TouchableOpacity>
        </View>

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
                style={styles.customInput}
                value={customInput}
                onChangeText={setCustomInput}
                placeholder={t("prefs.addPlaceholder")}
                placeholderTextColor="#9AA9A0"
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
          </View>
        )}

        {/* Optional product-submission consent (saved with the form). */}
        <View style={styles.submissionCard}>
          <View style={styles.submissionRow}>
            <Text style={styles.submissionTitle}>{t("prefs.submitTitle")}</Text>

            <Switch
              value={submitProducts}
              onValueChange={setSubmitProducts}
              disabled={loadingSaved}
              trackColor={{
                false: "#C9D4CC",
                true: "#8FC9A5",
              }}
              thumbColor={
                submitProducts ? "#176B43" : "#F4F6F5"
              }
              accessibilityLabel={t("prefs.submitA11y")}
            />
          </View>

          <Text style={styles.submissionText}>{t("prefs.submitBody")}</Text>
        </View>

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

  submissionCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE7E0",
    borderRadius: 12,
    padding: 14,
    marginTop: 22,
  },

  submissionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  submissionTitle: {
    flex: 1,
    color: "#17452F",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },

  submissionText: {
    color: "#63776B",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
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