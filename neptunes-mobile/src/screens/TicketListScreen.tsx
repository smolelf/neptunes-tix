import React, { useEffect, useState, useContext, useCallback, useRef, useMemo } from 'react';
import { 
    View, Text, FlatList, StyleSheet, ActivityIndicator, 
    TouchableOpacity, Modal, Alert, TextInput, AppState, AppStateStatus, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { ThemeContext } from '../context/ThemeContext';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';
import { debounce } from 'lodash';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import Slider from '@react-native-community/slider';

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

    // 🚀 NEW: Robust Coupon States
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponError, setCouponError] = useState('');

    const lastFetchTime = useRef<number>(0);
    const THROTTLE_MS = 30000;

    const queryRef = useRef('');

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

    // --- 🧮 MATH & CALCULATION LOGIC ---
    const subtotal = useMemo(() => {
        if (!selectedEvent) return 0;
        return selectedEvent.tiers.reduce((acc, tier) => acc + (tier.price * (quantities[tier.category] || 0)), 0);
    }, [selectedEvent, quantities]);

    const couponDiscountAmount = useMemo(() => {
        if (!appliedCoupon) return 0;
        return appliedCoupon.discount_type === 'percentage' 
            ? subtotal * (appliedCoupon.discount / 100) 
            : appliedCoupon.discount;
    }, [subtotal, appliedCoupon]);

    const remainingSubtotal = Math.max(0, subtotal - couponDiscountAmount);
    const maxPointsApplicable = Math.min(user?.points || 0, remainingSubtotal * 100);
    const pointsDiscount = redeemPoints / 100;
    const finalAmount = Math.max(0, remainingSubtotal - pointsDiscount);
    const totalTicketsSelected = Object.values(quantities).reduce((a, b) => a + b, 0);

    // Ensure points slider respects limits if quantity or coupon changes
    useEffect(() => {
        if (redeemPoints > maxPointsApplicable) {
            setRedeemPoints(maxPointsApplicable);
        }
    }, [maxPointsApplicable]);

    // --- 🎟️ ACTIONS ---
    const updateQty = (category: string, delta: number, maxStock: number) => {
        const current = quantities[category] || 0;
        const next = Math.max(0, Math.min(maxStock, current + delta));
        setQuantities(prev => ({ ...prev, [category]: next }));
    };

    const closeCheckoutModal = () => {
        setSelectedEvent(null);
        setQuantities({});
        setRedeemPoints(0);
        setCouponCode('');
        setAppliedCoupon(null);
        setCouponError('');
    };

    const handleBuyPress = (event: EventGroup) => {
        if (!user) {
            navigation.navigate('Signup', { targetEvent: event });
        } else {
            setSelectedEvent(event);
            setQuantities({});
            setRedeemPoints(0);
            setCouponCode('');
            setAppliedCoupon(null);
            setCouponError('');
        }
    };

    const validateCoupon = async () => {
        if (!couponCode.trim()) return;
        setCouponLoading(true);
        setCouponError('');
        try {
            const token = await SecureStore.getItemAsync('userToken');
            const response = await apiClient.post('/coupons/validate', {
                code: couponCode.trim().toUpperCase(),
                event_id: selectedEvent?.event_id
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAppliedCoupon(response.data);
            setCouponCode(response.data.code); 
        } catch (error: any) {
            setAppliedCoupon(null);
            setCouponError(error.response?.data?.error || "Invalid promo code");
        } finally {
            setCouponLoading(false);
        }
    };

    const clearCoupon = () => {
        setAppliedCoupon(null);
        setCouponCode('');
        setCouponError('');
    };

    const handleCheckout = async () => {
        if (!selectedEvent || totalTicketsSelected === 0) {
            Alert.alert("Error", "Please select at least one ticket.");
            return;
        }
        
        const items = Object.entries(quantities)
            .filter(([_, qty]) => qty > 0)
            .map(([category, quantity]) => ({ category, quantity }));

        try {
            setBookingLoading(true);
            const token = await SecureStore.getItemAsync('userToken');
            
            const response = await apiClient.post('/checkout', {
                event_id: selectedEvent.event_id,
                redeem_points: Math.floor(redeemPoints), 
                coupon_code: appliedCoupon ? appliedCoupon.code : '', 
                items: items 
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const paymentUrl = response.data.payment_url;
            if (paymentUrl) {
                setBookingLoading(false);
                const result = await WebBrowser.openBrowserAsync(paymentUrl, { showInRecents: true });
                closeCheckoutModal();
                
                if (result.type === 'cancel' || result.type === 'dismiss') {
                    verifyPaymentStatus(response.data.order_id); 
                }
            }
        } catch (error: any) {
            setBookingLoading(false);
            Alert.alert("Checkout Failed", error.response?.data?.error || "System error.");
        }
    };

    const verifyPaymentStatus = async (orderId: number) => {
        try {
            const response = await apiClient.get(`/orders/${orderId}/status`);
            if (response.data.status === 'paid') {
                setShowSuccess(true);
                if (user) refreshUser();
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
                if (user) refreshUser(); 
            }
        }, [user?.id]) 
    );

    const debouncedSearch = useCallback(
        debounce((nextValue: string) => fetchTickets(nextValue), 500),
        []
    );

    const handleSearchChange = (text: string) => {
        setSearchQuery(text);
        queryRef.current = text;
        debouncedSearch(text);
    };

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                fetchTickets(searchQuery);
                if (user) refreshUser(); 
            }
        });
        return () => subscription.remove();
    }, [user?.id]); 

    useEffect(() => {
        if (route.params?.autoOpenTicket) {
            const targetTicket = route.params.autoOpenTicket;
            const targetEvent = groupedEvents.find(e => e.event_id === targetTicket.event_id);

            if (targetEvent) {
                setSelectedEvent(targetEvent);
                setQuantities({ [targetTicket.category]: 1 });
            }
            navigation.setParams({ autoOpenTicket: undefined });
        }
    }, [route.params?.autoOpenTicket, groupedEvents]);

    useEffect(() => { fetchTickets(); }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchTickets(searchQuery, false);
        if (user) await refreshUser();
        setRefreshing(false);
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Text style={[styles.header, { color: colors.text }]}>Events</Text>
            
            <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="search" size={20} color={colors.subText} />
                <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search events, venues..."
                    placeholderTextColor={colors.subText}
                    value={searchQuery}
                    onChangeText={handleSearchChange}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => handleSearchChange('')}>
                        <Ionicons name="close-circle" size={18} color={colors.subText} />
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={groupedEvents}
                keyExtractor={(item) => item.event_id.toString()}
                refreshing={refreshing}
                onRefresh={onRefresh}
                renderItem={({ item }) => (
                    <TouchableOpacity style={[styles.ticketContainer, { backgroundColor: colors.card }]} onPress={() => handleBuyPress(item)}>
                        <View style={styles.ticketHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                                <View style={styles.infoRow}>
                                    <Ionicons name="location-outline" size={14} color={colors.subText} />
                                    <Text style={[styles.infoText, { color: colors.subText }]}>{item.venue}</Text>
                                </View>
                            </View>
                            <View style={styles.priceTag}>
                                <Text style={styles.priceText}>
                                    {item.tiers.length > 0 ? `From RM${Math.min(...item.tiers.map(t => t.price))}` : 'Sold Out'}
                                </Text>
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
                ListEmptyComponent={<View style={{ alignItems: 'center', marginTop: 50 }}><Text style={{ color: colors.subText }}>No events found.</Text></View>}
            />

            {/* --- CHECKOUT MODAL --- */}
            <Modal visible={!!selectedEvent} transparent={true} animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        
                        <View style={styles.modalDragHandle} />
                        <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedEvent?.name}</Text>

                        <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
                            
                            {/* TICKET SELECTION */}
                            {selectedEvent?.tiers.map((tier) => (
                                <View key={tier.category} style={styles.tierRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontWeight: 'bold', fontSize: 16, color: colors.text }}>{tier.category.toUpperCase()}</Text>
                                        <Text style={{ color: colors.subText }}>RM{tier.price} • {tier.stock} left</Text>
                                    </View>
                                    <View style={styles.smallStepper}>
                                        <TouchableOpacity onPress={() => updateQty(tier.category, -1, tier.stock)} style={styles.stepperBtnSmall}>
                                            <Ionicons name="remove" size={20} color={colors.text} />
                                        </TouchableOpacity>
                                        <Text style={[styles.quantityText, { color: colors.text }]}>{quantities[tier.category] || 0}</Text>
                                        <TouchableOpacity onPress={() => updateQty(tier.category, 1, tier.stock)} style={styles.stepperBtnSmall}>
                                            <Ionicons name="add" size={20} color={colors.text} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}

                            <View style={[styles.divider, { width: '100%', marginVertical: 15 }]} />

                            {/* 🚀 COUPON CODE VALIDATION */}
                            {subtotal > 0 && (
                                <View style={styles.couponContainer}>
                                    <Text style={{ color: colors.text, fontWeight: 'bold', marginBottom: 8 }}>Promo Code</Text>
                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <TextInput 
                                            style={[styles.couponInput, { 
                                                flex: 1, 
                                                borderColor: couponError ? '#FF3B30' : colors.border, 
                                                color: colors.text,
                                                backgroundColor: appliedCoupon ? 'rgba(40,167,69,0.05)' : 'transparent'
                                            }]}
                                            placeholder="Enter code here"
                                            placeholderTextColor={colors.subText}
                                            value={couponCode}
                                            onChangeText={(t) => {
                                                setCouponCode(t);
                                                if (appliedCoupon) setAppliedCoupon(null);
                                                if (couponError) setCouponError('');
                                            }}
                                            autoCapitalize="characters"
                                            editable={!appliedCoupon}
                                        />
                                        {!appliedCoupon ? (
                                            <TouchableOpacity 
                                                style={[styles.applyBtn, (!couponCode.trim() || couponLoading) && { opacity: 0.5 }]} 
                                                onPress={validateCoupon}
                                                disabled={!couponCode.trim() || couponLoading}
                                            >
                                                {couponLoading ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.applyBtnText}>Apply</Text>}
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity style={styles.clearBtn} onPress={clearCoupon}>
                                                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    
                                    {couponError ? (
                                        <Text style={{ color: '#FF3B30', fontSize: 12, marginTop: 5 }}>{couponError}</Text>
                                    ) : appliedCoupon ? (
                                        <Text style={{ color: '#28a745', fontSize: 13, marginTop: 5, fontWeight: '600' }}>
                                            ✅ {appliedCoupon.discount_type === 'percentage' ? `${appliedCoupon.discount}%` : `RM${appliedCoupon.discount}`} discount applied!
                                        </Text>
                                    ) : null}
                                </View>
                            )}

                            {/* 🚀 POINTS REDEMPTION SLIDER */}
                            {user?.points > 0 && remainingSubtotal > 0 && (
                                <View style={[styles.pointsContainer, { borderColor: colors.border }]}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                        <Text style={{ color: colors.text, fontWeight: 'bold' }}>Redeem Points</Text>
                                        <Text style={{ color: '#007AFF', fontWeight: 'bold' }}>-RM{(redeemPoints / 100).toFixed(2)}</Text>
                                    </View>
                                    <Slider
                                        style={{ width: '100%', height: 40 }}
                                        minimumValue={0}
                                        maximumValue={maxPointsApplicable}
                                        step={100} 
                                        value={redeemPoints}
                                        onValueChange={setRedeemPoints}
                                        minimumTrackTintColor="#007AFF"
                                        maximumTrackTintColor={colors.border}
                                        thumbTintColor="#007AFF"
                                    />
                                    <Text style={{ color: colors.subText, fontSize: 12, textAlign: 'right' }}>
                                        Using {redeemPoints} / {user?.points} pts
                                    </Text>
                                </View>
                            )}

                            {/* 🚀 DETAILED SUMMARY */}
                            <View style={styles.summaryBox}>
                                <View style={styles.summaryRow}>
                                    <Text style={[styles.summaryLabel, { color: colors.subText }]}>Subtotal</Text>
                                    <Text style={[styles.summaryValue, { color: colors.text }]}>RM{subtotal.toFixed(2)}</Text>
                                </View>
                                
                                {appliedCoupon && (
                                    <View style={styles.summaryRow}>
                                        <Text style={[styles.summaryLabel, { color: '#28a745' }]}>Promo Discount</Text>
                                        <Text style={[styles.summaryValue, { color: '#28a745' }]}>-RM{couponDiscountAmount.toFixed(2)}</Text>
                                    </View>
                                )}
                                
                                {redeemPoints > 0 && (
                                    <View style={styles.summaryRow}>
                                        <Text style={[styles.summaryLabel, { color: '#007AFF' }]}>Points Redeemed</Text>
                                        <Text style={[styles.summaryValue, { color: '#007AFF' }]}>-RM{pointsDiscount.toFixed(2)}</Text>
                                    </View>
                                )}
                                
                                <View style={[styles.divider, { marginVertical: 10, backgroundColor: colors.border }]} />
                                
                                <View style={styles.summaryRow}>
                                    <Text style={[styles.totalLabel, { color: colors.text }]}>Total to Pay</Text>
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

                            <TouchableOpacity style={styles.cancelButton} onPress={closeCheckoutModal}>
                                <Text style={styles.cancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                        
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
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
    
    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { width: '100%', maxHeight: '85%', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, alignItems: 'center' },
    modalDragHandle: { width: 40, height: 5, backgroundColor: 'rgba(128,128,128,0.3)', borderRadius: 3, marginBottom: 15 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
    tierRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 15 },
    smallStepper: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    stepperBtnSmall: { width: 35, height: 35, borderRadius: 17.5, backgroundColor: 'rgba(0,122,255,0.1)', justifyContent: 'center', alignItems: 'center' },
    quantityText: { fontSize: 22, fontWeight: 'bold', minWidth: 35, textAlign: 'center' },
    
    // 🚀 NEW Slider & Coupon Styles
    pointsContainer: { width: '100%', marginBottom: 15, padding: 15, borderRadius: 12, borderWidth: 1 },
    couponContainer: { width: '100%', marginBottom: 20 },
    couponInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 },
    applyBtn: { backgroundColor: '#007AFF', borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    applyBtnText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
    clearBtn: { backgroundColor: 'rgba(255,59,48,0.1)', borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    
    // 🚀 NEW Summary Styles
    summaryBox: { width: '100%', marginBottom: 20, marginTop: 5 },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    summaryLabel: { fontSize: 15, fontWeight: '500' },
    summaryValue: { fontSize: 15, fontWeight: 'bold' },
    totalLabel: { fontSize: 18, fontWeight: 'bold' },
    totalPriceText: { fontSize: 24, fontWeight: 'bold', color: '#28a745' },
    
    confirmBtn: { backgroundColor: '#007AFF', padding: 16, borderRadius: 15, width: '100%', alignItems: 'center', marginBottom: 10 },
    confirmText: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
    cancelButton: { padding: 12, width: '100%', alignItems: 'center' },
    cancelButtonText: { color: '#8e8e93', fontSize: 15, fontWeight: '600' },
});