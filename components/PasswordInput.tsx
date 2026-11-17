// ---------------------------------------------------------------------------
// components/PasswordInput.tsx
// Password field with a Show / Hide button, used on Forgot Password and
// Profile settings (Login and Register keep their own identical fields).
//
// Empty field  → grey placeholder TEXT (e.g. "Enter your password"), never
//                fake dots, so an empty field cannot look filled in.
// Typed text   → masked dots in the bright input text colour (dark theme:
//                near-white; see components/Themed.tsx → TextInput).
// The button sits on the end side: right in English, left in Arabic.
// Only presentation: the value and onChangeText are passed straight through.
// ---------------------------------------------------------------------------

import { useState, type ComponentProps } from "react";
import {
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { useI18n } from "../lib/i18n";
import { Text, TextInput, TouchableOpacity, View } from "./Themed";

type Props = Omit<ComponentProps<typeof TextInput>, "secureTextEntry"> & {
  containerStyle?: StyleProp<ViewStyle>;
};

export default function PasswordInput({
  style,
  containerStyle,
  accessibilityLabel,
  placeholder,
  ...props
}: Props) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  // Outer margins belong to the wrapper, so the Show / Hide button stays
  // vertically centred on the field itself.
  const {
    margin,
    marginTop,
    marginBottom,
    marginVertical,
    ...inputStyle
  } = (StyleSheet.flatten(style) ?? {}) as TextStyle;

  return (
    <View
      style={[
        styles.container,
        { margin, marginTop, marginBottom, marginVertical },
        containerStyle,
      ]}
    >
      <TextInput
        {...props}
        style={[inputStyle, styles.input]}
        placeholder={placeholder}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={accessibilityLabel ?? placeholder}
      />

      <TouchableOpacity
        style={styles.toggle}
        onPress={() => setVisible((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel={visible ? t("login.hide") : t("login.show")}
      >
        <Text style={styles.toggleText}>
          {visible ? t("login.hide") : t("login.show")}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    justifyContent: "center",
  },

  input: {
    // Room for the Show / Hide button (left side in Arabic).
    paddingEnd: 64,
  },

  toggle: {
    position: "absolute",
    end: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },

  toggleText: {
    color: "#176B43",
    fontSize: 13,
    fontWeight: "600",
  },
});
