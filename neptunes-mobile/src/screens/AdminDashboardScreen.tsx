import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import apiClient from '../api/client';
import { ThemeContext } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

// 1. Defined interfaces to match our Go relational stats output
interface EventStat {
  event_id: number;
  event_name: string;
  revenue: number;
  sold: number;
  scanned: number;
}

interface DashboardStats {
  total_revenue: number;
  total_sold: number;
  total_scanned: number;
  events: EventStat[];
}

export default function AdminDashboardScreen({ navigation }: any) {
  const { colors, isDark } = useContext(ThemeContext);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {      
      const response = await apiClient.get<DashboardStats>('/admin/stats');      
      setStats(response.data);
    } catch (e) {
      console.error("Dashboard Fetch Error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const StatCard = ({ title, value, icon, color }: any) => (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={[styles.cardTitle, { color: colors.subText }]}>{title}</Text>
      <Text style={[styles.cardValue, { color: colors.text }]}>{value}</Text>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: colors.background }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />}
    >
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.header, { color: colors.text }]}>Admin Console</Text>
            <Text style={{ color: colors.subText }}>Real-time event metrics</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.manageBtn}
            onPress={() => navigation.navigate('CreateEvent')}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Global Stats Grid */}
        <View style={styles.row}>
          <StatCard 
            title="Total Revenue" 
            value={`RM${stats?.total_revenue?.toLocaleString() || 0}`} 
            icon="wallet-outline" 
            color="#28a745" 
          />
          <StatCard 
            title="Tickets Sold" 
            value={stats?.total_sold || 0} 
            icon="ticket-outline" 
            color="#007AFF" 
          />
        </View>

        <View style={styles.row}>
          <StatCard 
            title="Checked In" 
            value={stats?.total_scanned || 0} 
            icon="scan-outline" 
            color="#ffc107" 
          />
          <StatCard 
            title="Avg. Attendance" 
            value={`${stats?.total_sold && stats.total_sold > 0 ? Math.round((stats.total_scanned / stats.total_sold) * 100) : 0}%`} 
            icon="people-outline" 
            color="#6f42c1" 
          />
        </View>

        <View style={styles.sectionHeader}>
            <Text style={[styles.subHeader, { color: colors.text }]}>Individual Events</Text>
            <TouchableOpacity onPress={onRefresh}>
                <Ionicons name="refresh" size={18} color={colors.subText} />
            </TouchableOpacity>
        </View>

        {/* Individual Event Performance Cards */}
        {stats?.events?.length === 0 ? (
            <View style={styles.emptyState}>
                <Text style={{ color: colors.subText }}>No active events found.</Text>
            </View>
        ) : (
            stats?.events?.map((event) => {
                const attendanceRate = event.sold > 0 ? (event.scanned / event.sold) : 0;
                
                return (
                    <TouchableOpacity 
                        key={event.event_id} 
                        style={[styles.eventCard, { backgroundColor: colors.card }]}
                        onPress={() => {
                            if (navigation.getState().routeNames.includes('EventDetails')) {
                                navigation.navigate('EventDetails', { eventId: event.event_id });
                            } else {
                                Alert.alert(
                                    event.event_name,
                                    `Revenue: RM${event.revenue}\nSold: ${event.sold}\nScanned: ${event.scanned}`
                                );
                            }
                        }}
                    >
                    <View style={styles.eventInfo}>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.eventName, { color: colors.text }]} numberOfLines={1}>
                                {event.event_name}
                            </Text>
                            <Text style={{ color: colors.subText, fontSize: 13 }}>
                                Revenue: RM{event.revenue.toLocaleString()}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.border} />
                    </View>
                    
                    <View style={styles.progressContainer}>
                        <View style={styles.progressHeader}>
                        <Text style={styles.progressLabel}>Entrance Check-in</Text>
                        <Text style={[styles.progressValue, { color: attendanceRate === 1 ? '#28a745' : '#007AFF' }]}>
                            {Math.round(attendanceRate * 100)}%
                        </Text>
                        </View>
                        <View style={[styles.progressBarBg, { backgroundColor: isDark ? '#333' : '#eee' }]}>
                            <View style={[
                                styles.progressBarFill, 
                                { width: `${attendanceRate * 100}%`, backgroundColor: attendanceRate === 1 ? '#28a745' : '#007AFF' }
                            ]} />
                        </View>
                        <View style={styles.footerRow}>
                            <Text style={styles.scannedCount}>{event.scanned} scanned</Text>
                            <Text style={styles.scannedCount}>{event.sold} sold</Text>
                        </View>
                    </View>
                    </TouchableOpacity>
                );
            })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 25 
  },
  manageBtn: {
    backgroundColor: '#007AFF',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#007AFF',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 }
  },
  header: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginTop: 25,
    marginBottom: 15
  },
  subHeader: { fontSize: 18, fontWeight: 'bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  card: { width: '47%', padding: 18, borderRadius: 20, elevation: 2 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  cardValue: { fontSize: 18, fontWeight: '800' },
  eventCard: {
    padding: 18,
    borderRadius: 20,
    marginBottom: 15,
    elevation: 1,
  },
  eventName: { fontSize: 17, fontWeight: '700', marginBottom: 2 },
  eventInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  progressContainer: { marginTop: 0 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 12, fontWeight: '600', color: 'gray' },
  progressValue: { fontSize: 13, fontWeight: '800' },
  progressBarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  scannedCount: { fontSize: 11, color: 'gray', fontWeight: '500' },
  emptyState: { padding: 40, alignItems: 'center' }
});