import React, { useContext, useState, useEffect, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, Linking, ActivityIndicator, Platform, Image, Dimensions
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ThemeContext } from '../context/ThemeContext';
import apiClient, { SERVER_BASE_URL } from '../api/client';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

const { width } = Dimensions.get('window');

export default function OrderDetailsScreen({ route }: any) {
  const { colors } = useContext(ThemeContext);
  const { orderId, order: initialOrder } = route.params || {};

  const [order, setOrder] = useState<any>(initialOrder);
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
  };

  const openMap = (url: string) => {
    if (url) {
      Linking.openURL(url).catch(() => alert("Couldn't open map link."));
    }
  };

  const ticketCounts = useMemo(() => {
    if (!order?.tickets) return {};
    return order.tickets.reduce((acc: any, ticket: any) => {
      const category = ticket.category || 'General';
      if (!acc[category]) {
        acc[category] = { count: 0, price: ticket.price || 0 };
      }
      acc[category].count += 1;
      return acc;
    }, {});
  }, [order]);

  const formatTicketDate = (dateString: string) => {
    if (!dateString || dateString === 'TBA') return 'Date TBA';
    return new Date(dateString).toLocaleDateString('en-MY', { 
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
    });
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />
        <Text style={{ color: colors.text, marginTop: 20 }}>Order not found.</Text>
      </View>
    );
  }

  const mainEvent = order.tickets && order.tickets.length > 0 ? order.tickets[0].event : null;
  const imageSource = mainEvent?.banner_url ? { uri: `${SERVER_BASE_URL}${mainEvent.banner_url}` } : require('../../assets/placeholder.png');

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      
      {/* 🚀 Visual Drag Handle for Modal */}
      <View style={styles.modalHeader}>
        <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />
      </View>

      <FlatList
        data={order.tickets}
        refreshing={refreshing}
        onRefresh={onRefresh}
        keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => {
          return (
            <View style={styles.headerContent}>
              
              {/* Event Summary Hero */}
              {mainEvent && (
                <View style={styles.eventSummaryContainer}>
                    <Image source={imageSource} style={styles.eventImage} />
                    <View style={styles.eventSummaryText}>
                        <Text style={[styles.eventName, { color: colors.text }]} numberOfLines={2}>
                            {mainEvent.name || 'Event Details'}
                        </Text>
                        <Text style={[styles.eventDetails, { color: colors.subText }]}>
                            {formatTicketDate(mainEvent.date)}
                        </Text>
                        
                        <View style={styles.infoRow}>
                            <Ionicons name="time-outline" size={14} color={colors.subText} />
                            <Text style={[styles.eventDetails, { color: colors.subText, marginLeft: 4 }]}>
                                Doors Open: {mainEvent.doors_open || 'TBA'}
                            </Text>
                        </View>

                        {mainEvent.location_url ? (
                            <TouchableOpacity style={styles.mapButton} onPress={() => openMap(mainEvent.location_url)}>
                                <Ionicons name="map-outline" size={14} color="#007AFF" />
                                <Text style={styles.mapButtonText}>Open in Maps</Text>
                            </TouchableOpacity>
                        ) : (
                            <Text style={[styles.eventDetails, { color: colors.subText, marginTop: 4 }]}>
                                📍 {mainEvent.venue || 'TBA'}
                            </Text>
                        )}
                    </View>
                </View>
              )}

              {/* Payment Banners */}
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
                      <Text style={styles.bannerText}>Order Expired or Cancelled.</Text>
                  </View>
              )}

              {/* Invoice Box */}
              <View style={[styles.invoiceBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.invoiceTitle, { color: colors.text }]}>Order #{order.id}</Text>
                  
                  {Object.keys(ticketCounts).map(cat => (
                     <View style={styles.invoiceRow} key={cat}>
                        <Text style={[styles.invoiceItem, { color: colors.text }]}>{ticketCounts[cat].count}x {cat}</Text>
                        <Text style={[styles.invoiceAmount, { color: colors.text }]}>RM {(ticketCounts[cat].count * ticketCounts[cat].price).toFixed(2)}</Text>
                     </View>
                  ))}

                  {(order.coupon_discount > 0 || order.points_applied > 0) ? (
                      <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  ) : null}

                  {order.coupon_discount > 0 && (
                      <View style={styles.invoiceRow}>
                        <Text style={styles.invoiceItemDiscount}>Promo Code</Text>
                        <Text style={styles.invoiceAmountDiscount}>-RM {order.coupon_discount.toFixed(2)}</Text>
                     </View>
                  )}

                  {order.points_applied > 0 && (
                      <View style={styles.invoiceRow}>
                        <Text style={styles.invoiceItemDiscount}>Points Redeemed</Text>
                        <Text style={styles.invoiceAmountDiscount}>-RM {(order.points_applied / 100).toFixed(2)}</Text>
                     </View>
                  )}

                  <View style={[styles.divider, { backgroundColor: colors.border, height: 2 }]} />

                  <View style={styles.invoiceRow}>
                      <Text style={[styles.invoiceTotal, { color: colors.text }]}>Grand Total</Text>
                      <Text style={styles.invoiceTotalAmount}>RM {order.total_amount?.toFixed(2)}</Text>
                  </View>

                  {isPaid && order.payment_method && (
                      <View style={styles.paymentDetailsBox}>
                          <Text style={styles.paymentDetailText}>Paid via {order.payment_method}</Text>
                          <Text style={styles.paymentDetailText}>Ref: {order.gateway_ref}</Text>
                      </View>
                  )}
              </View>

              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Your Tickets ({order.tickets?.length || 0})
              </Text>
            </View>
          );
        }}
        renderItem={({ item, index }) => {
          const eventName = item.event?.name || mainEvent?.name || "Event Ticket";
          const isScanned = !!item.checked_in_at || item.status === 'used';
          const safeIdStr = item.id ? item.id.toString() : '0000';
          
          return (
            <View style={[
                styles.ticketCard, 
                { backgroundColor: colors.card, borderColor: colors.border },
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
                  <Text style={[styles.ticketEventTitle, { color: colors.text }]} numberOfLines={1}>{eventName}</Text>
                  <Text style={styles.paxLabel}>TICKET {index + 1} OF {order.tickets.length}</Text>
                </View>
                
                <View style={styles.qrContainer}>
                  <View style={[styles.whiteBox, !isPaid && { opacity: 0.1 }]}> 
                    <QRCode value={isPaid ? safeIdStr : "LOCKED"} size={width * 0.45} backgroundColor="#fff" color="#000" />
                  </View>
                  <Text style={[styles.ticketId, { color: colors.subText }]}>
                    {isPaid ? `REF: ...${safeIdStr.slice(-8).toUpperCase()}` : "REF: UNCONFIRMED"}
                  </Text>
                </View>

                <View style={styles.dashedWrapper}>
                   <View style={[styles.dashedLine, { borderColor: colors.border }]} />
                </View>

                <View style={styles.footer}>
                    <Text style={[styles.category, { color: colors.text }]}>{item.category || 'GENERAL'}</Text>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Modal Drag Handle
  modalHeader: { width: '100%', alignItems: 'center', paddingTop: 12, paddingBottom: 10 },
  dragHandle: { width: 40, height: 5, borderRadius: 3 },
  
  headerContent: { paddingTop: 10 },

  eventSummaryContainer: { flexDirection: 'row', marginBottom: 20 },
  eventImage: { width: 85, height: 85, borderRadius: 12 },
  eventSummaryText: { flex: 1, marginLeft: 15, justifyContent: 'center' },
  eventName: { fontSize: 18, fontWeight: '800', marginBottom: 5 },
  eventDetails: { fontSize: 13, marginBottom: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  mapButton: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  mapButtonText: { color: '#007AFF', marginLeft: 4, fontWeight: '700', fontSize: 13 },
  
  invoiceBox: { width: '100%', padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 25 },
  invoiceTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  invoiceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  invoiceItem: { fontSize: 15 },
  invoiceAmount: { fontSize: 15, fontWeight: '600' },
  invoiceItemDiscount: { fontSize: 15, color: '#28a745' },
  invoiceAmountDiscount: { fontSize: 15, fontWeight: '600', color: '#28a745' },
  invoiceTotal: { fontSize: 16, fontWeight: 'bold' },
  invoiceTotalAmount: { fontSize: 20, fontWeight: '900', color: '#007AFF' },
  divider: { width: '100%', height: 1, marginVertical: 12 },
  paymentDetailsBox: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.2)', alignItems: 'center' },
  paymentDetailText: { fontSize: 12, color: 'gray', marginBottom: 2 },

  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },

  pendingBanner: { backgroundColor: '#ff9500', flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 20, width: '100%', justifyContent: 'center', gap: 10 },
  bannerText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  ticketCard: { borderRadius: 20, padding: 24, marginBottom: 25, borderWidth: 1, position: 'relative', overflow: 'hidden', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  notch: { position: 'absolute', width: 24, height: 24, borderRadius: 12, top: '75%', zIndex: 5, borderWidth: 1, borderColor: 'rgba(128,128,128,0.1)' },
  notchLeft: { left: -12 },
  notchRight: { right: -12 },
  ticketHeader: { width: '100%', marginBottom: 15, alignItems: 'center' },
  ticketEventTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  paxLabel: { fontSize: 11, color: '#007AFF', fontWeight: '800', letterSpacing: 1 },
  
  qrContainer: { alignItems: 'center', paddingVertical: 10 },
  whiteBox: { backgroundColor: '#fff', padding: 12, borderRadius: 15, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  ticketId: { marginTop: 12, fontSize: 11, letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  
  dashedWrapper: { width: '100%', height: 1, marginTop: 25, overflow: 'hidden' },
  dashedLine: { width: '100%', height: 2, borderWidth: 1, borderStyle: 'dashed', borderRadius: 1 },
  
  footer: { width: '100%', marginTop: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  category: { fontWeight: '800', textTransform: 'uppercase', fontSize: 14 },
  status: { fontWeight: 'bold', fontSize: 13 },
  
  scannedOverlay: { position: 'absolute', top: '40%', alignSelf: 'center', zIndex: 10, backgroundColor: 'rgba(255, 59, 48, 0.9)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, transform: [{ rotate: '-15deg' }], borderWidth: 2, borderColor: '#fff' },
  scannedText: { color: '#fff', fontWeight: '900', fontSize: 22, letterSpacing: 1 },
  
  lockedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 10, justifyContent: 'center', alignItems: 'center' },
  lockedText: { color: '#fff', fontWeight: '900', fontSize: 18, marginTop: 10 },
});