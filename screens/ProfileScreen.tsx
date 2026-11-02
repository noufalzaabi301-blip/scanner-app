import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import BottomNavigation from "../components/BottomNavigation";

export default function ProfileScreen({
  navigation,
}: any) {
  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.content}>
        <Text style={styles.title}>
          Profile & Settings
        </Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>L</Text>
          </View>

          <View style={styles.profileText}>
            <Text style={styles.name}>
              LabelLens User
            </Text>

            <Text style={styles.email}>
              Manage your LabelLens account and preferences.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.preferencesButton}
          onPress={() =>
            navigation.navigate("Preferences", {
              mode: "edit",
            })
          }
        >
          <Ionicons
            name="options-outline"
            size={21}
            color="#258D4D"
          />

          <Text style={styles.preferencesText}>
            Edit allergy preferences
          </Text>

          <Ionicons
            name="chevron-forward"
            size={21}
            color="#AEB9C6"
          />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>
          SUPPORT
        </Text>

        <View style={styles.group}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("FAQs")}
          >
            <Ionicons
              name="help-circle-outline"
              size={22}
              color="#258D4D"
              style={styles.rowIcon}
            />

            <Text style={styles.rowTitle}>
              FAQs
            </Text>

            <Ionicons
              name="chevron-forward"
              size={21}
              color="#AEB9C6"
            />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={() =>
              navigation.navigate("ContactUs")
            }
          >
            <Ionicons
              name="mail-outline"
              size={22}
              color="#258D4D"
              style={styles.rowIcon}
            />

            <Text style={styles.rowTitle}>
              Contact Us
            </Text>

            <Ionicons
              name="chevron-forward"
              size={21}
              color="#AEB9C6"
            />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={() =>
              navigation.navigate("AboutLabelLens")
            }
          >
            <Ionicons
              name="information-circle-outline"
              size={22}
              color="#258D4D"
              style={styles.rowIcon}
            />

            <Text style={styles.rowTitle}>
              About LabelLens
            </Text>

            <Text style={styles.rowValue}>
              v1.0.0
            </Text>

            <Ionicons
              name="chevron-forward"
              size={21}
              color="#AEB9C6"
            />
          </TouchableOpacity>
        </View>
      </View>

      <BottomNavigation
        navigation={navigation}
        activeTab="Profile"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F7F9F7",
  },

  content: {
    flex: 1,
    padding: 18,
  },

  title: {
    color: "#183F2B",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 18,
  },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E1E9E3",
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#CEF3DF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  avatarText: {
    color: "#197A42",
    fontSize: 19,
    fontWeight: "700",
  },

  profileText: {
    flex: 1,
  },

  name: {
    color: "#183F2B",
    fontSize: 15,
    fontWeight: "700",
  },

  email: {
    color: "#62756A",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },

  preferencesButton: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E1E9E3",
    paddingHorizontal: 14,
    marginTop: 14,
  },

  preferencesText: {
    flex: 1,
    color: "#193F2C",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 11,
  },

  sectionTitle: {
    color: "#91A0BF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 23,
    marginBottom: 8,
    marginLeft: 3,
  },

  group: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E1E9E3",
  },

  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },

  rowIcon: {
    width: 28,
  },

  rowTitle: {
    flex: 1,
    color: "#193F2C",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 10,
  },

  rowValue: {
    color: "#91A0BF",
    fontSize: 12,
    marginRight: 9,
  },

  divider: {
    height: 1,
    backgroundColor: "#EEF1EF",
    marginLeft: 54,
  },
});