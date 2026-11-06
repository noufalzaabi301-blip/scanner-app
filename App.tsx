// ---------------------------------------------------------------------------
// App.tsx
// Root of LabelLens: language provider, RTL direction and the navigation
// stack. Route names are part of the app's contract (screens navigate by
// name), so they are kept unchanged; see lib/constants.ts → ROUTES.
// ---------------------------------------------------------------------------

import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AboutLabelLensScreen from "./screens/AboutLabelLensScreen";
import AdminProductSubmissionsScreen from "./screens/AdminProductSubmissionsScreen";
import AvoidListScreen from "./screens/AvoidListScreen";
import ContactUsScreen from "./screens/ContactUsScreen";
import FAQsScreen from "./screens/FAQsScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";
import HomeScreen from "./screens/HomeScreen";
import LoginScreen from "./screens/LoginScreen";
import PreferencesScreen from "./screens/PreferencesScreen";
import PrivacyNoticeScreen from "./screens/PrivacyNoticeScreen";
import ProfileScreen from "./screens/ProfileScreen";
import ProfileSettingsScreen from "./screens/ProfileSettingsScreen";
import RegisterScreen from "./screens/RegisterScreen";
import ResetPasswordScreen from "./screens/ResetPasswordScreen";
import WelcomeScreen from "./screens/WelcomeScreen";

import { useIsAdmin } from "./lib/adminAccess";
import { COLORS, hasAcceptedCurrentPrivacy } from "./lib/constants";
import { supabase } from "./lib/supabase";
import { hasSavedPreferences } from "./lib/userPreferences";
import { I18nProvider, useI18n } from "./lib/i18n";
import { directionProps } from "./lib/rtl";
import { ThemeProvider, remapColor, useAppTheme } from "./lib/theme";

export type RootStackParamList = {
  Login: undefined;
  Welcome: undefined;

  // privacyAccepted is set only by PrivacyNotice after explicit acceptance.
  Register:
    | {
        privacyAccepted?: boolean;
      }
    | undefined;

  ForgotPassword: undefined;
  ResetPassword: undefined;

  PrivacyNotice:
    | {
        fromAppStart?: boolean;
        fromSignup?: boolean;
        fromLogin?: boolean;
        readOnly?: boolean;
      }
    | undefined;

  Preferences:
    | {
        mode?: "edit";
        submitProductsForReview?: boolean;
      }
    | undefined;

  Home: undefined;
  Avoid: undefined;
  Profile: undefined;
  ProfileSettings: undefined;
  FAQs: undefined;
  ContactUs: undefined;
  AboutLabelLens: undefined;

  // Registered only for approved admins.
  AdminProductSubmissions: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type StartRoute = "Login" | "Home" | "Preferences" | "PrivacyNotice";

// Chooses the first screen when the app opens.
// The Supabase session is kept on the device, so after one login or sign-up
// the user goes straight to the Scan (Home) screen on every later launch,
// until they log out. The privacy and first-time-preferences checks still
// apply, so nobody skips them.
async function chooseStartRoute(): Promise<StartRoute> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;

    if (!user) {
      return "Login";
    }

    if (!hasAcceptedCurrentPrivacy(user.user_metadata)) {
      return "PrivacyNotice";
    }

    try {
      return (await hasSavedPreferences(user.id)) ? "Home" : "Preferences";
    } catch {
      // Offline: still open the scanner; preferences load when online.
      return "Home";
    }
  } catch {
    return "Login";
  }
}

// Header and screen backgrounds for the navigation stack.
const LIGHT_NAV_THEME: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.primary,
    background: COLORS.page,
    card: "#FFFFFF",
    text: COLORS.heading,
    border: COLORS.border,
  },
};

const DARK_NAV_THEME: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: remapColor(COLORS.primary, "text") as string,
    background: remapColor(COLORS.page, "background") as string,
    card: remapColor("#FFFFFF", "background") as string,
    text: remapColor(COLORS.heading, "text") as string,
    border: remapColor(COLORS.border, "border") as string,
  },
};

function AppNavigator() {
  const { t, isRTL } = useI18n();
  const rootDirection = directionProps(isRTL ? "rtl" : "ltr");
  const { isDark } = useAppTheme();
  const [startRoute, setStartRoute] = useState<StartRoute | null>(null);

  useEffect(() => {
    let active = true;

    chooseStartRoute().then((route) => {
      if (active) {
        setStartRoute(route);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  // Re-checked automatically on login / logout.
  // Real protection is RLS + the Edge Functions; this only hides the route.
  const { isAdmin } = useIsAdmin();

  if (!startRoute) {
    return (
      <View
        style={[
          styles.root,
          styles.loading,
          {
            backgroundColor: isDark
              ? DARK_NAV_THEME.colors.background
              : COLORS.page,
          },
        ]}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    // Flips the whole layout for Arabic without an app reload (see
    // lib/i18n/index.tsx for why this is used instead of forceRTL, and
    // lib/rtl.ts for the web / phone difference).
    <View
      {...(rootDirection.dir ? ({ dir: rootDirection.dir } as object) : {})}
      style={[styles.root, rootDirection.style]}
    >
      <StatusBar style={isDark ? "light" : "dark"} />

      <NavigationContainer theme={isDark ? DARK_NAV_THEME : LIGHT_NAV_THEME}>
        <Stack.Navigator
          initialRouteName={startRoute}
          screenOptions={{
            headerTintColor: isDark
              ? DARK_NAV_THEME.colors.primary
              : COLORS.primary,
            headerTitleStyle: {
              fontWeight: "700",
            },
          }}
        >
          <Stack.Screen
            name="Welcome"
            component={WelcomeScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ title: t("title.createAccount") }}
          />

          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{ title: t("title.resetPassword") }}
          />

          <Stack.Screen
            name="ResetPassword"
            component={ResetPasswordScreen}
            options={{ title: t("title.resetPassword") }}
          />

          <Stack.Screen
            name="PrivacyNotice"
            component={PrivacyNoticeScreen}
            // Opening the app signed in without accepting the current notice.
            initialParams={
              startRoute === "PrivacyNotice" ? { fromLogin: true } : undefined
            }
            options={({ route }) => ({
              title: t("title.privacyNotice"),
              // First launch: cannot go back past it. Sign-up: going back
              // only returns to the Register form (no account is created).
              headerBackVisible:
                route.params?.readOnly === true ||
                route.params?.fromSignup === true,
              gestureEnabled:
                route.params?.fromAppStart !== true &&
                route.params?.fromLogin !== true,
            })}
          />

          <Stack.Screen
            name="Preferences"
            component={PreferencesScreen}
            options={({ route }) => {
              const isEdit = route.params?.mode === "edit";

              return {
                title: isEdit
                  ? t("title.editPreferences")
                  : t("title.yourPreferences"),
                // First-time setup cannot be skipped with back/swipe.
                headerBackVisible: isEdit,
                gestureEnabled: isEdit,
              };
            }}
          />

          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{
              title: "LabelLens",
              headerBackVisible: false,
            }}
          />

          <Stack.Screen
            name="Avoid"
            component={AvoidListScreen}
            options={{ title: t("title.avoidList") }}
          />

          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ title: t("title.profile") }}
          />

          <Stack.Screen
            name="ProfileSettings"
            component={ProfileSettingsScreen}
            options={{ title: t("title.profileSettings") }}
          />

          <Stack.Screen
            name="FAQs"
            component={FAQsScreen}
            options={{ title: t("title.faqs") }}
          />

          <Stack.Screen
            name="ContactUs"
            component={ContactUsScreen}
            options={{ title: t("title.contactUs") }}
          />

          <Stack.Screen
            name="AboutLabelLens"
            component={AboutLabelLensScreen}
            options={{ title: t("title.about") }}
          />

          {isAdmin ? (
            <Stack.Screen
              name="AdminProductSubmissions"
              component={AdminProductSubmissionsScreen}
              options={{ title: t("title.reviewSubmissions") }}
            />
          ) : null}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <ThemeProvider>
          <AppNavigator />
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  loading: {
    alignItems: "center",
    justifyContent: "center",
  },
});
