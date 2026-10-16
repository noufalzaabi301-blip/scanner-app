// React state is used for editable extracted fields.
import { useState } from "react";

// React Native components used to display and edit the extraction.
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

// The structure returned by the AI extraction function.
import type { LabelExtraction } from "../lib/labelExtraction";

export default function LabelReviewScreen({
  navigation,
  route,
}: any) {
  // Read the data sent from HomeScreen.
  const {
    barcode,
    frontPhotoUri,
    ingredientsPhotoUri,
    extraction,
  }: {
    barcode: string | null;
    frontPhotoUri: string;
    ingredientsPhotoUri: string;
    extraction: LabelExtraction;
  } = route.params;

  // Every extracted field can be corrected by the user.
  const [brand, setBrand] = useState(extraction.brand);
  const [productName, setProductName] = useState(
    extraction.product_name
  );
  const [variant, setVariant] = useState(extraction.variant);
  const [ingredients, setIngredients] = useState(
    extraction.ingredients
  );
  const [contains, setContains] = useState(
    extraction.contains
  );
  const [mayContain, setMayContain] = useState(
    extraction.may_contain
  );

  // Sends the confirmed information to the next analysis step.
  function confirmAndAnalyze() {
    // Prevent analysis when the ingredient information is empty.
    if (!ingredients.trim()) {
      Alert.alert(
        "Ingredients required",
        "Please review the ingredient list before continuing."
      );
      return;
    }

    // This is the confirmed user-edited product information.
    const confirmedProduct = {
      barcode,
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

    // For now, display confirmation.
    // The next step will send this object to the allergy
    // and halal screening logic.
    Alert.alert(
      "Information confirmed",
      "The extracted information is ready for allergy and halal analysis.",
      [
        {
          text: "OK",
          onPress: () => {
            // Keep the confirmed object available for the next screen.
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
        {/* Screen title. */}
        <Text style={styles.title}>
          Review product information
        </Text>

        {/* Explanation before confirmation. */}
        <Text style={styles.subtitle}>
          AI extracted the information from your photos. Please
          correct anything that is not accurate.
        </Text>

        {/* Show the original front-package photo. */}
        <Text style={styles.sectionTitle}>
          Front-package photo
        </Text>

        <Image
          source={{ uri: frontPhotoUri }}
          style={styles.photo}
        />

        {/* Show the original ingredient-panel photo. */}
        <Text style={styles.sectionTitle}>
          Ingredient-panel photo
        </Text>

        <Image
          source={{ uri: ingredientsPhotoUri }}
          style={styles.photo}
        />

        {/* Show AI confidence. */}
        <View style={styles.confidenceBox}>
          <Text style={styles.confidenceLabel}>
            AI confidence
          </Text>

          <Text style={styles.confidenceValue}>
            {extraction.confidence}
          </Text>
        </View>

        {/* Editable brand field. */}
        <Text style={styles.label}>Brand</Text>

        <TextInput
          style={styles.input}
          value={brand}
          onChangeText={setBrand}
          placeholder="Brand name"
          placeholderTextColor="#AAB8AE"
        />

        {/* Editable product-name field. */}
        <Text style={styles.label}>Product name</Text>

        <TextInput
          style={styles.input}
          value={productName}
          onChangeText={setProductName}
          placeholder="Product name"
          placeholderTextColor="#AAB8AE"
        />

        {/* Editable variant field. */}
        <Text style={styles.label}>Variant</Text>

        <TextInput
          style={styles.input}
          value={variant}
          onChangeText={setVariant}
          placeholder="Variant or flavor"
          placeholderTextColor="#AAB8AE"
        />

        {/* Editable complete ingredient list. */}
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

        {/* Editable Contains field. */}
        <Text style={styles.label}>Contains</Text>

        <TextInput
          style={styles.input}
          value={contains}
          onChangeText={setContains}
          placeholder="Contains allergens"
          placeholderTextColor="#AAB8AE"
        />

        {/* Editable May Contain field. */}
        <Text style={styles.label}>May contain</Text>

        <TextInput
          style={styles.input}
          value={mayContain}
          onChangeText={setMayContain}
          placeholder="May contain allergens"
          placeholderTextColor="#AAB8AE"
        />

        {/* Show text that the AI could not read clearly. */}
        {extraction.unclear_text.trim() !== "" && (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>
              Please check unclear text
            </Text>

            <Text style={styles.warningText}>
              {extraction.unclear_text}
            </Text>
          </View>
        )}

        {/* Confirm the user-edited information. */}
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={confirmAndAnalyze}
        >
          <Text style={styles.confirmButtonText}>
            Confirm and Analyze
          </Text>
        </TouchableOpacity>

        {/* Return to Home to retake the photos. */}
        <TouchableOpacity
          style={styles.retakeButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.retakeButtonText}>
            Retake Photos
          </Text>
        </TouchableOpacity>

        {/* Safety reminder. */}
        <Text style={styles.note}>
          Always compare the extracted information with the
          physical package before confirming.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// Styles for the review screen.
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
    marginBottom: 5,
  },

  warningText: {
    color: "#755000",
    fontSize: 13,
    lineHeight: 19,
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