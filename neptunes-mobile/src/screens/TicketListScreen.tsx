import React, { useEffect, useState, useContext,
    useCallback, useRef } from 'react';
import { 
    View, Text, FlatList, StyleSheet, ActivityIndicator, 
    TouchableOpacity, Modal, Alert, TextInput, AppState, AppStateStatus 
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser'; // 🌐 In-app browser
import LottieView from 'lottie-react-native'; // 🎉 Success animation
import { ThemeContext } from '../context/ThemeContext';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';
import { debounce } from 'lodash';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';

interface Ticket {
    ID: number; 
    event_id: number; 
    category: string;
    price: number;
    stock: number;
    event?: {
        name: string;
        venue?: string;
        date?: string;
    };
}

export default function TicketListScreen({ route }: any) {
    // States
    const navigation = useNavigation<any>(); // 🚀 Initialize navigation
    const { colors } = useContext(ThemeContext);
    const { user, token, refreshUser } = useContext(AuthContext);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [bookingLoading, setBookingLoading] = useState(false);
    const [redeemPoints, setRedeemPoints] = useState(0);
    const [showSuccess, setShowSuccess] = useState(false); // Success Lottie Modal

    // Pricing Logic
    const subtotal = (selectedTicket?.price || 0) * quantity;
    const discount = redeemPoints / 100;
    const finalAmount = Math.max(0, subtotal - discount);

    const lastFetchTime = useRef<number>(0);
    const THROTTLE_MS = 30000; // 30 seconds

    const fetchTickets = async (query: string = '', showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            const response = await apiClient.get<{ data: Ticket[] }>(`/marketplace?q=${query}`);
            setTickets(response.data.data || []);
            
            // Update timestamp
            lastFetchTime.current = Date.now();
        } catch (error) {
            console.error("Marketplace fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleBuyPress = (ticket: Ticket) => { // Changed param name for clarity
        if (!user) {
            // 🚀 If Guest, send them to signup and pass the ticket info
            // Note: Ensure param name 'autoOpenTicket' matches your useEffect listener
            navigation.navigate('Signup', { autoOpenTicket: ticket });
        } else {
            // 🚀 SUCCESS FIX: Instead of navigating to 'Checkout', 
            // just set the selected ticket to open the built-in Modal!
            setQuantity(1);
            setSelectedTicket(ticket);
        }
    };

    useFocusEffect(
        useCallback(() => {
            const now = Date.now();
            if (now - lastFetchTime.current > THROTTLE_MS || tickets.length === 0) {
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
            const ticket = route.params.autoOpenTicket;
            console.log("Auto-opening ticket after signup:", ticket.event?.name);
            
            // Set the modal state
            setQuantity(1);
            setSelectedTicket(ticket);
            
            // Clear the params so it doesn't open again on next visit
            navigation.setParams({ autoOpenTicket: undefined });
        }
    }, [route.params?.autoOpenTicket]);

    useEffect(() => { fetchTickets(); }, []);

    const handleCheckout = async () => {
        if (!selectedTicket) return;
        
        try {
            setBookingLoading(true);
            const token = await SecureStore.getItemAsync('userToken');
            
            const response = await apiClient.post('/checkout', {
                event_id: selectedTicket.event_id,
                category: selectedTicket.category,
                quantity: quantity,
                redeem_points: redeemPoints,
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            console.log("Checkout Response Data:", response.data);

            const orderId = response.data.order_id || response.data.id || response.data.ID;
            
            const paymentUrl = response.data.payment_url;

            if (paymentUrl) {
                // Keep the modal open but stop loading
                setBookingLoading(false);

                // Open browser directly
                const result = await WebBrowser.openBrowserAsync(paymentUrl, {
                    showInRecents: true,
                });

                // NOW close the ticket selection modal
                setSelectedTicket(null);
                setRedeemPoints(0);

                // Check if the user returned
                if (result.type === 'cancel' || result.type === 'dismiss') {
                    // IMPORTANT: We should verify with the backend if the order is PAID
                    // before showing the success animation
                    verifyPaymentStatus(orderId); 
                }
            }
        } catch (error: any) {
            setBookingLoading(false);
            console.error("Checkout Error:", error);
            Alert.alert("Error", error.response?.data?.error || "Checkout failed");
        }
    };

    // Add this helper to verify if they ACTUALLY paid
    const verifyPaymentStatus = async (orderId: number) => {
    try {
        const response = await apiClient.get(`/orders/${orderId}/status`);
        
        if (response.data.status === 'paid') {
            setShowSuccess(true);
            refreshUser();
            fetchTickets(searchQuery);
            setTimeout(() => setShowSuccess(false), 3000);
        } else {
            // Instead of a loud Alert, maybe just a console log or a smaller toast
            console.log("Payment not completed yet.");
        }
    } catch (e: any) {
        // Handle the 404 or network error silently
        if (e.response?.status === 404) {
            console.warn("Status endpoint missing on backend!");
        } else {
            console.error("Status check failed", e);
        }
    }
};

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchTickets(searchQuery, false);
        await refreshUser();
        setRefreshing(false);
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Text style={[styles.header, { color: colors.text }]}>Tickets Available</Text>
            
            {/* Search (Existing) */}
            <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="search" size={20} color={colors.subText} style={{ marginRight: 10 }} />
                <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search events..."
                    placeholderTextColor={colors.subText}
                    value={searchQuery}
                    onChangeText={handleSearchChange}
                />
            </View>
            
            {/* Ticket List (Existing) */}
            <FlatList
                data={tickets}
                keyExtractor={(item) => `${item.event_id}-${item.category}`}
                renderItem={({ item }) => (
                    <TouchableOpacity 
                        style={[styles.ticketContainer, { backgroundColor: colors.card }]} 
                        onPress={() => handleBuyPress(item)} // 🚀 Now uses the guard logic!
                    >
                        <View style={styles.ticketHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>{item.event?.name}</Text>
                                <View style={styles.infoRow}>
                                    <Ionicons name="location-outline" size={14} color={colors.subText} />
                                    <Text style={[styles.infoText, { color: colors.subText }]}>{item.event?.venue || 'Venue TBA'}</Text>
                                </View>
                            </View>
                            <View style={styles.priceTag}>
                                <Text style={styles.priceText}>RM{item.price}</Text>
                            </View>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.ticketFooter}>
                            <Text style={[styles.footerText, { color: colors.text }]}>{item.stock} available</Text>
                            <View style={styles.categoryBadge}>
                                <Text style={styles.categoryText}>{item.category.toUpperCase()}</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                )}
                refreshing={refreshing}
                onRefresh={onRefresh}
            />

            {/* --- CHECKOUT MODAL --- */}
            <Modal visible={!!selectedTicket} transparent={true} animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedTicket?.event?.name}</Text>
                        
                        {/* Stepper */}
                        <View style={styles.stepper}>
                            <TouchableOpacity onPress={() => setQuantity(Math.max(1, quantity - 1))} style={styles.stepperBtn}>
                                <Ionicons name="remove" size={24} color={colors.text} />
                            </TouchableOpacity>
                            <Text style={[styles.quantityText, { color: colors.text }]}>{quantity}</Text>
                            <TouchableOpacity 
                                onPress={() => quantity < (selectedTicket?.stock || 0) && setQuantity(quantity + 1)} 
                                style={styles.stepperBtn}
                            >
                                <Ionicons name="add" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        {/* 🪙 Points Section */}
                        {user?.points > 0 && (
                            <View style={styles.pointsSection}>
                                <Text style={[styles.pointsLabel, { color: colors.subText }]}>Balance: {user.points} pts</Text>
                                <TouchableOpacity 
                                    style={[styles.pointsToggle, redeemPoints > 0 && styles.pointsToggleActive]}
                                    onPress={() => setRedeemPoints(redeemPoints > 0 ? 0 : Math.min(user.points, subtotal * 100))}
                                >
                                    <Text style={[styles.pointsToggleText, { color: redeemPoints > 0 ? '#fff' : '#007AFF' }]}>
                                        {redeemPoints > 0 ? `Saved RM${discount.toFixed(2)}` : `Save RM${(user.points/100).toFixed(2)} with pts`}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Price Summary */}
                        <View style={styles.summaryBox}>
                            <View style={styles.summaryRow}><Text style={{ color: colors.subText }}>Subtotal</Text><Text style={{ color: colors.text }}>RM{subtotal.toFixed(2)}</Text></View>
                            {redeemPoints > 0 && <View style={styles.summaryRow}><Text style={{ color: '#ff3b30' }}>Discount</Text><Text style={{ color: '#ff3b30' }}>-RM{discount.toFixed(2)}</Text></View>}
                            <View style={[styles.divider, { marginVertical: 10 }]} />
                            <View style={styles.summaryRow}><Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text><Text style={styles.totalPriceText}>RM{finalAmount.toFixed(2)}</Text></View>
                        </View>

                        <TouchableOpacity style={[styles.confirmBtn, bookingLoading && { backgroundColor: '#ccc' }]} onPress={handleCheckout} disabled={bookingLoading}>
                            {bookingLoading ? <ActivityIndicator color="white" /> : <Text style={styles.confirmText}>Proceed to Payment</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.cancelButton} onPress={() => { setSelectedTicket(null); setRedeemPoints(0); }}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* --- 🎉 SUCCESS LOTTIE MODAL --- */}
            <Modal visible={showSuccess} transparent={true} animationType="fade">
                <View style={styles.successOverlay}>
                    {/* Wrap in a View that prevents touch propagation to background */}
                    <TouchableOpacity activeOpacity={1} style={styles.successCard}>
                        <LottieView 
                            source={require('../../assets/success-check.json')} 
                            autoPlay 
                            loop={false} 
                            style={{ width: 180, height: 180 }} 
                        />
                        <Text style={[styles.successTitle, {color: '#000'}]}>Payment Received!</Text>
                        <Text style={styles.successSub}>Your tickets are now available.</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    // ... Copy your existing styles here ...
    // ADD THESE NEW STYLES:
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
});