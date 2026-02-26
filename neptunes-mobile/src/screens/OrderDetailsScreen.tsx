import React, { useContext, useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, Linking, ActivityIndicator,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ThemeContext } from '../context/ThemeContext';
import apiClient from '../api/client';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function OrderDetailsScreen({ route }: any) {
  const { colors, isDark } = useContext(ThemeContext);
  const { orderId, order: initialOrder } = route.params;

  const [order, setOrder] = useState(initialOrder);
  const [loading, setLoading] = useState(!initialOrder);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrderDetails = async () => {
    try {
      const response = await apiClient.get(`/orders/${orderId || initialOrder?.id}`);
      setOrder(response.data);
    } catch (error) {
      console.error("Fetch order details failed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const isPaid = order?.status === 'paid';
  const isPending = order?.status === 'pending';
  const isCancelled = order?.status === 'cancelled';

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrderDetails();
    setRefreshing(false);
  };

  const openMap = (url: string) => {
    if (url) {
      Linking.openURL(url).catch(() => alert("Couldn't open map link."));
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!order) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={order.tickets}
        refreshing={refreshing}
        onRefresh={onRefresh}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        ListHeaderComponent={() => {
          const event = order.tickets[0]?.event;
          return (
            <View style={styles.header}>
              <Text style={[styles.orderTitle, { color: colors.text }]}>Order #{order.id}</Text>
              
              {event && (
                <View style={styles.eventInfoBox}>
                  <View style={styles.infoRow}>
                    <Ionicons name="time-outline" size={16} color={colors.subText} />
                    <Text style={{ color: colors.subText }}> Doors Open: {event.doors_open || 'TBA'}</Text>
                  </View>
                  {event.location_url && (
                    <TouchableOpacity style={styles.mapButton} onPress={() => openMap(event.location_url)}>
                      <Ionicons name="map-outline" size={16} color="#007AFF" />
                      <Text style={styles.mapButtonText}>Open in Maps</Text>
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
                      <Text style={styles.bannerText}>Order Expired.</Text>
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
                    <QRCode value={isPaid ? item.id : "LOCKED"} size={180} />
                  </View>
                  <Text style={[styles.ticketId, { color: colors.subText }]}>
                    {isPaid ? `REF: ...${item.id.slice(-8).toUpperCase()}` : "REF: UNCONFIRMED"}
                  </Text>
                </View>

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
  header: { marginBottom: 20, alignItems: 'center' },
  orderTitle: { fontSize: 22, fontWeight: 'bold' },
  eventInfoBox: { alignItems: 'center', marginVertical: 10, gap: 5 },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  mapButton: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  mapButtonText: { color: '#007AFF', marginLeft: 5, fontWeight: '600', fontSize: 13 },
  downloadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0,122,255,0.1)',
      paddingVertical: 12,
      paddingHorizontal: 25,
      borderRadius: 15,
      marginVertical: 15,
      borderWidth: 1,
      borderColor: 'rgba(0,122,255,0.2)',
      gap: 10,
  },
  downloadText: { color: '#007AFF', fontWeight: 'bold', fontSize: 14 },
  ticketCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.1)',
    position: 'relative',
    overflow: 'hidden',
  },
  notch: { position: 'absolute', width: 24, height: 24, borderRadius: 12, top: '78%', zIndex: 5 },
  notchLeft: { left: -12 },
  notchRight: { right: -12 },
  ticketHeader: { width: '100%', marginBottom: 15, alignItems: 'center' },
  eventTitle: { fontSize: 20, fontWeight: 'bold' },
  paxLabel: { fontSize: 11, color: '#007AFF', fontWeight: '800', letterSpacing: 1 },
  qrContainer: { alignItems: 'center' },
  whiteBox: { backgroundColor: '#fff', padding: 12, borderRadius: 15 },
  ticketId: { marginTop: 10, fontSize: 10, letterSpacing: 1 },
  dashedWrapper: { width: '100%', height: 1, marginTop: 25, overflow: 'hidden' },
  dashedLine: { width: '100%', height: 2, borderWidth: 1, borderStyle: 'dashed', borderRadius: 1 },
  footer: { width: '100%', marginTop: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  category: { fontWeight: '800', textTransform: 'uppercase', fontSize: 13 },
  status: { fontWeight: 'bold', fontSize: 13 },
  scannedOverlay: {
    position: 'absolute', top: '45%', alignSelf: 'center', zIndex: 10, backgroundColor: 'rgba(255, 59, 48, 0.9)',
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, transform: [{ rotate: '-15deg' }],
    borderWidth: 2, borderColor: '#fff',
  },
  scannedText: { color: '#fff', fontWeight: '900', fontSize: 22 },
  pendingBanner: {
    backgroundColor: '#ff9500', flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 12, marginVertical: 10, width: '100%', justifyContent: 'center', gap: 10,
  },
  bannerText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  lockedOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 10, justifyContent: 'center', alignItems: 'center',
  },
  lockedText: { color: '#fff', fontWeight: '900', fontSize: 18, marginTop: 10 },
});