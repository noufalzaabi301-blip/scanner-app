// ---------------------------------------------------------------------------
// screens/PreferencesScreen.tsx
// Allergy editor (first-time setup and "Edit allergy preferences"):
// allergy yes/no, the standard allergy list, custom allergies, Save.
//
// First-time setup (after the Privacy Notice, before the first scan) also
// asks "Do you prefer halal food?" and saves it. When EDITING, the halal
// preference and the product-submission consent are not shown or changed
// (they live in HalalAndVerificationScreen); a brand-new row starts with
// product submission turned off.
// ---------------------------------------------------------------------------

import { useCallback, useState } from "react";

import { useFocusEffect } from "@react-navigation/native";

import {
  ActivityIndicator,
  StyleSheet,
} from "react-native";

import { usePageInsets } from "../lib/layout";
import {
  addAllergyEntries,
  batchFeedback,
  remainingInput,
} from "../lib/allergyBatch";
import { useFormTokens } from "../lib/theme";
import { prepareAllergyLabels } from "../lib/foodTranslation";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { saveAllergyPreferences } from "../lib/userPreferences";
import { showMessage } from "../lib/ui/messages";
import AllergyEditor, { AnswerButtons } from "../components/AllergyEditor";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "../components/Themed";

type SavedPreferences = {
  prefers_halal?: boolean | null;
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
  // Shared responsive side padding (lib/layout.ts).
  const pageInsets = usePageInsets();
  // Explicit form colours (lib/formTokens.ts) for light and dark mode.
  const c = useFormTokens();

  const isEditMode =
    route?.params?.mode === "edit";

  const [hasAllergies, setHasAllergies] =
    useState<boolean | null>(null);

  const [selectedAllergies, setSelectedAllergies] =
    useState<string[]>([]);

  const [customAllergies, setCustomAllergies] =
    useState<string[]>([]);

  // First-time setup only: "Do you prefer halal food?" (before the first
  // scan). Editing later happens in Halal & verification.
  const [prefersHalal, setPrefersHalal] =
    useState<boolean | null>(null);

  const [customInput, setCustomInput] =
    useState("");
  // Validation message shown under the custom allergy field.
  const [customError, setCustomError] = useState("");

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
          .select("has_allergies, allergies, other_allergy, prefers_halal")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

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

        if (typeof saved.prefers_halal === "boolean") {
          setPrefersHalal(saved.prefers_halal);
        }

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

  function selectAllergyAnswer(value: boolean) {
    setHasAllergies(value);

    if (!value) {
      setSelectedAllergies([]);
      setCustomAllergies([]);
      setCustomInput("");
    }
  }

  // "Add" beside a common allergy: it moves into "Your selected allergies".
  function addStandardAllergy(allergy: string) {
    setSelectedAllergies((current) =>
      current.includes(allergy) ? current : [...current, allergy]
    );
    setHasAllergies(true);
  }

  // Adds one or more allergies typed in the field ("Milk, Eggs, Peanuts"
  // or one per line). Each entry is validated separately
  // (lib/allergyBatch.ts → validateCustomAllergy): valid ones are added,
  // duplicates are skipped, invalid ones stay in the field with their own
  // reason. Existing allergies are kept.
  function addCustomAllergy() {
    const result = addAllergyEntries(
      customInput,
      selectedAllergies,
      customAllergies
    );

    setSelectedAllergies(result.selected);
    setCustomAllergies(result.custom);
    setCustomInput(remainingInput(result));
    setCustomError(batchFeedback(result, t));

    if (result.added.length > 0) {
      setHasAllergies(true);
    }

    if (result.rejected.length > 0) {
      const first = result.rejected[0];
      showMessage(
        result.added.length > 0 || result.rejected.length > 1
          ? t("prefs.someNotAdded")
          : t(first.title),
        batchFeedback(result, t)
      );
    }
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
    let hasAnyAllergies = hasAllergies;
    let standardToSave = selectedAllergies;
    let customToSave = customAllergies;

    // Text still in the field counts too (not lost when Add was not
    // pressed). Invalid entries stop the save and are shown.
    if (hasAllergies === true && customInput.trim()) {
      const result = addAllergyEntries(
        customInput,
        selectedAllergies,
        customAllergies
      );

      setSelectedAllergies(result.selected);
      setCustomAllergies(result.custom);
      setCustomInput(remainingInput(result));
      setCustomError(batchFeedback(result, t));

      if (result.rejected.length > 0) {
        showMessage(t("prefs.someNotAdded"), batchFeedback(result, t));
        return;
      }

      standardToSave = result.selected;
      customToSave = result.custom;
      hasAnyAllergies = true;
    }

    if (hasAnyAllergies === null) {
      showMessage(
        t("prefs.chooseAllergyTitle"),
        t("prefs.chooseAllergyBody")
      );
      return;
    }

    if (
      hasAnyAllergies &&
      standardToSave.length === 0 &&
      customToSave.length === 0
    ) {
      showMessage(
        t("prefs.selectAllergyTitle"),
        t("prefs.selectAllergyBody")
      );
      return;
    }

    if (!isEditMode && prefersHalal === null) {
      showMessage(
        t("prefs.halalRequiredTitle"),
        t("prefs.halalRequiredBody")
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

      // Saves the allergies and keeps the existing halal preference and
      // product-verification consent (never sent as null). See
      // saveAllergyPreferences in lib/userPreferences.ts.
      await saveAllergyPreferences(user.id, {
        hasAllergies: hasAnyAllergies,
        allergies: standardToSave,
        otherAllergy:
          customToSave.length > 0 ? customToSave.join(", ") : null,
        // First-time setup also saves the halal answer; editing keeps it.
        ...(!isEditMode && prefersHalal !== null ? { prefersHalal } : {}),
      });

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

  return (
    <ScrollView
      contentContainerStyle={[styles.page, pageInsets]}
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
          <Text
            style={[
              styles.loadError,
              { color: c.errorText, backgroundColor: c.errorBackground },
            ]}
          >
            {t("prefs.loadFailed")}
          </Text>
        )}

        <Text style={[styles.question, { color: c.headingText }]}>
          {t("prefs.allergyQuestion")}
        </Text>

        <AnswerButtons
          value={hasAllergies}
          onChange={selectAllergyAnswer}
          yesLabel={t("common.yes")}
          noLabel={t("common.no")}
          accessibilityLabel={t("prefs.allergyQuestion")}
        />

        {hasAllergies === true && (
          // Edit mode now also lists every standard allergy (ticked = saved),
          // so allergies can be added or removed with one tap.
          <AllergyEditor
            selected={selectedAllergies}
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

        {!isEditMode && (
          <>
            <Text style={[styles.question, { color: c.headingText }]}>
              {t("prefs.halalQuestionSetup")}
            </Text>

            <AnswerButtons
              value={prefersHalal}
              onChange={setPrefersHalal}
              yesLabel={t("common.yes")}
              noLabel={t("common.no")}
              accessibilityLabel={t("prefs.halalQuestionSetup")}
            />
          </>
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
    // Full width of the shared page column (lib/layout.ts).
    width: "100%",
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