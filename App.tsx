// NavigationContainer manages navigation between all application screens.
import { NavigationContainer } from "@react-navigation/native";

// Native stack navigation provides mobile-style screen navigation.
import { createNativeStackNavigator } from "@react-navigation/native-stack";

// React Native components used by the temporary results screen.
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

// Application screens.
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
import LabelReviewScreen from "./screens/LabelReviewScreen";
import AvoidScreen from "./screens/AvoidScreen";

// Defines the parameters allowed for every navigation route.
export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: { privacyAccepted?: boolean } | undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
  Avoid: undefined;

  PrivacyNotice:
    | {
        // Used when the privacy notice opens during app startup.
        fromAppStart?: boolean;

        // Used when the privacy notice opens before registration.
        fromSignup?: boolean;

        // Allows the user to return from a read-only privacy page.
        readOnly?: boolean;
      }
    | undefined;

  Preferences: undefined;
  Home: undefined;
  Profile: undefined;
  ProfileSettings: undefined;

  // Data passed from HomeScreen to the editable review screen.
  LabelReview: {
    barcode: string | null;
    frontPhotoUri: string;
    ingredientsPhotoUri: string;
    extraction: {
      brand: string;
      product_name: string;
      variant: string;
      ingredients: string;
      contains: string;
      may_contain: string;
      unclear_text: string;
      confidence: "high" | "medium" | "low";
    };
  };

  // Confirmed product data passed to the results screen.
  AnalysisResults: {
    product: {
      barcode: string | null;
      brand: string;
      productName: string;
      variant: string;
      ingredients: string;
      contains: string;
      mayContain: string;
      frontPhotoUri: string;
      ingredientsPhotoUri: string;
      source: string;
    };
  };
};

// Creates the typed navigation stack.
const Stack = createNativeStackNavigator<RootStackParamList>();

// Allows password-reset links to open the ResetPassword screen.
const linking = {
  prefixes: ["http://localhost:8081", "exp://"],
  config: {
    screens: {
      ResetPassword: "reset-password",
    },
  },
};

// Temporary results screen.
function AnalysisResultsScreen({ route }: any) {
  // Read the confirmed product information.
  const { product } = route.params;

  return (
    <SafeAreaView style={resultsStyles.page}>
      <ScrollView contentContainerStyle={resultsStyles.content}>
        {/* Results screen heading. */}
        <Text style={resultsStyles.title}>
          Product information confirmed
        </Text>

        {/* Explains the current stage of development. */}
        <Text style={resultsStyles.subtitle}>
          The information was reviewed and confirmed. Allergy and halal
          screening will use this data.
        </Text>

        {/* Shows the confirmed product details. */}
        <View style={resultsStyles.card}>
          <Text style={resultsStyles.label}>Brand</Text>

          <Text style={resultsStyles.value}>
            {product.brand || "Not available"}
          </Text>

          <Text style={resultsStyles.label}>Product</Text>

          <Text style={resultsStyles.value}>
            {product.productName || "Not available"}
          </Text>

          <Text style={resultsStyles.label}>Ingredients</Text>

          <Text style={resultsStyles.value}>
            {product.ingredients || "Not available"}
          </Text>

          <Text style={resultsStyles.label}>Contains</Text>

          <Text style={resultsStyles.value}>
            {product.contains || "None extracted"}
          </Text>

          <Text style={resultsStyles.label}>May contain</Text>

          <Text style={resultsStyles.value}>
            {product.mayContain || "None extracted"}
          </Text>
        </View>

        {/* Safety message shown until screening logic is connected. */}
        <Text style={resultsStyles.notice}>
          Do not treat this screen as proof that the product is safe or
          halal-certified. Always check the physical package.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// Shared navigation styles.
const navigationStyles = StyleSheet.create({
  headerTitle: {
    fontWeight: "700",
  },
});

// Temporary results-screen styles.
const resultsStyles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F8FBF8",
  },

  content: {
    padding: 22,
    paddingBottom: 40,
  },

  title: {
    color: "#176B43",
    fontSize: 25,
    fontWeight: "800",
    marginBottom: 8,
  },

  subtitle: {
    color: "#63776B",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
  },

  label: {
    color: "#63776B",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 5,
  },

  value: {
    color: "#1D3829",
    fontSize: 14,
    lineHeight: 21,
  },

  notice: {
    color: "#63776B",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 20,
  },
});

// Main application component.
export default function App() {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          headerTintColor: "#176B43",
          headerTitleStyle: navigationStyles.headerTitle,
        }}
      >
        {/* First screen shown when the app opens. */}
        <Stack.Screen
          name="Welcome"
          component={WelcomeScreen}
          options={{ headerShown: false }}
        />

        {/* Authentication screens. */}
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

        {/* Privacy and preference screens. */}
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

        {/* Main Home/Scan screen. */}
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{
            title: "LabelLens",
            headerBackVisible: false,
          }}
        />

        {/* User profile screens. */}
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

        {/* Editable AI extraction review screen. */}
        <Stack.Screen
          name="LabelReview"
          component={LabelReviewScreen}
          options={{ title: "Review Label" }}
        />

        {/* Temporary results screen. */}
        <Stack.Screen
          name="AnalysisResults"
          component={AnalysisResultsScreen}
          options={{ title: "Analysis Results" }}
        />
      </Stack.Navigator>
      <Stack.Screen
  name="Avoid"
  component={AvoidScreen}
  options={{ headerShown: false }}
/>
    </NavigationContainer>
  );
}