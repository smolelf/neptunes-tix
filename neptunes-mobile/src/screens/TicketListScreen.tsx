import React, { useEffect, useState, useContext, useCallback, useRef, useMemo } from 'react';
import { 
    View, Text, FlatList, StyleSheet, ActivityIndicator, 
    TouchableOpacity, Modal, Alert, TextInput, AppState, AppStateStatus 
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import LottieView from 'lottie-react-native';
import { ThemeContext } from '../context/ThemeContext';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';
import { debounce } from 'lodash';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';

// 🚀 New Structured Interfaces
interface TicketTier {
    category: string;
    price: number;
    stock: number;
}

interface EventGroup {
    event_id: number;
    name: string;
    venue: string;
    date: string;
    tiers: TicketTier[];
}

export default function TicketListScreen({ route }: any) {
    const navigation = useNavigation<any>();
    const { colors } = useContext(ThemeContext);
    const { user, refreshUser } = useContext(AuthContext);
    
    // States
    const [rawTickets, setRawTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Cart States
    const [selectedEvent, setSelectedEvent] = useState<EventGroup | null>(null);
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [redeemPoints, setRedeemPoints] = useState(0);
    const [bookingLoading, setBookingLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const lastFetchTime = useRef<number>(0);
    const THROTTLE_MS = 30000;

    const fetchTickets = async (query: string = '', showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            const response = await apiClient.get(`/marketplace?q=${query}`);
            setRawTickets(response.data.data || []);
            lastFetchTime.current = Date.now();
        } catch (error) {
            console.error("Marketplace fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    // 🚀 Grouping Logic: Flattens backend response into Event -> Tiers
    const groupedEvents = useMemo(() => {
        const groups: Record<number, EventGroup> = {};
        rawTickets.forEach(t => {
            if (!groups[t.event_id]) {
                groups[t.event_id] = {
                    event_id: t.event_id,
                    name: t.event?.name || 'TBA',
                    venue: t.event?.venue || 'TBA',
                    date: t.event?.date || 'TBA',
                    tiers: []
                };
            }
            groups[t.event_id].tiers.push({
                category: t.category,
                price: t.price,
                stock: t.stock
            });
        });
        return Object.values(groups);
    }, [rawTickets]);

    // Dynamic Pricing Logic
    const subtotal = useMemo(() => {
        if (!selectedEvent) return 0;
        return selectedEvent.tiers.reduce((acc, tier) => {
            return acc + (tier.price * (quantities[tier.category] || 0));
        }, 0);
    }, [selectedEvent, quantities]);

    const totalTicketsSelected = Object.values(quantities).reduce((a, b) => a + b, 0);
    const discount = redeemPoints / 100;
    const finalAmount = Math.max(0, subtotal - discount);

    const updateQty = (category: string, delta: number, maxStock: number) => {
        const current = quantities[category] || 0;
        const next = Math.max(0, Math.min(maxStock, current + delta));
        setQuantities(prev => ({ ...prev, [category]: next }));
        // Reset points if user changes cart, so they don't overspend
        setRedeemPoints(0); 
    };

    const handleBuyPress = (event: EventGroup) => {
        if (!user) {
            navigation.navigate('Signup', { targetEvent: event });
        } else {
            setSelectedEvent(event);
            setQuantities({});
            setRedeemPoints(0);
        }
    };

    const handlePointsToggle = () => {
        if (redeemPoints > 0) {
            setRedeemPoints(0);
        } else {
            const pointsNeeded = subtotal * 100;
            const pointsToApply = Math.min(user?.points || 0, pointsNeeded);
            setRedeemPoints(pointsToApply);
        }
    };

    const handleCheckout = async () => {
        if (!selectedEvent || totalTicketsSelected === 0) {
            Alert.alert("Error", "Please select at least one ticket.");
            return;
        }
        
        // 🚀 Transform local cart state into backend-friendly array
        const items = Object.entries(quantities)
            .filter(([_, qty]) => qty > 0)
            .map(([category, quantity]) => ({ category, quantity }));

        try {
            setBookingLoading(true);
            const token = await SecureStore.getItemAsync('userToken');
            
            const response = await apiClient.post('/checkout', {
                event_id: selectedEvent.event_id,
                redeem_points: redeemPoints,
                items: items // Sending the array!
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const paymentUrl = response.data.payment_url;
            if (paymentUrl) {
                setBookingLoading(false);
                const result = await WebBrowser.openBrowserAsync(paymentUrl, { showInRecents: true });
                setSelectedEvent(null);
                
                if (result.type === 'cancel' || result.type === 'dismiss') {
                    verifyPaymentStatus(response.data.order_id); 
                }
            }
        } catch (error: any) {
            setBookingLoading(false);
            Alert.alert("Error", error.response?.data?.error || "Checkout failed");
        }
    };

    const verifyPaymentStatus = async (orderId: number) => {
        try {
            const response = await apiClient.get(`/orders/${orderId}/status`);
            if (response.data.status === 'paid') {
                setShowSuccess(true);
                refreshUser();
                fetchTickets(searchQuery);
                setTimeout(() => setShowSuccess(false), 3000);
            }
        } catch (e) {
            console.error("Status check failed", e);
        }
    };

    useFocusEffect(
        useCallback(() => {
            const now = Date.now();
            if (now - lastFetchTime.current > THROTTLE_MS || rawTickets.length === 0) {
                fetchTickets(searchQuery, false);
                // 🚀 Only refresh user points if they are logged in
                if (user) refreshUser(); 
            }
        }, [searchQuery, user]) // Add user to dependency array
    );

    const debouncedSearch = useCallback(
        debounce((nextValue: string) => fetchTickets(nextValue), 500),
        []
    );

    const handleSearchChange = (text: string) => {
        setSearchQuery(text);
        debouncedSearch(text);
    };

    // AppState Listener to refresh data when returning from In-App Browser
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                fetchTickets(searchQuery);
                refreshUser(); 
            }
        });
        return () => subscription.remove();
    }, [searchQuery, refreshUser]);

    useEffect(() => {
        if (route.params?.autoOpenTicket) {
            const targetTicket = route.params.autoOpenTicket;
            console.log("Auto-opening event for:", targetTicket.event?.name);
            
            // 1. Find the event group that contains this ticket
            // We search through the already calculated 'groupedEvents'
            const targetEvent = groupedEvents.find(e => e.event_id === targetTicket.event_id);

            if (targetEvent) {
                // 2. Open the modal for this Event
                setSelectedEvent(targetEvent);

                // 3. Pre-select 1 qty for the specific category
                setQuantities({ [targetTicket.category]: 1 });
            }
            
            // Clear the params so it doesn't open again on next visit
            navigation.setParams({ autoOpenTicket: undefined });
        }
    }, [route.params?.autoOpenTicket, groupedEvents]);

    useEffect(() => { fetchTickets(); }, []);

    


    const onRefresh = async () => {
        setRefreshing(true);
        await fetchTickets(searchQuery, false);
        await refreshUser();
        setRefreshing(false);
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Text style={[styles.header, { color: colors.text }]}>Events</Text>
            
            <FlatList
                data={groupedEvents}
                keyExtractor={(item) => item.event_id.toString()}
                renderItem={({ item }) => (
                    <TouchableOpacity 
                        style={[styles.ticketContainer, { backgroundColor: colors.card }]} 
                        onPress={() => handleBuyPress(item)}
                    >
                        <View style={styles.ticketHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                                <View style={styles.infoRow}>
                                    <Ionicons name="location-outline" size={14} color={colors.subText} />
                                    <Text style={[styles.infoText, { color: colors.subText }]}>{item.venue}</Text>
                                </View>
                            </View>
                            <View style={styles.priceTag}>
                                <Text style={styles.priceText}>From RM{Math.min(...item.tiers.map(t => t.price))}</Text>
                            </View>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.ticketFooter}>
                            <Text style={[styles.footerText, { color: colors.text }]}>
                                {item.tiers.reduce((sum, t) => sum + t.stock, 0)} total tickets left
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}
            />

            {/* --- CHECKOUT MODAL WITH MULTI-TIER SUPPORT --- */}
            <Modal visible={!!selectedEvent} transparent={true} animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 20 }]}>
                            {selectedEvent?.name}
                        </Text>

                        {/* 🚀 Dynamic Tier Rows */}
                        {selectedEvent?.tiers.map((tier) => (
                            <View key={tier.category} style={styles.tierRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: 'bold', fontSize: 16, color: colors.text }}>
                                        {tier.category.toUpperCase()}
                                    </Text>
                                    <Text style={{ color: colors.subText }}>RM{tier.price} • {tier.stock} left</Text>
                                </View>
                                
                                <View style={styles.smallStepper}>
                                    <TouchableOpacity 
                                        onPress={() => updateQty(tier.category, -1, tier.stock)} 
                                        style={styles.stepperBtnSmall}
                                    >
                                        <Ionicons name="remove" size={20} color={colors.text} />
                                    </TouchableOpacity>
                                    <Text style={[styles.quantityText, { color: colors.text, minWidth: 25 }]}>
                                        {quantities[tier.category] || 0}
                                    </Text>
                                    <TouchableOpacity 
                                        onPress={() => updateQty(tier.category, 1, tier.stock)} 
                                        style={styles.stepperBtnSmall}
                                    >
                                        <Ionicons name="add" size={20} color={colors.text} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}

                        <View style={[styles.divider, { width: '100%', marginVertical: 15 }]} />

                        {/* Points Section */}
                        {user?.points > 0 && subtotal > 0 && (
                            <TouchableOpacity 
                                style={[styles.pointsToggle, redeemPoints > 0 && styles.pointsToggleActive]}
                                onPress={handlePointsToggle}
                            >
                                <Text style={[styles.pointsToggleText, { color: redeemPoints > 0 ? '#fff' : '#007AFF' }]}>
                                    {redeemPoints > 0 
                                        ? `Applied -RM${(redeemPoints / 100).toFixed(2)}` 
                                        : `Use Points (Save up to RM${Math.min((user?.points || 0) / 100, subtotal).toFixed(2)})`}
                                </Text>
                            </TouchableOpacity>
                        )}

                        {/* Price Summary */}
                        <View style={styles.summaryBox}>
                            <View style={styles.summaryRow}>
                                <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
                                <Text style={styles.totalPriceText}>RM{finalAmount.toFixed(2)}</Text>
                            </View>
                        </View>

                        <TouchableOpacity 
                            style={[styles.confirmBtn, (bookingLoading || totalTicketsSelected === 0) && { backgroundColor: '#ccc' }]} 
                            onPress={handleCheckout} 
                            disabled={bookingLoading || totalTicketsSelected === 0}
                        >
                            {bookingLoading ? <ActivityIndicator color="white" /> : <Text style={styles.confirmText}>Proceed to Payment</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.cancelButton} onPress={() => setSelectedEvent(null)}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    successOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    successCard: {
        backgroundColor: 'white',
        borderRadius: 30,
        padding: 30,
        alignItems: 'center',
        width: '80%',
    },
    successTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 10 },
    successSub: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 },
    pointsSection: { width: '100%', padding: 15, backgroundColor: 'rgba(0,122,255,0.05)', borderRadius: 12, marginBottom: 20, alignItems: 'center' },
    pointsLabel: { fontSize: 13, marginBottom: 8 },
    pointsToggle: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20, borderWidth: 1, borderColor: '#007AFF' },
    pointsToggleActive: { backgroundColor: '#007AFF' },
    pointsToggleText: { fontWeight: 'bold' },
    summaryBox: { width: '100%', marginBottom: 20 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    totalLabel: { fontSize: 18, fontWeight: 'bold' },
    totalPriceText: { fontSize: 22, fontWeight: 'bold', color: '#28a745' },
    container: { flex: 1, paddingHorizontal: 16 },
    header: { fontSize: 28, fontWeight: '800', marginBottom: 20, marginTop: 40, letterSpacing: -0.5 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 50, borderRadius: 15, borderWidth: 1, marginBottom: 20 },
    searchInput: { flex: 1, fontSize: 16, marginLeft: 8 },
    ticketContainer: { borderRadius: 20, padding: 18, marginBottom: 16, borderLeftWidth: 6, borderLeftColor: '#007AFF' },
    ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    eventTitle: { fontSize: 19, fontWeight: 'bold', marginBottom: 6 },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
    infoText: { fontSize: 14, marginLeft: 6 },
    priceTag: { backgroundColor: '#28a745', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
    priceText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
    divider: { height: 1, backgroundColor: 'rgba(128,128,128,0.15)', marginVertical: 15 },
    ticketFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    footerText: { fontSize: 13, fontWeight: '600' },
    categoryBadge: { backgroundColor: 'rgba(0,122,255,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    categoryText: { color: '#007AFF', fontSize: 11, fontWeight: '900' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '88%', borderRadius: 25, padding: 24, alignItems: 'center' },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 8 },
    stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 25, gap: 35 },
    stepperBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,122,255,0.1)', justifyContent: 'center', alignItems: 'center' },
    quantityText: { fontSize: 26, fontWeight: 'bold', minWidth: 40, textAlign: 'center' },
    confirmBtn: { backgroundColor: '#007AFF', padding: 16, borderRadius: 15, width: '100%', alignItems: 'center', marginBottom: 10 },
    confirmText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
    cancelButton: { padding: 12, width: '100%', alignItems: 'center' },
    cancelButtonText: { color: '#8e8e93', fontSize: 15, fontWeight: '600' },
    tierRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 15 },
    smallStepper: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    stepperBtnSmall: { width: 35, height: 35, borderRadius: 17.5, backgroundColor: 'rgba(0,122,255,0.1)', justifyContent: 'center', alignItems: 'center' },
});