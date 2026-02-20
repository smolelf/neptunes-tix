import React, { useEffect, useState, useContext, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, Alert, TextInput } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';
import { debounce } from 'lodash';
import { Ionicons } from '@expo/vector-icons';

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

export default function TicketListScreen() {
    const { colors } = useContext(ThemeContext);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [bookingLoading, setBookingLoading] = useState(false);

    const fetchTickets = async (query: string = '') => {
        try {
            setLoading(true);
            // Search query 'q' matches your Go gin handler
            const response = await apiClient.get<{ data: Ticket[] }>(`/marketplace?q=${query}`);
            setTickets(response.data.data || []); // Safety fallback to empty array
        } catch (error) {
            console.error("Marketplace fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    const debouncedSearch = useCallback(
        debounce((nextValue: string) => fetchTickets(nextValue), 500),
        []
    );

    const handleSearchChange = (text: string) => {
        setSearchQuery(text);
        debouncedSearch(text);
    };

    useEffect(() => {
        fetchTickets();
    }, []);

    const handleBulkBook = async () => {
        if (!selectedTicket) return;
        
        try {
            setBookingLoading(true);
            const token = await SecureStore.getItemAsync('userToken');
            
            // This matches your 'req' struct in main.go
            await apiClient.post('/bookings/bulk', {
                event_id: selectedTicket.event_id,
                category: selectedTicket.category,
                quantity: quantity,
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
      
            Alert.alert("Success", `Booked ${quantity} tickets for ${selectedTicket.event?.name}`);
            setSelectedTicket(null);
            setQuantity(1);
            fetchTickets(searchQuery); 
        } catch (error: any) {
            Alert.alert("Error", error.response?.data?.error || "Booking failed");
        } finally {
            setBookingLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchTickets(searchQuery);
        setRefreshing(false);
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Text style={[styles.header, { color: colors.text }]}>Tickets Available</Text>
            
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
            
            {loading && !refreshing ? (
                <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={tickets}
                    // Improved Key: Combines EventID and Category for uniqueness
                    keyExtractor={(item) => `${item.event_id}-${item.category}`}
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                            style={[styles.ticketContainer, { backgroundColor: colors.card }]} 
                            onPress={() => {
                                setQuantity(1);
                                setSelectedTicket(item);
                            }}
                        >
                            <View style={styles.ticketHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
                                        {item.event?.name}
                                    </Text>
                                    <View style={styles.infoRow}>
                                        <Ionicons name="location-outline" size={14} color={colors.subText} />
                                        <Text style={[styles.infoText, { color: colors.subText }]} numberOfLines={1}>
                                            {item.event?.venue || 'Venue TBA'}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.priceTag}>
                                    <Text style={styles.priceText}>RM{item.price}</Text>
                                </View>
                            </View>

                            <View style={styles.divider} />

                            <View style={styles.ticketFooter}>
                                <View style={styles.infoRow}>
                                    <Ionicons name="people-outline" size={14} color="#007AFF"
                                        style={{ marginRight: 6 }}/>
                                    <Text style={[styles.footerText, { color: colors.text }]}>
                                        {item.stock} available
                                    </Text>
                                </View>
                                <View style={styles.categoryBadge}>
                                    <Text style={styles.categoryText}>{item.category.toUpperCase()}</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    )}
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="ticket-outline" size={60} color={colors.subText} style={{ marginBottom: 15 }} />
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>
                            No available ticket.
                        </Text>
                        <Text style={[styles.emptySub, { color: colors.subText }]}>
                            Try again later.
                        </Text>
                        <TouchableOpacity 
                            style={[styles.retryBtn, { borderColor: colors.border }]} 
                            onPress={onRefresh}
                        >
                            <Text style={{ color: '#007AFF', fontWeight: '600' }}>Refresh Marketplace</Text>
                        </TouchableOpacity>
                    </View>
                }
                />
            )}

            <Modal visible={!!selectedTicket} transparent={true} animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedTicket?.event?.name}</Text>
                        <Text style={[styles.modalSub, { color: colors.subText }]}>
                            {selectedTicket?.category} — {selectedTicket?.stock} in stock
                        </Text>

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

                        <Text style={styles.totalPrice}>Total: RM{(selectedTicket?.price || 0) * quantity}</Text>

                        <TouchableOpacity 
                            style={[styles.confirmBtn, (bookingLoading || selectedTicket?.stock === 0) && { backgroundColor: '#ccc' }]} 
                            onPress={handleBulkBook}
                            disabled={bookingLoading || selectedTicket?.stock === 0}
                        >
                            {bookingLoading ? <ActivityIndicator color="white" /> : <Text style={styles.confirmText}>Confirm Booking</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.cancelButton} onPress={() => setSelectedTicket(null)}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        paddingHorizontal: 16,
    },
    header: { 
        fontSize: 28, 
        fontWeight: '800', 
        marginBottom: 20, 
        marginTop: 40,
        letterSpacing: -0.5,
    },
    // Search UI
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        height: 50,
        borderRadius: 15,
        borderWidth: 1,
        marginBottom: 20,
        // Subtle shadow for search bar
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        marginLeft: 8,
    },
    // The main Ticket Card
    ticketContainer: {
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        borderLeftWidth: 6,
        borderLeftColor: '#007AFF',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
    },
    ticketHeader: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start' 
    },
    eventTitle: { 
        fontSize: 19, 
        fontWeight: 'bold', 
        marginBottom: 6,
        maxWidth: '85%',
    },
    infoRow: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        marginTop: 3 
    },
    infoText: { 
        fontSize: 14, 
        marginLeft: 6,
    },
    priceTag: { 
        backgroundColor: '#28a745', 
        paddingVertical: 6, 
        paddingHorizontal: 12, 
        borderRadius: 10 
    },
    priceText: { 
        color: '#fff', 
        fontWeight: 'bold',
        fontSize: 15,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(128,128,128,0.15)',
        marginVertical: 15,
        borderStyle: 'dashed',
        borderRadius: 1, // Fix for Android dashed rendering
        borderWidth: 1,
        borderColor: 'rgba(128,128,128,0.1)',
    },
    ticketFooter: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
    },
    footerText: {
        fontSize: 13,
        fontWeight: '600',
    },
    categoryBadge: {
        backgroundColor: 'rgba(0,122,255,0.1)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    categoryText: { 
        color: '#007AFF', 
        fontSize: 11, 
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    // Modal UI
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '88%',
        borderRadius: 25,
        padding: 24,
        alignItems: 'center',
        elevation: 10,
    },
    modalTitle: { 
        fontSize: 22, 
        fontWeight: 'bold', 
        marginBottom: 8,
        textAlign: 'center' 
    },
    modalSub: { 
        fontSize: 15, 
        marginBottom: 4,
        textAlign: 'center' 
    },
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 25,
        gap: 35,
    },
    stepperBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(0,122,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityText: {
        fontSize: 26,
        fontWeight: 'bold',
        minWidth: 40,
        textAlign: 'center',
    },
    totalPrice: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 24,
        color: '#28a745'
    },
    confirmBtn: {
        backgroundColor: '#007AFF',
        padding: 16,
        borderRadius: 15,
        width: '100%',
        alignItems: 'center',
        marginBottom: 10,
    },
    confirmText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 17
    },
    cancelButton: { 
        padding: 12, 
        width: '100%',
        alignItems: 'center' 
    },
    cancelButtonText: { 
        color: '#8e8e93',
        fontSize: 15,
        fontWeight: '600'
    },
    // Empty State
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 80,
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 15,
    },
    emptySub: {
        fontSize: 15,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 25,
    },
    retryBtn: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
        borderWidth: 1,
    },
});