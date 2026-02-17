import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';
import { Ionicons } from '@expo/vector-icons';
import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';

export default function MyTicketsScreen() {
  const { colors, isDark} = useContext(ThemeContext);
  const [myTickets, setMyTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
      const response = await apiClient.get('/my-tickets', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setMyTickets(response.data);
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" style={{flex: 1}} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Themed Header */}
      <Text style={[styles.header, { color: colors.text }]}>My Tickets</Text>
      
      {/* Themed Empty State */}
      {myTickets.length === 0 && !loading && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 }}>
            <Ionicons name="ticket-outline" size={80} color={isDark ? "#444" : "#ccc"} />
            <Text style={{ color: colors.subText, marginTop: 10 }}>
              No tickets found. Go to Marketplace!
            </Text>
        </View>
      )}
  
      <FlatList
        data={myTickets}
        keyExtractor={(item: any) => item.ID.toString()}
        renderItem={({ item }) => (
          <View style={[styles.ticketCard, { backgroundColor: colors.card }]}>
            <View style={styles.info}>
              <Text style={[styles.eventTitle, { color: colors.text }]}>
                {item.event_name}
              </Text>
              <Text style={{ color: colors.subText }}>
                {item.category}
              </Text>
              {item.checked_in_at && <Text style={styles.used}>USED</Text>}
            </View>
            
            {/* QR Code Background: We keep this white so it's scannable in the dark! */}
            <View style={{ backgroundColor: '#fff', padding: 8, borderRadius: 8 }}>
              <QRCode value={item.ID.toString()} size={80} />
            </View>
          </View>
        )}
        refreshing={refreshing}
        onRefresh={onRefresh}
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
});