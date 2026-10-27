import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const subjects = [
  "General Question",
  "Technical Issue",
  "Feedback",
  "Privacy Question",
  "Other",
];

export default function ContactUsScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  function handleSendMessage() {
    if (!fullName.trim() || !email.trim() || !subject || !message.trim()) {
      Alert.alert("Missing information", "Please complete all fields.");
      return;
    }

    // هذا مؤقت للنموذج الأولي. سنربط الإرسال الحقيقي لاحقًا.
    Alert.alert(
      "Message ready",
      "Thank you for contacting LabelLens. We aim to respond within 2–3 business days."
    );

    setFullName("");
    setEmail("");
    setSubject("");
    setMessage("");
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Contact Us</Text>
        <Text style={styles.intro}>We would love to hear from you.</Text>

        <Text style={styles.description}>
          If you have a question, suggestion, technical issue, or feedback
          about the app, please contact our team using the form below.
        </Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>labellens.contact@gmail.com</Text>

          <View style={styles.divider} />

          <Text style={styles.infoLabel}>University</Text>
          <Text style={styles.infoValue}>United Arab Emirates University</Text>

          <View style={styles.divider} />

          <Text style={styles.infoLabel}>Project</Text>
          <Text style={styles.infoValue}>LabelLens</Text>

          <View style={styles.divider} />

          <Text style={styles.infoLabel}>Response Time</Text>
          <Text style={styles.infoValue}>
            We aim to respond within 2–3 business days.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Send Us a Message</Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your name"
          placeholderTextColor="#9CA3AF"
          value={fullName}
          onChangeText={setFullName}
        />

        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your email"
          placeholderTextColor="#9CA3AF"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Subject</Text>
        <View style={styles.subjectList}>
          {subjects.map((item) => (
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
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Message</Text>
        <TextInput
          style={[styles.input, styles.messageInput]}
          placeholder="Write your message here"
          placeholderTextColor="#9CA3AF"
          multiline
          textAlignVertical="top"
          value={message}
          onChangeText={setMessage}
        />

        <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
          <Text style={styles.sendButtonText}>Send Message</Text>
        </TouchableOpacity>

        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>Important Notice</Text>
          <Text style={styles.noticeText}>
            LabelLens provides allergen and halal ingredient screening based on
            available product-label information. It does not provide medical,
            dietary, religious, or legal advice.
          </Text>
          <Text style={[styles.noticeText, styles.noticeTextLast]}>
            If you have a severe allergy, always read the product label
            carefully and consult a qualified healthcare professional when
            needed. For official halal certification information, please
            contact the manufacturer or an authorized certification body.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8F9F5",
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
    color: "#166534",
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
    backgroundColor: "#DCFCE7",
    borderColor: "#16A34A",
  },
  subjectText: {
    color: "#4B5563",
    fontSize: 13,
  },
  subjectTextSelected: {
    color: "#166534",
    fontWeight: "700",
  },
  messageInput: {
    height: 130,
  },
  sendButton: {
    backgroundColor: "#15803D",
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