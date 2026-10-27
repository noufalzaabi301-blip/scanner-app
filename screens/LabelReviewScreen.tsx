import { useState } from "react";

import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import type { LabelExtraction } from "../lib/labelExtraction";

type ReviewRouteParams = {
  barcode: string | null;
  frontPhotoUri: string;
  ingredientsPhotoUri: string;
  extraction: LabelExtraction;
};

export default function LabelReviewScreen({
  navigation,
  route,
}: any) {
  const {
    barcode,
    frontPhotoUri,
    ingredientsPhotoUri,
    extraction,
  } = route.params as ReviewRouteParams;

  const [brand, setBrand] = useState(
    extraction?.brand ?? ""
  );

  const [productName, setProductName] = useState(
    extraction?.product_name ?? ""
  );

  const [variant, setVariant] = useState(
    extraction?.variant ?? ""
  );

  const [ingredients, setIngredients] = useState(
    extraction?.ingredients ?? ""
  );

  const [contains, setContains] = useState(
    extraction?.contains ?? ""
  );

  const [mayContain, setMayContain] = useState(
    extraction?.may_contain ?? ""
  );

  // Supports both an array and an older string response.
  const unclearItems: string[] = Array.isArray(
    extraction?.unclear_text
  )
    ? extraction.unclear_text
        .map((item) => String(item).trim())
        .filter(Boolean)
    : extraction?.unclear_text
      ? String(extraction.unclear_text)
          .split(/[,;\n]+/)
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  function confirmAndAnalyze() {
    if (!ingredients.trim()) {
      Alert.alert(
        "Ingredients required",
        "Please review the ingredient list before continuing."
      );
      return;
    }

    const confirmedProduct = {
      barcode: barcode ?? null,
      brand: brand.trim(),
      productName: productName.trim(),
      variant: variant.trim(),
      ingredients: ingredients.trim(),
      contains: contains.trim(),
      mayContain: mayContain.trim(),
      frontPhotoUri,
      ingredientsPhotoUri,
      source: "AI photo extraction",
    };

    Alert.alert(
      "Information confirmed",
      "The product is ready for allergy and halal analysis.",
      [
        {
          text: "Analyze",
          onPress: () => {
            navigation.navigate("AnalysisResults", {
              product: confirmedProduct,
            });
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>
          Review product information
        </Text>

        <Text style={styles.subtitle}>
          Please check the information extracted from the package
          photos. Edit anything that looks incorrect.
        </Text>

        <Text style={styles.sectionTitle}>
          Front-package photo
        </Text>

        <Image
          source={{ uri: frontPhotoUri }}
          style={styles.photo}
        />

        <Text style={styles.sectionTitle}>
          Ingredient-label photo
        </Text>

        <Image
          source={{ uri: ingredientsPhotoUri }}
          style={styles.photo}
        />

        <View style={styles.confidenceBox}>
          <Text style={styles.confidenceLabel}>
            AI confidence
          </Text>

          <Text style={styles.confidenceValue}>
            {extraction?.confidence ?? "low"}
          </Text>
        </View>

        {unclearItems.length > 0 && (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>
              Please check these unclear items
            </Text>

            <Text style={styles.warningText}>
              {unclearItems.map((item, index) => (
                <Text key={`${item}-${index}`}>
                  {item}
                  {index < unclearItems.length - 1
                    ? "\n"
                    : ""}
                </Text>
              ))}
            </Text>
          </View>
        )}

        <Text style={styles.label}>Brand</Text>

        <TextInput
          style={styles.input}
          value={brand}
          onChangeText={setBrand}
          placeholder="Brand name"
          placeholderTextColor="#AAB8AE"
        />

        <Text style={styles.label}>Product name</Text>

        <TextInput
          style={styles.input}
          value={productName}
          onChangeText={setProductName}
          placeholder="Product name"
          placeholderTextColor="#AAB8AE"
        />

        <Text style={styles.label}>Variant</Text>

        <TextInput
          style={styles.input}
          value={variant}
          onChangeText={setVariant}
          placeholder="Variant or flavor"
          placeholderTextColor="#AAB8AE"
        />

        <Text style={styles.label}>Ingredients</Text>

        <TextInput
          style={styles.largeInput}
          value={ingredients}
          onChangeText={setIngredients}
          placeholder="Complete ingredient list"
          placeholderTextColor="#AAB8AE"
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>Contains</Text>

        <TextInput
          style={styles.input}
          value={contains}
          onChangeText={setContains}
          placeholder="Contains allergens"
          placeholderTextColor="#AAB8AE"
        />

        <Text style={styles.label}>May contain</Text>

        <TextInput
          style={styles.input}
          value={mayContain}
          onChangeText={setMayContain}
          placeholder="May contain allergens"
          placeholderTextColor="#AAB8AE"
        />

        <TouchableOpacity
          style={styles.confirmButton}
          onPress={confirmAndAnalyze}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmButtonText}>
            Confirm and Analyze
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.retakeButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Text style={styles.retakeButtonText}>
            Retake Photos
          </Text>
        </TouchableOpacity>

        <Text style={styles.note}>
          Always compare the extracted information with the
          physical package before confirming.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F8FBF8",
  },

  content: {
    padding: 22,
    paddingBottom: 45,
  },

  title: {
    color: "#176B43",
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 8,
  },

  subtitle: {
    color: "#63776B",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },

  sectionTitle: {
    color: "#163D2A",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 10,
    marginBottom: 8,
  },

  photo: {
    width: "100%",
    height: 190,
    borderRadius: 14,
    resizeMode: "cover",
    marginBottom: 12,
  },

  confidenceBox: {
    backgroundColor: "#EAF5ED",
    borderRadius: 12,
    padding: 13,
    marginVertical: 12,
  },

  confidenceLabel: {
    color: "#63776B",
    fontSize: 13,
  },

  confidenceValue: {
    color: "#176B43",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 3,
    textTransform: "capitalize",
  },

  label: {
    color: "#264C37",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 13,
    marginBottom: 7,
  },

  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#DCE5DE",
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    color: "#1D3829",
    fontSize: 14,
  },

  largeInput: {
    minHeight: 150,
    borderWidth: 1,
    borderColor: "#DCE5DE",
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#1D3829",
    fontSize: 14,
    lineHeight: 21,
  },

  warningBox: {
    backgroundColor: "#FFF5DF",
    borderRadius: 12,
    padding: 14,
    marginTop: 18,
  },

  warningTitle: {
    color: "#9A6500",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6,
  },

  warningText: {
    color: "#755000",
    fontSize: 13,
    lineHeight: 20,
  },

  confirmButton: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: "#258D4D",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },

  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  retakeButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#258D4D",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },

  retakeButtonText: {
    color: "#258D4D",
    fontSize: 15,
    fontWeight: "700",
  },

  note: {
    color: "#63776B",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 20,
  },
});