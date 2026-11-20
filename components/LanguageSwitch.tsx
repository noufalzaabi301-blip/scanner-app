// ---------------------------------------------------------------------------
// components/LanguageSwitch.tsx
// Small English / العربية selector shown on Welcome, Login and Register, so
// the language can be chosen before signing in. Uses the same saved setting
// as the Language section in Profile (lib/i18n), so the choice applies at
// once (Arabic → right-to-left, English → left-to-right) and stays when
// moving to Login, Create account, Forgot password, guest onboarding and the
// main app.
//
// Colours come from the form tokens (lib/formTokens.ts): the pill has its
// own border and background, so it stays visible on light and dark pages
// and on the Welcome hero; the selected language is the solid button.
// ---------------------------------------------------------------------------

import {
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { LANGUAGES, useI18n } from "../lib/i18n";
import { useFormTokens } from "../lib/theme";
import {
  Text,
  TouchableOpacity,
  View,
} from "./Themed";

export default function LanguageSwitch({
  style,
}: {
  style?: StyleProp<ViewStyle>;
}) {
  const { language, setLanguage, t } = useI18n();
  const c = useFormTokens();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: c.optionBackground, borderColor: c.optionBorder },
        style,
      ]}
      accessibilityRole="radiogroup"
      accessibilityLabel={t("language.title")}
      testID="language-switch"
    >
      {LANGUAGES.map((item) => {
        const active = item.code === language;

        return (
          <TouchableOpacity
            key={item.code}
            style={[
              styles.option,
              active && { backgroundColor: c.selectedBackground },
            ]}
            onPress={() => void setLanguage(item.code)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            testID={`language-${item.code}`}
          >
            <Text
              style={[
                styles.text,
                { color: active ? c.selectedText : c.optionText },
                active && styles.activeText,
              ]}
            >
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
    borderRadius: 22,
    borderWidth: 1,
    padding: 3,
    marginBottom: 18,
    flexShrink: 0,
  },

  option: {
    minHeight: 36,
    minWidth: 72,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  text: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },

  activeText: {
    fontWeight: "800",
  },
});
