import { Ionicons } from "@expo/vector-icons";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type TabName = "Home" | "Avoid" | "Profile";

type BottomNavigationProps = {
  navigation: any;
  activeTab: TabName;
};

export default function BottomNavigation({
  navigation,
  activeTab,
}: BottomNavigationProps) {
  return (
    <View style={styles.footer}>
      <TouchableOpacity
        style={[
          styles.item,
          activeTab === "Home" && styles.activeItem,
        ]}
        onPress={() => navigation.navigate("Home")}
      >
        <Ionicons
          name="scan-outline"
          size={21}
          color={
            activeTab === "Home"
              ? "#176B43"
              : "#63776B"
          }
        />

        <Text
          style={[
            styles.label,
            activeTab === "Home" &&
              styles.activeLabel,
          ]}
        >
          Scan
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.item,
          activeTab === "Avoid" && styles.activeItem,
        ]}
        onPress={() => navigation.navigate("Avoid")}
      >
        <Ionicons
          name="list-outline"
          size={21}
          color={
            activeTab === "Avoid"
              ? "#176B43"
              : "#63776B"
          }
        />

        <Text
          style={[
            styles.label,
            activeTab === "Avoid" &&
              styles.activeLabel,
          ]}
        >
          Avoid
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.item,
          activeTab === "Profile" &&
            styles.activeItem,
        ]}
        onPress={() => navigation.navigate("Profile")}
      >
        <Ionicons
          name="person-outline"
          size={21}
          color={
            activeTab === "Profile"
              ? "#176B43"
              : "#63776B"
          }
        />

        <Text
          style={[
            styles.label,
            activeTab === "Profile" &&
              styles.activeLabel,
          ]}
        >
          Profile
        </Text>
      </TouchableOpacity>
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
    backgroundColor: "#E8F5E9",
  },

  label: {
    color: "#63776B",
    fontSize: 12,
    marginTop: 3,
  },

  activeLabel: {
    color: "#176B43",
    fontWeight: "800",
  },
});