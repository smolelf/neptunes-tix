import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';
import { Ionicons } from '@expo/vector-icons';
import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';

interface Ticket {
    ID: number;
    event_name: string;
    category: string;
    is_sold: boolean;
    checked_in_at: string | null;
  }
  
  interface Order {
    ID: number;
    CreatedAt: string;
    tickets: Ticket[]; // This is what GORM Preload("Tickets") sends
    total_amount: number;
  }

export default function MyTicketsScreen() {
  const { colors, isDark} = useContext(ThemeContext);
//   const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<any>();

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMyTickets(); // Or fetchMyTickets() for the wallet
    setRefreshing(false);
  };

  useEffect(() => {
    fetchMyTickets();
  }, []);

  const fetchMyTickets = async () => {
    try {
      // 1. Get the saved token
      const token = await SecureStore.getItemAsync('userToken');
      
      // 2. Send request with Authorization Header
      const response = await apiClient.get<Order[]>('/my-orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMyOrders(response.data);
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderOrder = ({ item }: { item: Order }) => (
    <View style={[styles.orderCard, { backgroundColor: colors.card }]}>
      <View style={styles.orderHeader}>
        <Text style={[styles.orderId, { color: colors.subText }]}>Order #{item.ID}</Text>
        <Text style={[styles.orderDate, { color: colors.subText }]}>
          {new Date(item.CreatedAt).toLocaleDateString()}
        </Text>
      </View>
  
      {/* List the distinct types of tickets in this order */}
      <View style={styles.ticketSection}>
        <Text style={[styles.eventTitle, { color: colors.text }]}>
          {item.tickets[0]?.event_name}
        </Text>
        <View style={styles.paxBadge}>
          <Ionicons name="people" size={14} color="#007AFF" />
          <Text style={styles.paxText}>{item.tickets.length} Pax</Text>
        </View>
      </View>
  
      <TouchableOpacity 
        style={styles.viewDetailsBtn}
        onPress={() => navigation.navigate('OrderDetails', { order: item })}
      >
        <Text style={styles.viewDetailsText}>View All Tickets</Text>
        <Ionicons name="chevron-forward" size={16} color="#007AFF" />
      </TouchableOpacity>
    </View>
  );

  if (loading) return <ActivityIndicator size="large" style={{flex: 1}} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Themed Header */}
      <Text style={[styles.header, { color: colors.text }]}>My Tickets</Text>
      
      {/* Themed Empty State */}
      {/* {myTickets.length === 0 && !loading && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 }}>
            <Ionicons name="ticket-outline" size={80} color={isDark ? "#444" : "#ccc"} />
            <Text style={{ color: colors.subText, marginTop: 10 }}>
              No tickets found. Go to Marketplace!
            </Text>
        </View>
      )} */}
  
  <FlatList
    data={myOrders} // Use orders now
    keyExtractor={(item) => item.ID.toString()}
    contentContainerStyle={{ flexGrow: 1 }}
    renderItem={renderOrder} // Point to the function you defined earlier
    refreshing={refreshing}
    onRefresh={onRefresh}
    ListEmptyComponent={() => (
        <View style={styles.emptyContainer}>
        <Ionicons name="ticket-outline" size={80} color={isDark ? "#444" : "#ccc"} />
        <Text style={{ color: colors.subText, marginTop: 10 }}>
            No orders found. Go to Marketplace!
        </Text>
        </View>
    )}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 30, marginTop: 10 },
  ticketCard: { 
    flexDirection: 'row', 
    backgroundColor: '#f9f9f9', 
    padding: 20, 
    borderRadius: 15, 
    marginBottom: 15,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 5,
    borderLeftColor: '#007AFF'
  },
  eventTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  info: { flex: 1 },
  used: { color: 'red', fontWeight: 'bold', marginTop: 5 },
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100, // Centers it visually above the bottom tabs
  },
  orderCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    // Shadow for iOS/Android depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(128,128,128,0.2)',
    paddingBottom: 8,
  },
  orderId: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  orderDate: {
    fontSize: 12,
  },
  ticketSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  paxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  paxText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '700',
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingTop: 10,
    gap: 4,
  },
  viewDetailsText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
  },
});