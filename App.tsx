import { NavigationContainer } from "@react-navigation/native";
import PrivacyNoticeScreen from "./screens/PrivacyNoticeScreen";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import PreferencesScreen from "./screens/PreferencesScreen";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";
import HomeScreen from "./screens/HomeScreen";
import WelcomeScreen from "./screens/WelcomeScreen";

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  PrivacyNotice: undefined;
  Preferences: undefined;
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
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
  name="PrivacyNotice"
  component={PrivacyNoticeScreen}
  options={{
    title: "Privacy Notice",
    headerBackVisible: false,
  }}
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