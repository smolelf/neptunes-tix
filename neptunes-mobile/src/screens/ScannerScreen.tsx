import React, { useState, useRef, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { CameraView } from 'expo-camera';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';
import * as Haptics from 'expo-haptics';
import { Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';

const { width } = Dimensions.get('window');

interface TicketStats {
    total_sold: number;
    checked_in: number;
    remaining: number;
  }

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useContext(ThemeContext);
  const isFocused = useIsFocused();
  const [cameraActive, setCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const scanLock = useRef(false);
  const [torchOn, setTorchOn] = useState(false);
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualId, setManualId] = useState('');

  const handleManualSubmit = () => {
    if (manualId.trim().length === 0) return;
    setManualModalVisible(false);
    // Reuse our existing scan logic by passing the manually typed ID
    handleBarCodeScanned({ data: manualId, bounds: null } as any); 
    setManualId('');
  };

  const [stats, setStats] = useState<TicketStats>({ 
    total_sold: 0, 
    checked_in: 0, 
    remaining: 0 
  });
  
  const fetchStats = async () => {
    try {
        const response = await apiClient.get<TicketStats>('/tickets/stats')
        setStats(response.data);
    } catch (error) {
        console.error("Stats fetch failed", error);
    }
  };

  useEffect(() => {
    if (isFocused) fetchStats();
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused) setCameraActive(false);
  }, [isFocused]);

  useEffect(() => {
    if (!cameraActive || !isFocused) {
      setTorchOn(false);
    }
  }, [cameraActive, isFocused]);

  const handleBarCodeScanned = async ({ data, bounds }: any) => {
    if (scanLock.current) return;

    // 🎯 BOX VALIDATION (Only if it's a real camera scan)
    if (bounds) {
      const qrY = bounds.origin.y;
      const qrX = bounds.origin.x;
      const boxTop = 100 + insets.top;
      const boxBottom = boxTop + 250;
      const boxLeft = (width - 250) / 2;
      const boxRight = boxLeft + 250;

      // Only scan if QR is within the blue corners
      if (qrY < boxTop || qrY > boxBottom || qrX < boxLeft || qrX > boxRight) {
        return; 
      }
    }

    // Lock, Close Camera, and Start Loading
    scanLock.current = true;
    setCameraActive(false);
    setLoading(true);

    try {
      await apiClient.patch(`/tickets/${data}/checkin`)
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert("✅ Success", "Guest Verified", [
        { text: "OK", onPress: () => {
          setLoading(false);
          scanLock.current = false;
          fetchStats(); // Refresh stats after success
        }}
      ]);

    } catch (error: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

        const msg = error.response?.data?.error || "Invalid Ticket";
        Alert.alert("❌ Error", msg, [
            { text: "Try Again", onPress: () => {
            setLoading(false);
            scanLock.current = false;
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
            zoom={0.01}
            enableTorch={torchOn}
          />

          <TouchableOpacity 
            style={[styles.torchButton, { top: insets.top + 20 }]} 
            onPress={() => {
                Haptics.selectionAsync(); // Give it a little click feel
                setTorchOn(!torchOn);
            }}
          >
            <Ionicons 
              name={torchOn ? "flash" : "flash-off"} 
              size={24} 
              color={torchOn ? "#FFD60A" : "white"} 
            />
          </TouchableOpacity>

          <View style={[styles.topUi, { paddingTop: insets.top + 100 }]}>
            <View style={styles.targetSquare}>
              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />
            </View>
            <Text style={styles.hint}>Align QR within frame</Text>
          </View>

          <View style={[styles.bottomUi, { paddingBottom: insets.bottom + 20 }]}>
            {/* MANUAL ENTRY BUTTON */}
            <TouchableOpacity 
                style={styles.manualEntryBtn}
                onPress={() => {
                Haptics.selectionAsync();
                setManualModalVisible(true);
                }}
            >
                <Ionicons name="keypad-outline" size={20} color="white" />
                <Text style={styles.manualEntryText}>Manual Entry</Text>
            </TouchableOpacity>

            {/* CLOSE BUTTON */}
            <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => {
                setCameraActive(false);
                Haptics.selectionAsync();
                }}
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
                <Ionicons name="stats-chart" size={50} color="#007AFF" />
              </View>

              <View style={[styles.statCard, { backgroundColor: colors.card || '#f8f9fa' }]}>
                <Text style={[styles.statLabel, { color: colors.subText }]}>LIVE CHECK-IN STATS</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {stats.checked_in} / {stats.total_sold}
                </Text>
                
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { 
                      width: `${stats.total_sold > 0 ? (stats.checked_in / stats.total_sold) * 100 : 0}%` 
                  }]} />
                </View>
                <Text style={styles.percentageText}>
                  {stats.total_sold > 0 ? Math.round((stats.checked_in / stats.total_sold) * 100) : 0}% capacity
                </Text>
              </View>

              <TouchableOpacity 
                style={styles.startButton} 
                onPress={() => { 
                    Haptics.selectionAsync();
                    scanLock.current = false; 
                    setCameraActive(true); 
                }}
              >
                <Text style={styles.buttonText}>Open Scanner</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

<Modal visible={manualModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Manual Check-in</Text>
            <TextInput
              style={[styles.manualInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Enter Ticket ID"
              placeholderTextColor={colors.subText}
              value={manualId}
              onChangeText={setManualId}
              keyboardType="number-pad" // Ticket IDs are usually numeric
              autoFocus={true}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: '#FF3B30' }]} 
                onPress={() => setManualModalVisible(false)}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: '#007AFF' }]} 
                onPress={handleManualSubmit}
              >
                <Text style={styles.btnText}>Verify</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  bottomUi: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    alignItems: 'center',
    gap: 10, // Adds space between the manual and close buttons
},  cancelButton: { flexDirection: 'row', backgroundColor: '#FF3B30', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30, alignItems: 'center', gap: 8 },
  cancelText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  idleState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  welcomeCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(0,122,255,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 25 },
  statCard: { width: '100%', padding: 25, borderRadius: 20, marginBottom: 30, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  statLabel: { fontSize: 12, fontWeight: 'bold', letterSpacing: 1.2, marginBottom: 10 },
  statValue: { fontSize: 36, fontWeight: 'bold', marginBottom: 15 },
  progressBar: { width: '100%', height: 10, backgroundColor: '#e0e0e0', borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#007AFF' },
  percentageText: { marginTop: 10, fontSize: 14, color: '#666', fontWeight: '500' },
  startButton: { backgroundColor: '#007AFF', paddingVertical: 18, width: '100%', borderRadius: 15, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  loadingBox: { alignItems: 'center' },
  loadingText: { marginTop: 15, fontSize: 16, fontWeight: '500' },
  torchButton: {
    position: 'absolute',
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  manualEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 10,
  },
  manualEntryText: { color: 'white', marginLeft: 8, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { padding: 30, borderTopLeftRadius: 25, borderTopRightRadius: 25, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  manualInput: { width: '100%', height: 50, borderWidth: 1, borderRadius: 10, paddingHorizontal: 15, fontSize: 18, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 15 },
  modalBtn: { paddingVertical: 12, paddingHorizontal: 30, borderRadius: 10, minWidth: 120, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold' }
});