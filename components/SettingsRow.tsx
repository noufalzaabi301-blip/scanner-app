// ---------------------------------------------------------------------------
// components/SettingsRow.tsx
// One row of a settings group (icon, title, optional value, chevron or a
// custom control such as a Switch). Used by the Profile screen.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";
import {
  StyleSheet,
} from "react-native";

import { COLORS } from "../lib/constants";
import { useI18n } from "../lib/i18n";
import {
  Ionicons,
  Text,
  TouchableOpacity,
  View,
} from "./Themed";

type SettingsRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  // Replaces the chevron (for example a Switch or a checkmark).
  right?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
};

export function SettingsDivider() {
  return <View style={styles.divider} />;
}

export function SettingsSectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function SettingsGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

export default function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  right,
  disabled,
  danger,
}: SettingsRowProps) {
  const { isRTL } = useI18n();

  // Workaround: on the web, text uses dir="auto", so an Arabic title in the
  // English layout (e.g. "العربية") would align right. Pin it to the
  // layout's start side instead.
  const align = { textAlign: isRTL ? "right" : "left" } as const;

  // Icons are not mirrored by the RTL layout, so the chevron is swapped.
  const chevron = isRTL ? "chevron-back" : "chevron-forward";

  const content = (
    <>
      <Ionicons
        name={icon}
        size={22}
        color={danger ? COLORS.danger : COLORS.primaryBright}
        style={styles.icon}
      />

      <View style={styles.textBlock}>
        <Text style={[styles.title, align, danger && styles.dangerText]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, align]}>{subtitle}</Text>
        ) : null}
      </View>

      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}

      {right ?? (onPress ? (
        <Ionicons name={chevron} size={21} color="#AEB9C6" />
      ) : null)}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <TouchableOpacity
      style={[styles.row, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: COLORS.subtle,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 23,
    marginBottom: 8,
    marginStart: 3,
  },

  group: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  disabled: {
    opacity: 0.55,
  },

  icon: {
    width: 28,
    textAlign: "center",
  },

  textBlock: {
    flex: 1,
  },

  title: {
    color: "#17452F",
    fontSize: 14,
    fontWeight: "600",
  },

  dangerText: {
    color: COLORS.danger,
  },

  subtitle: {
    color: "#62756A",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },

  value: {
    maxWidth: "45%",
    color: COLORS.subtle,
    fontSize: 12,
  },

  divider: {
    height: 1,
    backgroundColor: "#EEF1EF",
    marginStart: 54,
  },
});
