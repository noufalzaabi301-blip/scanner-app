import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { hasDeviceAcceptedPrivacy } from "../lib/privacyConsent";
import { usePageInsets } from "../lib/layout";
import { supabase } from "../lib/supabase";
import { ROUTES, STORAGE_KEYS } from "../lib/constants";
import { useI18n } from "../lib/i18n";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  // Plain (un-themed) View: the logo tile stays white in dark mode.
  View as PlainView,
} from "react-native";
import {
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from "../components/Themed";

const HAS_OPENED_KEY = STORAGE_KEYS.hasOpenedBefore;

export default function WelcomeScreen({ navigation }: any) {
  const { t } = useI18n();
  // Shared responsive side padding (lib/layout.ts).
  const pageInsets = usePageInsets();
  const [checkingStart, setCheckingStart] = useState(true);

  useEffect(() => {
    // Guard: this check runs once per visit. In development React runs
    // effects twice; without the guard both runs could open the Privacy
    // Notice, stacking two copies.
    let cancelled = false;

    async function chooseStartScreen() {
      try {
        // Show the Privacy Notice only once on this device (per version).
        const privacyAccepted = await hasDeviceAcceptedPrivacy();

        if (cancelled) {
          return;
        }

        if (!privacyAccepted) {
          navigation.replace("PrivacyNotice", {
            fromAppStart: true,
          });
          return;
        }

        const hasOpenedBefore =
          await AsyncStorage.getItem(HAS_OPENED_KEY);

        // First normal Welcome-page visit after accepting Privacy.
        if (!hasOpenedBefore) {
          await AsyncStorage.setItem(
            HAS_OPENED_KEY,
            "true"
          );

          setCheckingStart(false);
          return;
        }

        // Later openings: go straight to Home when signed in.
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session && !cancelled) {
          navigation.replace("Home");
          return;
        }

        setCheckingStart(false);
      } catch {
        setCheckingStart(false);
      }
    }

    chooseStartScreen();

    return () => {
      cancelled = true;
    };
  }, [navigation]);

  // Guest mode: the guest must set allergy and halal preferences first
  // (screens/GuestPreferencesScreen.tsx). The scanner never opens
  // directly. Welcome stays underneath, so going back returns here.
  async function continueAsGuest() {
    await supabase.auth.signOut({
      scope: "local",
    });

    navigation.navigate(ROUTES.GuestPreferences);
  }

  if (checkingStart) {
    return (
      <SafeAreaView style={styles.loadingPage}>
        <ActivityIndicator size="large" color="#176B43" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.hero}>
        <View style={styles.circleLeft} />
        <View style={styles.circleRight} />

        {/* LabelLens logo (assets/logo-mark.png). The white tile keeps the
            black outline visible in dark mode too. */}
        <PlainView style={styles.logo}>
          <Image
            source={require("../assets/logo-mark.png")}
            style={styles.logoImage}
            resizeMode="contain"
            accessibilityLabel="LabelLens logo"
          />
        </PlainView>

        <Text style={styles.title}>LabelLens</Text>

        <Text style={styles.subtitle}>
          {t("welcome.subtitle")}
        </Text>
      </View>

      <View style={[styles.content, pageInsets]}>
        <Text style={styles.description}>
          {t("welcome.description")}
        </Text>

        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate("Register")}
        >
          <Text style={styles.createButtonText}>
            {t("common.createAccount")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signInButton}
          onPress={() => navigation.navigate("Login")}
        >
          <Text style={styles.signInButtonText}>
            {t("common.signIn")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.guestButton}
          onPress={continueAsGuest}
        >
          <Text style={styles.guestButtonText}>
            {t("welcome.guest")}
          </Text>
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

  loadingPage: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  hero: {
    height: "46%",
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  circleLeft: {
    position: "absolute",
    width: 125,
    height: 125,
    borderRadius: 100,
    backgroundColor: "#E8F5E9",
    left: -28,
    bottom: 88,
  },

  circleRight: {
    position: "absolute",
    width: 175,
    height: 175,
    borderRadius: 100,
    backgroundColor: "#E8F5E9",
    right: -35,
    top: -30,
  },

  logo: {
    width: 88,
    height: 88,
    borderRadius: 22,
    // Always white (not themed) so the logo keeps its colours.
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  logoImage: {
    width: 70,
    height: 70,
  },


  title: {
    fontSize: 29,
    color: "#17452F",
    fontFamily: "Georgia",
    fontWeight: "500",
  },

  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#17452F",
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
    backgroundColor: "#176B43",
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

  guestButton: {
    minHeight: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#176B43",
    backgroundColor: "#F7F9F7",
    marginTop: 12,
  },

  guestButtonText: {
    color: "#176B43",
    fontSize: 14,
    fontWeight: "700",
  },
});