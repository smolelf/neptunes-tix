import React, { useState, useRef, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { CameraView } from 'expo-camera';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/client';
import * as Haptics from 'expo-haptics';
import { Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

const { width } = Dimensions.get('window');

interface TicketStats {
  total_sold: number;
  total_scanned: number;
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
  const [stats, setStats] = useState<TicketStats>({ total_sold: 0, total_scanned: 0 });
  const [emailSearch, setEmailSearch] = useState('');
  const [foundTickets, setFoundTickets] = useState<any[]>([]);
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const fetchStats = async () => {
    try {
        const response = await apiClient.get<TicketStats>('/admin/stats');
        setStats(response.data);
    } catch (error) {
        console.error("Stats fetch failed", error);
    }
  };

  useEffect(() => {
    if (isFocused) fetchStats();
    if (!isFocused) {
        setCameraActive(false);
        setTorchOn(false);
    }
  }, [isFocused]);

  const handleBarCodeScanned = async ({ data, bounds }: any) => {
    if (scanLock.current || !data) return;

    // 🎯 BOX VALIDATION (Only if it's a real camera scan)
    if (bounds) {
      const { y: qrY, x: qrX } = bounds.origin;
      const boxTop = 100 + insets.top;
      const boxBottom = boxTop + 250;
      const boxLeft = (width - 250) / 2;
      const boxRight = boxLeft + 250;

      if (qrY < boxTop || qrY > boxBottom || qrX < boxLeft || qrX > boxRight) return; 
    }

    scanLock.current = true;
    setCameraActive(false);
    setLoading(true);

    try {
      // Data is now a UUID string
      const response = await apiClient.patch<{ data: any }>(`/tickets/${data}/checkin`);
      const ticketInfo = response.data.data;
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        "✅ Verified", 
        `Ticket: ${ticketInfo.category}\nEvent: ${ticketInfo.event?.name || 'Valid Entry'}`, 
        [{ text: "Next Guest", onPress: () => resetScanner() }]
      );

    } catch (error: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const msg = error.response?.data?.error || "Invalid QR Code or already scanned.";
        
        Alert.alert("❌ Access Denied", msg, [
            { text: "Try Again", onPress: () => resetScanner() }
        ]);
    }
  };

  const resetScanner = () => {
    setLoading(false);
    scanLock.current = false;
    fetchStats();
  };

  const handleManualSubmit = () => {
    if (manualId.trim().length < 5) return; // Basic UUID fragment check
    setManualModalVisible(false);
    handleBarCodeScanned({ data: manualId.trim(), bounds: null } as any); 
    setManualId('');
  };

  const lookupByEmail = async () => {
  if (!emailSearch.includes('@')) return;
  setIsSearching(true);
  try {
    const response = await apiClient.get(`/admin/tickets/lookup?email=${emailSearch.toLowerCase().trim()}`);
    setFoundTickets(response.data);
    if (response.data.length === 0) {
      Alert.alert("Not Found", "No unscanned tickets found for this email.");
    }
  } catch (e) {
    Alert.alert("Error", "Could not search by email.");
  } finally {
    setIsSearching(false);
  }
};

const handleBulkCheckIn = async () => {
    if (selectedTickets.length === 0) return;
    setLoading(true);
    setManualModalVisible(false);
    try {
      await apiClient.post('/admin/tickets/bulk-checkin', { ticket_ids: selectedTickets });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", `Checked in ${selectedTickets.length} guests.`);
    } catch (e) {
      Alert.alert("Error", "Bulk check-in failed.");
      setLoading(false);
    } finally {
      setSelectedTickets([]);
      setFoundTickets([]);
      setEmailSearch('');
    }
    resetScanner();
    setCameraActive(false);
  };

  const toggleTicketSelection = (id: string) => {
    setSelectedTickets(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {isFocused && cameraActive && !loading && !manualModalVisible ? (          <View style={StyleSheet.absoluteFill}>
            <CameraView
              style={StyleSheet.absoluteFill}
              onBarcodeScanned={handleBarCodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              enableTorch={torchOn}
            />

            <TouchableOpacity 
              style={[styles.torchButton, { top: insets.top + 20 }]} 
              onPress={() => setTorchOn(!torchOn)}
            >
              <Ionicons name={torchOn ? "flash" : "flash-off"} size={24} color={torchOn ? "#FFD60A" : "white"} />
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

            <View style={[styles.bottomUi, { paddingBottom: insets.bottom + 30 }]}>
              <TouchableOpacity style={styles.manualEntryBtn} onPress={() => setManualModalVisible(true)}>
                  <Ionicons name="keypad-outline" size={20} color="white" />
                  <Text style={styles.manualEntryText}>Manual Entry</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelButton} onPress={() => setCameraActive(false)}>
                  <Text style={styles.cancelText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.idleState}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={[styles.loadingText, { color: colors.text }]}>Verifying Ticket...</Text>
              </View>
            ) : (
              <>
                <View style={styles.welcomeCircle}>
                  <Ionicons name="scan" size={50} color="#007AFF" />
                </View>

                <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                  <Text style={[styles.statLabel, { color: colors.subText }]}>GATE CAPACITY</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {stats.total_scanned} / {stats.total_sold}
                  </Text>
                  
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { 
                        width: `${stats.total_sold > 0 ? (stats.total_scanned / stats.total_sold) * 100 : 0}%`,
                        backgroundColor: stats.total_scanned >= stats.total_sold && stats.total_sold > 0 ? '#28a745' : '#007AFF'
                    }]} />
                  </View>
                  <Text style={styles.percentageText}>
                    {Math.max(0, stats.total_sold - stats.total_scanned)} guests remaining
                  </Text>
                </View>

                <TouchableOpacity style={styles.startButton} onPress={() => setCameraActive(true)}>
                  <Text style={styles.buttonText}>Start Scanning</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        <Modal
          visible={manualModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setManualModalVisible(false)}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.card, height: '70%' }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Guest Lookup</Text>
              
              <View style={styles.searchContainer}>
                <TextInput
                  style={[styles.manualInput, { flex: 1, color: colors.text, borderColor: colors.border, marginBottom: 0 }]}
                  placeholder="Guest Email Address"
                  placeholderTextColor={colors.subText}
                  value={emailSearch}
                  onChangeText={setEmailSearch}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TouchableOpacity style={styles.searchIconBtn} onPress={lookupByEmail}>
                  {isSearching ? <ActivityIndicator size="small" color="#007AFF" /> : <Ionicons name="search" size={24} color="#007AFF" />}
                </TouchableOpacity>
              </View>

              <ScrollView style={{ width: '100%', marginTop: 20 }}>
                {foundTickets.map((ticket) => (
                  <TouchableOpacity 
                    key={ticket.id} 
                    style={[styles.ticketSelectItem, { backgroundColor: selectedTickets.includes(ticket.id) ? 'rgba(0,122,255,0.1)' : 'transparent' }]}
                    onPress={() => toggleTicketSelection(ticket.id)}
                  >
                    <View>
                      <Text style={{ color: colors.text, fontWeight: 'bold' }}>{ticket.category}</Text>
                      <Text style={{ color: colors.subText, fontSize: 12 }}>{ticket.event?.name}</Text>
                    </View>
                    <Ionicons 
                      name={selectedTickets.includes(ticket.id) ? "checkbox" : "square-outline"} 
                      size={24} 
                      color={selectedTickets.includes(ticket.id) ? "#007AFF" : colors.subText} 
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={[styles.modalButtons, { marginTop: 20 }]}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.border }]} onPress={() => {
                  setManualModalVisible(false);
                  setFoundTickets([]);
                  setEmailSearch('');
                }}>
                  <Text style={[styles.btnText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                
                {selectedTickets.length > 0 && (
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#28a745' }]} onPress={handleBulkCheckIn}>
                    <Text style={styles.btnText}>Check In ({selectedTickets.length})</Text>
                  </TouchableOpacity>
                )}
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
  bottomUi: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', gap: 10 },  
  cancelButton: { backgroundColor: 'rgba(255, 59, 48, 0.8)', paddingVertical: 12, paddingHorizontal: 40, borderRadius: 25 },
  cancelText: { color: 'white', fontWeight: 'bold' },
  idleState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  welcomeCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(0,122,255,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 25 },
  statCard: { width: '100%', padding: 25, borderRadius: 20, marginBottom: 30, alignItems: 'center', elevation: 3 },
  statLabel: { fontSize: 12, fontWeight: 'bold', letterSpacing: 1.2, marginBottom: 10 },
  statValue: { fontSize: 36, fontWeight: 'bold', marginBottom: 15 },
  progressBar: { width: '100%', height: 10, backgroundColor: '#e0e0e0', borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%' },
  percentageText: { marginTop: 10, fontSize: 14, color: '#666' },
  startButton: { backgroundColor: '#007AFF', paddingVertical: 18, width: '100%', borderRadius: 15, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  loadingBox: { alignItems: 'center' },
  loadingText: { marginTop: 15, fontSize: 16 },
  torchButton: { position: 'absolute', right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  manualEntryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
  manualEntryText: { color: 'white', marginLeft: 8, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { padding: 30, borderTopLeftRadius: 25, borderTopRightRadius: 25, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  manualInput: { width: '100%', height: 55, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, fontSize: 16, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 15 },
  modalBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, flex: 1, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold' },
  searchContainer: { flexDirection: 'row', width: '100%', gap: 10, alignItems: 'center' },
  searchIconBtn: { padding: 10, borderRadius: 10, backgroundColor: 'rgba(0,122,255,0.1)' },
  ticketSelectItem: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: 15, 
      borderRadius: 12, 
      marginBottom: 8,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.05)'
  },
});