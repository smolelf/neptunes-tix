import React, { useEffect, useState, useContext,
  useCallback, useRef } from 'react';
import { View, Text, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import apiClient from '../api/client';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';


const { width } = Dimensions.get('window');
// 1. Updated Interface: event is now a nested object
interface Ticket {
  id: string; // This is our new UUID!
  category: string;
  event: {
    name: string;
    venue: string;
    date: string;
  };
}
  
interface Order {
    id: number;
    created_at: string;
    tickets: Ticket[]; 
    total_amount: number;
    status: string;
    payment_url: string;
}

export default function MyTicketsScreen() {
  const { colors, isDark } = useContext(ThemeContext);
  const { user } = useContext(AuthContext);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<any>();

  const lastFetchTime = useRef<number>(0);
  const THROTTLE_MS = 30000; // 30 seconds

  const fetchMyOrders = async (showLoading = true) => {
      // 🚀 Guard: Don't fetch if no user is logged in
      if (!user) {
          setLoading(false);
          return;
      }

      try {
          if (showLoading) setLoading(true);
          const response = await apiClient.get<Order[]>('/my-orders');
          setMyOrders(response.data || []);
          lastFetchTime.current = Date.now();
      } catch (error) {
          console.error("Fetch orders error:", error);
      } finally {
          setLoading(false);
          setRefreshing(false);
      }
  };

  if (!user) {
    return (
      <View style={[styles.container, styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="lock-closed-outline" size={80} color={colors.subText} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Member Feature</Text>
        <Text style={[styles.emptySub, { color: colors.subText }]}>
          Sign in to view your tickets and order history.
        </Text>
        <TouchableOpacity 
            style={[styles.marketBtn, { backgroundColor: '#007AFF', borderColor: '#007AFF' }]}
            onPress={() => navigation.navigate('Login')}
        >
            <Text style={[styles.marketBtnText, { color: '#fff' }]}>Sign In Now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      
      if (now - lastFetchTime.current > THROTTLE_MS) {
        console.log("Tab focused: Throttled refresh triggered");
        fetchMyOrders(false); // Pass false so we don't show a giant jumpy loader
      } else {
        console.log("Tab focused: Too soon to refresh, skipping...");
      }
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMyOrders();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchMyOrders();
  }, []);

  const renderOrder = ({ item }: { item: Order }) => {
      const firstTicket = item.tickets?.[0];
      const eventName = firstTicket?.event?.name || "Event Details TBA";
      const isPaid = item.status === 'paid';
    
      return (
        <View style={[styles.orderCard, { backgroundColor: colors.card, borderLeftWidth: 5, borderLeftColor: isPaid ? '#28a745' : '#ff9500' }]}>
          <View style={styles.orderHeader}>
            <Text style={[styles.orderId, { color: colors.subText }]}>Order #{item.id}</Text>
            {/* 🏷️ Status Badge */}
            <View style={[styles.statusBadge, { backgroundColor: isPaid ? 'rgba(40, 167, 69, 0.1)' : 'rgba(255, 149, 0, 0.1)' }]}>
              <Text style={[styles.statusText, { color: isPaid ? '#28a745' : '#ff9500' }]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
          </View>
      
          <View style={styles.ticketSection}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>{eventName}</Text>
              <Text style={[styles.orderTotal, { color: colors.subText }]}>Total: RM{item.total_amount}</Text>
            </View>
          </View>
      
          {isPaid ? (
            <TouchableOpacity 
              style={styles.viewDetailsBtn}
              onPress={() => navigation.navigate('OrderDetails', { order: item })}
            >
              <Text style={styles.viewDetailsText}>View Digital Tickets</Text>
              <Ionicons name="qr-code-outline" size={16} color="#007AFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.viewDetailsBtn}
              onPress={() => navigation.navigate('OrderDetails', { orderId: item.id.toString() })} // 🚀 Fixed Param
            >
              <Text style={styles.viewDetailsText}>View Digital Tickets</Text>
              <Ionicons name="qr-code-outline" size={16} color="#007AFF" />
            </TouchableOpacity>
          )}
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
        keyExtractor={(item) => item.id.toString()}
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  payNowBtn: {
    backgroundColor: '#ff9500',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 15,
  },
  payNowText: {
    color: '#fff',
    fontWeight: 'bold',
    marginRight: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15 },
  emptySub: { fontSize: 14, textAlign: 'center', marginVertical: 10, paddingHorizontal: 40 },
  marketBtn: { marginTop: 15, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1 },
  marketBtnText: { color: '#007AFF', fontWeight: '600' }
});