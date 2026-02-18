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
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTickets(); // Or fetchMyTickets() for the wallet
    setRefreshing(false);
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async (query: string = '') => {
    try {
      setLoading(true);
      // Pass the search term to your new Go 'q' parameter
      const response = await apiClient.get<TicketResponse>(`/tickets?q=${query}`);
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
            renderItem={({ item }) => (
            <TouchableOpacity 
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} 
                onPress={() => setSelectedTicket(item)}
            >
                <View style={{ flex: 1 }}>
                <Text style={[styles.event, { color: colors.text }]}>{item.event_name}</Text>
                <Text style={[styles.category, { color: colors.subText }]}>{item.category}</Text>
                </View>
                <Text style={styles.price}>RM{item.price}</Text>
            </TouchableOpacity>
            )}
            refreshing={refreshing}
            onRefresh={onRefresh}
        />

        {/* --- PURCHASE MODAL --- */}
            <Modal visible={!!selectedTicket} transparent={true} animationType="fade">
            <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedTicket?.event_name}</Text>
                <Text style={{ color: colors.subText }}>{selectedTicket?.category}</Text>
                <Text style={styles.modalPrice}>RM{selectedTicket?.price}</Text>
                
                <TouchableOpacity style={styles.buyButton} onPress={handlePurchase}>
                <Text style={styles.buyButtonText}>Confirm Purchase</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSelectedTicket(null)}>
                <Text style={{ color: colors.subText, marginTop: 10 }}>Cancel</Text>
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
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
    modalText: { fontSize: 16, color: 'gray', marginBottom: 5 },
    modalPrice: { fontSize: 20, fontWeight: 'bold', marginVertical: 15, color: '#007AFF' },
    buttonGroup: { width: '100%', marginTop: 10 },
    buyButton: { backgroundColor: '#007AFF', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
    buyButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    cancelButton: { padding: 10, alignItems: 'center' },
    cancelButtonText: { color: 'gray' },
});