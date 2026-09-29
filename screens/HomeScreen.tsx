import { useState } from "react";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import {
   Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function HomeScreen({ navigation }: any) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [barcode, setBarcode] = useState("");

  const [permission, requestPermission] = useCameraPermissions();

  async function openCamera() {
    if (!permission?.granted) {
      const result = await requestPermission();

      if (!result.granted) {
        return;
      }
    }

    setBarcode("");
    setScanned(false);
    setCameraOpen(true);
  }

  function closeCamera() {
    setCameraOpen(false);
    setScanned(false);
  }

  function handleBarcodeScanned(result: BarcodeScanningResult) {
    const cleanBarcode = result.data.replace(/\D/g, "");

    if (cleanBarcode.length < 8 || cleanBarcode.length > 14) {
      return;
    }

    setBarcode(cleanBarcode);
    setScanned(true);
  }

  if (cameraOpen) {
    return (
      <SafeAreaView style={styles.cameraPage}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={
            scanned ? undefined : handleBarcodeScanned
          }
        >
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraHeader}>
              <Text style={styles.cameraTitle}>Scan barcode</Text>

              <Text style={styles.cameraDescription}>
                Place the complete barcode inside the frame
              </Text>
            </View>

            <View style={styles.liveScanFrame} />

            {scanned && (
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>
                  Barcode detected
                </Text>

                <Text style={styles.barcodeText}>{barcode}</Text>

                <TouchableOpacity
                  style={styles.scanAgainButton}
                  onPress={() => {
                    setBarcode("");
                    setScanned(false);
                  }}
                >
                  <Text style={styles.scanAgainText}>
                    Scan again
                  </Text>
                </TouchableOpacity>
              </View>
            )}

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

  return (
    <SafeAreaView style={styles.page}>
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
        <Text style={styles.title}>Scan a product</Text>

        <Text style={styles.description}>
          Scan the barcode to find available product and
          {"\n"}ingredient information.
        </Text>

        <View style={styles.scannerCard}>
          <View style={styles.cameraIconCircle}>
            <Text style={styles.cameraIcon}>▣</Text>
          </View>

          <Text style={styles.scannerTitle}>Scan barcode</Text>

          <Text style={styles.scannerDescription}>
            Position the product barcode inside the frame
          </Text>

          <View style={styles.previewFrame}>
            <View style={[styles.corner, styles.topLeftCorner]} />
            <View style={[styles.corner, styles.topRightCorner]} />
            <View style={[styles.corner, styles.bottomLeftCorner]} />
            <View style={[styles.corner, styles.bottomRightCorner]} />

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

          <TouchableOpacity
            style={styles.openCameraButton}
            onPress={openCamera}
          >
            <Text style={styles.openCameraText}>Open camera</Text>
          </TouchableOpacity>
        </View>

        {permission?.canAskAgain === false && !permission.granted && (
          <Text style={styles.permissionWarning}>
            Camera access is disabled. Enable it in your device or
            browser settings.
          </Text>
        )}

        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>Barcode unavailable?</Text>

          <Text style={styles.helpText}>
            You will also be able to photograph the package and
            ingredient label.
          </Text>
        </View>
        
      </ScrollView>
      <View style={styles.bottomBar}>
  <View style={styles.navItem}>
    <Text style={[styles.navIcon, styles.activeNavIcon]}>▣</Text>
    <Text style={[styles.navText, styles.activeNavText]}>Scan</Text>
  </View>

  <TouchableOpacity
    style={styles.navItem}
    onPress={() =>
      Alert.alert("Coming soon", "The Avoid page will be added soon.")
    }
  >
    <Text style={styles.navIcon}>☰</Text>
    <Text style={styles.navText}>Avoid</Text>
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
  bottomBar: {
  flexDirection: "row",
  backgroundColor: "#FFFFFF",
  borderTopWidth: 1,
  borderTopColor: "#DDE6E0",
  paddingTop: 9,
  paddingBottom: 12,
},

navItem: {
  flex: 1,
  alignItems: "center",
},

navIcon: {
  color: "#68766F",
  fontSize: 17,
  marginBottom: 3,
},

activeNavIcon: {
  color: "#176B43",
},

navText: {
  color: "#68766F",
  fontSize: 11,
},

activeNavText: {
  color: "#176B43",
  fontWeight: "bold",
},
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
    shadowOffset: { width: 0, height: 8 },
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
  permissionWarning: {
    color: "#8A591A",
    backgroundColor: "#FFF4D9",
    borderRadius: 12,
    padding: 13,
    textAlign: "center",
    marginTop: 16,
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
  profileButton: {
    borderColor: "#176B43",
    borderWidth: 1,
    borderRadius: 13,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 25,
  },
  profileButtonText: {
    color: "#176B43",
    fontSize: 16,
    fontWeight: "bold",
  },
  loginButton: {
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 6,
  },
  loginButtonText: {
    color: "#68766F",
    fontWeight: "600",
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
    backgroundColor: "rgba(0, 0, 0, 0.22)",
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
  scanAgainButton: {
    backgroundColor: "#E3F1E8",
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 15,
  },
  scanAgainText: {
    color: "#176B43",
    fontWeight: "bold",
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