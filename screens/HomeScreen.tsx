//Test comment on home Screen
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";

export default function HomeScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.page}>
      <Text style={styles.title}>Welcome to LabelLens</Text>

      <Text style={styles.description}>
        The barcode scanner will be added to this page.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.replace("Login")}
      >
        <Text style={styles.buttonText}>Return to login</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F1F7F3",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    color: "#17452F",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
  },
  description: {
    color: "#68766F",
    fontSize: 16,
    textAlign: "center",
    marginTop: 12,
  },
  button: {
    backgroundColor: "#176B43",
    borderRadius: 12,
    padding: 15,
    marginTop: 30,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
});