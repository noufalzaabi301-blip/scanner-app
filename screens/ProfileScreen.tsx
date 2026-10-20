// Basic placeholder Profile screen.
// Profile functionality will be implemented later.

import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.content}>
        {/* Temporary message until Profile is implemented. */}
        <Text style={styles.title}>
          Profile
        </Text>

        <Text style={styles.message}>
          Profile settings will be available later.
        </Text>
      </View>
    </SafeAreaView>
  );
}

// Styles for the temporary Profile screen.
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F8FBF8",
  },

  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  title: {
    color: "#176B43",
    fontSize: 26,
    fontWeight: "800",
  },

  message: {
    color: "#63776B",
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
  },
});