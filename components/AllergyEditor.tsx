// ---------------------------------------------------------------------------
// components/AllergyEditor.tsx
// The allergy editor shared by "Edit allergy preferences"
// (screens/PreferencesScreen.tsx) and guest onboarding
// (screens/GuestPreferencesScreen.tsx):
//   - AnswerButtons: the Yes / No question buttons
//   - AllergyEditor: "Your selected allergies" (standard and custom in ONE
//     list, each with a delete button; "No allergies selected yet." when
//     empty), "Add another allergy" field + Add (one or several, commas or
//     new lines), validation message, and common allergies with an Add
//     button each. No checkboxes.
//
// Only presentation. The screens keep their own state, validation and
// saving (nothing about detection, storage or Supabase changes here).
//
// Colours come from explicit theme tokens (lib/formTokens.ts via
// useFormTokens), not from the automatic dark-mode conversion, so every
// option, the field, the Add button and the delete icons stay clearly
// visible in dark mode. Layout uses gap / flex rows only (no left/right),
// so Arabic mirrors correctly.
// ---------------------------------------------------------------------------

// Icons are drawn with the token colour as-is (not the themed icon, which
// would convert the colour a second time).
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet } from "react-native";

import { MAX_ALLERGY_LENGTH } from "../lib/allergyValidation";
import { ALLERGY_OPTIONS, allergyLabel } from "../lib/constants";
import { useI18n } from "../lib/i18n";
import { useFormTokens } from "../lib/theme";
import { Text, TextInput, TouchableOpacity, View } from "./Themed";

export const STANDARD_ALLERGIES = ALLERGY_OPTIONS.map((option) => option.value);

// Room for several allergies in one go (each is still limited to
// MAX_ALLERGY_LENGTH by the validation).
const MAX_INPUT_LENGTH = MAX_ALLERGY_LENGTH * 12;

// ---------------------------------------------------------------------------
// Yes / No buttons
// ---------------------------------------------------------------------------

type AnswerButtonsProps = {
  value: boolean | null;
  onChange: (value: boolean) => void;
  yesLabel: string;
  noLabel: string;
  accessibilityLabel?: string;
};

export function AnswerButtons({
  value,
  onChange,
  yesLabel,
  noLabel,
  accessibilityLabel,
}: AnswerButtonsProps) {
  const c = useFormTokens();

  const button = (answer: boolean, label: string) => {
    const selected = value === answer;

    return (
      <TouchableOpacity
        key={String(answer)}
        style={[
          styles.answerButton,
          {
            backgroundColor: selected ? c.selectedBackground : c.optionBackground,
            borderColor: selected ? c.selectedBorder : c.optionBorder,
          },
        ]}
        onPress={() => onChange(answer)}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
      >
        {selected && (
          <Ionicons name="checkmark-circle" size={18} color={c.selectedText} />
        )}
        <Text
          style={[
            styles.answerText,
            { color: selected ? c.selectedText : c.optionText },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={styles.answerRow}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {button(true, yesLabel)}
      {button(false, noLabel)}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Allergy list ("Your selected allergies"), "Add another allergy" field and
// common-allergy suggestions. No checkboxes:
//   - every current allergy (standard AND custom, one list) has a delete
//     button that removes only that allergy;
//   - common allergies not chosen yet are offered with an "Add" button;
//     once added they move into "Your selected allergies".
// ---------------------------------------------------------------------------

type AllergyEditorProps = {
  selected: string[]; // standard allergies (e.g. "Milk")
  custom: string[]; // custom allergies (typed by the user)
  onAddStandard: (value: string) => void; // add a common allergy
  onRemove: (value: string) => void; // remove exactly this allergy
  input: string;
  onChangeInput: (value: string) => void;
  onAdd: () => void; // add what is typed (one or several)
  error: string; // validation message ("" = none)
};

export default function AllergyEditor({
  selected,
  custom,
  onAddStandard,
  onRemove,
  input,
  onChangeInput,
  onAdd,
  error,
}: AllergyEditorProps) {
  const { t } = useI18n();
  const c = useFormTokens();

  // One list: standard and custom together (no duplicates).
  const current = [...new Set([...selected, ...custom])];
  const suggestions = STANDARD_ALLERGIES.filter(
    (value) => !selected.includes(value)
  );

  return (
    <View style={styles.section}>
      {/* 1. Your selected allergies */}
      <Text
        style={[styles.sectionTitle, { color: c.headingText }]}
        accessibilityRole="header"
      >
        {t("prefs.selectedAllergies")}
      </Text>

      {current.length === 0 ? (
        <View
          style={[
            styles.emptyBox,
            { backgroundColor: c.optionBackground, borderColor: c.optionBorder },
          ]}
          testID="allergy-list-empty"
        >
          <Text style={[styles.emptyText, { color: c.mutedText }]}>
            {t("prefs.noAllergiesYet")}
          </Text>
        </View>
      ) : (
        <View style={styles.list} testID="selected-allergies">
          {current.map((value) => {
            const label = allergyLabel(value, t);

            return (
              <View
                key={`selected-${value}`}
                style={[
                  styles.row,
                  { backgroundColor: c.selectedRowBackground, borderColor: c.selectedBorder },
                ]}
                testID={`selected-allergy-${value}`}
              >
                <Text style={[styles.rowText, { color: c.selectedRowText }]}>
                  {label}
                </Text>
                <TouchableOpacity
                  style={[styles.deleteButton, { backgroundColor: c.deleteBackground }]}
                  onPress={() => onRemove(value)}
                  accessibilityRole="button"
                  accessibilityLabel={t("prefs.deleteAllergy", { name: label })}
                  hitSlop={6}
                  testID={`delete-allergy-${value}`}
                >
                  <Ionicons name="trash-outline" size={20} color={c.deleteIcon} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* 2. Add another allergy (one, or several separated by commas or
          new lines) */}
      <Text style={[styles.inputLabel, { color: c.headingText }]}>
        {t("prefs.addAnother")}
      </Text>

      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: c.inputBackground,
              borderColor: error ? c.errorBorder : c.inputBorder,
              color: c.inputText,
            },
          ]}
          value={input}
          onChangeText={onChangeInput}
          placeholder={t("prefs.addPlaceholder")}
          placeholderTextColor={c.inputPlaceholder}
          multiline
          maxLength={MAX_INPUT_LENGTH}
          autoCorrect={false}
          textAlignVertical="center"
          accessibilityLabel={t("prefs.addAnother")}
          testID="custom-allergy-input"
        />

        <TouchableOpacity
          style={[
            styles.addButton,
            { backgroundColor: c.addButtonBackground, borderColor: c.addButtonBorder },
          ]}
          onPress={onAdd}
          accessibilityRole="button"
          testID="custom-allergy-add"
        >
          <Ionicons name="add" size={18} color={c.addButtonText} />
          <Text style={[styles.addText, { color: c.addButtonText }]}>{t("prefs.add")}</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View
          style={[styles.errorBox, { backgroundColor: c.errorBackground, borderColor: c.errorBorder }]}
          accessibilityRole="alert"
          testID="allergy-error"
        >
          <Ionicons name="alert-circle" size={16} color={c.errorText} />
          <Text style={[styles.errorText, { color: c.errorText }]}>{error}</Text>
        </View>
      ) : (
        <Text style={[styles.hint, { color: c.mutedText }]}>{t("prefs.allergyHint")}</Text>
      )}

      {/* 3. Common allergies not chosen yet, each with its own Add button */}
      {suggestions.length > 0 && (
        <>
          <Text style={[styles.inputLabel, { color: c.headingText }]}>
            {t("prefs.commonAllergies")}
          </Text>
          <View style={styles.list}>
            {suggestions.map((value) => {
              const label = allergyLabel(value, t);

              return (
                <View
                  key={`suggest-${value}`}
                  style={[
                    styles.row,
                    { backgroundColor: c.optionBackground, borderColor: c.optionBorder },
                  ]}
                  testID={`suggestion-${value}`}
                >
                  <Text style={[styles.rowText, styles.suggestionText, { color: c.optionText }]}>
                    {label}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.suggestAdd,
                      { borderColor: c.selectedBorder, backgroundColor: c.inputBackground },
                    ]}
                    onPress={() => onAddStandard(value)}
                    accessibilityRole="button"
                    accessibilityLabel={t("prefs.addSuggestion", { name: label })}
                    testID={`add-suggestion-${value}`}
                  >
                    <Ionicons name="add" size={16} color={c.linkText} />
                    <Text style={[styles.suggestAddText, { color: c.linkText }]}>
                      {t("prefs.add")}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  answerRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },

  answerButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
  },

  answerText: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

  section: {
    marginTop: 5,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 10,
  },


  list: {
    gap: 8,
  },

  row: {
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingStart: 14,
    paddingEnd: 6,
    paddingVertical: 5,
  },

  rowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },

  suggestionText: {
    fontWeight: "500",
  },

  suggestAdd: {
    minHeight: 38,
    minWidth: 72,
    borderWidth: 1.5,
    borderRadius: 19,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    flexShrink: 0,
  },

  suggestAddText: {
    fontSize: 14,
    fontWeight: "700",
  },

  emptyBox: {
    minHeight: 52,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 10,
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  emptyText: {
    fontSize: 14,
  },






  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 7,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 132,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 13,
    fontSize: 15,
  },

  addButton: {
    flexShrink: 0, // always fully visible next to the field
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  addText: {
    fontSize: 14,
    fontWeight: "800",
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },

  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },

  hint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
});
