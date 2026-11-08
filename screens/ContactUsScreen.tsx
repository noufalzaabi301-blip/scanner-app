// ---------------------------------------------------------------------------
// screens/ContactUsScreen.tsx
// Contact details and a message form.
//
// There is no mail server behind the app, so the form opens the user's own
// email app with the message pre-filled (mailto:). Nothing is stored or
// sent by LabelLens itself; the user still presses Send in their mail app.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import {
  Linking,
  Platform,
  StyleSheet,
} from "react-native";

import { CONTACT_EMAIL } from "../lib/constants";
import { useI18n, type TranslationKey } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { showMessage } from "../lib/ui/messages";
import {
  KeyboardAvoidingView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "../components/Themed";

const SUBJECTS: TranslationKey[] = [
  "contact.subjectGeneral",
  "contact.subjectTechnical",
  "contact.subjectFeedback",
  "contact.subjectPrivacy",
  "contact.subjectOther",
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactUsScreen() {
  const { t } = useI18n();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<TranslationKey | "">("");
  const [message, setMessage] = useState("");

  // Pre-fill name and email for signed-in users (still editable).
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user;

      if (!user) {
        return;
      }

      const name = `${user.user_metadata?.first_name ?? ""} ${
        user.user_metadata?.last_name ?? ""
      }`.trim();

      setFullName((current) => current || name);
      setEmail((current) => current || user.email || "");
    });
  }, []);

  async function handleSendMessage() {
    if (!fullName.trim() || !email.trim() || !subject || !message.trim()) {
      showMessage(t("login.missingTitle"), t("contact.missingBody"));
      return;
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      showMessage(t("login.missingTitle"), t("contact.invalidEmail"));
      return;
    }

    const mailSubject = `LabelLens – ${t(subject)}`;
    const body = `${message.trim()}\n\n— ${fullName.trim()} (${email.trim()})`;
    const url = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      mailSubject
    )}&body=${encodeURIComponent(body)}`;

    try {
      await Linking.openURL(url);
      showMessage(t("contact.readyTitle"), t("contact.readyBody"));
      setSubject("");
      setMessage("");
    } catch {
      showMessage(
        t("contact.noMailTitle"),
        t("contact.noMailBody", { email: CONTACT_EMAIL })
      );
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t("title.contactUs")}</Text>
        <Text style={styles.intro}>{t("contact.intro")}</Text>

        <Text style={styles.description}>{t("contact.description")}</Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>{t("common.email")}</Text>
          <Text style={styles.infoValue}>{CONTACT_EMAIL}</Text>

          <View style={styles.divider} />

          <Text style={styles.infoLabel}>{t("contact.university")}</Text>
          <Text style={styles.infoValue}>{t("about.university")}</Text>

          <View style={styles.divider} />

          <Text style={styles.infoLabel}>{t("contact.project")}</Text>
          <Text style={styles.infoValue}>LabelLens</Text>

          <View style={styles.divider} />

          <Text style={styles.infoLabel}>{t("contact.responseTime")}</Text>
          <Text style={styles.infoValue}>{t("contact.responseBody")}</Text>
        </View>

        <Text style={styles.sectionTitle}>{t("contact.sendTitle")}</Text>

        <Text style={styles.label}>{t("contact.fullName")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("contact.namePlaceholder")}
          placeholderTextColor="#9CA3AF"
          value={fullName}
          onChangeText={setFullName}
        />

        <Text style={styles.label}>{t("settings.email")}</Text>
        <TextInput
          style={styles.input}
          placeholder={t("contact.emailPlaceholder")}
          placeholderTextColor="#9CA3AF"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>{t("contact.subject")}</Text>
        <View style={styles.subjectList}>
          {SUBJECTS.map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.subjectButton,
                subject === item && styles.subjectButtonSelected,
              ]}
              onPress={() => setSubject(item)}
            >
              <Text
                style={[
                  styles.subjectText,
                  subject === item && styles.subjectTextSelected,
                ]}
              >
                {t(item)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>{t("contact.message")}</Text>
        <TextInput
          style={[styles.input, styles.messageInput]}
          placeholder={t("contact.messagePlaceholder")}
          placeholderTextColor="#9CA3AF"
          multiline
          textAlignVertical="top"
          value={message}
          onChangeText={setMessage}
        />

        <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
          <Text style={styles.sendButtonText}>{t("contact.send")}</Text>
        </TouchableOpacity>

        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>{t("contact.noticeTitle")}</Text>
          <Text style={styles.noticeText}>{t("contact.notice1")}</Text>
          <Text style={[styles.noticeText, styles.noticeTextLast]}>
            {t("contact.notice2")}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F9F7",
  },
  container: {
    padding: 20,
    paddingBottom: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  intro: {
    fontSize: 18,
    fontWeight: "600",
    color: "#176B43",
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: "#4B5563",
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 16,
    marginBottom: 26,
  },
  infoLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    color: "#1F2937",
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: "#1F2937",
    marginBottom: 18,
  },
  subjectList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },
  subjectButton: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  subjectButtonSelected: {
    backgroundColor: "#E8F5E9",
    borderColor: "#176B43",
  },
  subjectText: {
    color: "#4B5563",
    fontSize: 13,
  },
  subjectTextSelected: {
    color: "#176B43",
    fontWeight: "700",
  },
  messageInput: {
    height: 130,
  },
  sendButton: {
    backgroundColor: "#176B43",
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 15,
    marginBottom: 26,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  noticeBox: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 14,
    padding: 16,
  },
  noticeTitle: {
    color: "#92400E",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  noticeText: {
    color: "#78350F",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  noticeTextLast: {
    marginBottom: 0,
  },
});