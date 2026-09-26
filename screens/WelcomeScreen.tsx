import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function HomeScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.hero}>
        <View style={styles.circleLeft} />
        <View style={styles.circleRight} />

        <View style={styles.logo}>
          <View style={styles.paper}>
            <View style={styles.paperLine} />
            <View style={styles.paperLine} />
            <View style={styles.paperLineShort} />
          </View>
          <View style={styles.searchCircle} />
          <View style={styles.searchHandle} />
        </View>

        <Text style={styles.title}>LabelLens</Text>
        <Text style={styles.subtitle}>
          Understand what’s inside before you eat
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.description}>
          Scan products, check allergens, and verify{"\n"}
          ingredients — right at the shelf.
        </Text>

        <TouchableOpacity
  style={styles.createButton}
  onPress={() => navigation.navigate("Register")}
>
  <Text style={styles.createButtonText}>Create Account</Text>
</TouchableOpacity>

<TouchableOpacity
  style={styles.signInButton}
  onPress={() => navigation.navigate("Login")}
>
  <Text style={styles.signInButtonText}>Sign In</Text>
</TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  hero: {
    height: "46%",
    backgroundColor: "#C9F0D9",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  circleLeft: {
    position: "absolute",
    width: 125,
    height: 125,
    borderRadius: 100,
    backgroundColor: "#B5E5C7",
    left: -28,
    bottom: 88,
  },
  circleRight: {
    position: "absolute",
    width: 175,
    height: 175,
    borderRadius: 100,
    backgroundColor: "#B4E7C7",
    right: -35,
    top: -30,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#20864D",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  paper: {
    width: 19,
    height: 24,
    borderWidth: 1.5,
    borderColor: "#D7F4E2",
    borderRadius: 2,
    position: "absolute",
    left: 17,
    top: 18,
    paddingTop: 4,
  },
  paperLine: {
    height: 1.5,
    width: 10,
    backgroundColor: "#D7F4E2",
    marginLeft: 3,
    marginBottom: 3,
  },
  paperLineShort: {
    height: 1.5,
    width: 7,
    backgroundColor: "#D7F4E2",
    marginLeft: 3,
  },
  searchCircle: {
    width: 14,
    height: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    position: "absolute",
    right: 16,
    bottom: 17,
  },
  searchHandle: {
    width: 8,
    height: 2,
    backgroundColor: "#FFFFFF",
    position: "absolute",
    right: 12,
    bottom: 15,
    transform: [{ rotate: "45deg" }],
  },
  title: {
    fontSize: 29,
    color: "#173E2A",
    fontFamily: "Georgia",
    fontWeight: "500",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#275541",
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 28,
  },
  description: {
    color: "#536A60",
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: "#25884D",
    minHeight: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#17452F",
    shadowOpacity: 0.16,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  signInButton: {
    minHeight: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#D9E0DB",
  },
  signInButtonText: {
    color: "#17452F",
    fontSize: 14,
    fontWeight: "600",
  },
});