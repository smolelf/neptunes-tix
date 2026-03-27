import React, { useContext, useState, useMemo, useEffect } from 'react';
import { 
    View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, 
    Platform, Modal, KeyboardAvoidingView, TextInput, ActivityIndicator, Alert, Dimensions 
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';
import * as WebBrowser from 'expo-web-browser';
import Slider from '@react-native-community/slider';

const { width } = Dimensions.get('window');
const SERVER_BASE_URL = 'http://192.168.1.100:8080';

export default function EventDetailScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { colors } = useContext(ThemeContext);
    const { user, refreshUser } = useContext(AuthContext);

    const { event } = route.params || {};

    // --- 🖼️ GALLERY STATES ---
    const [gallery, setGallery] = useState<any[]>([]);
    const [activeSlide, setActiveSlide] = useState(0);

    // --- 🛒 CHECKOUT STATES ---
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [redeemPoints, setRedeemPoints] = useState(0);
    const [bookingLoading, setBookingLoading] = useState(false);
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponError, setCouponError] = useState('');

    useEffect(() => {
        if (!event?.event_id) return;
        const fetchGallery = async () => {
            try {
                const response = await apiClient.get(`/events/${event.event_id}`);
                
                // 🚀 FIXED: Look inside response.data.event to find the images!
                // We add fallbacks just in case your Go JSON tags are capitalized differently
                const fetchedImages = response.data.event?.images || response.data.Event?.Images || response.data.images;
                
                if (fetchedImages && Array.isArray(fetchedImages)) {
                    setGallery(fetchedImages);
                } else {
                    console.log("No images array found in response:", response.data);
                }
            } catch (error) {
                console.log("Failed to fetch gallery:", error);
            }
        };
        fetchGallery();
    }, [event?.event_id]);

    // 🚀 COMBINE BANNER + GALLERY IMAGES
    const allImages = useMemo(() => {
        if (!event) return [];
        const mainBanner = event.banner_url ? { uri: `${SERVER_BASE_URL}${event.banner_url}` } : require('../../assets/placeholder.png');
        const extraImages = gallery.map(img => ({ uri: `${SERVER_BASE_URL}${img.image_url}` }));
        return [mainBanner, ...extraImages];
    }, [event, gallery]);

    const handleScroll = (e: any) => {
        const slide = Math.round(e.nativeEvent.contentOffset.x / width);
        setActiveSlide(slide);
    };

    // --- 🧮 MATH & CALCULATION LOGIC ---
    const subtotal = useMemo(() => {
        if (!event || !event.tiers) return 0;
        return event.tiers.reduce((acc: number, tier: any) => acc + (tier.price * (quantities[tier.category] || 0)), 0);
    }, [event, quantities]);

    const couponDiscountAmount = useMemo(() => {
        if (!appliedCoupon) return 0;
        return appliedCoupon.discount_type === 'percentage' ? subtotal * (appliedCoupon.discount / 100) : appliedCoupon.discount;
    }, [subtotal, appliedCoupon]);

    const remainingSubtotal = Math.max(0, subtotal - couponDiscountAmount);
    const maxPointsApplicable = Math.min(user?.points || 0, remainingSubtotal * 100);
    const pointsDiscount = redeemPoints / 100;
    const finalAmount = Math.max(0, remainingSubtotal - pointsDiscount);
    const totalTicketsSelected = Object.values(quantities).reduce((a, b) => a + b, 0);

    useEffect(() => {
        if (redeemPoints > maxPointsApplicable) setRedeemPoints(maxPointsApplicable);
    }, [maxPointsApplicable]);

    if (!event) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <Text style={{ color: colors.text }}>Event details not found.</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}><Text style={{ color: '#007AFF' }}>Go Back</Text></TouchableOpacity>
            </View>
        );
    }

    // --- 🎟️ ACTIONS ---
    const handleGetTicketsPress = () => {
        if (!user) navigation.navigate('Signup', { targetEvent: event });
        else setIsModalVisible(true);
    };

    const updateQty = (category: string, delta: number, maxStock: number) => {
        const current = quantities[category] || 0;
        const next = Math.max(0, Math.min(maxStock, current + delta));
        setQuantities(prev => ({ ...prev, [category]: next }));
    };

    const closeCheckoutModal = () => {
        setIsModalVisible(false);
        setQuantities({});
        setRedeemPoints(0);
        setCouponCode('');
        setAppliedCoupon(null);
        setCouponError('');
    };

    const validateCoupon = async () => {
        if (!couponCode.trim()) return;
        setCouponLoading(true);
        setCouponError('');
        try {
            const token = await SecureStore.getItemAsync('userToken');
            const response = await apiClient.post('/coupons/validate', { code: couponCode.trim().toUpperCase(), event_id: event.event_id }, { headers: { Authorization: `Bearer ${token}` } });
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
        if (totalTicketsSelected === 0) {
            Alert.alert("Error", "Please select at least one ticket.");
            return;
        }
        const items = Object.entries(quantities).filter(([_, qty]) => qty > 0).map(([category, quantity]) => ({ category, quantity }));

        try {
            setBookingLoading(true);
            const token = await SecureStore.getItemAsync('userToken');
            const response = await apiClient.post('/checkout', { event_id: event.event_id, redeem_points: Math.floor(redeemPoints), coupon_code: appliedCoupon ? appliedCoupon.code : '', items: items }, { headers: { Authorization: `Bearer ${token}` } });
            
            if (response.data.payment_url) {
                setBookingLoading(false);
                const result = await WebBrowser.openBrowserAsync(response.data.payment_url, { showInRecents: true });
                closeCheckoutModal();
                if (result.type === 'cancel' || result.type === 'dismiss') {
                    if (user) refreshUser();
                }
            }
        } catch (error: any) {
            setBookingLoading(false);
            Alert.alert("Checkout Failed", error.response?.data?.error || "System error.");
        }
    };

    const minPrice = event.tiers?.length > 0 ? Math.min(...event.tiers.map((t: any) => t.price)) : 0;
    const formattedDate = event.date !== 'TBA' ? new Date(event.date).toLocaleDateString('en-MY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Date TBA';

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                
                {/* 🚀 NEW SWIPEABLE HERO GALLERY */}
                <View style={styles.imageContainer}>
                    <ScrollView 
                        horizontal 
                        pagingEnabled 
                        showsHorizontalScrollIndicator={false}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                    >
                        {allImages.map((img, index) => (
                            <Image key={index} source={img} style={styles.heroImage} />
                        ))}
                    </ScrollView>

                    {/* Pagination Dots */}
                    {allImages.length > 1 && (
                        <View style={styles.paginationContainer}>
                            {allImages.map((_, index) => (
                                <View key={index} style={[styles.dot, activeSlide === index ? styles.activeDot : null]} />
                            ))}
                        </View>
                    )}

                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={24} color="#000" />
                    </TouchableOpacity>
                </View>

                {/* Content Overlay */}
                <View style={[styles.contentWrapper, { backgroundColor: colors.background }]}>
                    <View style={styles.titleRow}>
                        <Text style={[styles.title, { color: colors.text }]} numberOfLines={3}>{event.name}</Text>
                    </View>

                    <View style={styles.infoSection}>
                        <View style={styles.infoRow}>
                            <View style={[styles.iconBox, { backgroundColor: 'rgba(0,122,255,0.1)' }]}><Ionicons name="calendar" size={20} color="#007AFF" /></View>
                            <View style={styles.infoTextWrapper}>
                                <Text style={[styles.infoLabel, { color: colors.subText }]}>Date & Time</Text>
                                <Text style={[styles.infoValue, { color: colors.text }]}>{formattedDate}</Text>
                                <Text style={[styles.infoSubValue, { color: colors.subText }]}>Doors open at {event.doors_open || 'TBA'}</Text>
                            </View>
                        </View>

                        <View style={styles.infoRow}>
                            <View style={[styles.iconBox, { backgroundColor: 'rgba(255,149,0,0.1)' }]}><Ionicons name="location" size={20} color="#FF9500" /></View>
                            <View style={styles.infoTextWrapper}>
                                <Text style={[styles.infoLabel, { color: colors.subText }]}>Location</Text>
                                <Text style={[styles.infoValue, { color: colors.text }]}>{event.venue}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.border }]} />

                    <View style={styles.aboutSection}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>About Event</Text>
                        <Text style={[styles.description, { color: colors.subText }]}>{event.description || "Get ready for an unforgettable experience! More details about this event will be announced soon."}</Text>
                    </View>
                </View>
            </ScrollView>

            {/* Sticky Bottom Bar */}
            <View style={[styles.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
                <View style={styles.priceContainer}>
                    <Text style={[styles.priceLabel, { color: colors.subText }]}>Price</Text>
                    <Text style={[styles.bottomPrice, { color: colors.text }]}>{minPrice > 0 ? `RM ${minPrice}` : 'Free'}</Text>
                </View>
                <TouchableOpacity style={styles.buyButton} onPress={handleGetTicketsPress}>
                    <Text style={styles.buyButtonText}>Get Tickets</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 5 }} />
                </TouchableOpacity>
            </View>

            {/* CHECKOUT MODAL */}
            <Modal visible={isModalVisible} transparent={true} animationType="slide">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <View style={styles.modalDragHandle} />
                        <Text style={[styles.modalTitle, { color: colors.text }]}>{event.name}</Text>

                        <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
                            {/* TICKET SELECTION */}
                            {event.tiers?.map((tier: any) => (
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

                            {/* COUPONS */}
                            {subtotal > 0 && (
                                <View style={styles.couponContainer}>
                                    <Text style={{ color: colors.text, fontWeight: 'bold', marginBottom: 8 }}>Promo Code</Text>
                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <TextInput 
                                            style={[styles.couponInput, { flex: 1, borderColor: couponError ? '#FF3B30' : colors.border, color: colors.text, backgroundColor: appliedCoupon ? 'rgba(40,167,69,0.05)' : 'transparent' }]}
                                            placeholder="Enter code here" placeholderTextColor={colors.subText}
                                            value={couponCode} autoCapitalize="characters" editable={!appliedCoupon}
                                            onChangeText={(t) => {
                                                setCouponCode(t);
                                                if (appliedCoupon) setAppliedCoupon(null);
                                                if (couponError) setCouponError('');
                                            }}
                                        />
                                        {!appliedCoupon ? (
                                            <TouchableOpacity style={[styles.applyBtn, (!couponCode.trim() || couponLoading) && { opacity: 0.5 }]} onPress={validateCoupon} disabled={!couponCode.trim() || couponLoading}>
                                                {couponLoading ? <ActivityIndicator color="white" size="small" /> : <Text style={styles.applyBtnText}>Apply</Text>}
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity style={styles.clearBtn} onPress={clearCoupon}><Ionicons name="trash-outline" size={20} color="#FF3B30" /></TouchableOpacity>
                                        )}
                                    </View>
                                    {couponError ? <Text style={{ color: '#FF3B30', fontSize: 12, marginTop: 5 }}>{couponError}</Text> 
                                    : appliedCoupon ? <Text style={{ color: '#28a745', fontSize: 13, marginTop: 5, fontWeight: '600' }}>✅ {appliedCoupon.discount_type === 'percentage' ? `${appliedCoupon.discount}%` : `RM${appliedCoupon.discount}`} discount applied!</Text> : null}
                                </View>
                            )}

                            {/* POINTS REDEMPTION */}
                            {user?.points > 0 && remainingSubtotal > 0 && (
                                <View style={[styles.pointsContainer, { borderColor: colors.border }]}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                        <Text style={{ color: colors.text, fontWeight: 'bold' }}>Redeem Points</Text>
                                        <Text style={{ color: '#007AFF', fontWeight: 'bold' }}>-RM{(redeemPoints / 100).toFixed(2)}</Text>
                                    </View>
                                    <Slider style={{ width: '100%', height: 40 }} minimumValue={0} maximumValue={maxPointsApplicable} step={100} value={redeemPoints} onValueChange={setRedeemPoints} minimumTrackTintColor="#007AFF" maximumTrackTintColor={colors.border} thumbTintColor="#007AFF" />
                                    <Text style={{ color: colors.subText, fontSize: 12, textAlign: 'right' }}>Using {redeemPoints} / {user?.points} pts</Text>
                                </View>
                            )}

                            {/* SUMMARY */}
                            <View style={styles.summaryBox}>
                                <View style={styles.summaryRow}><Text style={[styles.summaryLabel, { color: colors.subText }]}>Subtotal</Text><Text style={[styles.summaryValue, { color: colors.text }]}>RM{subtotal.toFixed(2)}</Text></View>
                                {appliedCoupon && <View style={styles.summaryRow}><Text style={[styles.summaryLabel, { color: '#28a745' }]}>Promo Discount</Text><Text style={[styles.summaryValue, { color: '#28a745' }]}>-RM{couponDiscountAmount.toFixed(2)}</Text></View>}
                                {redeemPoints > 0 && <View style={styles.summaryRow}><Text style={[styles.summaryLabel, { color: '#007AFF' }]}>Points Redeemed</Text><Text style={[styles.summaryValue, { color: '#007AFF' }]}>-RM{pointsDiscount.toFixed(2)}</Text></View>}
                                <View style={[styles.divider, { marginVertical: 10, backgroundColor: colors.border }]} />
                                <View style={styles.summaryRow}><Text style={[styles.totalLabel, { color: colors.text }]}>Total to Pay</Text><Text style={styles.totalPriceText}>RM{finalAmount.toFixed(2)}</Text></View>
                            </View>

                            <TouchableOpacity style={[styles.confirmBtn, (bookingLoading || totalTicketsSelected === 0) && { backgroundColor: '#ccc' }]} onPress={handleCheckout} disabled={bookingLoading || totalTicketsSelected === 0}>
                                {bookingLoading ? <ActivityIndicator color="white" /> : <Text style={styles.confirmText}>Proceed to Payment</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.cancelButton} onPress={closeCheckoutModal}><Text style={styles.cancelButtonText}>Cancel</Text></TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // 🚀 NEW Gallery Styles
    imageContainer: { width: '100%', height: 350, position: 'relative' },
    heroImage: { width: width, height: 350, resizeMode: 'cover' }, // Forces image to snap exactly to screen width
    paginationContainer: { position: 'absolute', bottom: 45, width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)', marginHorizontal: 4 },
    activeDot: { backgroundColor: '#fff', width: 24, height: 8, borderRadius: 4 }, // Pill shape for active dot
    
    backButton: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
    contentWrapper: { marginTop: -30, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 24, paddingTop: 30, minHeight: 500 },
    titleRow: { marginBottom: 25 },
    title: { fontSize: 28, fontWeight: '900', lineHeight: 34, letterSpacing: -0.5 },
    infoSection: { marginBottom: 20 },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    iconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    infoTextWrapper: { flex: 1 },
    infoLabel: { fontSize: 13, fontWeight: '600', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
    infoValue: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
    infoSubValue: { fontSize: 14 },
    divider: { height: 1, width: '100%', opacity: 0.5, marginVertical: 10 },
    aboutSection: { paddingTop: 15 },
    sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
    description: { fontSize: 15, lineHeight: 24 },
    bottomBar: { position: 'absolute', bottom: 0, width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 15, paddingBottom: Platform.OS === 'ios' ? 30 : 15, borderTopWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 10 },
    priceContainer: { flex: 1 },
    priceLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    bottomPrice: { fontSize: 22, fontWeight: '900' },
    buyButton: { backgroundColor: '#007AFF', flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14 },
    buyButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    
    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { width: '100%', maxHeight: '85%', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, alignItems: 'center' },
    modalDragHandle: { width: 40, height: 5, backgroundColor: 'rgba(128,128,128,0.3)', borderRadius: 3, marginBottom: 15 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
    tierRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 15 },
    smallStepper: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    stepperBtnSmall: { width: 35, height: 35, borderRadius: 17.5, backgroundColor: 'rgba(0,122,255,0.1)', justifyContent: 'center', alignItems: 'center' },
    quantityText: { fontSize: 22, fontWeight: 'bold', minWidth: 35, textAlign: 'center' },
    pointsContainer: { width: '100%', marginBottom: 15, padding: 15, borderRadius: 12, borderWidth: 1 },
    couponContainer: { width: '100%', marginBottom: 20 },
    couponInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 },
    applyBtn: { backgroundColor: '#007AFF', borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    applyBtnText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
    clearBtn: { backgroundColor: 'rgba(255,59,48,0.1)', borderRadius: 12, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
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