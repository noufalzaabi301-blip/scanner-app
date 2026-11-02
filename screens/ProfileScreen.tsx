import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ProfileScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile & Settings</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>L</Text>
          </View>

          <View>
            <Text style={styles.name}>LabelLens User</Text>
            <Text style={styles.email}>
              Profile settings will be available later.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>SUPPORT</Text>

        <View style={styles.group}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("FAQs")}
          >
            <Text style={styles.rowIcon}>?</Text>
            <Text style={styles.rowTitle}>FAQs</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("ContactUs")}
          >
            <Text style={styles.rowIcon}>✉</Text>
            <Text style={styles.rowTitle}>Contact Us</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("AboutLabelLens")}
          >
            <Text style={styles.rowIcon}>i</Text>
            <Text style={styles.rowTitle}>About LabelLens</Text>
            <Text style={styles.rowValue}>v1.0.0</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
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
    color: "#258D4D",
    fontSize: 19,
    fontWeight: "700",
    width: 32,
    textAlign: "center",
    marginRight: 8,
  },
  rowTitle: {
    flex: 1,
    color: "#193F2C",
    fontSize: 14,
    fontWeight: "600",
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
    marginLeft: 54,
  },
});