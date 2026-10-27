import { useEffect, useRef, useState } from "react";

import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { supabase } from "./lib/supabase";

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

type ProductResult = {
  barcode: string | null;
  brand: string;
  productName: string;
  variant: string;
  ingredients: string;
  contains: string;
  mayContain: string;
  frontPhotoUri?: string | null;
  ingredientsPhotoUri?: string | null;
  source?: string;
};

export type RootStackParamList = {
  Login: undefined;
  Welcome: undefined;

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
        readOnly?: boolean;
      }
    | undefined;

  Preferences:
    | {
        mode?: "edit";
      }
    | undefined;

  Home: undefined;
  Profile: undefined;
  ProfileSettings: undefined;
  Avoid: undefined;

  AnalysisResults: {
    product: ProductResult;
  };
};

const Stack =
  createNativeStackNavigator<RootStackParamList>();

function showMessage(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function AnalysisResultsScreen({
  route,
}: any) {
  const { product } = route.params as {
    product: ProductResult;
  };

  const scrollRef = useRef<ScrollView>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: 0,
        animated: false,
      });
    });
  }, []);

  async function addToAvoidList() {
    if (saving || saved) {
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        showMessage(
          "Login required",
          "Please log in before saving products."
        );
        return;
      }

      const { error } = await supabase
        .from("avoid_list")
        .insert({
          user_id: user.id,
          barcode: product.barcode || null,
          product_name: product.productName || "",
          brand_name: product.brand || "",
          variant: product.variant || "",
          ingredients_text: product.ingredients || "",
          contains_text: product.contains || "",
          may_contain_text: product.mayContain || "",
          save_reason:
            product.contains ||
            product.mayContain ||
            "Saved from product analysis",
          source: product.source || "LabelLens",
        });

      if (error) {
        throw error;
      }

      setSaved(true);

      showMessage(
        "Added successfully",
        "This product was added to your Avoid List."
      );
    } catch (error: any) {
      console.error("Avoid List insert error:", error);

      showMessage(
        "Could not add product",
        error?.message ||
          "The product could not be added. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.title}>
          Product analysis
        </Text>

        <Text style={styles.subtitle}>
          Review the screening result before saving this
          product.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Brand</Text>
          <Text style={styles.value}>
            {product.brand || "Not available"}
          </Text>

          <Text style={styles.label}>Product</Text>
          <Text style={styles.value}>
            {product.productName || "Not available"}
          </Text>

          {product.variant ? (
            <>
              <Text style={styles.label}>Variant</Text>
              <Text style={styles.value}>
                {product.variant}
              </Text>
            </>
          ) : null}

          <Text style={styles.label}>Ingredients</Text>
          <Text style={styles.value}>
            {product.ingredients || "Not available"}
          </Text>

          <Text style={styles.label}>Contains</Text>
          <Text style={styles.value}>
            {product.contains || "None detected"}
          </Text>

          <Text style={styles.label}>May contain</Text>
          <Text style={styles.value}>
            {product.mayContain || "None detected"}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.avoidButton,
            saved && styles.savedButton,
          ]}
          onPress={addToAvoidList}
          disabled={saving || saved}
          activeOpacity={0.8}
        >
          <Text style={styles.avoidButtonText}>
            {saving
              ? "Adding..."
              : saved
                ? "Added to My Avoid List"
                : "Add to My Avoid List"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.warning}>
          LabelLens is a screening tool. Always check the
          physical package and official certification.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function AnalysisResultsPlaceholder() {
  return null;
}

export default function App() {
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
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{
              title: "Create account",
            }}
          />

          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{
              title: "Reset password",
            }}
          />

          <Stack.Screen
            name="ResetPassword"
            component={ResetPasswordScreen}
            options={{
              title: "Reset password",
            }}
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
            name="AnalysisResults"
            component={AnalysisResultsScreen}
            options={{
              title: "Analysis Results",
            }}
          />

          <Stack.Screen
            name="Avoid"
            component={AvoidListScreen}
            options={{
              title: "My Avoid List",
            }}
          />

          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{
              title: "Profile",
            }}
          />

          <Stack.Screen
            name="ProfileSettings"
            component={ProfileSettingsScreen}
            options={{
              title: "Profile settings",
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F8FBF8",
  },

  content: {
    padding: 20,
    paddingBottom: 45,
  },

  title: {
    color: "#176B43",
    fontSize: 27,
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
    marginTop: 13,
    marginBottom: 5,
  },

  value: {
    color: "#1D3829",
    fontSize: 14,
    lineHeight: 21,
  },

  avoidButton: {
    minHeight: 52,
    borderRadius: 13,
    backgroundColor: "#258D4D",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },

  savedButton: {
    backgroundColor: "#176B43",
  },

  avoidButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  warning: {
    color: "#63776B",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 20,
  },
});