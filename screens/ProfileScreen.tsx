import { supabase } from "../lib/supabase";
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ProfileScreen({ navigation }: any) {
  const [name, setName] = useState("LabelLens User");
  const [email, setEmail] = useState("");
  const [allergies, setAllergies] = useState("No allergies saved");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      navigation.replace("Welcome");
      return;
    }

    const fullName =
      user.user_metadata?.full_name ||
      `${user.user_metadata?.first_name ?? ""} ${
        user.user_metadata?.last_name ?? ""
      }`.trim() ||
      "LabelLens User";

    setName(fullName);
    setEmail(user.email ?? "");

    const { data: preferences } = await supabase
      .from("user_preferences")
      .select("allergies, other_allergy")
      .eq("user_id", user.id)
      .maybeSingle();

    if (preferences?.allergies?.length) {
      setAllergies(preferences.allergies.join(", "));
    } else if (preferences?.other_allergy) {
      setAllergies(preferences.other_allergy);
    }
  }

  function showMessage(title: string, message: string) {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigation.replace("Welcome");
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Profile & Settings</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {name.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.profileDetails}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.email}>{email}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>ALLERGY PROFILE</Text>
        <TouchableOpacity
          style={styles.singleRow}
          onPress={() => navigation.navigate("Preferences")}
        >
          <Text style={styles.rowIcon}>🛡️</Text>

          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Edit Allergens</Text>
            <Text style={styles.rowSubtitle}>{allergies}</Text>
          </View>

          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>PREFERENCES</Text>
        <View style={styles.group}>
          <TouchableOpacity
            style={styles.row}
            onPress={() =>
              showMessage("Language", "Language settings will be added soon.")
            }
          >
            <Text style={styles.rowIcon}>🌐</Text>
            <Text style={styles.rowTitle}>Language</Text>
            <Text style={styles.rowValue}>English</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={() =>
              showMessage(
                "Notifications",
                "Notification settings will be added soon."
              )
            }
          >
            <Text style={styles.rowIcon}>🔔</Text>
            <Text style={styles.rowTitle}>Notifications</Text>
            <Text style={styles.rowValue}>On</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>SUPPORT</Text>
        <View style={styles.group}>
          <TouchableOpacity
            style={styles.row}
            onPress={() =>
              showMessage("Help Center", "Help Center will be added soon.")
            }
          >
            <Text style={styles.rowIcon}>❓</Text>
            <Text style={styles.rowTitle}>Help Center</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={() =>
              showMessage("Contact Us", "Contact support at support@labellens.com")
            }
          >
            <Text style={styles.rowIcon}>✉️</Text>
            <Text style={styles.rowTitle}>Contact Us</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={() =>
              showMessage("About LabelLens", "LabelLens version 1.0.0")
            }
          >
            <Text style={styles.rowIcon}>ℹ️</Text>
            <Text style={styles.rowTitle}>About LabelLens</Text>
            <Text style={styles.rowValue}>v1.0.0</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        <View style={styles.group}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("PrivacyNotice")}
          >
            <Text style={styles.rowIcon}>🔒</Text>
            <Text style={styles.rowTitle}>Privacy</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.row} onPress={signOut}>
            <Text style={styles.rowIcon}>🚪</Text>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("Home")}
        >
          <Text style={styles.navIcon}>▣</Text>
          <Text style={styles.navText}>Scan</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("Preferences")}
        >
          <Text style={styles.navIcon}>▤</Text>
          <Text style={styles.navText}>Avoid</Text>
        </TouchableOpacity>

        <View style={styles.navItem}>
          <Text style={styles.activeNavIcon}>♙</Text>
          <Text style={styles.activeNavText}>Profile</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F7F9F7",
  },
  content: {
    padding: 18,
    paddingBottom: 18,
  },
  header: {
    color: "#183F2B",
    fontSize: 19,
    fontWeight: "700",
    marginBottom: 20,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 17,
    borderWidth: 1,
    borderColor: "#EDF0ED",
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
    fontWeight: "600",
  },
  profileDetails: {
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
    marginTop: 4,
  },
  sectionTitle: {
    color: "#91A0BF",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 7,
    marginLeft: 3,
  },
  group: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EDF0ED",
  },
  singleRow: {
    minHeight: 65,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#EDF0ED",
  },
  row: {
    minHeight: 53,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  rowIcon: {
    fontSize: 16,
    width: 28,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    flex: 1,
    color: "#193F2C",
    fontSize: 13,
    fontWeight: "500",
  },
  rowSubtitle: {
    color: "#63776B",
    fontSize: 11,
    marginTop: 3,
  },
  rowValue: {
    color: "#91A0BF",
    fontSize: 12,
    marginRight: 9,
  },
  arrow: {
    color: "#AEB9C6",
    fontSize: 24,
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: "#EEF1EF",
    marginLeft: 42,
  },
  signOutText: {
    color: "#D45050",
    fontSize: 13,
    fontWeight: "500",
  },
  bottomNav: {
    minHeight: 70,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E8EEEA",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  navItem: {
    minWidth: 72,
    alignItems: "center",
  },
  navIcon: {
    color: "#9BA9A1",
    fontSize: 18,
  },
  navText: {
    color: "#9BA9A1",
    fontSize: 10,
    marginTop: 3,
  },
  activeNavIcon: {
    color: "#258D4D",
    fontSize: 20,
  },
  activeNavText: {
    color: "#258D4D",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 3,
  },
});