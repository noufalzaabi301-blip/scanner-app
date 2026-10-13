import { NavigationContainer } from "@react-navigation/native";
import PrivacyNoticeScreen from "./screens/PrivacyNoticeScreen";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import PreferencesScreen from "./screens/PreferencesScreen";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";
import HomeScreen from "./screens/HomeScreen";
import WelcomeScreen from "./screens/WelcomeScreen";
import ResetPasswordScreen from "./screens/ResetPasswordScreen";
import ProfileScreen from "./screens/ProfileScreen";
import ProfileSettingsScreen from "./screens/ProfileSettingsScreen";

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: { privacyAccepted?: boolean } | undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
  PrivacyNotice:
    | {
        readOnly?: boolean;
        fromSignup?: boolean;
      }
    | undefined;
  Preferences: undefined;
  Home: undefined;
  Profile: undefined;
  ProfileSettings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const linking = {
  prefixes: ["http://localhost:8081"],
  config: {
    screens: {
      ResetPassword: "reset-password",
    },
  },
};
export default function App() {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName="Welcome"
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
  name="Profile"
  component={ProfileScreen}
  options={{ headerShown: false }}
/>
<Stack.Screen
  name="ProfileSettings"
  component={ProfileSettingsScreen}
  options={{ title: "Profile settings" }}
/>
        <Stack.Screen
  name="Login"
  component={LoginScreen}
  options={{ title: "Back" }}
/>

        <Stack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ title: "Back" }}
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
    headerBackVisible: route.params?.readOnly === true,
  })}
/>

<Stack.Screen
  name="Preferences"
  component={PreferencesScreen}
  options={{
    title: "Your preferences",
    headerBackVisible: false,
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
       
      </Stack.Navigator>
    </NavigationContainer>
  );
}