import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function AboutLabelLensScreen() {
  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoBox}>
          <Text style={styles.logoIcon}>⌕</Text>
        </View>

        <Text style={styles.title}>About LabelLens</Text>
        <Text style={styles.tagline}>
          Understand what is inside before you eat.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Our purpose</Text>
          <Text style={styles.text}>
            LabelLens is a food-label scanning app designed to help users
            review ingredients, identify possible allergens, and understand
            halal-related ingredient concerns before making their own decision.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>How it works</Text>

          <View style={styles.step}>
            <Text style={styles.stepNumber}>1</Text>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>Scan the product</Text>
              <Text style={styles.stepDescription}>
                Scan a barcode or photograph an ingredient label.
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <Text style={styles.stepNumber}>2</Text>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>Review the label</Text>
              <Text style={styles.stepDescription}>
                Check and correct the extracted ingredient text before analysis.
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <Text style={styles.stepNumber}>3</Text>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>Understand the results</Text>
              <Text style={styles.stepDescription}>
                Review possible allergens and ingredient concerns.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>Important notice</Text>
          <Text style={styles.noticeText}>
            LabelLens provides information based on available product-label
            information. It does not provide medical, dietary, religious, or
            legal advice.
          </Text>
        </View>

        <Text style={styles.version}>LabelLens • Version 1.0.0</Text>
        <Text style={styles.university}>
          United Arab Emirates University
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F7F9F7",
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#258D4D",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  logoIcon: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "700",
  },
  title: {
    color: "#183F2B",
    fontSize: 27,
    fontWeight: "700",
    marginBottom: 7,
  },
  tagline: {
    color: "#62756A",
    fontSize: 15,
    marginBottom: 23,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E9E3",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  cardTitle: {
    color: "#17452F",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 9,
  },
  text: {
    color: "#55685D",
    fontSize: 14,
    lineHeight: 21,
  },
  step: {
    flexDirection: "row",
    marginBottom: 17,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#EAF7EF",
    color: "#176B43",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 28,
    marginRight: 12,
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    color: "#193F2C",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 3,
  },
  stepDescription: {
    color: "#62756A",
    fontSize: 13,
    lineHeight: 19,
  },
  noticeBox: {
    backgroundColor: "#FFF8DB",
    borderWidth: 1,
    borderColor: "#F4DA75",
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
  },
  noticeTitle: {
    color: "#8A6110",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 7,
  },
  noticeText: {
    color: "#755515",
    fontSize: 13,
    lineHeight: 19,
  },
  version: {
    color: "#62756A",
    fontSize: 13,
    textAlign: "center",
    marginTop: 25,
  },
  university: {
    color: "#91A0BF",
    fontSize: 12,
    textAlign: "center",
    marginTop: 5,
  },
});