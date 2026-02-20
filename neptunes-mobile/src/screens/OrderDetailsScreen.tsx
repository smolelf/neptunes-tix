import React, { useContext, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ThemeContext } from '../context/ThemeContext';
import apiClient from '../api/client';

export default function OrderDetailsScreen({ route }: any) {
  const { colors, isDark } = useContext(ThemeContext);
  const [order, setOrder] = useState(route.params.order); 
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Fetch the latest order status (to see if tickets were scanned while the app was open)
      const response = await apiClient.get(`/orders/${order.ID}`);
      setOrder(response.data); 
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={order.tickets}
        refreshing={refreshing}
        onRefresh={onRefresh}
        keyExtractor={(item) => item.ID.toString()}
        contentContainerStyle={{ padding: 20 }}
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <Text style={[styles.orderTitle, { color: colors.text }]}>Order #{order.ID}</Text>
            <Text style={{ color: colors.subText }}>Swipe through your tickets below</Text>
          </View>
        )}
        renderItem={({ item, index }) => {
          // Relational Fix: Get name from nested event object
          const eventName = item.event?.name || "Event Ticket";
          
          return (
            <View style={[
                styles.ticketCard, 
                { backgroundColor: colors.card },
                item.checked_in_at && { opacity: 0.6 }
              ]}>
                
                {/* Visual side-notches for ticket effect */}
                <View style={[styles.notch, styles.notchLeft, { backgroundColor: colors.background }]} />
                <View style={[styles.notch, styles.notchRight, { backgroundColor: colors.background }]} />

                {item.checked_in_at && (
                  <View style={styles.scannedOverlay}>
                    <Text style={styles.scannedText}>USED</Text>
                  </View>
                )}

                <View style={styles.ticketHeader}>
                  <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
                    {eventName}
                  </Text>
                  <Text style={styles.paxLabel}>TICKET {index + 1} OF {order.tickets.length}</Text>
                </View>
                
                <View style={styles.qrContainer}>
                  {/* White box is mandatory so QR codes work in Dark Mode */}
                  <View style={styles.whiteBox}>
                    <QRCode 
                        value={item.ID.toString()} 
                        size={200} 
                        color="black"
                        backgroundColor="white"
                    />
                  </View>
                  <Text style={[styles.ticketId, { color: colors.subText }]}>
                    SERIAL: {item.ID.toString().padStart(6, '0')}
                  </Text>
                </View>

                <View style={styles.footer}>
                    <Text style={[styles.category, { color: colors.text }]}>
                        {item.category}
                    </Text>
                    <Text style={[
                        styles.status, 
                        item.checked_in_at ? { color: '#8e8e93' } : { color: '#28a745' }
                    ]}>
                        {item.checked_in_at ? "CHECKED IN" : "READY TO SCAN"}
                    </Text>
                </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 30, alignItems: 'center', marginTop: 10 },
  orderTitle: { fontSize: 24, fontWeight: 'bold' },
  ticketCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.1)',
    position: 'relative', // Necessary for notches
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  // Ticket Notch Effect
  notch: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    top: '75%', // Positioned near the bottom section
    zIndex: 5,
  },
  notchLeft: { left: -15 },
  notchRight: { right: -15 },
  
  ticketHeader: { width: '100%', marginBottom: 15, alignItems: 'center' },
  eventTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
  paxLabel: { fontSize: 12, color: '#007AFF', marginTop: 4, fontWeight: '800', letterSpacing: 1 },
  qrContainer: { alignItems: 'center', marginVertical: 15 },
  whiteBox: { 
    backgroundColor: '#fff', 
    padding: 15, 
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#eee'
  },
  ticketId: { marginTop: 12, fontSize: 11, letterSpacing: 2, fontWeight: '500' },
  footer: { 
    width: '100%', 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(128,128,128,0.1)', 
    marginTop: 20, 
    paddingTop: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  category: { fontWeight: '800', textTransform: 'uppercase', fontSize: 14 },
  status: { fontWeight: 'bold', fontSize: 13 },
  scannedOverlay: {
    position: 'absolute',
    top: '40%',
    zIndex: 10,
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 12,
    transform: [{ rotate: '-12deg' }],
    borderWidth: 3,
    borderColor: '#fff',
  },
  scannedText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 28,
    letterSpacing: 3,
  },
});