import { useCallback, useState } from "react";

import { useFocusEffect } from "@react-navigation/native";

import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { supabase } from "../lib/supabase";

const ALLERGY_OPTIONS = [
  "Milk",
  "Eggs",
  "Peanuts",
  "Tree nuts",
  "Wheat",
  "Soy",
  "Fish",
  "Shellfish",
  "Sesame",
];

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

  const loadSavedPreferences = useCallback(
    async () => {
      setLoadingSaved(true);

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
        "Enter an allergy",
        "Please type an allergy before pressing Add."
      );
      return;
    }

    const alreadyExists = [
      ...selectedAllergies,
      ...customAllergies,
    ].some(
      (item) =>
        item.toLowerCase() === value.toLowerCase()
    );

    if (alreadyExists) {
      showMessage(
        "Already added",
        "This allergy is already in your profile."
      );
      return;
    }

    const standardMatch =
      ALLERGY_OPTIONS.find(
        (item) =>
          item.toLowerCase() === value.toLowerCase()
      );

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
        "Choose a food preference",
        "Please choose whether you prefer halal food."
      );
      return;
    }

    if (hasAllergies === null) {
      showMessage(
        "Choose an allergy option",
        "Please choose Yes or No."
      );
      return;
    }

    if (
      hasAllergies &&
      selectedAllergies.length === 0 &&
      customAllergies.length === 0
    ) {
      showMessage(
        "Select an allergy",
        "Choose an allergy or add a custom allergy."
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
          "Session expired",
          "Please log in again."
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

      showMessage(
        "Saved successfully",
        "Your preferences were updated."
      );

      if (isEditMode) {
        navigation.goBack();
      } else {
        navigation.replace("Home");
      }
    } catch (error: any) {
      showMessage(
        "Could not save preferences",
        error?.message ||
          "Please try again."
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
            ? "Edit preferences"
            : "Your preferences"}
        </Text>

        <Text style={styles.subtitle}>
          Tell us about your food preferences so LabelLens
          can screen products for you.
        </Text>

        <Text style={styles.question}>
          Do you prefer halal food?
        </Text>

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
              Yes
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
              No
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.question}>
          Do you have any food allergies?
        </Text>

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
              Yes
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
              No
            </Text>
          </TouchableOpacity>
        </View>

        {hasAllergies === true && (
          <View style={styles.allergySection}>
            <Text style={styles.sectionTitle}>
              {isEditMode
                ? "Your current allergies"
                : "Select all that apply"}
            </Text>

            {!isEditMode &&
              ALLERGY_OPTIONS.map((allergy) => {
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
                      {allergy}
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
                      {allergy}
                    </Text>

                    <TouchableOpacity
                      onPress={() =>
                        removeAllergy(allergy)
                      }
                      accessibilityLabel={`Delete ${allergy}`}
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
                      {allergy}
                    </Text>

                    <TouchableOpacity
                      onPress={() =>
                        removeAllergy(allergy)
                      }
                      accessibilityLabel={`Delete ${allergy}`}
                    >
                      <Text style={styles.deleteText}>
                        🗑
                      </Text>
                    </TouchableOpacity>
                  </View>
                )
              )}

            <Text style={styles.otherLabel}>
              Add an allergy
            </Text>

            <View style={styles.customInputRow}>
              <TextInput
                style={styles.customInput}
                value={customInput}
                onChangeText={setCustomInput}
                placeholder="e.g. Coconut or Sugar"
                placeholderTextColor="#9AA9A0"
                onSubmitEditing={
                  addCustomAllergy
                }
              />

              <TouchableOpacity
                style={styles.addButton}
                onPress={addCustomAllergy}
              >
                <Text style={styles.addButtonText}>
                  Add
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Optional product-submission consent (saved with the form). */}
        <View style={styles.submissionCard}>
          <View style={styles.submissionRow}>
            <Text style={styles.submissionTitle}>
              Help improve LabelLens by sending scanned
              products for verification
            </Text>

            <Switch
              value={submitProducts}
              onValueChange={setSubmitProducts}
              disabled={loadingSaved}
              trackColor={{
                false: "#C9D4CC",
                true: "#8FC9A5",
              }}
              thumbColor={
                submitProducts ? "#197640" : "#F4F6F5"
              }
              accessibilityLabel="Send scanned products for verification"
            />
          </View>

          <Text style={styles.submissionText}>
            When this is on, the barcode, the product
            information read from the label (name, brand,
            ingredients and allergen statements) and the
            package photos may be sent to LabelLens so the
            developer can verify the product. Your allergy
            profile is not sent. This is optional and you can
            turn it off at any time.
          </Text>
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
                ? "Save changes"
                : "Save and continue"}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.warning}>
          LabelLens provides screening information and
          cannot guarantee that a product is safe.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    backgroundColor: "#F8FBF8",
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
    color: "#163D2A",
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
    backgroundColor: "#197640",
    borderColor: "#197640",
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
    color: "#163D2A",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 10,
  },

  checkboxRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
  },

  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: "#AFC4B5",
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  checkedBox: {
    backgroundColor: "#197640",
    borderColor: "#197640",
  },

  checkmark: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  checkboxLabel: {
    color: "#1D3829",
    fontSize: 14,
  },

  allergyRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EEF7E7",
    borderRadius: 9,
    paddingHorizontal: 12,
    marginBottom: 8,
  },

  allergyRowText: {
    color: "#315D35",
    fontSize: 14,
    fontWeight: "600",
  },

  deleteText: {
    color: "#C0392B",
    fontSize: 18,
  },

  otherLabel: {
    color: "#264C37",
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
    color: "#1D3829",
    fontSize: 14,
  },

  addButton: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#197640",
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
    color: "#163D2A",
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
    backgroundColor: "#197640",
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