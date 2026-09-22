import { useState } from "react";
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

export default function PreferencesScreen({
  navigation,
}: any) {
  const [prefersHalal, setPrefersHalal] =
    useState<boolean | null>(null);

  const [hasAllergies, setHasAllergies] =
    useState<boolean | null>(null);

  const [selectedAllergies, setSelectedAllergies] =
    useState<string[]>([]);

  const [otherAllergy, setOtherAllergy] = useState("");
  const [loading, setLoading] = useState(false);

  function showMessage(title: string, message: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  function toggleAllergy(allergy: string) {
    setSelectedAllergies((current) => {
      if (current.includes(allergy)) {
        return current.filter((item) => item !== allergy);
      }

      return [...current, allergy];
    });
  }

  function selectAllergyAnswer(answer: boolean) {
    setHasAllergies(answer);

    if (!answer) {
      setSelectedAllergies([]);
      setOtherAllergy("");
    }
  }

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
        "Tell us whether you have any food allergies."
      );
      return;
    }

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
              hasAllergies && otherAllergy.trim()
                ? otherAllergy.trim()
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

      navigation.replace("Home");
    } catch {
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
        <Text style={styles.title}>
          Personalize LabelLens
        </Text>

        <Text style={styles.description}>
          These preferences help us highlight relevant product
          information. Always verify product labels before consuming
          a product.
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
                >
                  <View
                    style={[
                      styles.checkbox,
                      selected && styles.checkedBox,
                    ]}
                  >
                    {selected && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>

                  <Text style={styles.checkboxLabel}>
                    {allergy}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <Text style={styles.otherLabel}>
              Other allergy
            </Text>

            <TextInput
              style={styles.input}
              value={otherAllergy}
              onChangeText={setOtherAllergy}
              placeholder="Enter another allergy"
            />
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.saveButton,
            loading && styles.disabledButton,
          ]}
          onPress={savePreferences}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>
              Save and continue
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.warning}>
          LabelLens provides product information and cannot guarantee
          that a product is safe for a particular allergy.
        </Text>
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
  },

  saveButton: {
    backgroundColor: "#176B43",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
    marginTop: 30,
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