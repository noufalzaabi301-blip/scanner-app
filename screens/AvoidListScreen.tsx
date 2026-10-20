// Loads React state and callback helpers.
import { useCallback, useState } from "react";

// Reloads the Avoid List whenever the screen opens.
import { useFocusEffect } from "@react-navigation/native";

// React Native components.
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// User Supabase database.
import { supabase } from "../lib/supabase";

// One saved Avoid List product.
type AvoidItem = {
  id: string;
  product_name: string;
  brand_name: string;
  ingredients_text: string;
  save_reason: string;
};

export default function AvoidListScreen({ navigation }: any) {
  // Stores the products saved by the current user.
  const [items, setItems] = useState<AvoidItem[]>([]);

  // Shows loading while the database is queried.
  const [loading, setLoading] = useState(true);

  // Loads only this user's Avoid List records.
  const loadAvoidList = useCallback(async () => {
    setLoading(true);

    try {
      // Get the currently signed-in user.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Require authentication before reading saved products.
      if (!user) {
        Alert.alert(
          "Login required",
          "Please log in to view your Avoid List."
        );
        return;
      }

      // Read only records belonging to the signed-in user.
      const { data, error } = await supabase
        .from("avoid_list")
        .select(
          "id, product_name, brand_name, ingredients_text, save_reason"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      // Stop if Supabase returns an error.
      if (error) {
        throw error;
      }

      // Store the returned products.
      setItems((data ?? []) as AvoidItem[]);
    } catch {
      // Show a friendly message without exposing technical details.
      Alert.alert(
        "Could not load Avoid List",
        "Please try again."
      );
    } finally {
      // Stop the loading indicator.
      setLoading(false);
    }
  }, []);

  // Reload the list whenever the user opens this screen.
  useFocusEffect(
    useCallback(() => {
      loadAvoidList();
    }, [loadAvoidList])
  );

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Screen title. */}
        <Text style={styles.title}>My Avoid List</Text>

        {/* Short explanation. */}
        <Text style={styles.subtitle}>
          Products you saved for future reference.
        </Text>

        {/* Loading state. */}
        {loading && (
          <ActivityIndicator
            size="large"
            color="#258D4D"
          />
        )}

        {/* Empty state. */}
        {!loading && items.length === 0 && (
          <Text style={styles.emptyText}>
            No products have been added yet.
          </Text>
        )}

        {/* Saved products. */}
        {!loading &&
          items.map((item) => (
            <View
              key={item.id}
              style={styles.card}
            >
              <Text style={styles.productName}>
                {item.product_name || "Unnamed product"}
              </Text>

              <Text style={styles.brandName}>
                {item.brand_name || "Brand unavailable"}
              </Text>

              {item.save_reason ? (
                <Text style={styles.reason}>
                  {item.save_reason}
                </Text>
              ) : null}

              <Text style={styles.ingredients}>
                {item.ingredients_text ||
                  "Ingredients unavailable"}
              </Text>
            </View>
          ))}

        {/* Return to the scanning screen. */}
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => navigation.navigate("Home")}
          activeOpacity={0.8}
        >
          <Text style={styles.scanButtonText}>
            Scan another product
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// Screen styles.
const styles = StyleSheet.create({
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
    fontSize: 27,
    fontWeight: "800",
  },

  subtitle: {
    color: "#63776B",
    fontSize: 14,
    marginTop: 7,
    marginBottom: 20,
  },

  emptyText: {
    color: "#63776B",
    textAlign: "center",
    marginTop: 30,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },

  productName: {
    color: "#163D2A",
    fontSize: 17,
    fontWeight: "800",
  },

  brandName: {
    color: "#63776B",
    fontSize: 13,
    marginTop: 4,
  },

  reason: {
    color: "#A33B2B",
    fontSize: 13,
    marginTop: 10,
  },

  ingredients: {
    color: "#1D3829",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },

  scanButton: {
    backgroundColor: "#258D4D",
    borderRadius: 12,
    minHeight: 50,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 18,
  },

  scanButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
});