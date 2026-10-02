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
  const [name, setName] = useState("Guest");
  const [email, setEmail] = useState(
    "Log in or create an account to save your preferences."
  );
  const [allergies, setAllergies] = useState("No allergies saved");
  const [isGuest, setIsGuest] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setName("Guest");
      setEmail(
        "Log in or create an account to save your preferences."
      );
      setAllergies("Sign in to save allergies");
      setIsGuest(true);
      return;
    }

    setIsGuest(false);

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

  function confirmSignOut() {
    const signOutNow = async () => {
      const { error } = await supabase.auth.signOut({
        scope: "local",
      });

      if (error) {
        showMessage("Could not sign out", error.message);
        return;
      }

      navigation.replace("Welcome");
    };

    if (Platform.OS === "web") {
      if (window.confirm("Sign out of this device?")) {
        signOutNow();
      }
      return;
    }

    Alert.alert(
      "Sign out?",
      "You will be signed out of this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: signOutNow,
        },
      ]
    );
  }

  function confirmDeleteAccount() {
    const deleteAccount = async () => {
      setDeleting(true);

      try {
        const { error } = await supabase.functions.invoke(
          "delete-my-account"
        );

        if (error) {
          throw error;
        }

        await supabase.auth.signOut({
          scope: "local",
        });

        navigation.replace("Welcome");
      } catch (error: any) {
        showMessage(
          "Could not delete account",
          error?.message ||
            "Your account could not be deleted."
        );
      } finally {
        setDeleting(false);
      }
    };

    const warning =
      "This permanently deletes your LabelLens account, saved preferences, privacy consent, and profile information. This cannot be undone.";

    if (Platform.OS === "web") {
      if (window.confirm(warning)) {
        deleteAccount();
      }
      return;
    }

    Alert.alert("Delete account?", warning, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete account",
        style: "destructive",
        onPress: deleteAccount,
      },
    ]);
  }

  function openPreferences() {
    if (isGuest) {
      navigation.replace("Welcome");
      return;
    }

    navigation.navigate("Preferences");
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Profile & Settings</Text>

        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
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

          {isGuest ? (
            <TouchableOpacity
              style={styles.guestAccountButton}
              onPress={() => navigation.replace("Register")}
            >
              <Text style={styles.guestAccountButtonText}>
                Log in / Create account
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.accountSettingsButton}
              onPress={() =>
                navigation.navigate("ProfileSettings")
              }
            >
              <Text style={styles.accountSettingsText}>
                Profile settings
              </Text>
              <Text style={styles.accountSettingsArrow}>›</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sectionTitle}>ALLERGY PROFILE</Text>

        <TouchableOpacity
          style={styles.singleRow}
          onPress={openPreferences}
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
              showMessage(
                "Language",
                "Language settings will be added soon."
              )
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
              showMessage(
                "Help Center",
                "Help Center will be added soon."
              )
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
              showMessage(
                "Contact Us",
                "Contact support at support@labellens.com"
              )
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
              showMessage(
                "About LabelLens",
                "LabelLens version 1.0.0"
              )
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
            onPress={() =>
              navigation.navigate("PrivacyNotice", {
                readOnly: true,
              })
            }
          >
            <Text style={styles.rowIcon}>🔒</Text>
            <Text style={styles.rowTitle}>Privacy</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          {!isGuest && (
            <>
              <View style={styles.divider} />

              <TouchableOpacity
                style={styles.row}
                onPress={confirmSignOut}
              >
                <Text style={styles.rowIcon}>🚪</Text>
                <Text style={styles.signOutText}>Sign Out</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity
                style={[
                  styles.row,
                  deleting && styles.disabledRow,
                ]}
                onPress={confirmDeleteAccount}
                disabled={deleting}
              >
                <Text style={styles.rowIcon}>🗑️</Text>
                <Text style={styles.deleteAccountText}>
                  {deleting
                    ? "Deleting account..."
                    : "Delete account"}
                </Text>
              </TouchableOpacity>
            </>
          )}
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
          onPress={openPreferences}
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
    marginBottom: 17,
    borderWidth: 1,
    borderColor: "#EDF0ED",
  },

  profileRow: {
    flexDirection: "row",
    alignItems: "center",
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
    flexShrink: 1,
  },

  accountSettingsButton: {
    borderTopWidth: 1,
    borderTopColor: "#E5ECE8",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 14,
  },

  accountSettingsText: {
    color: "#176B43",
    fontWeight: "700",
  },

  accountSettingsArrow: {
    color: "#176B43",
    fontSize: 22,
  },

  guestAccountButton: {
    backgroundColor: "#176B43",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 11,
    marginTop: 14,
  },

  guestAccountButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
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

  deleteAccountText: {
    color: "#A33838",
    fontSize: 13,
    fontWeight: "700",
  },

  disabledRow: {
    opacity: 0.55,
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