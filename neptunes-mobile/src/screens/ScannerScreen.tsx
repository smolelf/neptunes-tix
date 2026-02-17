import React, { useState, useRef, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { CameraView } from 'expo-camera';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // The Modern Fix
import { ThemeContext } from '../context/ThemeContext';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';

const { width, height } = Dimensions.get('window');

export default function ScannerScreen() {
  const insets = useSafeAreaInsets(); // Hook to get Notch/Bottom bar height
  const { colors } = useContext(ThemeContext);
  const isFocused = useIsFocused();
  const [cameraActive, setCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const scanLock = useRef(false);

  // Kill camera on tab switch
  useEffect(() => {
    if (!isFocused) setCameraActive(false);
  }, [isFocused]);

  const handleBarCodeScanned = async ({ data, bounds }: any) => {
    if (scanLock.current) return;

    // 🎯 VALIDATION: Is the QR code inside the box?
    // The box is at top: 100, size: 250.
    const qrY = bounds.origin.y;
    const boxTop = 100 + insets.top;
    const boxBottom = boxTop + 250;

    if (qrY < boxTop || qrY > boxBottom) return; // Ignore if outside vertical box

    scanLock.current = true;
    setCameraActive(false);
    setLoading(true);

    try {
      const token = await SecureStore.getItemAsync('userToken');
      await apiClient.patch(`/tickets/${data}/checkin`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Alert.alert("✅ Success", "Guest Verified", [{ text: "OK", onPress: () => setLoading(false) }]);
    } catch (error: any) {
      Alert.alert("❌ Error", "Invalid Ticket", [{ text: "OK", onPress: () => setLoading(false) }]);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isFocused && cameraActive && !loading ? (
        <View style={StyleSheet.absoluteFill}>
          <CameraView
            style={StyleSheet.absoluteFill}
            onBarcodeScanned={handleBarCodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            zoom={0.01} // 📸 Force standard lens (bypasses Ultrawide)
          />

          {/* TOP UI: Positioned exactly below the Notch */}
          <View style={[styles.topUi, { paddingTop: insets.top + 20 }]}>
            <View style={styles.targetSquare}>
              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />
            </View>
            <Text style={styles.hint}>Place QR inside the blue frame</Text>
          </View>

          {/* BOTTOM UI: Positioned above the Home Indicator */}
          <View style={[styles.bottomUi, { paddingBottom: insets.bottom + 40 }]}>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={() => setCameraActive(false)}
            >
              <Text style={styles.cancelText}>CLOSE SCANNER</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.idleState}>
          {loading ? (
            <ActivityIndicator size="large" color="#007AFF" />
          ) : (
            <TouchableOpacity 
              style={styles.startButton} 
              onPress={() => { scanLock.current = false; setCameraActive(true); }}
            >
              <Text style={styles.buttonText}>Start Verification</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topUi: { flex: 1, alignItems: 'center' },
  targetSquare: { width: 250, height: 250, position: 'relative' },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: '#007AFF', borderWidth: 4 },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  hint: { color: 'white', marginTop: 20, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 8 },
  bottomUi: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  cancelButton: { backgroundColor: '#FF3B30', paddingVertical: 15, paddingHorizontal: 60, borderRadius: 30 },
  cancelText: { color: 'white', fontWeight: 'bold' },
  idleState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  startButton: { backgroundColor: '#007AFF', padding: 20, borderRadius: 15 },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 18 }
});