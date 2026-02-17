import React, { useState, useRef, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { CameraView } from 'expo-camera';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';

const { width } = Dimensions.get('window');

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useContext(ThemeContext);
  const isFocused = useIsFocused();
  const [cameraActive, setCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const scanLock = useRef(false);

  useEffect(() => {
    if (!isFocused) setCameraActive(false);
  }, [isFocused]);

  const handleBarCodeScanned = async ({ data, bounds }: any) => {
    if (scanLock.current) return;

    // 🎯 BOX VALIDATION
    const qrY = bounds.origin.y;
    const qrX = bounds.origin.x;
    const boxTop = 100 + insets.top;
    const boxBottom = boxTop + 250;
    const boxLeft = (width - 250) / 2;
    const boxRight = boxLeft + 250;

    // Only scan if QR is roughly within the blue corners
    if (qrY < boxTop || qrY > boxBottom || qrX < boxLeft || qrX > boxRight) {
      return; 
    }

    scanLock.current = true;
    setCameraActive(false);
    setLoading(true);

    try {
      const token = await SecureStore.getItemAsync('userToken');
      await apiClient.patch(`/tickets/${data}/checkin`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      Alert.alert("✅ Success", "Guest Verified", [
        { text: "OK", onPress: () => {
          setLoading(false);
          scanLock.current = false; // Release lock after user acknowledges
        }}
      ]);
    } catch (error: any) {
      const msg = error.response?.data?.error || "Invalid Ticket";
      Alert.alert("❌ Error", msg, [
        { text: "Try Again", onPress: () => {
          setLoading(false);
          scanLock.current = false; // Release lock for retry
        }}
      ]);
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
            zoom={0.01} // Bypasses Ultrawide on iPhone 14
          />

          <View style={[styles.topUi, { paddingTop: insets.top + 100 }]}>
            <View style={styles.targetSquare}>
              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />
            </View>
            <Text style={styles.hint}>Align QR within frame</Text>
          </View>

          <View style={[styles.bottomUi, { paddingBottom: insets.bottom + 40 }]}>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={() => setCameraActive(false)}
            >
              <Ionicons name="close-circle" size={20} color="white" />
              <Text style={styles.cancelText}>CLOSE SCANNER</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.idleState}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={[styles.loadingText, { color: colors.text }]}>Checking Database...</Text>
            </View>
          ) : (
            <>
              <View style={styles.welcomeCircle}>
                <Ionicons name="scan" size={60} color="#007AFF" />
              </View>
              <Text style={[styles.idleTitle, { color: colors.text }]}>Scanner Ready</Text>
              <TouchableOpacity 
                style={styles.startButton} 
                onPress={() => { 
                  scanLock.current = false; 
                  setCameraActive(true); 
                }}
              >
                <Text style={styles.buttonText}>Start New Scan</Text>
              </TouchableOpacity>
            </>
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
  corner: { position: 'absolute', width: 45, height: 45, borderColor: '#007AFF', borderWidth: 5 },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  hint: { color: 'white', marginTop: 25, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.7)', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, overflow: 'hidden' },
  bottomUi: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  cancelButton: { flexDirection: 'row', backgroundColor: '#FF3B30', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30, alignItems: 'center', gap: 8 },
  cancelText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  idleState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  welcomeCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(0,122,255,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  idleTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 30 },
  startButton: { backgroundColor: '#007AFF', paddingVertical: 18, width: '100%', borderRadius: 15, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5 },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  loadingBox: { alignItems: 'center' },
  loadingText: { marginTop: 15, fontSize: 16, fontWeight: '500' }
});