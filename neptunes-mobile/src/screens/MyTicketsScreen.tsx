import React, { useEffect, useState, useContext } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import apiClient from '../api/client';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';

// 1. Updated Interface: event is now a nested object
interface Ticket {
    ID: number;
    category: string;
    checked_in_at: string | null;
    event?: {
        name: string;
        venue?: string;
        date?: string;
    };
}
  
interface Order {
    ID: number;
    CreatedAt: string;
    tickets: Ticket[]; 
    total_amount: number;
}

export default function MyTicketsScreen() {
  const { colors, isDark } = useContext(ThemeContext);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<any>();

  const fetchMyOrders = async () => {
    try {
      // Endpoint returns Orders preloaded with Tickets and Events
      const response = await apiClient.get<Order[]>('/my-orders');
      setMyOrders(response.data || []);
    } catch (error) {
      console.error("Fetch orders error:", error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMyOrders();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchMyOrders();
  }, []);

  const renderOrder = ({ item }: { item: Order }) => {
    // Safely get the event name from the first ticket in the order
    const firstTicket = item.tickets?.[0];
    const eventName = firstTicket?.event?.name || "Event Details TBA";

    return (
      <View style={[styles.orderCard, { backgroundColor: colors.card }]}>
        <View style={styles.orderHeader}>
          <Text style={[styles.orderId, { color: colors.subText }]}>Order #{item.ID}</Text>
          <Text style={[styles.orderDate, { color: colors.subText }]}>
            {item.CreatedAt ? new Date(item.CreatedAt).toLocaleDateString() : 'N/A'}
          </Text>
        </View>
    
        <View style={styles.ticketSection}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
              {eventName}
            </Text>
            <Text style={[styles.orderTotal, { color: colors.subText }]}>
              Total Paid: RM{item.total_amount}
            </Text>
          </View>
          <View style={styles.paxBadge}>
            <Ionicons name="people" size={14} color="#007AFF" />
            <Text style={styles.paxText}>{item.tickets?.length || 0} Pax</Text>
          </View>
        </View>
    
        <TouchableOpacity 
          style={styles.viewDetailsBtn}
          onPress={() => navigation.navigate('OrderDetails', { order: item })}
        >
          <Text style={styles.viewDetailsText}>View Digital Tickets</Text>
          <Ionicons name="chevron-forward" size={16} color="#007AFF" />
        </TouchableOpacity>
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.header, { color: colors.text }]}>My Tickets</Text>
  
      <FlatList
        data={myOrders}
        keyExtractor={(item) => item.ID.toString()}
        contentContainerStyle={{ flexGrow: 1 }}
        renderItem={renderOrder}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="ticket-outline" size={80} color={isDark ? "#444" : "#ccc"} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No tickets found.
            </Text>
            <Text style={[styles.emptySub, { color: colors.subText }]}>
              Go to Marketplace to book your first event!
            </Text>
            <TouchableOpacity 
                style={[styles.marketBtn, { borderColor: colors.border }]}
                onPress={() => navigation.navigate('Marketplace')}
            >
                <Text style={styles.marketBtnText}>Visit Marketplace</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 30, marginTop: 10 },
  orderCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
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
  orderId: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  orderDate: { fontSize: 11 },
  ticketSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  eventTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 4 },
  orderTotal: { fontSize: 12 },
  paxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  paxText: { color: '#007AFF', fontSize: 13, fontWeight: '700' },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingTop: 10,
    gap: 4,
  },
  viewDetailsText: { color: '#007AFF', fontWeight: '600', fontSize: 14 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -30,
  },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15 },
  emptySub: { fontSize: 14, textAlign: 'center', marginVertical: 10, paddingHorizontal: 40 },
  marketBtn: { marginTop: 15, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1 },
  marketBtnText: { color: '#007AFF', fontWeight: '600' }
});