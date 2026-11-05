// ---------------------------------------------------------------------------
// components/Themed.tsx
// Drop-in replacements for React Native's Text, TextInput, View, ScrollView,
// TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Switch and Ionicons.
// Screens import these instead of the originals, so dark mode, text size
// and right-to-left text alignment apply everywhere without changing each
// screen's StyleSheet.
// ---------------------------------------------------------------------------

import { Ionicons as BaseIonicons } from "@expo/vector-icons";
import { forwardRef, type ComponentProps } from "react";
import {
  KeyboardAvoidingView as RNKeyboardAvoidingView,
  SafeAreaView as RNSafeAreaView,
  ScrollView as RNScrollView,
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  TouchableOpacity as RNTouchableOpacity,
  View as RNView,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView as RNContextSafeAreaView } from "react-native-safe-area-context";

import { useI18n } from "../lib/i18n";
import { remapColor, useAppTheme } from "../lib/theme";

const DEFAULT_FONT_SIZE = 14;

const VIEW_COLOR_KEYS: [string, "background" | "border"][] = [
  ["backgroundColor", "background"],
  ["borderColor", "border"],
  ["borderTopColor", "border"],
  ["borderBottomColor", "border"],
  ["borderLeftColor", "border"],
  ["borderRightColor", "border"],
  ["borderStartColor", "border"],
  ["borderEndColor", "border"],
];

const ARABIC = /[؀-ۿ]/;

function themeViewStyle(
  style: StyleProp<ViewStyle>,
  isDark: boolean
): StyleProp<ViewStyle> {
  if (!isDark || !style) {
    return style;
  }

  const flat: Record<string, unknown> = { ...(StyleSheet.flatten(style) as object) };

  for (const [key, kind] of VIEW_COLOR_KEYS) {
    if (flat[key] !== undefined) {
      flat[key] = remapColor(flat[key], kind);
    }
  }

  return flat as ViewStyle;
}

function useViewStyle(style: StyleProp<ViewStyle>) {
  const { isDark } = useAppTheme();
  return themeViewStyle(style, isDark);
}

// Text: theme colours, text size, and alignment that follows the layout
// direction (Arabic right, English left) unless a screen sets textAlign.
function useTextStyle(
  style: StyleProp<TextStyle>,
  content?: unknown
): StyleProp<TextStyle> {
  const { isDark, fontScale } = useAppTheme();
  const { isRTL } = useI18n();

  const flat: Record<string, any> = {
    ...((StyleSheet.flatten(style) as object) ?? {}),
  };

  if (isDark) {
    flat.color = remapColor(flat.color ?? "#17452F", "text");

    for (const [key, kind] of VIEW_COLOR_KEYS) {
      if (flat[key] !== undefined) {
        flat[key] = remapColor(flat[key], kind);
      }
    }
  }

  if (fontScale !== 1) {
    flat.fontSize = (flat.fontSize ?? DEFAULT_FONT_SIZE) * fontScale;

    if (typeof flat.lineHeight === "number") {
      flat.lineHeight = flat.lineHeight * fontScale;
    }
  }

  if (flat.textAlign === undefined) {
    flat.textAlign = isRTL ? "right" : "left";
  }

  // Letter spacing breaks the joined letters of Arabic script.
  if (
    flat.letterSpacing &&
    (isRTL || (typeof content === "string" && ARABIC.test(content)))
  ) {
    flat.letterSpacing = 0;
  }

  return flat as TextStyle;
}

export const Text = forwardRef<RNText, ComponentProps<typeof RNText>>(
  function Text({ style, ...props }, ref) {
    const themed = useTextStyle(style, props.children);
    return <RNText ref={ref} {...props} style={themed} />;
  }
);

export const TextInput = forwardRef<
  RNTextInput,
  ComponentProps<typeof RNTextInput>
>(function TextInput({ style, placeholderTextColor, ...props }, ref) {
  const { isDark } = useAppTheme();
  const themed = useTextStyle(style);

  return (
    <RNTextInput
      ref={ref}
      {...props}
      style={themed}
      placeholderTextColor={
        isDark
          ? (remapColor(placeholderTextColor ?? "#8A9A91", "text") as string)
          : placeholderTextColor
      }
    />
  );
});

export const View = forwardRef<RNView, ComponentProps<typeof RNView>>(
  function View({ style, ...props }, ref) {
    return <RNView ref={ref} {...props} style={useViewStyle(style)} />;
  }
);

export const TouchableOpacity = forwardRef<
  RNView,
  ComponentProps<typeof RNTouchableOpacity>
>(function TouchableOpacity({ style, ...props }, ref) {
  return (
    <RNTouchableOpacity ref={ref as any} {...props} style={useViewStyle(style)} />
  );
});

export const ScrollView = forwardRef<
  RNScrollView,
  ComponentProps<typeof RNScrollView>
>(function ScrollView({ style, contentContainerStyle, ...props }, ref) {
  return (
    <RNScrollView
      ref={ref}
      {...props}
      style={useViewStyle(style)}
      contentContainerStyle={useViewStyle(contentContainerStyle)}
    />
  );
});

export function SafeAreaView({
  style,
  ...props
}: ComponentProps<typeof RNSafeAreaView>) {
  return <RNSafeAreaView {...props} style={useViewStyle(style)} />;
}

export function ContextSafeAreaView({
  style,
  ...props
}: ComponentProps<typeof RNContextSafeAreaView>) {
  return <RNContextSafeAreaView {...props} style={useViewStyle(style)} />;
}

export function KeyboardAvoidingView({
  style,
  ...props
}: ComponentProps<typeof RNKeyboardAvoidingView>) {
  return <RNKeyboardAvoidingView {...props} style={useViewStyle(style)} />;
}

// LabelLens toggle switch (replaces React Native's Switch).
// Workaround: react-native-web positions the built-in Switch thumb with
// "start/end" values, which put the thumb outside its track (on top of the
// label) in Arabic right-to-left pages. This switch draws its own track and
// thumb with fixed left positions, so it looks the same in English and
// Arabic, on the web and on phones. "On" is always the right-hand side,
// like iOS/Android switches.
type SwitchProps = {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  trackColor?: { false?: string | null; true?: string | null };
  thumbColor?: string;
};

const TRACK_WIDTH = 46;
const TRACK_HEIGHT = 26;
const THUMB_SIZE = 20;
const THUMB_GAP = (TRACK_HEIGHT - THUMB_SIZE) / 2;

export function Switch({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
  trackColor,
  thumbColor,
}: SwitchProps) {
  const { isDark } = useAppTheme();

  const track = value
    ? trackColor?.true ?? "#8FC9A5"
    : trackColor?.false ?? "#C9D4CC";
  const thumb = thumbColor ?? (value ? "#176B43" : "#FFFFFF");

  return (
    <RNTouchableOpacity
      onPress={() => onValueChange?.(!value)}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={[
        switchStyles.track,
        {
          backgroundColor: isDark
            ? (remapColor(track, "border") as string)
            : track,
        },
        disabled && switchStyles.disabled,
      ]}
    >
      <RNView
        style={[
          switchStyles.thumb,
          {
            backgroundColor: thumb,
            left: value ? TRACK_WIDTH - THUMB_SIZE - THUMB_GAP : THUMB_GAP,
          },
        ]}
      />
    </RNTouchableOpacity>
  );
}

const switchStyles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    position: "relative",
    // Keep the switch itself left-to-right inside Arabic layouts.
    direction: "ltr",
  },
  thumb: {
    position: "absolute",
    top: THUMB_GAP,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  disabled: {
    opacity: 0.5,
  },
});

// Icons follow the same text colour rules in dark mode.
function ThemedIonicons({ color, ...props }: ComponentProps<typeof BaseIonicons>) {
  const { isDark } = useAppTheme();

  return (
    <BaseIonicons
      {...props}
      color={isDark ? (remapColor(color, "text") as string) : color}
    />
  );
}

ThemedIonicons.glyphMap = BaseIonicons.glyphMap;

export const Ionicons = ThemedIonicons;
