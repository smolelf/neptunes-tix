import React, { useEffect, useState, useContext, useCallback, useRef } from 'react';
import { 
  View, Text, FlatList, StyleSheet, ActivityIndicator, 
  TouchableOpacity, Dimensions 
} from 'react-native';
import apiClient from '../api/client';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const { width } = Dimensions.get('window');

const TICKET_CACHE_KEY = '@cached_my_orders';

interface Ticket {
  id: string; 
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
  const navigation = useNavigation<any>();

  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const lastFetchTime = useRef<number>(0);
  const THROTTLE_MS = 30000; // 30 seconds

  const fetchMyOrders = async (showLoading = true) => {
      if (!user) {
          setLoading(false);
          return;
      }

      // 1. FAST LOAD: Check local cache first
      try {
          const cachedData = await AsyncStorage.getItem(TICKET_CACHE_KEY);
          if (cachedData !== null) {
              setMyOrders(JSON.parse(cachedData)); // Show tickets instantly
          }
      } catch (e) {
          console.error("Failed to load cache", e);
      }

      // 2. BACKGROUND SYNC: Try to fetch fresh data from Go Backend
      try {
          if (showLoading && myOrders.length === 0) setLoading(true);
          
          const token = await SecureStore.getItemAsync('userToken');
          const response = await apiClient.get<Order[]>('/my-orders', {
              headers: { Authorization: `Bearer ${token}` }
          });

          const freshOrders = response.data || [];
          setMyOrders(freshOrders); // Update UI with fresh data
          setIsOffline(false);      // We have internet!

          // 3. OVERWRITE CACHE: Save the fresh tickets for next time
          await AsyncStorage.setItem(TICKET_CACHE_KEY, JSON.stringify(freshOrders));

      } catch (error) {
          // 4. OFFLINE FALLBACK: The API failed (no internet)
          console.log("Network failed, relying on cache.");
          setIsOffline(true); 
      } finally {
          setLoading(false);
          setRefreshing(false);
          lastFetchTime.current = Date.now();
      }
  };

  // 🚀 ALL HOOKS MUST BE CALLED BEFORE ANY 'IF' RETURNS
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastFetchTime.current > THROTTLE_MS) {
        fetchMyOrders(false); // Silent refresh
      }
    }, [user]) // Re-run if user context changes
  );

  useEffect(() => {
    fetchMyOrders();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMyOrders();
  };

  // --- EARLY RETURNS (Render Logic) ---

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

  // Only show giant loader if we have NO cache and are fetching for the first time
  if (loading && !refreshing && myOrders.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const renderOrder = ({ item }: { item: Order }) => {
      const firstTicket = item.tickets?.[0];
      const eventName = firstTicket?.event?.name || "Event Details TBA";
      const isPaid = item.status === 'paid';
    
      return (
        <View style={[styles.orderCard, { backgroundColor: colors.card, borderLeftWidth: 5, borderLeftColor: isPaid ? '#28a745' : '#ff9500' }]}>
          <View style={styles.orderHeader}>
            <Text style={[styles.orderId, { color: colors.subText }]}>Order #{item.id}</Text>
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
      
          <TouchableOpacity 
            style={styles.viewDetailsBtn}
            // Consistently pass orderId so the OrderDetailsScreen can fetch it
            onPress={() => navigation.navigate('OrderDetails', { orderId: item.id.toString() })} 
          >
            <Text style={styles.viewDetailsText}>View Digital Tickets</Text>
            <Ionicons name="qr-code-outline" size={16} color="#007AFF" />
          </TouchableOpacity>
        </View>
      );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.header, { color: colors.text }]}>My Tickets</Text>
      </View>

      {/* 🚀 OFFLINE INDICATOR */}
      {isOffline && (
        <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline" size={16} color="#856404" />
            <Text style={styles.offlineText}>Offline Mode: Showing saved tickets</Text>
        </View>
      )}
  
      <FlatList
        data={myOrders}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
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
  container: { flex: 1, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 20 },
  header: { fontSize: 24, fontWeight: 'bold' },
  offlineBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff3cd',
      padding: 10,
      borderRadius: 10,
      marginBottom: 15,
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: '#ffeeba'
  },
  offlineText: { color: '#856404', fontSize: 13, fontWeight: '600' },
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
  ticketSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  eventTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 4 },
  orderTotal: { fontSize: 12 },
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
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '800' },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15 },
  emptySub: { fontSize: 14, textAlign: 'center', marginVertical: 10, paddingHorizontal: 40 },
  marketBtn: { marginTop: 15, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1 },
  marketBtnText: { color: '#007AFF', fontWeight: '600' }
});