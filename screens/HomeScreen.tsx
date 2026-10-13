// React hooks used for camera reference and screen state.
import { useRef, useState } from "react";

// Expo camera components and barcode result type.
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";

// React Native components used to build the screen.
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// The camera has two possible purposes.
type CameraMode = "barcode" | "ingredient";

export default function HomeScreen() {
  // Controls whether the camera screen is visible.
  const [cameraOpen, setCameraOpen] = useState(false);

  // Stores whether the camera scans a barcode or takes a photo.
  const [cameraMode, setCameraMode] =
    useState<CameraMode>("barcode");

  // Prevents multiple barcode detections.
  const [scanned, setScanned] = useState(false);

  // Stores the detected barcode.
  const [barcode, setBarcode] = useState("");

  // Stores the ingredient photo location.
  const [ingredientPhotoUri, setIngredientPhotoUri] =
    useState<string | null>(null);

  // Shows a loading message while taking a photo.
  const [takingPhoto, setTakingPhoto] = useState(false);

  // Handles camera permission.
  const [permission, requestPermission] =
    useCameraPermissions();

  // Reference used to take a picture with the camera.
  const cameraRef = useRef<any>(null);

  // Opens the camera in the selected mode.
  async function openCamera(mode: CameraMode) {
    // Ask for permission if it has not been granted.
    if (!permission?.granted) {
      const result = await requestPermission();

      // Stop if permission is denied.
      if (!result.granted) {
        return;
      }
    }

    // Reset the previous scan.
    setBarcode("");
    setScanned(false);

    // Set the requested camera mode.
    setCameraMode(mode);

    // Open the camera screen.
    setCameraOpen(true);
  }

  // Closes the camera and returns to Home.
  function closeCamera() {
    setCameraOpen(false);
    setScanned(false);
    setCameraMode("barcode");
  }

  // Handles a barcode detected by the camera.
  function handleBarcodeScanned(
    result: BarcodeScanningResult
  ) {
    // Keep only numeric characters.
    const cleanBarcode = result.data.replace(/\D/g, "");

    // Accept barcode lengths from 8 to 14 digits.
    if (
      cleanBarcode.length < 8 ||
      cleanBarcode.length > 14
    ) {
      return;
    }

    // Save the barcode and stop scanning.
    setBarcode(cleanBarcode);
    setScanned(true);

    // Close the camera after a valid barcode is detected.
    setTimeout(() => {
      setCameraOpen(false);
    }, 500);
  }

  // Switches from barcode scanning to ingredient photography.
  function chooseIngredientPhoto() {
    setCameraMode("ingredient");
    setScanned(false);
  }

  // Takes a photo of the ingredient label.
  async function takeIngredientPhoto() {
    // Stop if the camera is not ready.
    if (!cameraRef.current) {
      return;
    }

    setTakingPhoto(true);

    try {
      // Capture the current camera view.
      const photo =
        await cameraRef.current.takePictureAsync({
          quality: 0.8,
          skipProcessing: false,
        });

      // Save the photo and close the camera.
      if (photo?.uri) {
        setIngredientPhotoUri(photo.uri);
        setCameraOpen(false);
      }
    } catch {
      // Keep the camera open if taking the photo fails.
    } finally {
      // Stop showing the loading state.
      setTakingPhoto(false);
    }
  }

  // Opens the camera again to replace the current photo.
  function retakeIngredientPhoto() {
    openCamera("ingredient");
  }

  // This is the full-screen camera view.
  // It appears only after the user presses a camera button.
  if (cameraOpen) {
    return (
      <SafeAreaView style={styles.cameraPage}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          onBarcodeScanned={
            cameraMode === "barcode" && !scanned
              ? handleBarcodeScanned
              : undefined
          }
        >
          <View style={styles.cameraOverlay}>
            {/* Camera title and instructions. */}
            <View style={styles.cameraHeader}>
              <Text style={styles.cameraTitle}>
                {cameraMode === "barcode"
                  ? "Scan barcode"
                  : "Photograph ingredients"}
              </Text>

              <Text style={styles.cameraDescription}>
                {cameraMode === "barcode"
                  ? "Place the complete barcode inside the frame"
                  : "Place the full ingredient label inside the frame"}
              </Text>
            </View>

            {/* Barcode guidance frame. */}
            {cameraMode === "barcode" && (
              <View style={styles.liveScanFrame}>
                <Text style={styles.frameHint}>
                  Align barcode here
                </Text>
              </View>
            )}

            {/* Ingredient-label guidance frame. */}
            {cameraMode === "ingredient" && (
              <View style={styles.ingredientGuide}>
                <Text style={styles.ingredientGuideTitle}>
                  Ingredient label
                </Text>

                <Text style={styles.ingredientGuideText}>
                  Keep the complete text inside this frame
                </Text>

                <Text style={styles.ingredientTip}>
                  Avoid glare and keep the text in focus
                </Text>
              </View>
            )}

            {/* Temporary barcode confirmation. */}
            {cameraMode === "barcode" && scanned && (
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>
                  Barcode detected
                </Text>

                <Text style={styles.barcodeText}>
                  {barcode}
                </Text>
              </View>
            )}

            {/* Takes the ingredient photo. */}
            {cameraMode === "ingredient" && (
              <TouchableOpacity
                style={styles.takePhotoButton}
                onPress={takeIngredientPhoto}
                disabled={takingPhoto}
              >
                <Text style={styles.takePhotoText}>
                  {takingPhoto
                    ? "Taking photo..."
                    : "Take photo"}
                </Text>
              </TouchableOpacity>
            )}

            {/* Allows ingredient photography without a barcode. */}
            {cameraMode === "barcode" && !scanned && (
              <TouchableOpacity
                style={styles.ingredientOptionButton}
                onPress={chooseIngredientPhoto}
              >
                <Text style={styles.ingredientOptionText}>
                  No barcode? Photograph ingredient label
                </Text>
              </TouchableOpacity>
            )}

            {/* Closes the camera. */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={closeCamera}
            >
              <Text style={styles.closeButtonText}>
                Close camera
              </Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </SafeAreaView>
    );
  }

  // This is the normal Home screen.
  // The camera is not active here.
  return (
    <SafeAreaView style={styles.page}>
      {/* Application header. */}
      <View style={styles.header}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>✓</Text>
        </View>

        <View style={styles.headerText}>
          <Text style={styles.appName}>LabelLens</Text>

          <Text style={styles.appSubtitle}>
            Food-label screening assistant
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Home screen heading. */}
        <Text style={styles.title}>
          Scan a product
        </Text>

        <Text style={styles.description}>
          Scan the barcode to find available product and
          ingredient information.
        </Text>

        {/* Main scanner card. */}
        <View style={styles.scannerCard}>
          <View style={styles.cameraIconCircle}>
            <Text style={styles.cameraIcon}>▣</Text>
          </View>

          <Text style={styles.scannerTitle}>
            Scan barcode
          </Text>

          <Text style={styles.scannerDescription}>
            Position the product barcode inside the frame
          </Text>

          {/* Static placeholder shown before opening the camera. */}
          <View style={styles.previewFrame}>
            <View
              style={[
                styles.corner,
                styles.topLeftCorner,
              ]}
            />

            <View
              style={[
                styles.corner,
                styles.topRightCorner,
              ]}
            />

            <View
              style={[
                styles.corner,
                styles.bottomLeftCorner,
              ]}
            />

            <View
              style={[
                styles.corner,
                styles.bottomRightCorner,
              ]}
            />

            <View style={styles.barcodePreview}>
              <View style={styles.barcodeLineWide} />
              <View style={styles.barcodeLine} />
              <View style={styles.barcodeLineWide} />
              <View style={styles.barcodeLine} />
              <View style={styles.barcodeLine} />
              <View style={styles.barcodeLineWide} />
              <View style={styles.barcodeLine} />
              <View style={styles.barcodeLineWide} />
              <View style={styles.barcodeLine} />
            </View>
          </View>

          {/* Opens barcode-scanning mode. */}
          <TouchableOpacity
            style={styles.openCameraButton}
            onPress={() => openCamera("barcode")}
          >
            <Text style={styles.openCameraText}>
              Open camera
            </Text>
          </TouchableOpacity>

          {/* Opens ingredient-photo mode directly. */}
          <TouchableOpacity
            style={styles.photoLabelButton}
            onPress={() => openCamera("ingredient")}
          >
            <Text style={styles.photoLabelText}>
              No barcode? Photograph ingredient label
            </Text>
          </TouchableOpacity>
        </View>

        {/* Camera permission warning. */}
        {permission?.canAskAgain === false &&
          !permission.granted && (
            <Text style={styles.permissionWarning}>
              Camera access is disabled. Enable it in your
              device or browser settings.
            </Text>
          )}

        {/* Displays the scanned barcode after returning Home. */}
        {barcode !== "" && (
          <View style={styles.homeResultCard}>
            <Text style={styles.homeResultTitle}>
              Barcode detected
            </Text>

            <Text style={styles.homeBarcodeText}>
              {barcode}
            </Text>

            <Text style={styles.homeResultMessage}>
              The barcode is ready to be checked.
            </Text>
          </View>
        )}

        {/* Displays the captured ingredient photo. */}
        {ingredientPhotoUri && (
          <View style={styles.photoResultCard}>
            <Text style={styles.photoResultTitle}>
              Ingredient photo
            </Text>

            <Image
              source={{ uri: ingredientPhotoUri }}
              style={styles.ingredientPhoto}
              resizeMode="cover"
            />

            {/* Allows the user to retake the photo. */}
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={retakeIngredientPhoto}
            >
              <Text style={styles.retakeButtonText}>
                Retake photo
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Explanation for products without a barcode. */}
        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>
            Barcode unavailable?
          </Text>

          <Text style={styles.helpText}>
            Photograph the ingredient label so the text can
            be extracted and reviewed.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// All HomeScreen and camera-screen styles.
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F1F7F3",
  },

  header: {
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 16,
  },

  logo: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "#176B43",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  logoText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
  },

  headerText: {
    flex: 1,
  },

  appName: {
    color: "#17452F",
    fontSize: 20,
    fontWeight: "bold",
  },

  appSubtitle: {
    color: "#68766F",
    fontSize: 12,
    marginTop: 2,
  },

  scroll: {
    flex: 1,
    width: "100%",
  },

  content: {
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 45,
  },

  title: {
    color: "#17452F",
    fontSize: 30,
    fontWeight: "bold",
    textAlign: "center",
  },

  description: {
    color: "#68766F",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 9,
    marginBottom: 24,
  },

  scannerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
    shadowColor: "#163A29",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 4,
  },

  cameraIconCircle: {
    width: 55,
    height: 55,
    borderRadius: 28,
    backgroundColor: "#E3F1E8",
    alignItems: "center",
    justifyContent: "center",
  },

  cameraIcon: {
    color: "#176B43",
    fontSize: 28,
    fontWeight: "bold",
  },

  scannerTitle: {
    color: "#17452F",
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 13,
  },

  scannerDescription: {
    color: "#68766F",
    fontSize: 14,
    textAlign: "center",
    marginTop: 6,
  },

  previewFrame: {
    width: "100%",
    height: 150,
    backgroundColor: "#EFF6F1",
    borderRadius: 18,
    marginTop: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: "#176B43",
  },

  topLeftCorner: {
    top: 15,
    left: 15,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },

  topRightCorner: {
    top: 15,
    right: 15,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },

  bottomLeftCorner: {
    bottom: 15,
    left: 15,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },

  bottomRightCorner: {
    right: 15,
    bottom: 15,
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderBottomRightRadius: 8,
  },

  barcodePreview: {
    height: 65,
    flexDirection: "row",
    alignItems: "stretch",
  },

  barcodeLine: {
    width: 4,
    backgroundColor: "#315143",
    marginHorizontal: 3,
  },

  barcodeLineWide: {
    width: 8,
    backgroundColor: "#315143",
    marginHorizontal: 3,
  },

  openCameraButton: {
    width: "100%",
    backgroundColor: "#176B43",
    borderRadius: 13,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 22,
  },

  openCameraText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },

  photoLabelButton: {
    width: "100%",
    backgroundColor: "#E3F1E8",
    borderRadius: 13,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },

  photoLabelText: {
    color: "#176B43",
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
  },

  permissionWarning: {
    color: "#8A591A",
    backgroundColor: "#FFF4D9",
    borderRadius: 12,
    padding: 13,
    textAlign: "center",
    marginTop: 16,
  },

  homeResultCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    marginTop: 20,
  },

  homeResultTitle: {
    color: "#68766F",
    fontSize: 14,
  },

  homeBarcodeText: {
    color: "#17452F",
    fontSize: 21,
    fontWeight: "bold",
    marginTop: 5,
  },

  homeResultMessage: {
    color: "#68766F",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },

  photoResultCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    marginTop: 20,
  },

  photoResultTitle: {
    color: "#17452F",
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 12,
  },

  ingredientPhoto: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    backgroundColor: "#EFF6F1",
  },

  retakeButton: {
    backgroundColor: "#E3F1E8",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },

  retakeButtonText: {
    color: "#176B43",
    fontWeight: "bold",
  },

  helpSection: {
    alignItems: "center",
    marginTop: 25,
  },

  helpTitle: {
    color: "#17452F",
    fontSize: 15,
    fontWeight: "bold",
  },

  helpText: {
    color: "#68766F",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 5,
  },

  cameraPage: {
    flex: 1,
    backgroundColor: "#000000",
  },

  camera: {
    flex: 1,
  },

  cameraOverlay: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 55,
    paddingBottom: 35,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },

  cameraHeader: {
    alignItems: "center",
  },

  cameraTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "bold",
  },

  cameraDescription: {
    color: "#FFFFFF",
    fontSize: 14,
    textAlign: "center",
    marginTop: 7,
  },

  liveScanFrame: {
    width: "90%",
    maxWidth: 360,
    height: 170,
    borderWidth: 3,
    borderColor: "#8DF0B8",
    borderRadius: 18,
    marginTop: 80,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 12,
  },

  frameHint: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },

  ingredientGuide: {
    width: "90%",
    maxWidth: 360,
    height: 230,
    borderWidth: 3,
    borderColor: "#8DF0B8",
    borderRadius: 18,
    marginTop: 70,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },

  ingredientGuideTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },

  ingredientGuideText: {
    color: "#FFFFFF",
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
  },

  ingredientTip: {
    color: "#FFFFFF",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },

  resultCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    marginTop: 25,
  },

  resultTitle: {
    color: "#68766F",
    fontSize: 14,
  },

  barcodeText: {
    color: "#17452F",
    fontSize: 21,
    fontWeight: "bold",
    marginTop: 5,
  },

  takePhotoButton: {
    backgroundColor: "#176B43",
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 25,
  },

  takePhotoText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 15,
  },

  ingredientOptionButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 13,
    marginTop: 25,
  },

  ingredientOptionText: {
    color: "#176B43",
    fontWeight: "bold",
    textAlign: "center",
  },

  closeButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 25,
    paddingVertical: 14,
    marginTop: "auto",
  },

  closeButtonText: {
    color: "#176B43",
    fontWeight: "bold",
  },
});