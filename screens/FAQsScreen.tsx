import { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const faqs = [
  {
    question: "What is LabelLens?",
    answer:
      "LabelLens is a food-label scanning app that helps you review product ingredients, possible allergens, and halal-related ingredient concerns before making your own decision.",
  },
  {
    question: "Does LabelLens provide medical advice?",
    answer:
      "No. LabelLens provides information based on available product-label information. It does not provide medical, dietary, religious, or legal advice. Always read the product label and consult a qualified healthcare professional when needed.",
  },
  {
    question: "How does product scanning work?",
    answer:
      "Scan a barcode or take a photo of the ingredient label. LabelLens extracts the text, lets you review it, and then highlights possible allergens or ingredient concerns.",
  },
  {
    question: "How do I update my allergies?",
    answer:
      "Open Profile, choose Edit Allergens, select the allergens that apply to you, and save your changes. Your allergy profile is used when reviewing products.",
  },
  {
    question: "What does halal screening mean?",
    answer:
      "LabelLens can highlight ingredients that may need halal verification. For official halal certification information, please contact the manufacturer or an authorized certification body.",
  },
  {
    question: "How can I contact the LabelLens team?",
    answer:
      "Open Contact Us from your Profile page and complete the message form. We aim to respond within 2–3 business days.",
  },
];

export default function FAQsScreen({ navigation }: any) {
  const [openQuestion, setOpenQuestion] = useState<number | null>(null);

  function toggleQuestion(index: number) {
    setOpenQuestion(openQuestion === index ? null : index);
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconBox}>
          <Text style={styles.icon}>?</Text>
        </View>

        <Text style={styles.title}>Frequently Asked Questions</Text>
        <Text style={styles.subtitle}>
          Quick answers about using LabelLens.
        </Text>

        <View style={styles.list}>
          {faqs.map((item, index) => {
            const isOpen = openQuestion === index;

            return (
              <View key={item.question} style={styles.faqCard}>
                <TouchableOpacity
                  style={styles.questionRow}
                  onPress={() => toggleQuestion(index)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.question}>{item.question}</Text>
                  <Text style={styles.arrow}>{isOpen ? "⌃" : "⌄"}</Text>
                </TouchableOpacity>

                {isOpen && <Text style={styles.answer}>{item.answer}</Text>}
              </View>
            );
          })}
        </View>

        <View style={styles.contactBox}>
          <Text style={styles.contactTitle}>Still need help?</Text>
          <Text style={styles.contactText}>
            Send a message to the LabelLens team and we will be happy to help.
          </Text>

          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => navigation.navigate("ContactUs")}
          >
            <Text style={styles.contactButtonText}>Contact Us</Text>
          </TouchableOpacity>
        </View>
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
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#EAF7EF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  icon: {
    color: "#176B43",
    fontSize: 27,
    fontWeight: "700",
  },
  title: {
    color: "#183F2B",
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: "#62756A",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 22,
  },
  list: {
    marginBottom: 22,
  },
  faqCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E9E3",
    borderRadius: 14,
    marginBottom: 12,
    overflow: "hidden",
  },
  questionRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  question: {
    flex: 1,
    color: "#193F2C",
    fontSize: 15,
    fontWeight: "600",
    marginRight: 12,
  },
  arrow: {
    color: "#258D4D",
    fontSize: 21,
    fontWeight: "700",
  },
  answer: {
    color: "#55685D",
    fontSize: 14,
    lineHeight: 21,
    paddingHorizontal: 16,
    paddingBottom: 17,
  },
  contactBox: {
    backgroundColor: "#EAF7EF",
    borderRadius: 16,
    padding: 18,
  },
  contactTitle: {
    color: "#17452F",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 7,
  },
  contactText: {
    color: "#466052",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 15,
  },
  contactButton: {
    backgroundColor: "#176B43",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  contactButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});