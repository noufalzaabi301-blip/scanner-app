// ---------------------------------------------------------------------------
// screens/AboutLabelLensScreen.tsx
// The single official About page (the duplicate that used to live inside
// App.tsx has been removed).
// ---------------------------------------------------------------------------

import {
  StyleSheet,
} from "react-native";

import { APP_VERSION } from "../lib/constants";
import { useI18n, type TranslationKey } from "../lib/i18n";
import {
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "../components/Themed";

const STEPS: { title: TranslationKey; body: TranslationKey }[] = [
  { title: "about.step1Title", body: "about.step1Body" },
  { title: "about.step2Title", body: "about.step2Body" },
  { title: "about.step3Title", body: "about.step3Body" },
];

export default function AboutLabelLensScreen() {
  const { t } = useI18n();

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoBox}>
          <Text style={styles.logoIcon}>⌕</Text>
        </View>

        <Text style={styles.title}>{t("title.about")}</Text>

        <Text style={styles.tagline}>{t("about.tagline")}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("about.purposeTitle")}</Text>
          <Text style={styles.text}>{t("about.purposeBody")}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("about.howTitle")}</Text>

          {STEPS.map((step, index) => (
            <View key={step.title} style={styles.step}>
              <Text style={styles.stepNumber}>{index + 1}</Text>

              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>{t(step.title)}</Text>
                <Text style={styles.stepDescription}>{t(step.body)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("about.avoidTitle")}</Text>
          <Text style={styles.text}>{t("about.avoidBody")}</Text>
        </View>

        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>{t("about.noticeTitle")}</Text>
          <Text style={styles.noticeText}>{t("about.noticeBody")}</Text>
        </View>

        <Text style={styles.version}>
          {t("about.version", { version: APP_VERSION })}
        </Text>

        <Text style={styles.university}>{t("about.university")}</Text>
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
    backgroundColor: "#176B43",
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
    color: "#17452F",
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
    backgroundColor: "#E8F5E9",
    color: "#176B43",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 28,
    marginEnd: 12,
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    color: "#17452F",
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