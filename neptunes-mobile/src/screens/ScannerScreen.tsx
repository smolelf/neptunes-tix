import React, { useState, useRef, useContext, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Dimensions, FlatList, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/client';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

interface EventStat {
  event_id: number;
  event_name: string;
  revenue: number;
  sold: number;
  scanned: number;
}

interface TicketStats {
  total_sold: number;
  total_scanned: number;
  events: EventStat[];
}

export default function ScannerScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useContext(ThemeContext);
  const isFocused = useIsFocused();
  
  const [permission, requestPermission] = useCameraPermissions();
  
  const [cameraActive, setCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const scanLock = useRef(false);
  const [torchOn, setTorchOn] = useState(false);
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [emailSearch, setEmailSearch] = useState('');
  
  const [stats, setStats] = useState<TicketStats>({ total_sold: 0, total_scanned: 0, events: [] });
  const [selectedEvent, setSelectedEvent] = useState<EventStat | null>(null);

  const [foundTickets, setFoundTickets] = useState<any[]>([]);
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const fetchStats = async () => {
    try {
        const response = await apiClient.get<TicketStats>('/admin/stats');
        setStats(response.data);
        
        if (selectedEvent) {
            const updatedEvent = response.data.events.find(e => e.event_id === selectedEvent.event_id);
            if (updatedEvent) setSelectedEvent(updatedEvent);
        }
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

  if (!permission) {
    return (
      <View style={[styles.idleState, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // --- 🚀 POLISHED EVENT SELECTOR UI ---
  if (!selectedEvent) {
      return (
          <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
              {/* Beautiful Left-Aligned Header */}
              <View style={styles.headerContainer}>
                  <Text style={[styles.mainHeader, { color: colors.text }]}>Scanner</Text>
                  <Text style={[styles.subHeader, { color: colors.subText }]}>Select an event to start checking in guests.</Text>
              </View>
              
              <FlatList
                  data={stats.events}
                  keyExtractor={(item) => item.event_id.toString()}
                  contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                      <TouchableOpacity 
                          style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                          onPress={() => setSelectedEvent(item)}
                          activeOpacity={0.8}
                      >
                          <View style={{ flex: 1 }}>
                              <Text style={[styles.eventCardTitle, { color: colors.text }]} numberOfLines={1}>{item.event_name}</Text>
                              <Text style={[styles.eventCardSub, { color: colors.subText }]}>
                                  {item.scanned} / {item.sold} Checked In
                              </Text>
                              {/* Sleek Mini Progress Bar */}
                              <View style={[styles.miniProgressBar, { backgroundColor: colors.border }]}>
                                  <View style={[styles.miniProgressFill, { 
                                      width: `${item.sold > 0 ? (item.scanned / item.sold) * 100 : 0}%`,
                                      backgroundColor: item.scanned >= item.sold && item.sold > 0 ? '#28a745' : '#007AFF'
                                  }]} />
                              </View>
                          </View>
                          
                          <View style={styles.chevronCircle}>
                              <Ionicons name="chevron-forward" size={20} color="#007AFF" />
                          </View>
                      </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                      <View style={styles.emptyContainer}>
                          <Ionicons name="calendar-outline" size={60} color={colors.border} style={{ marginBottom: 15 }} />
                          <Text style={{ color: colors.subText, textAlign: 'center', fontSize: 16 }}>No active events found.</Text>
                      </View>
                  }
              />
          </View>
      );
  }

  const handleStartScanning = async () => {
    if (!permission.granted) {
      const response = await requestPermission();
      if (!response.granted) {
        Alert.alert("Permission Required", "Please enable camera access.");
        return;
      }
    }
    setCameraActive(true);
  };
  
  const handleBarCodeScanned = async ({ data, bounds }: any) => {
    if (scanLock.current || !data) return;

    // Boundary check for precision
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
      const response = await apiClient.patch<{ data: any }>(
          `/tickets/${data}/checkin?event_id=${selectedEvent.event_id}`
      );
      
      const ticketInfo = response.data.data;
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "✅ Verified", 
        `Tier: ${ticketInfo.category}\nEvent: ${ticketInfo.event?.name || 'Valid Entry'}`, 
        [{ text: "Next Guest", onPress: () => resetScanner() }]
      );

    } catch (error: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const msg = error.response?.data?.error || "Invalid QR Code";
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

  const lookupByEmail = async () => {
      if (!emailSearch.includes('@')) return;
      setIsSearching(true);
      try {
        const response = await apiClient.get(`/admin/tickets/lookup?email=${emailSearch.toLowerCase().trim()}`);
        const filteredForThisEvent = response.data.filter((t: any) => t.event_id === selectedEvent.event_id);
        
        setFoundTickets(filteredForThisEvent);
        if (filteredForThisEvent.length === 0) {
          Alert.alert("Not Found", `No valid tickets found for this email for ${selectedEvent.event_name}.`);
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
        {isFocused && cameraActive && !loading && !manualModalVisible ? (
          <View style={StyleSheet.absoluteFill}>
            <CameraView
              style={StyleSheet.absoluteFill}
              onBarcodeScanned={handleBarCodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              enableTorch={torchOn}
            />

            <TouchableOpacity style={[styles.torchButton, { top: insets.top + 20 }]} onPress={() => setTorchOn(!torchOn)}>
              <Ionicons name={torchOn ? "flash" : "flash-off"} size={24} color={torchOn ? "#FFD60A" : "white"} />
            </TouchableOpacity>

            <View style={[styles.topUi, { paddingTop: insets.top + 100 }]}>
              <View style={styles.targetSquare}>
                <View style={[styles.corner, styles.tl]} />
                <View style={[styles.corner, styles.tr]} />
                <View style={[styles.corner, styles.bl]} />
                <View style={[styles.corner, styles.br]} />
              </View>
              <Text style={styles.hint}>Scanning for {selectedEvent.event_name}</Text>
            </View>

            <View style={[styles.bottomUi, { paddingBottom: insets.bottom + 30 }]}>
              <TouchableOpacity style={styles.manualEntryBtn} onPress={() => setManualModalVisible(true)}>
                  <Ionicons name="keypad-outline" size={20} color="white" />
                  <Text style={styles.manualEntryText}>Email Lookup</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setCameraActive(false)}>
                  <Text style={styles.cancelText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.idleState}>
            
            <TouchableOpacity style={[styles.backToEventsBtn, { top: insets.top + 15 }]} onPress={() => setSelectedEvent(null)}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>

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

                {/* 🚀 Polished Dashboard Stat Card */}
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.statEventName, { color: colors.text }]}>{selectedEvent.event_name.toUpperCase()}</Text>
                  
                  <View style={styles.divider} />
                  
                  <Text style={[styles.statLabel, { color: colors.subText }]}>GATE CAPACITY</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {selectedEvent.scanned} / {selectedEvent.sold}
                  </Text>
                  
                  <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                    <View style={[styles.progressFill, { 
                        width: `${selectedEvent.sold > 0 ? (selectedEvent.scanned / selectedEvent.sold) * 100 : 0}%`,
                        backgroundColor: selectedEvent.scanned >= selectedEvent.sold && selectedEvent.sold > 0 ? '#28a745' : '#007AFF'
                    }]} />
                  </View>
                  <Text style={styles.percentageText}>
                    {Math.max(0, selectedEvent.sold - selectedEvent.scanned)} guests remaining
                  </Text>
                </View>

                <TouchableOpacity style={styles.startButton} onPress={handleStartScanning}>
                  <Text style={styles.buttonText}>Start Scanning</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* 🚀 Polished Manual Lookup Modal */}
        <Modal visible={manualModalVisible} animationType="slide" transparent={true} onRequestClose={() => setManualModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.card, height: '80%' }]}>
              
              {/* Added Drag Handle for consistency */}
              <View style={[styles.modalDragHandle, { backgroundColor: colors.border }]} />
              
              <Text style={[styles.modalTitle, { color: colors.text }]}>Lookup Guest</Text>
              
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

              <ScrollView style={{ width: '100%', marginTop: 20 }} showsVerticalScrollIndicator={false}>
                {foundTickets.map((ticket) => {
                  const isSelected = selectedTickets.includes(ticket.id);
                  return (
                      <TouchableOpacity 
                        key={ticket.id} 
                        style={[
                            styles.ticketSelectItem, 
                            { 
                                backgroundColor: isSelected ? 'rgba(0,122,255,0.08)' : colors.background,
                                borderColor: isSelected ? '#007AFF' : colors.border 
                            }
                        ]}
                        onPress={() => toggleTicketSelection(ticket.id)}
                        activeOpacity={0.7}
                      >
                        <View>
                          <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16 }}>{ticket.category}</Text>
                          <Text style={{ color: colors.subText, fontSize: 13, marginTop: 2 }}>{ticket.event?.name}</Text>
                        </View>
                        <Ionicons 
                          name={isSelected ? "checkmark-circle" : "ellipse-outline"} 
                          size={26} 
                          color={isSelected ? "#007AFF" : colors.subText} 
                        />
                      </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={[styles.modalButtons, { marginTop: 20 }]}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]} onPress={() => {
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
  
  // Event Selector Menu
  headerContainer: { paddingHorizontal: 20, paddingTop: 5, paddingBottom: 20 },
  mainHeader: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5, marginBottom: 5 },
  subHeader: { fontSize: 15 },
  eventCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 16, marginBottom: 14, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  eventCardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  eventCardSub: { fontSize: 13, marginBottom: 12 },
  chevronCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,122,255,0.1)', justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
  miniProgressBar: { height: 6, borderRadius: 3, width: '85%', overflow: 'hidden' },
  miniProgressFill: { height: '100%' },
  emptyContainer: { alignItems: 'center', marginTop: 80 },

  // Scanner UI
  topUi: { flex: 1, alignItems: 'center' },
  targetSquare: { width: 250, height: 250, position: 'relative' },
  corner: { position: 'absolute', width: 45, height: 45, borderColor: '#007AFF', borderWidth: 5 },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  hint: { color: 'white', marginTop: 25, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.7)', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, overflow: 'hidden', textAlign: 'center' },
  bottomUi: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', gap: 10 },  
  cancelButton: { backgroundColor: 'rgba(255, 59, 48, 0.8)', paddingVertical: 12, paddingHorizontal: 40, borderRadius: 25 },
  cancelText: { color: 'white', fontWeight: 'bold' },
  
  // Idle Dashboard State
  idleState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  backToEventsBtn: { position: 'absolute', left: 20, zIndex: 10, width: 40, height: 40, justifyContent: 'center' },
  welcomeCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(0,122,255,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 25 },
  
  statCard: { width: '100%', padding: 25, borderRadius: 20, marginBottom: 30, alignItems: 'center', borderWidth: 1, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  statEventName: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  divider: { width: '100%', height: 1, backgroundColor: 'rgba(128,128,128,0.2)', marginVertical: 15 },
  statLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginBottom: 10, textAlign: 'center' },
  statValue: { fontSize: 36, fontWeight: '900', marginBottom: 15 },
  progressBar: { width: '100%', height: 10, borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%' },
  percentageText: { marginTop: 10, fontSize: 14, color: '#666', fontWeight: '500' },
  
  startButton: { backgroundColor: '#007AFF', paddingVertical: 18, width: '100%', borderRadius: 15, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  loadingBox: { alignItems: 'center' },
  loadingText: { marginTop: 15, fontSize: 16, fontWeight: '600' },
  torchButton: { position: 'absolute', right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  
  // Modal Styles
  manualEntryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
  manualEntryText: { color: 'white', marginLeft: 8, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { padding: 30, paddingTop: 15, borderTopLeftRadius: 30, borderTopRightRadius: 30, alignItems: 'center' },
  modalDragHandle: { width: 40, height: 5, borderRadius: 3, marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  manualInput: { width: '100%', height: 55, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, fontSize: 16, marginBottom: 20 },
  
  modalButtons: { flexDirection: 'row', gap: 15 },
  modalBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, flex: 1, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  
  searchContainer: { flexDirection: 'row', width: '100%', gap: 10, alignItems: 'center' },
  searchIconBtn: { padding: 15, borderRadius: 12, backgroundColor: 'rgba(0,122,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  ticketSelectItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderRadius: 12, marginBottom: 10, borderWidth: 1 },
});