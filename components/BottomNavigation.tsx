// ---------------------------------------------------------------------------
// components/BottomNavigation.tsx
// The one shared footer used by Home, Avoid List and Profile.
// ---------------------------------------------------------------------------

import {
  StyleSheet,
} from "react-native";

import { COLORS, ROUTES } from "../lib/constants";
import { useI18n, type TranslationKey } from "../lib/i18n";
import {
  Ionicons,
  Text,
  TouchableOpacity,
  View,
} from "./Themed";

type TabName = "Home" | "Avoid" | "Profile";

type BottomNavigationProps = {
  navigation: any;
  activeTab: TabName;
};

const TABS: {
  name: TabName;
  icon: keyof typeof Ionicons.glyphMap;
  label: TranslationKey;
}[] = [
  { name: ROUTES.Home, icon: "scan-outline", label: "nav.scan" },
  { name: ROUTES.Avoid, icon: "list-outline", label: "nav.avoid" },
  { name: ROUTES.Profile, icon: "person-outline", label: "nav.profile" },
];

export default function BottomNavigation({
  navigation,
  activeTab,
}: BottomNavigationProps) {
  const { t } = useI18n();

  return (
    <View style={styles.footer}>
      {TABS.map((tab) => {
        const active = activeTab === tab.name;

        return (
          <TouchableOpacity
            key={tab.name}
            style={[styles.item, active && styles.activeItem]}
            onPress={() => navigation.navigate(tab.name)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Ionicons
              name={tab.icon}
              size={21}
              color={active ? COLORS.primary : COLORS.muted}
            />

            <Text style={[styles.label, active && styles.activeLabel]}>
              {t(tab.label)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#DDE7E0",
    paddingHorizontal: 8,
    paddingVertical: 7,
  },

  item: {
    flex: 1,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },

  activeItem: {
    backgroundColor: COLORS.primarySoft,
  },

  label: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 3,
  },

  activeLabel: {
    color: COLORS.primary,
    fontWeight: "800",
  },
});
