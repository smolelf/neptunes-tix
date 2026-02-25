import React, { useContext, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ThemeContext } from '../context/ThemeContext';
import apiClient from '../api/client';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

export default function OrderDetailsScreen({ route }: any) {
  const { colors } = useContext(ThemeContext);
  const [order, setOrder] = useState(route.params.order); 
  const [refreshing, setRefreshing] = useState(false);

  // Status checks
  const isPaid = order.status === 'paid';
  const isPending = order.status === 'pending';
  const isCancelled = order.status === 'cancelled';

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await apiClient.get(`/orders/${order.id}`);
      setOrder(response.data); 
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // 📍 Function to open Maps
  const openMap = (url: string) => {
    if (url) {
      Linking.openURL(url).catch(() => {
        alert("Couldn't open map link.");
      });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={order.tickets}
        refreshing={refreshing}
        onRefresh={onRefresh}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 20 }}
        ListHeaderComponent={() => {
          const event = order.tickets[0]?.event;
          return (
            <View style={styles.header}>
              <Text style={[styles.orderTitle, { color: colors.text }]}>Order #{order.id}</Text>
              
              {/* 🕒 New Event Info Row */}
              {event && (
                <View style={styles.eventInfoBox}>
                  <View style={styles.infoRow}>
                    <Ionicons name="time-outline" size={16} color={colors.subText} />
                    <Text style={{ color: colors.subText }}> Doors Open: {event.doors_open || 'TBA'}</Text>
                  </View>
                  
                  {event.location_url && (
                    <TouchableOpacity 
                      style={styles.mapButton} 
                      onPress={() => openMap(event.location_url)}
                    >
                      <Ionicons name="map-outline" size={16} color="#007AFF" />
                      <Text style={styles.mapButtonText}>Open in Google Maps / Waze</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {isPending && (
                  <TouchableOpacity 
                      style={styles.pendingBanner} 
                      onPress={() => order.payment_url && WebBrowser.openBrowserAsync(order.payment_url)}
                  >
                      <Ionicons name="card-outline" size={20} color="#fff" />
                      <Text style={styles.bannerText}>Payment Pending. Tap to Pay Now.</Text>
                  </TouchableOpacity>
              )}

              {isCancelled && (
                  <View style={[styles.pendingBanner, { backgroundColor: '#ff3b30' }]}>
                      <Ionicons name="close-circle-outline" size={20} color="#fff" />
                      <Text style={styles.bannerText}>Order Expired. Tickets were released.</Text>
                  </View>
              )}
            </View>
          );
        }}
        renderItem={({ item, index }) => {
          const eventName = item.event?.name || "Event Ticket";
          const isScanned = !!item.checked_in_at;
          
          return (
            <View style={[
                styles.ticketCard, 
                { backgroundColor: colors.card },
                (isScanned || !isPaid) && { opacity: 0.6 }
              ]}>
                
                <View style={[styles.notch, styles.notchLeft, { backgroundColor: colors.background }]} />
                <View style={[styles.notch, styles.notchRight, { backgroundColor: colors.background }]} />

                {isScanned && (
                  <View style={styles.scannedOverlay}>
                    <Text style={styles.scannedText}>VOID / USED</Text>
                  </View>
                )}

                {isPending && (
                   <View style={styles.lockedOverlay}>
                        <Ionicons name="lock-closed" size={40} color="#fff" />
                        <Text style={styles.lockedText}>AWAITING PAYMENT</Text>
                   </View>
                )}

                <View style={styles.ticketHeader}>
                  <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>{eventName}</Text>
                  <Text style={styles.paxLabel}>TICKET {index + 1} OF {order.tickets.length}</Text>
                </View>
                
                <View style={styles.qrContainer}>
                  <View style={[styles.whiteBox, !isPaid && { opacity: 0.1 }]}> 
                    <QRCode 
                        value={isPaid ? item.id : "LOCKED"}
                        size={180} 
                        color="black"
                        backgroundColor="white"
                    />
                  </View>
                  <Text style={[styles.ticketId, { color: colors.subText }]}>
                    {isPaid ? `REF: ...${item.id.slice(-8).toUpperCase()}` : "REF: UNCONFIRMED"}
                  </Text>
                </View>

                {/* 🛠️ The Dashed Line Fix */}
                <View style={styles.dashedWrapper}>
                   <View style={[styles.dashedLine, { borderColor: colors.border }]} />
                </View>

                <View style={styles.footer}>
                    <Text style={[styles.category, { color: colors.text }]}>{item.category}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Ionicons 
                            name={isScanned ? "checkmark-circle" : (isPaid ? "checkmark-circle" : "time-outline")} 
                            size={16} 
                            color={isPaid ? "#28a745" : "#ff9500"} 
                        />
                        <Text style={[styles.status, { color: isPaid ? "#28a745" : "#ff9500" }]}>
                            {isScanned ? "USED" : (isPaid ? "READY" : "PENDING")}
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
  // ... existing styles ...
  header: { marginBottom: 20, alignItems: 'center', width: '100%' },
  eventInfoBox: { alignItems: 'center', marginVertical: 10, gap: 5 },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  mapButton: { flexDirection: 'row', alignItems: 'center', marginTop: 5, padding: 5 },
  mapButtonText: { color: '#007AFF', marginLeft: 5, fontWeight: '600', fontSize: 13 },
  
  // 🛠️ New Dashed Line Logic
  dashedWrapper: {
    width: '100%',
    height: 1,
    marginTop: 20,
    overflow: 'hidden', // This is key for the dashed effect
  },
  dashedLine: {
    width: '100%',
    height: 2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 1,
  },
  footer: { 
    width: '100%', 
    marginTop: 15, 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  // Keep your other styles (ticketCard, notch, etc.) but REMOVE borderTopStyle from footer
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
  },
  notch: { position: 'absolute', width: 24, height: 24, borderRadius: 12, top: '80%', zIndex: 5 },
  notchLeft: { left: -12 },
  notchRight: { right: -12 },
  ticketHeader: { width: '100%', marginBottom: 10, alignItems: 'center' },
  eventTitle: { fontSize: 20, fontWeight: 'bold' },
  paxLabel: { fontSize: 11, color: '#007AFF', fontWeight: '800', letterSpacing: 1 },
  qrContainer: { alignItems: 'center' },
  whiteBox: { backgroundColor: '#fff', padding: 12, borderRadius: 15 },
  ticketId: { marginTop: 10, fontSize: 10, letterSpacing: 1 },
  category: { fontWeight: '800', textTransform: 'uppercase', fontSize: 13 },
  status: { fontWeight: 'bold', fontSize: 13 },
  scannedOverlay: {
    position: 'absolute', top: '45%', zIndex: 10, backgroundColor: 'rgba(255, 59, 48, 0.9)',
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, transform: [{ rotate: '-15deg' }],
    borderWidth: 2, borderColor: '#fff',
  },
  scannedText: { color: '#fff', fontWeight: '900', fontSize: 22, letterSpacing: 2 },
  pendingBanner: {
    backgroundColor: '#ff9500', flexDirection: 'row', alignItems: 'center',
    padding: 12, borderRadius: 12, marginBottom: 15, width: '100%', justifyContent: 'center', gap: 10,
  },
  bannerText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  lockedOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 10, justifyContent: 'center', alignItems: 'center', borderRadius: 20,
  },
  lockedText: { color: '#fff', fontWeight: '900', fontSize: 18, marginTop: 10, letterSpacing: 1 },
});