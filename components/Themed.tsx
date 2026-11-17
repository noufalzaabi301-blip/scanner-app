// ---------------------------------------------------------------------------
// components/Themed.tsx
// Drop-in replacements for React Native's Text, TextInput, View, ScrollView,
// TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Switch and Ionicons.
// Screens import these instead of the originals, so dark mode, text size
// and right-to-left text alignment apply everywhere without changing each
// screen's StyleSheet.
// ---------------------------------------------------------------------------

import { Ionicons as BaseIonicons } from "@expo/vector-icons";
import { forwardRef, useEffect, useState, type ComponentProps } from "react";
import {
  KeyboardAvoidingView as RNKeyboardAvoidingView,
  Platform,
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
import { INPUT_TOKENS, inputColors } from "../lib/inputColors";
import { directionProps } from "../lib/rtl";
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

  // Arabic text runs right-to-left (punctuation and mixed English words
  // are placed correctly). Not the "direction" style, which is invalid on
  // the web.
  if (flat.writingDirection === undefined) {
    flat.writingDirection = isRTL ? "rtl" : "ltr";
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

// ---------------------------------------------------------------------------
// TextInput: every text field in the app (Login, Register, Forgot password,
// Profile, Change password, Preferences, scan review, Avoid search,
// developer edit fields, Contact). Colours come from the theme input tokens
// (lib/inputColors.ts → INPUT_TOKENS, exported by lib/theme.tsx).
//
// Dark theme, bordered fields: dark inset surface, visible neutral border
// (accent borders such as the amber "check this" border keep their
// colour), near-white typed text / password dots, dim grey placeholder,
// green caret, readable selection and a green border while focused.
// Borderless fields sit inside their own box (e.g. the Avoid List search);
// that box uses inputShellStyle() below.
// Light theme: the screens' own colours; only the focus border, caret and
// selection colours are added. No form logic is changed.
// ---------------------------------------------------------------------------

function colorSaturation(value: unknown): number {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}/i.test(value)) {
    return 0;
  }
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) {
    return 0;
  }
  const light = (max + min) / 2;
  return light > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

function hasBorder(flat: Record<string, any>): boolean {
  return [
    flat.borderWidth,
    flat.borderTopWidth,
    flat.borderBottomWidth,
    flat.borderLeftWidth,
    flat.borderRightWidth,
  ].some((width) => typeof width === "number" && width > 0);
}

// Translucent overlay colours (e.g. the camera's barcode field) are kept.
function isTranslucent(value: unknown): boolean {
  return typeof value === "string" && /^rgba\(|transparent/i.test(value);
}

// Box around a borderless input (search fields with an icon).
export function inputShellStyle(isDark: boolean, focused: boolean): ViewStyle {
  const tokens = isDark ? INPUT_TOKENS.dark : INPUT_TOKENS.light;
  const style: ViewStyle = {};

  if (isDark) {
    style.backgroundColor = tokens.surface;
    style.borderColor = tokens.border;
  }

  if (focused) {
    style.borderColor = tokens.focusBorder;
  }

  return style;
}

// Web: selected-text colours cannot be set inline, so one small stylesheet
// is kept in sync with the theme.
function useWebSelectionStyle(isDark: boolean) {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      return;
    }
    const tokens = isDark ? INPUT_TOKENS.dark : INPUT_TOKENS.light;
    let tag = document.getElementById("labellens-input-selection");
    if (!tag) {
      tag = document.createElement("style");
      tag.id = "labellens-input-selection";
      document.head.appendChild(tag);
    }
    tag.textContent =
      `input::selection, textarea::selection { background: ${tokens.selection}; color: ${tokens.selectionText}; }` +
      // The coloured focus border replaces the browser's default outline.
      " input:focus, textarea:focus { outline: none; }";
  }, [isDark]);
}

export const TextInput = forwardRef<
  RNTextInput,
  ComponentProps<typeof RNTextInput>
>(function TextInput(
  { style, placeholderTextColor, onFocus, onBlur, editable, ...props },
  ref
) {
  const { isDark } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const themed = useTextStyle(style) as Record<string, any>;
  const original = (StyleSheet.flatten(style) ?? {}) as Record<string, any>;
  const tokens = isDark ? INPUT_TOKENS.dark : INPUT_TOKENS.light;
  const colors = inputColors(isDark, placeholderTextColor as string | undefined);
  const disabled = editable === false;
  const bordered = hasBorder(original);

  useWebSelectionStyle(isDark);

  // Web caret colour (native uses cursorColor / selectionColor below).
  const overrides: Record<string, any> =
    Platform.OS === "web" ? { caretColor: tokens.cursor } : {};

  // Web: a browser input has a built-in minimum width (about 20
  // characters), so a field sharing a row with a button (e.g. "Add an
  // allergy" + Add) pushed the button off narrow screens. Let flexible
  // fields shrink.
  if (Platform.OS === "web" && original.flex && original.minWidth === undefined) {
    overrides.minWidth = 0;
  }

  if (isDark) {
    overrides.color = disabled ? tokens.disabledText : tokens.text;

    if (bordered) {
      if (!isTranslucent(original.backgroundColor)) {
        overrides.backgroundColor = disabled ? tokens.disabledSurface : tokens.surface;
      }

      // Neutral borders get the visible token; accent borders keep hue.
      if (!isTranslucent(original.borderColor) && colorSaturation(original.borderColor) < 0.45) {
        overrides.borderColor = tokens.border;
      }
    } else {
      overrides.backgroundColor = "transparent";
    }
  } else if (colors.text) {
    overrides.color = colors.text;
  }

  if (focused && bordered && !disabled && !isTranslucent(original.borderColor)) {
    overrides.borderColor = tokens.focusBorder;
  }

  return (
    <RNTextInput
      ref={ref}
      {...props}
      editable={editable}
      style={[themed, overrides]}
      placeholderTextColor={colors.placeholder}
      selectionColor={tokens.selection}
      cursorColor={tokens.cursor}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
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

// Right-to-left container for content rendered OUTSIDE the main app tree,
// such as React Native <Modal> windows, which do not inherit the direction
// set in App.tsx. Arabic → RTL, English → LTR.
export function DirectionView({
  style,
  ...props
}: ComponentProps<typeof RNView>) {
  const { isRTL } = useI18n();
  const direction = directionProps(isRTL ? "rtl" : "ltr");

  return (
    <RNView
      {...props}
      {...(direction.dir ? ({ dir: direction.dir } as object) : {})}
      style={[{ flex: 1 }, direction.style, style]}
    />
  );
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
  const ltr = directionProps("ltr");

  const track = value
    ? trackColor?.true ?? "#8FC9A5"
    : trackColor?.false ?? "#C9D4CC";
  const thumb = thumbColor ?? (value ? "#176B43" : "#FFFFFF");

  return (
    // Always left-to-right, also inside Arabic screens (see lib/rtl.ts).
    <RNView
      {...(ltr.dir ? ({ dir: ltr.dir } as object) : {})}
      style={[switchStyles.wrapper, ltr.style]}
    >
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
    </RNView>
  );
}

const switchStyles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    position: "relative",
  },
  wrapper: {
    alignSelf: "flex-start",
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
