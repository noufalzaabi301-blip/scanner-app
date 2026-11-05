// ---------------------------------------------------------------------------
// screens/FAQsScreen.tsx
// Accordion list of frequently asked questions.
// ---------------------------------------------------------------------------

import { useState } from "react";
import {
  StyleSheet,
} from "react-native";

import { useI18n, type TranslationKey } from "../lib/i18n";
import {
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "../components/Themed";

const FAQS: { question: TranslationKey; answer: TranslationKey }[] = [
  { question: "faq.q1", answer: "faq.a1" },
  { question: "faq.q2", answer: "faq.a2" },
  { question: "faq.q3", answer: "faq.a3" },
  { question: "faq.q4", answer: "faq.a4" },
  { question: "faq.q5", answer: "faq.a5" },
  { question: "faq.q6", answer: "faq.a6" },
  { question: "faq.q7", answer: "faq.a7" },
];

export default function FAQsScreen({ navigation }: any) {
  const { t } = useI18n();
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

        <Text style={styles.title}>{t("faq.title")}</Text>
        <Text style={styles.subtitle}>{t("faq.subtitle")}</Text>

        <View style={styles.list}>
          {FAQS.map((item, index) => {
            const isOpen = openQuestion === index;

            return (
              <View key={item.question} style={styles.faqCard}>
                <TouchableOpacity
                  style={styles.questionRow}
                  onPress={() => toggleQuestion(index)}
                  activeOpacity={0.7}
                  accessibilityState={{ expanded: isOpen }}
                >
                  <Text style={styles.question}>{t(item.question)}</Text>
                  <Text style={styles.arrow}>{isOpen ? "⌃" : "⌄"}</Text>
                </TouchableOpacity>

                {isOpen && <Text style={styles.answer}>{t(item.answer)}</Text>}
              </View>
            );
          })}
        </View>

        <View style={styles.contactBox}>
          <Text style={styles.contactTitle}>{t("faq.stillNeedHelp")}</Text>
          <Text style={styles.contactText}>{t("faq.stillNeedHelpBody")}</Text>

          <TouchableOpacity
            style={styles.contactButton}
            onPress={() => navigation.navigate("ContactUs")}
          >
            <Text style={styles.contactButtonText}>{t("title.contactUs")}</Text>
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
    backgroundColor: "#E8F5E9",
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
    color: "#17452F",
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
    color: "#17452F",
    fontSize: 15,
    fontWeight: "600",
    marginEnd: 12,
  },
  arrow: {
    color: "#176B43",
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
    backgroundColor: "#E8F5E9",
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