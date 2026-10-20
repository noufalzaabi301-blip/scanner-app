import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { supabase } from "../lib/supabase";

type AvoidItem = {
  id?: string;
  barcode?: string | null;
  product_name?: string | null;
  brand_name?: string | null;
  variant?: string | null;
  save_reason?: string | null;
};

export default function AvoidScreen({ navigation }: any) {
  const [items, setItems] = useState<AvoidItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadAvoidList() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsGuest(true);
        setItems([]);
        return;
      }

      setIsGuest(false);

      const { data, error } = await supabase
        .from("avoid_list")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      setItems(data || []);
    } catch {
      setErrorMessage(
        "Your Avoid List could not be loaded. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAvoidList();
  }, []);

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>My Avoid List</Text>
        <Text style={styles.subtitle}>
          Products you saved after screening.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading && (
          <ActivityIndicator size="large" color="#258D4D" />
        )}

        {!loading && isGuest && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              Sign in to use your Avoid List
            </Text>

            <Text style={styles.emptyText}>
              Create an account or sign in to save and review products.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate("Login")}
            >
              <Text style={styles.primaryButtonText}>Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate("Register")}
            >
              <Text style={styles.secondaryButtonText}>
                Create Account
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !isGuest && errorMessage ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Could not load list</Text>
            <Text style={styles.emptyText}>{errorMessage}</Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={loadAvoidList}
            >
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {!loading &&
          !isGuest &&
          !errorMessage &&
          items.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                No saved products yet
              </Text>

              <Text style={styles.emptyText}>
                Scan a product and choose “Add to My Avoid List” to save it here.
              </Text>
            </View>
          )}

        {!loading &&
          !isGuest &&
          !errorMessage &&
          items.map((item, index) => (
            <View
              key={item.id || item.barcode || String(index)}
              style={styles.productCard}
            >
              <Text style={styles.productName}>
                {item.product_name || "Unnamed product"}
              </Text>

              {!!item.brand_name && (
                <Text style={styles.brandName}>
                  {item.brand_name}
                </Text>
              )}

              {!!item.variant && (
                <Text style={styles.variant}>
                  {item.variant}
                </Text>
              )}

              {!!item.save_reason && (
                <Text style={styles.reason}>
                  {item.save_reason}
                </Text>
              )}
            </View>
          ))}
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("Home")}
        >
          <Text style={styles.navIcon}>▣</Text>
          <Text style={styles.navText}>Scan</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Text style={[styles.navIcon, styles.activeNavIcon]}>
            ▤
          </Text>
          <Text style={[styles.navText, styles.activeNavText]}>
            Avoid
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate("Profile")}
        >
          <Text style={styles.navIcon}>♙</Text>
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F8FBF8",
  },

  header: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 12,
  },

  title: {
    color: "#176B43",
    fontSize: 28,
    fontWeight: "800",
  },

  subtitle: {
    color: "#63776B",
    fontSize: 14,
    marginTop: 6,
  },

  content: {
    flexGrow: 1,
    padding: 20,
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 22,
    alignItems: "center",
  },

  emptyTitle: {
    color: "#163D2A",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },

  emptyText: {
    color: "#63776B",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
  },

  primaryButton: {
    width: "100%",
    minHeight: 48,
    backgroundColor: "#258D4D",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  secondaryButton: {
    width: "100%",
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#258D4D",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },

  secondaryButtonText: {
    color: "#258D4D",
    fontWeight: "800",
  },

  productCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },

  productName: {
    color: "#163D2A",
    fontSize: 17,
    fontWeight: "800",
  },

  brandName: {
    color: "#258D4D",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 5,
  },

  variant: {
    color: "#63776B",
    fontSize: 13,
    marginTop: 4,
  },

  reason: {
    color: "#63776B",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },

  bottomNav: {
    minHeight: 70,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#DDE7E0",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },

  navItem: {
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },

  navIcon: {
    color: "#76857C",
    fontSize: 21,
  },

  activeNavIcon: {
    color: "#176B43",
  },

  navText: {
    color: "#76857C",
    fontSize: 12,
    marginTop: 3,
  },

  activeNavText: {
    color: "#176B43",
    fontWeight: "700",
  },
});