// React hooks used for form state and reloading saved preferences.
import { useCallback, useState } from "react";

// React Navigation hook used to reload data whenever this screen opens.
import { useFocusEffect } from "@react-navigation/native";

// React Native components used to build the preferences screen.
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

// Allergy choices shown to the user.
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

// Type for the saved preferences returned by Supabase.
type SavedPreferences = {
  prefers_halal: boolean | null;
  has_allergies: boolean | null;
  allergies: unknown;
  other_allergy: string | null;
};

export default function PreferencesScreen({
  navigation,
  route,
}: any) {
  // Edit mode is used when the user opens this screen from Home.
  const isEditMode = route?.params?.mode === "edit";

  // Stores the user's halal preference.
  const [prefersHalal, setPrefersHalal] =
    useState<boolean | null>(null);

  // Stores whether the user has allergies.
  const [hasAllergies, setHasAllergies] =
    useState<boolean | null>(null);

  // Stores the selected standard allergies.
  const [selectedAllergies, setSelectedAllergies] =
    useState<string[]>([]);

  // Stores an allergy entered manually.
  const [otherAllergy, setOtherAllergy] = useState("");

  // Shows a loading state while saving.
  const [loading, setLoading] = useState(false);

  // Shows a loading state while saved data is being loaded.
  const [loadingSaved, setLoadingSaved] = useState(true);

  // Shows a message on web, Android, and iOS.
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

  // Loads the current user's saved preferences.
  const loadSavedPreferences = useCallback(async () => {
    setLoadingSaved(true);

    try {
      // Get the currently signed-in user.
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return;
      }

      // Read the user's saved preferences.
      const { data, error } = await supabase
        .from("user_preferences")
        .select(
          "prefers_halal, has_allergies, allergies, other_allergy"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !data) {
        console.warn(
          "Could not load saved preferences:",
          error?.message
        );
        return;
      }

      const saved = data as SavedPreferences;

      // Supabase normally returns the text[] column as a JavaScript array.
      const savedAllergies = Array.isArray(saved.allergies)
        ? saved.allergies.filter(
            (item): item is string =>
              typeof item === "string"
          )
        : [];

      // Fill the form with the saved halal preference.
      setPrefersHalal(
        typeof saved.prefers_halal === "boolean"
          ? saved.prefers_halal
          : null
      );

      // Fill the allergy answer.
      setHasAllergies(
        typeof saved.has_allergies === "boolean"
          ? saved.has_allergies
          : savedAllergies.length > 0 ||
            Boolean(saved.other_allergy)
      );

      // Fill the selected allergy checkboxes.
      setSelectedAllergies(savedAllergies);

      // Fill the manually entered allergy.
      setOtherAllergy(saved.other_allergy ?? "");
    } catch (error) {
      console.warn(
        "Could not load saved preferences:",
        error
      );
    } finally {
      setLoadingSaved(false);
    }
  }, []);

  // Reload saved values every time this screen becomes visible.
  useFocusEffect(
    useCallback(() => {
      void loadSavedPreferences();
    }, [loadSavedPreferences])
  );

  // Adds or removes one allergy from the selected list.
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

  // Handles the Yes/No allergy answer.
  function selectAllergyAnswer(answer: boolean) {
    setHasAllergies(answer);

    // Clear allergy values if the user chooses No.
    if (!answer) {
      setSelectedAllergies([]);
      setOtherAllergy("");
    }
  }

  // Saves the preferences to the user Supabase database.
  async function savePreferences() {
    // Validate the halal question.
    if (prefersHalal === null) {
      showMessage(
        "Choose a food preference",
        "Tell us whether you prefer halal food."
      );
      return;
    }

    // Validate the allergy question.
    if (hasAllergies === null) {
      showMessage(
        "Choose an allergy option",
        "Tell us whether you have any food allergies."
      );
      return;
    }

    // If the user has allergies, require at least one value.
    if (
      hasAllergies &&
      selectedAllergies.length === 0 &&
      !otherAllergy.trim()
    ) {
      showMessage(
        "Select an allergy",
        "Choose at least one allergy or enter another allergy."
      );
      return;
    }

    setLoading(true);

    try {
      // Confirm that the user is still signed in.
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

      // Save new values or update the existing row.
      const { error: saveError } = await supabase
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
              hasAllergies && otherAllergy.trim()
                ? otherAllergy.trim()
                : null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        );

      if (saveError) {
        showMessage(
          "Could not save preferences",
          saveError.message
        );
        return;
      }

      // Editing returns to the previous Home screen.
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
        "Saving preferences failed:",
        error
      );

      showMessage(
        "Connection problem",
        "Could not save your preferences. Try again."
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
        {/* Page title changes when editing existing preferences. */}
        <Text style={styles.title}>
          {isEditMode
            ? "Edit your preferences"
            : "Personalize LabelLens"}
        </Text>

        {/* Loading indicator while saved values are being loaded. */}
        {loadingSaved && (
          <ActivityIndicator
            color="#176B43"
            style={styles.loadingSaved}
          />
        )}

        {/* Explains why the preferences are needed. */}
        <Text style={styles.description}>
          These preferences help LabelLens highlight relevant
          product information. Always verify product labels
          before consuming a product.
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
            activeOpacity={0.8}
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
            activeOpacity={0.8}
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
            onPress={() => selectAllergyAnswer(true)}
            activeOpacity={0.8}
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
            onPress={() => selectAllergyAnswer(false)}
            activeOpacity={0.8}
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

        {/* Show allergy choices only when the answer is Yes. */}
        {hasAllergies === true && (
          <View style={styles.allergySection}>
            <Text style={styles.sectionTitle}>
              Select all that apply
            </Text>

            {ALLERGY_OPTIONS.map((allergy) => {
              const selected =
                selectedAllergies.includes(allergy);

              return (
                <TouchableOpacity
                  key={allergy}
                  style={styles.checkboxRow}
                  onPress={() => toggleAllergy(allergy)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.checkbox,
                      selected && styles.checkedBox,
                    ]}
                  >
                    {selected && (
                      <Text style={styles.checkmark}>
                        ✓
                      </Text>
                    )}
                  </View>

                  <Text style={styles.checkboxLabel}>
                    {allergy}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* Allows the user to add an allergy not in the list. */}
            <Text style={styles.otherLabel}>
              Other allergy
            </Text>

            <TextInput
              style={styles.input}
              value={otherAllergy}
              onChangeText={setOtherAllergy}
              placeholder="Enter another allergy"
              placeholderTextColor="#9AA9A0"
              autoCapitalize="sentences"
            />
          </View>
        )}

        {/* Saves the current preferences. */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            (loading || loadingSaved) &&
              styles.disabledButton,
          ]}
          onPress={savePreferences}
          disabled={loading || loadingSaved}
          activeOpacity={0.8}
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
          LabelLens provides screening information and cannot
          guarantee that a product is safe for a particular
          allergy.
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
    paddingHorizontal: 20,
    paddingVertical: 40,
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
    gap: 12,
  },

  answerButton: {
    flex: 1,
    borderColor: "#B9CCC1",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
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
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
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

  otherLabel: {
    color: "#263E32",
    fontWeight: "600",
    marginTop: 15,
    marginBottom: 7,
  },

  input: {
    borderColor: "#C9D8CF",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#263E32",
    backgroundColor: "#FFFFFF",
  },

  saveButton: {
    backgroundColor: "#176B43",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
    marginTop: 30,
  },

  loadingSaved: {
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