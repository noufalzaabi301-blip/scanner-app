import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import PrivacyNoticeScreen from "./screens/PrivacyNoticeScreen";
import PreferencesScreen from "./screens/PreferencesScreen";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";
import ResetPasswordScreen from "./screens/ResetPasswordScreen";
import HomeScreen from "./screens/HomeScreen";
import WelcomeScreen from "./screens/WelcomeScreen";
import ProfileScreen from "./screens/ProfileScreen";
import ProfileSettingsScreen from "./screens/ProfileSettingsScreen";
import AvoidListScreen from "./screens/AvoidListScreen";
import FAQsScreen from "./screens/FAQsScreen";
import ContactUsScreen from "./screens/ContactUsScreen";
import AdminProductSubmissionsScreen from "./screens/AdminProductSubmissionsScreen";

import { useIsAdmin } from "./lib/adminAccess";

export type RootStackParamList = {
  Login: undefined;
  Welcome: undefined;

  Register:
    | {
        privacyAccepted?: boolean;
        submitProductsForReview?: boolean;
      }
    | undefined;

  ForgotPassword: undefined;
  ResetPassword: undefined;

  PrivacyNotice:
    | {
        fromAppStart?: boolean;
        fromSignup?: boolean;
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

const Stack =
  createNativeStackNavigator<RootStackParamList>();

function AboutLabelLensScreen() {
  return (
    <SafeAreaView style={styles.aboutPage}>
      <View style={styles.aboutContent}>
        <Text style={styles.aboutTitle}>
          About LabelLens
        </Text>

        <Text style={styles.aboutText}>
          LabelLens helps users review food products
          against their allergy and halal preferences.
        </Text>

        <Text style={styles.aboutVersion}>
          Version 1.0.0
        </Text>

        <Text style={styles.aboutNotice}>
          LabelLens provides screening support only.
          Always check the physical product package.
        </Text>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  // Re-checked automatically on login / logout.
  // Real protection is RLS + the Edge Functions; this only hides the route.
  const { isAdmin } = useIsAdmin();

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerTintColor: "#176B43",
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
            options={{ title: "Create account" }}
          />

          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{ title: "Reset password" }}
          />

          <Stack.Screen
            name="ResetPassword"
            component={ResetPasswordScreen}
            options={{ title: "Reset password" }}
          />

          <Stack.Screen
            name="PrivacyNotice"
            component={PrivacyNoticeScreen}
            options={({ route }) => ({
              title: "Privacy Notice",
              headerBackVisible:
                route.params?.readOnly === true,
            })}
          />

          <Stack.Screen
            name="Preferences"
            component={PreferencesScreen}
            options={({ route }) => {
              const isEdit =
                route.params?.mode === "edit";

              return {
                title: isEdit
                  ? "Edit preferences"
                  : "Your preferences",
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
            options={{ title: "My Avoid List" }}
          />

          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ title: "Profile" }}
          />

          <Stack.Screen
            name="ProfileSettings"
            component={ProfileSettingsScreen}
            options={{ title: "Profile settings" }}
          />

          <Stack.Screen
            name="FAQs"
            component={FAQsScreen}
            options={{ title: "FAQs" }}
          />

          <Stack.Screen
            name="ContactUs"
            component={ContactUsScreen}
            options={{ title: "Contact Us" }}
          />

          <Stack.Screen
            name="AboutLabelLens"
            component={AboutLabelLensScreen}
            options={{ title: "About LabelLens" }}
          />

          {isAdmin ? (
            <Stack.Screen
              name="AdminProductSubmissions"
              component={AdminProductSubmissionsScreen}
              options={{ title: "Review submissions" }}
            />
          ) : null}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  aboutPage: {
    flex: 1,
    backgroundColor: "#F8FBF8",
  },

  aboutContent: {
    padding: 22,
  },

  aboutTitle: {
    color: "#176B43",
    fontSize: 25,
    fontWeight: "800",
    marginBottom: 15,
  },

  aboutText: {
    color: "#1D3829",
    fontSize: 15,
    lineHeight: 23,
  },

  aboutVersion: {
    color: "#63776B",
    fontSize: 13,
    marginTop: 20,
  },

  aboutNotice: {
    color: "#63776B",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 30,
  },
});