// Manages navigation between application screens.
import { NavigationContainer } from "@react-navigation/native";

// Provides mobile-style stack navigation.
import { createNativeStackNavigator } from "@react-navigation/native-stack";

// Provides safe-area support for mobile devices.
import { SafeAreaProvider } from "react-native-safe-area-context";

// Application screens.
import PrivacyNoticeScreen from "./screens/PrivacyNoticeScreen";
import PreferencesScreen from "./screens/PreferencesScreen";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";
import ResetPasswordScreen from "./screens/ResetPasswordScreen";
import HomeScreen from "./screens/HomeScreen";

// Screens added by the other project branch.
import WelcomeScreen from "./screens/WelcomeScreen";
import ProfileScreen from "./screens/ProfileScreen";
import ProfileSettingsScreen from "./screens/ProfileSettingsScreen";
import AvoidScreen from "./screens/AvoidScreen";

// Defines all valid navigation routes.
export type RootStackParamList = {
  // The app opens at Login while testing.
  Login: undefined;

  // Welcome screen remains available if needed later.
  Welcome: undefined;

  // Registration can receive privacy confirmation.
  Register:
    | {
        privacyAccepted?: boolean;
      }
    | undefined;

  // Password recovery routes.
  ForgotPassword: undefined;
  ResetPassword: undefined;

  // Privacy notice parameters.
  PrivacyNotice:
    | {
        fromAppStart?: boolean;
        fromSignup?: boolean;
        readOnly?: boolean;
      }
    | undefined;

  // Preferences can be opened for setup or editing.
  Preferences:
    | {
        mode?: "edit";
      }
    | undefined;

  // Main scanning screen.
  Home: undefined;

  // Profile-related routes.
  Profile: undefined;
  ProfileSettings: undefined;

  // Avoid List route.
  Avoid: undefined;
};

// Creates the typed navigation stack.
const Stack =
  createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          // Opens Login first while testing.
          initialRouteName="Login"
          screenOptions={{
            headerTintColor: "#176B43",
            headerTitleStyle: {
              fontWeight: "700",
            },
          }}
        >
          {/* Welcome screen. */}
          <Stack.Screen
            name="Welcome"
            component={WelcomeScreen}
            options={{
              headerShown: false,
            }}
          />

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

              // Read-only privacy pages can use the back arrow.
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

                // Setup cannot go backward.
                // Editing can return to Home.
                headerBackVisible: isEdit,
                gestureEnabled: isEdit,
              };
            }}
          />

          {/* Main Home and scanning screen. */}
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{
              title: "LabelLens",
              headerBackVisible: false,
            }}
          />

          {/* Profile screen kept for the other project branch. */}
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{
              title: "Profile",
            }}
          />

          {/* Profile settings screen. */}
          <Stack.Screen
            name="ProfileSettings"
            component={ProfileSettingsScreen}
            options={{
              title: "Profile settings",
            }}
          />

          {/* Avoid List screen kept for future use. */}
          <Stack.Screen
            name="Avoid"
            component={AvoidScreen}
            options={{
              title: "My Avoid List",
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}