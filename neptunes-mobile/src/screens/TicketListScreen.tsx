import React, { useEffect, useState, useContext, useCallback } from 'react';
import { ThemeContext } from '../context/ThemeContext'; // Import your context
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Modal, Button, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';
import { TextInput } from 'react-native';
import { debounce } from 'lodash';
import { Ionicons } from '@expo/vector-icons';

interface Ticket {
    ID: number;
    event_name: string;
    category: string;
    price: number;
    is_sold: boolean;
    stock: number; // New field to show how many tickets are left
  }

interface TicketResponse {
    total: number;
    limit: number;
    offset: number;
    data: Ticket[];
  }

export default function TicketListScreen() {
  const { colors, isDark } = useContext(ThemeContext);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<any>(null); // For the modal
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [bookingLoading, setBookingLoading] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTickets(); // Or fetchMyTickets() for the wallet
    setRefreshing(false);
  };

  const fetchTickets = async (query: string = '') => {
    try {
      setLoading(true);
      // Pass the search term to your new Go 'q' parameter
      const response = await apiClient.get<TicketResponse>(`/marketplace?q=${query}`);
      setTickets(response.data.data);
    } catch (error) {
      console.error(error);
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
      
      // We now send the Event Name, Category, and Quantity
      await apiClient.post('/bookings/bulk', {
        event_name: selectedTicket.event_name,
        category: selectedTicket.category,
        quantity: quantity,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
  
      Alert.alert("Success", `Booked ${quantity} tickets for ${selectedTicket.event_name}`);
      setSelectedTicket(null);
      setQuantity(1); // Reset
      fetchTickets(); // Refresh list
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.error || "Booking failed");
    } finally {
      setBookingLoading(false);
    }
  };

  const handlePurchase = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      
      // CALLING YOUR GO BACKEND: POST /bookings (or however you named your buy route)
      // We send the ticket_id to the backend
      await apiClient.post('/bookings', 
        { ticket_id: selectedTicket.ID.toString() }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert("Success!", `You've secured your spot for ${selectedTicket.event_name}`);
      setSelectedTicket(null); // Close modal
    } catch (error: any) {
      Alert.alert("Purchase Failed", error.response?.data?.error || "Something went wrong");
    }
  };

  if (loading) return <ActivityIndicator size="large" style={{flex: 1}} />;

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
                clearButtonMode="while-editing" // iOS specific: adds an 'X' button
            />
        </View>
        
        <FlatList
            data={tickets}
            keyExtractor={(item) => item.ID.toString()}
            contentContainerStyle={{ flexGrow: 1 }}
            renderItem={({ item }) => (
                <TouchableOpacity 
                    style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} 
                    onPress={() => setSelectedTicket(item)}
                >
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.event, { color: colors.text }]}>{item.event_name}</Text>
                        <Text style={[styles.category, { color: colors.subText }]}>
                            {item.category} • {item.stock} left
                        </Text>
                    </View>
                    <Text style={styles.price}>RM{item.price}</Text>
                </TouchableOpacity>
            )}
            refreshing={refreshing}
            onRefresh={onRefresh}
            ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                    <Text style={{ color: colors.subText }}>No tickets available at the moment.</Text>
                    <Text style={{ color: colors.subText, fontSize: 12 }}>Pull down to refresh</Text>
                </View>
            )}
        />

        {/* --- PURCHASE MODAL --- */}
        <Modal visible={!!selectedTicket} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
            {/* Use colors.card for the modal background */}
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedTicket?.event_name}</Text>
            <Text style={[styles.modalSub, { color: colors.subText }]}>
                {selectedTicket?.category} — {selectedTicket?.stock} available
            </Text>
            <Text style={[styles.modalSub, { color: colors.subText }]}>
                Select Quantity (Pax)
            </Text>

            <View style={styles.stepper}>
                <TouchableOpacity 
                    onPress={() => setQuantity(Math.max(1, quantity - 1))}
                    style={styles.stepperBtn}
                >
                    <Ionicons name="remove" size={24} color={colors.text} />
                </TouchableOpacity>
                
                <Text style={[styles.quantityText, { color: colors.text }]}>{quantity}</Text>
                
                <TouchableOpacity 
                    onPress={() => {
                        // Only increment if we are below the available stock
                        if (quantity < selectedTicket?.stock) {
                            setQuantity(quantity + 1);
                        } else {
                            Alert.alert("Limit Reached", `Only ${selectedTicket?.stock} tickets left!`);
                        }
                    }}
                    // Subtly dim the button if they can't click it anymore
                    style={[styles.stepperBtn, quantity >= selectedTicket?.stock && { opacity: 0.3 }]}
                >
                    <Ionicons name="add" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            <Text style={styles.totalPrice}>
                Total: RM{(selectedTicket?.price || 0) * quantity}
            </Text>

            <View style={{ width: '100%', gap: 10 }}>
                <TouchableOpacity 
                    style={[
                        styles.confirmBtn, 
                        (bookingLoading || selectedTicket?.stock === 0) && { backgroundColor: '#ccc' }
                    ]} 
                    onPress={handleBulkBook}
                    disabled={bookingLoading || selectedTicket?.stock === 0}
                >
                    {bookingLoading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={styles.confirmText}>
                            {selectedTicket?.stock === 0 ? "Sold Out" : "Confirm Booking"}
                        </Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => {
                    setSelectedTicket(null);
                    setQuantity(1);
                }}
                >
                <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
            </View>
            </View>
        </View>
        </Modal>
        </View>
  );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#f2f2f7', // Light grey background like iOS settings
        paddingHorizontal: 15 
    },
    card: { 
        padding: 20, 
        borderRadius: 15, 
        marginVertical: 8, 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        // Use a very subtle border in dark mode instead of heavy shadows
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)', 
      },
    event: { 
        fontSize: 18, 
        fontWeight: 'bold', 
        color: '#1c1c1e' 
    },
    category: { 
        fontSize: 14, 
        color: '#8e8e93', // Muted grey
        marginTop: 4,
        textTransform: 'uppercase', // Makes "Vip" look like "VIP"
        letterSpacing: 0.5
    },
    price: { 
        fontSize: 17, 
        fontWeight: '700', 
        color: '#007AFF' // Signature blue
    },        
    header: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, marginTop: 30 },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        height: 50,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 20,
      },
      searchInput: {
        flex: 1,
        fontSize: 16,
      },
    modalContent: {
        width: '85%',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 25,
        alignItems: 'center',
        elevation: 5,
    },
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 20,
        gap: 30,
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
        fontSize: 24,
        fontWeight: 'bold',
        minWidth: 40,
        textAlign: 'center',
      },
      totalPrice: {
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 20,
        color: '#28a745'
      },
      confirmBtn: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center'
    },
    confirmText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16
    },
    modalSub: {
        fontSize: 14,
        marginBottom: 5
    },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
    modalText: { fontSize: 16, color: 'gray', marginBottom: 5 },
    modalPrice: { fontSize: 20, fontWeight: 'bold', marginVertical: 15, color: '#007AFF' },
    buttonGroup: { width: '100%', marginTop: 10 },
    buyButton: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
    buyButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    cancelButton: { padding: 10, alignItems: 'center' },
    cancelButtonText: { color: 'gray' },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 100, // Centers it visually above the bottom tabs
    },
});