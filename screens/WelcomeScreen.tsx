import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { routeAfterSignIn, routeForGuest } from "../lib/postAuthRoute";
import { usePageInsets } from "../lib/layout";
import { supabase } from "../lib/supabase";
import { STORAGE_KEYS } from "../lib/constants";
import { useI18n } from "../lib/i18n";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  // Plain (un-themed) View: the logo tile stays white in dark mode.
  View as PlainView,
} from "react-native";
import LanguageSwitch from "../components/LanguageSwitch";
import {
  // Safe-area padding on iOS AND Android (the plain React Native
  // SafeAreaView only pads on iOS), so the language switch at the top is
  // never under the status bar / notch.
  ContextSafeAreaView as SafeAreaView,
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
    // effects twice; without the guard both runs could navigate twice.
    let cancelled = false;

    // The Privacy Notice is NOT shown here: it comes only after Login /
    // Create account or after "Continue as guest" (lib/postAuthRoute.ts).
    async function chooseStartScreen() {
      try {
        const hasOpenedBefore =
          await AsyncStorage.getItem(HAS_OPENED_KEY);

        if (cancelled) {
          return;
        }

        // First Welcome visit on this device.
        if (!hasOpenedBefore) {
          await AsyncStorage.setItem(HAS_OPENED_KEY, "true");
          setCheckingStart(false);
          return;
        }

        // Later openings: a signed-in user continues (Privacy Notice if
        // not accepted yet, first-time setup, or the scanner).
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user && !cancelled) {
          const next = await routeAfterSignIn(session.user);

          if (!cancelled) {
            navigation.reset({ index: 0, routes: [next] });
          }
          return;
        }

        if (!cancelled) {
          setCheckingStart(false);
        }
      } catch {
        if (!cancelled) {
          setCheckingStart(false);
        }
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

    // Privacy Notice first (only if this version was not accepted on this
    // device yet), then the guest allergy + halal setup. Welcome stays
    // underneath, so Back returns here.
    const next = await routeForGuest();
    navigation.navigate(next.name, next.params);
  }

  if (checkingStart) {
    return (
      <SafeAreaView style={styles.loadingPage} edges={["top", "bottom"]}>
        <ActivityIndicator size="large" color="#176B43" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
      <View style={styles.hero}>
        <View style={styles.circleLeft} />
        <View style={styles.circleRight} />

        {/* English / العربية selector: in the normal layout flow (not
            absolute), above the decorative circles, so it is never hidden
            or pushed off-screen. Same saved setting as Login, Register and
            Profile → Language. */}
        <View style={[styles.topBar, pageInsets]}>
          <LanguageSwitch style={styles.languageSwitch} />
        </View>

        <View style={styles.heroBody}>
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
    minHeight: 250,
    backgroundColor: "#E8F5E9",
    overflow: "hidden",
  },

  topBar: {
    width: "100%",
    paddingTop: 10,
    zIndex: 2, // above the decorative circles
  },

  languageSwitch: {
    marginBottom: 0,
  },

  heroBody: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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