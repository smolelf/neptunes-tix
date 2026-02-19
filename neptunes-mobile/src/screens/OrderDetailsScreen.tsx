import React from 'react';
import { View, Text, FlatList, StyleSheet, ScrollView } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useContext, useState} from 'react';
import { ThemeContext } from '../context/ThemeContext';
import apiClient from '../api/client';
import * as SecureStore from 'expo-secure-store';

export default function OrderDetailsScreen({ route }: any) {
  const { colors, isDark } = useContext(ThemeContext);
  const [order, setOrder] = useState(route.params.order); 
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      
      // 2. Fetch the updated order from the new endpoint
      const response = await apiClient.get(`/orders/${order.ID}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // 3. Update the state (this will make the "SCANNED" stamps appear!)
      setOrder(response.data); 
    } catch (error) {
      console.error("Refresh failed:", error);
      // Optional: Alert.alert("Error", "Could not update ticket status");
    } finally {
      setRefreshing(false);
    }
  };

  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
  };

  return (
    <View style={[dynamicStyles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={order.tickets}
        refreshing={refreshing}
        onRefresh={onRefresh}
        keyExtractor={(item) => item.ID.toString()}
        contentContainerStyle={{ padding: 20 }}
        ListHeaderComponent={() => (
          <View style={styles.header}>
            <Text style={[styles.orderTitle, { color: colors.text }]}>Order #{order.ID}</Text>
            <Text style={{ color: colors.subText }}>Show these QR codes at the entrance</Text>
          </View>
        )}
        renderItem={({ item, index }) => (
            <View style={[
                styles.ticketCard, 
                { backgroundColor: colors.card },
                item.checked_in_at && { opacity: 0.5 } // Dims the card if already scanned
              ]}>
                {item.checked_in_at && (
                <View style={styles.scannedOverlay}>
                <Text style={styles.scannedText}>SCANNED</Text>
                </View>
                )}
            <View style={styles.ticketHeader}>
              <Text style={[styles.eventTitle, { color: colors.text }]}>{item.event_name}</Text>
              <Text style={styles.paxLabel}>Ticket {index + 1} of {order.tickets.length}</Text>
            </View>
            
            <View style={styles.qrContainer}>
              {/* Keep QR background white for scanners */}
              <View style={styles.whiteBox}>
                <QRCode value={item.ID.toString()} size={180} />
              </View>
              <Text style={[styles.ticketId, { color: colors.subText }]}>ID: {item.ID}</Text>
            </View>

            <Text style={[
                styles.status, 
                item.checked_in_at && { color: colors.subText }
                ]}>
                {item.checked_in_at ? "Checked In" : "Ready to Scan"}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { marginBottom: 20, alignItems: 'center' },
  orderTitle: { fontSize: 22, fontWeight: 'bold' },
  ticketCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.1)',
  },
  ticketHeader: { width: '100%', marginBottom: 20, alignItems: 'center' },
  eventTitle: { fontSize: 20, fontWeight: 'bold' },
  paxLabel: { fontSize: 14, color: '#007AFF', marginTop: 4, fontWeight: '600' },
  qrContainer: { alignItems: 'center', marginVertical: 10 },
  whiteBox: { backgroundColor: '#fff', padding: 15, borderRadius: 15 },
  ticketId: { marginTop: 10, fontSize: 12, letterSpacing: 1 },
  footer: { 
    width: '100%', 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(128,128,128,0.1)', 
    marginTop: 20, 
    paddingTop: 15,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  category: { fontWeight: '700', textTransform: 'uppercase' },
  status: { color: '#28a745', fontWeight: 'bold' },
  scannedOverlay: {
    position: 'absolute',
    top: '50%',
    zIndex: 10,
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    transform: [{ rotate: '-15deg' }], // Gives it that "stamped" look
    borderWidth: 2,
    borderColor: '#fff',
  },
  scannedText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 24,
    letterSpacing: 2,
  },
});