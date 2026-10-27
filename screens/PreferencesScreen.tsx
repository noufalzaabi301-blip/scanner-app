// React hooks used by the preferences form.
import { useCallback, useState } from "react";

// Reloads saved preferences whenever this screen opens.
import { useFocusEffect } from "@react-navigation/native";

// React Native components used by this screen.
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// Supabase client for the user database.
import { supabase } from "../lib/supabase";

// Standard allergies used during first-time setup.
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

// Shape of the saved preferences row.
type SavedPreferences = {
  prefers_halal: boolean | null;
  has_allergies: boolean | null;
  allergies: unknown;
  other_allergy: string | null;
};

// Converts the saved custom-allergy text into multiple values.
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
  // Edit mode is opened from the Home allergy banner.
  const isEditMode =
    route?.params?.mode === "edit";

  // Stores the halal preference.
  const [prefersHalal, setPrefersHalal] =
    useState<boolean | null>(null);

  // Stores whether the user has allergies.
  const [hasAllergies, setHasAllergies] =
    useState<boolean | null>(null);

  // Stores selected standard allergies.
  const [selectedAllergies, setSelectedAllergies] =
    useState<string[]>([]);

  // Stores allergies not included in the standard list.
  const [customAllergies, setCustomAllergies] =
    useState<string[]>([]);

  // Stores the current allergy being added.
  const [customInput, setCustomInput] = useState("");

  // Loading states.
  const [loading, setLoading] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);

  // Shows messages on web and mobile.
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

  // Loads the saved preferences from Supabase.
  const loadSavedPreferences = useCallback(
    async () => {
      setLoadingSaved(true);

      try {
        // Get the currently signed-in user.
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          return;
        }

        // Load the user's preferences.
        const { data, error } = await supabase
          .from("user_preferences")
          .select(
            "prefers_halal, has_allergies, allergies, other_allergy"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (error || !data) {
          console.warn(
            "Could not load preferences:",
            error?.message
          );
          return;
        }

        const saved = data as SavedPreferences;

        // Read standard allergies from the text[] column.
        const standardAllergies =
          Array.isArray(saved.allergies)
            ? saved.allergies.filter(
                (item): item is string =>
                  typeof item === "string"
              )
            : [];

        // Read multiple custom allergies from the text column.
        const customAllergies =
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
              customAllergies.length > 0
        );

        setSelectedAllergies(standardAllergies);
        setCustomAllergies(customAllergies);
        setCustomInput("");
      } catch (error) {
        console.warn(
          "Could not load preferences:",
          error
        );
      } finally {
        setLoadingSaved(false);
      }
    },
    []
  );

  // Reload saved preferences every time this screen opens.
  useFocusEffect(
    useCallback(() => {
      void loadSavedPreferences();
    }, [loadSavedPreferences])
  );

  // Adds or removes a standard allergy during setup.
  function toggleAllergy(allergy: string) {
    setSelectedAllergies((current) => {
      if (current.includes(allergy)) {
        return current.filter(
          (item) => item !== allergy
        );
      }

      return [...current, allergy];
    });
  }

  // Adds either a standard or custom allergy.
  function addAllergy() {
    const value = customInput.trim();

    if (!value) {
      return;
    }

    const standardMatch = ALLERGY_OPTIONS.find(
      (allergy) =>
        allergy.toLowerCase() === value.toLowerCase()
    );

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

    // Save known allergies in the standard allergy array.
    if (standardMatch) {
      setSelectedAllergies((current) => [
        ...current,
        standardMatch,
      ]);
    } else {
      // Save unknown allergies in the custom allergy list.
      setCustomAllergies((current) => [
        ...current,
        value,
      ]);
    }

    setHasAllergies(true);
    setCustomInput("");
  }

  // Deletes any allergy while editing.
  function removeAllergy(allergy: string) {
    setSelectedAllergies((current) =>
      current.filter((item) => item !== allergy)
    );

    setCustomAllergies((current) =>
      current.filter((item) => item !== allergy)
    );
  }

  // Handles the Yes/No allergy answer.
  function selectAllergyAnswer(
    answer: boolean
  ) {
    setHasAllergies(answer);

    // Clear all allergy values when No is selected.
    if (!answer) {
      setSelectedAllergies([]);
      setCustomAllergies([]);
      setCustomInput("");
    }
  }

  // Saves the preferences to Supabase.
  async function savePreferences() {
    if (prefersHalal === null) {
      showMessage(
        "Choose a food preference",
        "Tell us whether you prefer halal food."
      );
      return;
    }

    if (hasAllergies === null) {
      showMessage(
        "Choose an allergy option",
        "Tell us whether you have food allergies."
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
      // Confirm that the user is signed in.
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

      // Save standard and custom allergies.
      const { error } = await supabase
        .from("user_preferences")
        .upsert(
          {
            user_id: user.id,
            prefers_halal: prefersHalal,
            has_allergies: hasAllergies,

            // Standard allergies are saved in the text[] column.
            allergies: hasAllergies
              ? selectedAllergies
              : [],

            // Custom allergies are stored as comma-separated text
            // because the existing database uses one text column.
            other_allergy:
              hasAllergies &&
              customAllergies.length > 0
                ? customAllergies.join(", ")
                : null,

            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        );

      if (error) {
        showMessage(
          "Could not save preferences",
          error.message
        );
        return;
      }

      // Edit mode returns to Home.
      if (
        isEditMode &&
        navigation.canGoBack()
      ) {
        navigation.goBack();
      } else {
        // First-time setup continues to Home.
        navigation.replace("Home");
      }
    } catch (error) {
      console.warn(
        "Could not save preferences:",
        error
      );

      showMessage(
        "Connection problem",
        "Could not save your preferences."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        {/* Title changes between setup and edit mode. */}
        <Text style={styles.title}>
          {isEditMode
            ? "Edit your preferences"
            : "Personalize LabelLens"}
        </Text>

        {/* Shows while saved values are loading. */}
        {loadingSaved && (
          <ActivityIndicator
            color="#176B43"
            style={styles.loading}
          />
        )}

        {/* Explains the purpose of the preferences. */}
        <Text style={styles.description}>
          These preferences help LabelLens highlight
          relevant product information. Always verify
          the package label before consuming a product.
        </Text>

        {/* Halal preference question. */}
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
            onPress={() => setPrefersHalal(true)}
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
            onPress={() => setPrefersHalal(false)}
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

        {/* Allergy preference question. */}
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

        {/* Allergy content appears after Yes is selected. */}
        {hasAllergies === true && (
          <View style={styles.allergySection}>
            <Text style={styles.sectionTitle}>
              {isEditMode
                ? "Your current allergies"
                : "Select all that apply"}
            </Text>

            {isEditMode ? (
              <>
                {/* Edit mode shows only saved allergies. */}
                {[
                  ...selectedAllergies,
                  ...customAllergies,
                ].length === 0 ? (
                  <Text style={styles.emptyText}>
                    No allergies added yet.
                  </Text>
                ) : (
                  [
                    ...selectedAllergies,
                    ...customAllergies,
                  ].map((allergy) => (
                    <View
                      key={`edit-${allergy}`}
                      style={styles.editAllergyRow}
                    >
                      <Text
                        style={styles.editAllergyText}
                      >
                        {allergy}
                      </Text>

                      {/* Every saved allergy can be deleted. */}
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() =>
                          removeAllergy(allergy)
                        }
                        accessibilityLabel={`Delete ${allergy}`}
                      >
                        <Text style={styles.deleteIcon}>
                          🗑
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </>
            ) : (
              <>
                {/* First-time setup uses checkboxes. */}
                {ALLERGY_OPTIONS.map((allergy) => {
                  const selected =
                    selectedAllergies.includes(
                      allergy
                    );

                  return (
                    <TouchableOpacity
                      key={allergy}
                      style={styles.checkboxRow}
                      onPress={() =>
                        toggleAllergy(allergy)
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
              </>
            )}

            {/* Adds a standard or custom allergy. */}
            <Text style={styles.otherLabel}>
              Add an allergy
            </Text>

            <View style={styles.customInputRow}>
              <TextInput
                style={styles.input}
                value={customInput}
                onChangeText={setCustomInput}
                placeholder="e.g. Coconut or Milk"
                placeholderTextColor="#9AA9A0"
              />

              <TouchableOpacity
                style={styles.addButton}
                onPress={addAllergy}
              >
                <Text style={styles.addButtonText}>
                  Add
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Saves the preferences. */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            (loading || loadingSaved) &&
              styles.disabledButton,
          ]}
          onPress={savePreferences}
          disabled={loading || loadingSaved}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>
              {isEditMode
                ? "Save changes"
                : "Save and continue"}
            </Text>
          )}
        </TouchableOpacity>

        {/* Safety reminder. */}
        <Text style={styles.warning}>
          LabelLens provides screening information and
          cannot guarantee that a product is safe for a
          particular allergy.
        </Text>
      </View>
    </ScrollView>
  );
}

// Styles used by the preferences screen.
const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    backgroundColor: "#F1F7F3",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  card: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 30,
  },

  title: {
    color: "#17452F",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
  },

  description: {
    color: "#68766F",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 28,
  },

  question: {
    color: "#263E32",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 12,
  },

  answerRow: {
    flexDirection: "row",
  },

  answerButton: {
    flex: 1,
    borderColor: "#B9CCC1",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginHorizontal: 5,
  },

  selectedAnswer: {
    backgroundColor: "#176B43",
    borderColor: "#176B43",
  },

  answerText: {
    color: "#176B43",
    fontWeight: "700",
  },

  selectedAnswerText: {
    color: "#FFFFFF",
  },

  allergySection: {
    marginTop: 24,
  },

  sectionTitle: {
    color: "#263E32",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },

  checkboxRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: "#93AA9D",
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

  checkboxLabel: {
    color: "#263E32",
    fontSize: 16,
  },

  editAllergyRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E3ECE6",
    paddingVertical: 9,
  },

  editAllergyText: {
    color: "#263E32",
    fontSize: 16,
  },

  emptyText: {
    color: "#68766F",
    fontSize: 14,
    marginBottom: 8,
  },

  deleteButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  deleteIcon: {
    color: "#B3261E",
    fontSize: 18,
  },

  otherLabel: {
    color: "#263E32",
    fontWeight: "600",
    marginTop: 18,
    marginBottom: 7,
  },

  customInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  input: {
    flex: 1,
    borderColor: "#C9D8CF",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#263E32",
  },

  addButton: {
    backgroundColor: "#176B43",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginLeft: 8,
  },

  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  saveButton: {
    backgroundColor: "#176B43",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
    marginTop: 30,
  },

  loading: {
    marginTop: 12,
  },

  disabledButton: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },

  warning: {
    color: "#7A6251",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 18,
  },
});