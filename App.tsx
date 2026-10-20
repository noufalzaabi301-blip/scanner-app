// Manages navigation between all application screens.
import { NavigationContainer } from "@react-navigation/native";

// Provides mobile-style stack navigation.
import { createNativeStackNavigator } from "@react-navigation/native-stack";

// Provides safe-area support on phones.
import { SafeAreaProvider } from "react-native-safe-area-context";

// Application screens.
import PrivacyNoticeScreen from "./screens/PrivacyNoticeScreen";
import PreferencesScreen from "./screens/PreferencesScreen";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";
import ResetPasswordScreen from "./screens/ResetPasswordScreen";
import HomeScreen from "./screens/HomeScreen";

// Defines the valid navigation routes and their parameters.
export type RootStackParamList = {
  // The app opens at Login while testing.
  Login: undefined;

  // Registration may receive privacy confirmation.
  Register:
    | {
        privacyAccepted?: boolean;
      }
    | undefined;

  // Password recovery screens.
  ForgotPassword: undefined;
  ResetPassword: undefined;

  // Privacy page can be opened in different situations.
  PrivacyNotice:
    | {
        fromAppStart?: boolean;
        fromSignup?: boolean;
        readOnly?: boolean;
      }
    | undefined;

  // Preferences can be opened for first-time setup or editing.
  Preferences:
    | {
        mode?: "edit";
      }
    | undefined;

  // Main scanning screen.
  Home: undefined;
};

// Creates the typed navigation stack.
const Stack =
  createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          // Opens the login screen first while testing.
          initialRouteName="Login"
          screenOptions={{
            headerTintColor: "#176B43",
            headerTitleStyle: {
              fontWeight: "700",
            },
          }}
        >
          {/* Login screen. */}
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{
              headerShown: false,
            }}
          />

          {/* Registration screen. */}
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{
              title: "Create account",
            }}
          />

          {/* Forgot-password screen. */}
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{
              title: "Reset password",
            }}
          />

          {/* New-password screen opened from the reset link. */}
          <Stack.Screen
            name="ResetPassword"
            component={ResetPasswordScreen}
            options={{
              title: "Reset password",
            }}
          />

          {/* Privacy notice screen. */}
          <Stack.Screen
            name="PrivacyNotice"
            component={PrivacyNoticeScreen}
            options={({ route }) => ({
              title: "Privacy Notice",

              // The page can go back only when opened in read-only mode.
              headerBackVisible:
                route.params?.readOnly === true,
            })}
          />

          {/* Allergy and halal preferences screen. */}
          <Stack.Screen
            name="Preferences"
            component={PreferencesScreen}
            options={({ route }) => {
              // Edit mode is opened from the Home allergy banner.
              const isEdit =
                route.params?.mode === "edit";

              return {
                title: isEdit
                  ? "Edit preferences"
                  : "Your preferences",

                // First-time setup cannot go back.
                // Edit mode can go back to Home.
                headerBackVisible: isEdit,
                gestureEnabled: isEdit,
              };
            }}
          />

          {/* Main Home and barcode-scanning screen. */}
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{
              title: "LabelLens",

              // Users should not return to setup with the header arrow.
              headerBackVisible: false,
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}