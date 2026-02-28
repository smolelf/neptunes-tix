import React, { useState, useCallback, useContext } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, RefreshControl, 
  TouchableOpacity, ActivityIndicator 
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import apiClient from '../api/client';

export default function AdminDashboardScreen() {
  const { colors } = useContext(ThemeContext);
  const navigation = useNavigation<any>();
  
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const response = await apiClient.get('/admin/stats');
      setStats(response.data);
    } catch (error) {
      console.error("Dashboard fetch failed:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />}
      >
        
        {/* 📊 1. Analytics Cards */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Overview</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardScroll}>
          <View style={[styles.statCard, { backgroundColor: '#007AFF' }]}>
            <Ionicons name="cash-outline" size={24} color="white" />
            <Text style={styles.cardLabel}>Total Revenue</Text>
            <Text style={styles.cardValue}>RM {stats?.total_revenue?.toLocaleString() || '0'}</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#34C759' }]}>
            <Ionicons name="ticket-outline" size={24} color="white" />
            <Text style={styles.cardLabel}>Tickets Sold</Text>
            <Text style={styles.cardValue}>{stats?.total_sold?.toLocaleString() || '0'}</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#FF9500' }]}>
            <Ionicons name="people-outline" size={24} color="white" />
            <Text style={styles.cardLabel}>Checked In</Text>
            <Text style={styles.cardValue}>{stats?.total_scanned?.toLocaleString() || '0'}</Text>
          </View>
        </ScrollView>

        {/* 🛠️ 2. Manage Events Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Manage Events</Text>
          <TouchableOpacity onPress={() => navigation.navigate('CreateEvent')}>
            <Text style={{ color: '#007AFF', fontWeight: '600' }}>+ Create New</Text>
          </TouchableOpacity>
        </View>

        {stats?.events?.map((event: any) => (
          <View key={event.event_id} style={[styles.eventRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.eventName, { color: colors.text }]}>{event.event_name}</Text>
              <Text style={{ color: colors.subText, fontSize: 12 }}>
                {event.sold} Sold • RM {event.revenue?.toLocaleString()} Rev
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.editBtn}
              onPress={() => navigation.navigate('EditEvent', { event })}
            >
              <Ionicons name="create-outline" size={20} color="#007AFF" />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        ))}

        {(!stats?.events || stats.events.length === 0) && (
          <Text style={{ color: colors.subText, textAlign: 'center', marginTop: 20 }}>
            No active events found. Create one to get started!
          </Text>
        )}

      </ScrollView>
    </View>
  );
}

// Keep your existing StyleSheet here...
const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 15 },
  cardScroll: { maxHeight: 140, marginBottom: 10 },
  statCard: { width: 140, height: 120, borderRadius: 16, padding: 15, marginRight: 15, justifyContent: 'space-between', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
  cardLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 'bold', marginTop: 5 },
  cardValue: { color: 'white', fontSize: 22, fontWeight: '900' },
  eventRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  eventName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  editBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,122,255,0.1)', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  editBtnText: { color: '#007AFF', fontWeight: 'bold', marginLeft: 5, fontSize: 13 }
});