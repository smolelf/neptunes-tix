import React, { useContext, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ThemeContext } from '../context/ThemeContext';
import apiClient from '../api/client';
import { Ionicons } from '@expo/vector-icons';

export default function OrderDetailsScreen({ route }: any) {
  const { colors } = useContext(ThemeContext);
  const [order, setOrder] = useState(route.params.order); 
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Re-fetch order to check if tickets were scanned
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
        keyExtractor={(item) => item.id} // Updated to lowercase 'id' for UUID string
        contentContainerStyle={{ padding: 20 }}
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <Text style={[styles.orderTitle, { color: colors.text }]}>Order #{order.ID}</Text>
            <Text style={{ color: colors.subText }}>Present these QR codes at the entrance</Text>
          </View>
        )}
        renderItem={({ item, index }) => {
          const eventName = item.event?.name || "Event Ticket";
          const isScanned = !!item.checked_in_at;
          
          return (
            <View style={[
                styles.ticketCard, 
                { backgroundColor: colors.card },
                isScanned && { opacity: 0.6 }
              ]}>
                
                {/* Visual side-notches */}
                <View style={[styles.notch, styles.notchLeft, { backgroundColor: colors.background }]} />
                <View style={[styles.notch, styles.notchRight, { backgroundColor: colors.background }]} />

                {isScanned && (
                  <View style={styles.scannedOverlay}>
                    <Text style={styles.scannedText}>VOID / USED</Text>
                  </View>
                )}

                <View style={styles.ticketHeader}>
                  <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
                    {eventName}
                  </Text>
                  <Text style={styles.paxLabel}>TICKET {index + 1} OF {order.tickets.length}</Text>
                </View>
                
                <View style={styles.qrContainer}>
                  <View style={styles.whiteBox}>
                    <QRCode 
                        value={item.id} // Sending the UUID string
                        size={180} 
                        color="black"
                        backgroundColor="white"
                    />
                  </View>
                  {/* Showing the last 8 chars of UUID as a 'Serial' for easier human reading */}
                  <Text style={[styles.ticketId, { color: colors.subText }]}>
                    REF: ...{item.id.slice(-8).toUpperCase()}
                  </Text>
                </View>

                <View style={styles.footer}>
                    <Text style={[styles.category, { color: colors.text }]}>
                        {item.category}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Ionicons 
                            name={isScanned ? "checkmark-circle" : "time-outline"} 
                            size={16} 
                            color={isScanned ? "#8e8e93" : "#28a745"} 
                        />
                        <Text style={[
                            styles.status, 
                            isScanned ? { color: '#8e8e93' } : { color: '#28a745' }
                        ]}>
                            {isScanned ? "CHECKED IN" : "READY"}
                        </Text>
                    </View>
                </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 20, alignItems: 'center' },
  orderTitle: { fontSize: 22, fontWeight: 'bold' },
  ticketCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.1)',
    position: 'relative',
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  notch: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    top: '78%',
    zIndex: 5,
  },
  notchLeft: { left: -12 },
  notchRight: { right: -12 },
  ticketHeader: { width: '100%', marginBottom: 10, alignItems: 'center' },
  eventTitle: { fontSize: 20, fontWeight: 'bold' },
  paxLabel: { fontSize: 11, color: '#007AFF', fontWeight: '800', letterSpacing: 1 },
  qrContainer: { alignItems: 'center' },
  whiteBox: { 
    backgroundColor: '#fff', 
    padding: 12, 
    borderRadius: 15,
  },
  ticketId: { marginTop: 10, fontSize: 10, letterSpacing: 1, fontFamily: 'monospace' },
  footer: { 
    width: '100%', 
    borderTopWidth: 1, 
    borderTopStyle: 'dashed', // Gives a nice ticket tear-off look
    borderTopColor: 'rgba(128,128,128,0.3)', 
    marginTop: 15, 
    paddingTop: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  category: { fontWeight: '800', textTransform: 'uppercase', fontSize: 13 },
  status: { fontWeight: 'bold', fontSize: 13 },
  scannedOverlay: {
    position: 'absolute',
    top: '45%',
    zIndex: 10,
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    transform: [{ rotate: '-15deg' }],
    borderWidth: 2,
    borderColor: '#fff',
  },
  scannedText: { color: '#fff', fontWeight: '900', fontSize: 22, letterSpacing: 2 },
});