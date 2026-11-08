// ---------------------------------------------------------------------------
// components/LanguageSwitch.tsx
// Small English / العربية selector shown on Login and Register, so the
// language can be chosen before signing in. Uses the same saved setting as
// the Language section in Profile.
// ---------------------------------------------------------------------------

import {
  StyleSheet,
} from "react-native";

import { COLORS } from "../lib/constants";
import { LANGUAGES, useI18n } from "../lib/i18n";
import {
  Text,
  TouchableOpacity,
  View,
} from "./Themed";

export default function LanguageSwitch() {
  const { language, setLanguage } = useI18n();

  return (
    <View style={styles.container} accessibilityRole="radiogroup">
      {LANGUAGES.map((item) => {
        const active = item.code === language;

        return (
          <TouchableOpacity
            key={item.code}
            style={[styles.option, active && styles.activeOption]}
            onPress={() => void setLanguage(item.code)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.text, active && styles.activeText]}>
              {item.nativeName}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignSelf: "flex-end",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 20,
    padding: 3,
    marginBottom: 18,
  },

  option: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 17,
  },

  activeOption: {
    backgroundColor: COLORS.primary,
  },

  text: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "600",
  },

  activeText: {
    color: "#FFFFFF",
  },
});
