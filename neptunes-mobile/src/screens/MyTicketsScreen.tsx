import React, { useEffect, useState, useContext, useCallback, useMemo } from 'react';
import { 
    View, Text, FlatList, StyleSheet, TouchableOpacity, 
    ActivityIndicator, Image, RefreshControl, Platform 
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import * as SecureStore from 'expo-secure-store';
import apiClient, { SERVER_BASE_URL } from '../api/client';
import { Ionicons } from '@expo/vector-icons';

export default function MyTicketScreen() {
    const navigation = useNavigation<any>();
    const { colors } = useContext(ThemeContext);
    const { user } = useContext(AuthContext);

    const [rawTickets, setRawTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchMyTickets = async (showLoading = true) => {
        if (!user) return;
        if (showLoading) setLoading(true);
        
        try {
            const token = await SecureStore.getItemAsync('userToken');
            const response = await apiClient.get('/my-tickets', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRawTickets(response.data || []);
        } catch (error) {
            console.error("Failed to fetch my tickets", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchMyTickets();
        }, [user])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchMyTickets(false);
    };

    // 🚀 FIXED: Grouping Logic now uses 'checked_in_at' from your JSON
    const groupedOrders = useMemo(() => {
        const groups: Record<number, any> = {};
        
        rawTickets.forEach((t: any) => {
            const orderId = t.order_id || t.OrderID;
            const eventInfo = t.event || t.Event;
            const orderInfo = t.order || t.Order;
            
            // Safely force statuses to lowercase
            const ticketStatus = (t.status || t.Status || '').toLowerCase();
            const orderStatus = (orderInfo?.status || orderInfo?.Status || '').toLowerCase();

            if (!groups[orderId]) {
                groups[orderId] = {
                    order_id: orderId,
                    event: eventInfo,
                    tickets: [],
                    total_quantity: 0,
                    all_used: true,
                    is_unpaid: t.is_sold === false
                };
            }
            groups[orderId].tickets.push(t);
            groups[orderId].total_quantity += 1;
            
            const isTicketUsed = !!t.checked_in_at || ticketStatus === 'used';
            if (!isTicketUsed) {
                groups[orderId].all_used = false;
            }
        });

        return Object.values(groups).sort((a: any, b: any) => b.order_id - a.order_id);
    }, [rawTickets]);

    const formatTicketDate = (dateString: string) => {
        if (!dateString || dateString === 'TBA') return 'Date TBA';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-MY', { 
            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
        });
    };

    if (loading && !refreshing) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    if (!user) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <Ionicons name="ticket-outline" size={64} color={colors.subText} style={{ marginBottom: 15 }} />
                <Text style={[styles.emptyText, { color: colors.text }]}>Please log in to view your tickets</Text>
                <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Profile')}>
                    <Text style={styles.loginBtnText}>Go to Login</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.headerContainer}>
                <Text style={[styles.header, { color: colors.text }]}>My Tickets</Text>
            </View>

            <FlatList
                data={groupedOrders}
                keyExtractor={(item) => item.order_id.toString()}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />}
                contentContainerStyle={styles.listContainer}
                renderItem={({ item }) => {
                    const event = item.event;
                    const imageSource = event?.banner_url 
                        ? { uri: `${SERVER_BASE_URL}${event.banner_url}` } 
                        : require('../../assets/placeholder.png');
                    
                    const isUnpaid = item.is_unpaid;
                    const isUsed = item.all_used && !isUnpaid;

                    // 🚀 ASSIGN COLORS & LABELS CLEANLY
                    const badgeBg = isUnpaid ? 'rgba(255,149,0,0.1)' : (isUsed ? 'rgba(142,142,147,0.1)' : 'rgba(40,167,69,0.1)');
                    const badgeColor = isUnpaid ? '#FF9500' : (isUsed ? '#8e8e93' : '#28a745');
                    const badgeLabel = isUnpaid ? 'UNPAID' : (isUsed ? 'USED' : 'VALID ENTRY');
                    
                    return (
                        <TouchableOpacity 
                            style={[styles.ticketCard, { backgroundColor: colors.card, opacity: item.all_used ? 0.7 : 1 }]}
                            onPress={() => navigation.navigate('OrderDetails', { orderId: item.order_id })}
                            activeOpacity={0.9}
                        >
                            {/* Top Section */}
                            <View style={styles.ticketHeader}>
                                <Image source={imageSource} style={styles.ticketImage} />
                                <View style={styles.imageOverlay} />
                                <View style={styles.headerTextContainer}>
                                    <Text style={styles.eventTitle} numberOfLines={1}>{event?.name || 'Unknown Event'}</Text>
                                    <Text style={styles.eventDate}>{formatTicketDate(event?.date)}</Text>
                                </View>
                            </View>

                            {/* Middle Section */}
                            <View style={styles.ticketBody}>
                                <View style={styles.detailRow}>
                                    <View>
                                        <Text style={[styles.label, { color: colors.subText }]}>Venue</Text>
                                        <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>{event?.venue || 'TBA'}</Text>
                                    </View>
                                </View>
                                <View style={[styles.detailRow, { marginTop: 15 }]}>
                                    <View>
                                        <Text style={[styles.label, { color: colors.subText }]}>Total Tickets</Text>
                                        <Text style={[styles.value, { color: colors.text }]}>{item.total_quantity} Pass{item.total_quantity > 1 ? 'es' : ''}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={[styles.label, { color: colors.subText }]}>Order ID</Text>
                                        <Text style={[styles.value, { color: colors.text, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}>
                                            #{item.order_id.toString().padStart(6, '0')}
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            {/* The "Perforation" Line */}
                            <View style={styles.perforationContainer}>
                                <View style={[styles.semiCircleLeft, { backgroundColor: colors.background }]} />
                                <View style={[styles.dashedLine, { borderColor: colors.border }]} />
                                <View style={[styles.semiCircleRight, { backgroundColor: colors.background }]} />
                            </View>

                            {/* 🚀 FIXED: The Dynamic Footer now ACTUALLY uses the variables! */}
                            <View style={styles.ticketFooter}>
                                <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                                    <Text style={[styles.statusText, { color: badgeColor }]}>
                                        {badgeLabel}
                                    </Text>
                                </View>
                                
                                {isUnpaid ? (
                                    <View style={styles.qrPrompt}>
                                        <Text style={{ color: '#FF9500', fontWeight: 'bold', marginRight: 5 }}>Pay Now</Text>
                                        <Ionicons name="card-outline" size={20} color="#FF9500" />
                                    </View>
                                ) : (
                                    <View style={styles.qrPrompt}>
                                        <Text style={{ color: '#007AFF', fontWeight: 'bold', marginRight: 5 }}>View QR</Text>
                                        <Ionicons name="qr-code-outline" size={20} color="#007AFF" />
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="ticket-outline" size={64} color={colors.subText} style={{ marginBottom: 15 }} />
                        <Text style={[styles.emptyText, { color: colors.text }]}>No tickets found.</Text>
                        <Text style={[styles.emptySubText, { color: colors.subText }]}>When you buy tickets, they will appear here.</Text>
                        <TouchableOpacity style={styles.browseBtn} onPress={() => navigation.navigate('Home')}>
                            <Text style={styles.browseBtnText}>Browse Events</Text>
                        </TouchableOpacity>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    headerContainer: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 10 },
    header: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
    listContainer: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10 },
    
    // Ticket Wallet Design
    ticketCard: { borderRadius: 16, marginBottom: 20, overflow: 'hidden', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 },
    ticketHeader: { height: 100, position: 'relative', backgroundColor: '#000' },
    ticketImage: { width: '100%', height: '100%', resizeMode: 'cover', opacity: 0.6 },
    imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },
    headerTextContainer: { position: 'absolute', bottom: 15, left: 15, right: 15 },
    eventTitle: { color: '#FFF', fontSize: 20, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
    eventDate: { color: '#FFF', fontSize: 13, fontWeight: '600', marginTop: 2 },
    
    // Middle: Details
    ticketBody: { padding: 20 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { fontSize: 11, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
    value: { fontSize: 16, fontWeight: '800' },
    
    // The Perforation Line
    perforationContainer: { flexDirection: 'row', alignItems: 'center', height: 20, overflow: 'hidden' },
    semiCircleLeft: { width: 20, height: 20, borderRadius: 10, marginLeft: -10 },
    dashedLine: { flex: 1, height: 1, borderWidth: 1, borderStyle: 'dashed', marginHorizontal: 5 },
    semiCircleRight: { width: 20, height: 20, borderRadius: 10, marginRight: -10 },
    
    // Bottom: Status & Action
    ticketFooter: { paddingTop: 5, paddingBottom: 15, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
    statusText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
    qrPrompt: { flexDirection: 'row', alignItems: 'center' },

    // Empty/Logged Out States
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80, paddingHorizontal: 40 },
    emptyText: { fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
    emptySubText: { fontSize: 15, textAlign: 'center', marginBottom: 25, lineHeight: 22 },
    loginBtn: { backgroundColor: '#007AFF', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
    loginBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    browseBtn: { backgroundColor: 'rgba(0,122,255,0.1)', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
    browseBtnText: { color: '#007AFF', fontSize: 16, fontWeight: 'bold' },
});