import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import apiClient from '../api/client';
import { ThemeContext } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export default function AdminDashboardScreen() {
  const { colors } = useContext(ThemeContext);
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    setRefreshing(true);
    try {      
      const response = await apiClient.get('/admin/stats');      
      setStats(response.data);
    } catch (e) {
      console.error("Dashboard Fetch Error:", e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const StatCard = ({ title, value, icon, color }: any) => (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={[styles.cardTitle, { color: colors.subText }]}>{title}</Text>
      <Text style={[styles.cardValue, { color: colors.text }]}>{value}</Text>
    </View>
  );

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: colors.background }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchStats} />}
    >
      <View style={styles.container}>
        <Text style={[styles.header, { color: colors.text }]}>Event Overview</Text>
        
        <View style={styles.row}>
          <StatCard 
            title="Total Revenue" 
            value={`$${stats?.total_revenue || 0}`} 
            icon="cash-outline" 
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
            icon="checkmark-circle-outline" 
            color="#ffc107" 
          />
          <StatCard 
            title="Attendance" 
            value={`${stats?.total_sold > 0 ? Math.round((stats.total_scanned/stats.total_sold)*100) : 0}%`} 
            icon="people-outline" 
            // Turns purple normally, but green if everyone has arrived!
            color={stats?.total_scanned === stats?.total_sold && stats?.total_sold > 0 ? "#28a745" : "#6f42c1"} 
          />
        </View>

        <Text style={[styles.subHeader, { color: colors.text }]}>Event Performance</Text>

        {stats?.events?.map((event: any, index: number) => {
          const attendanceRate = event.sold > 0 ? (event.scanned / event.sold) : 0;
          
          return (
            <View key={index} style={[styles.eventCard, { backgroundColor: colors.card }]}>
              <View style={styles.eventInfo}>
                <Text style={[styles.eventName, { color: colors.text }]}>{event.event_name}</Text>
                <Text style={{ color: colors.subText }}>${event.revenue.toLocaleString()}</Text>
              </View>
              
              {/* Attendance Progress Bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Attendance</Text>
                  <Text style={styles.progressValue}>{Math.round(attendanceRate * 100)}%</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[
                    styles.progressBarFill, 
                    { width: `${attendanceRate * 100}%`, backgroundColor: '#4CD964' }
                  ]} />
                </View>
                <Text style={styles.scannedCount}>{event.scanned} of {event.sold} checked in</Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  subHeader: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  card: { width: '48%', padding: 20, borderRadius: 15, alignItems: 'center' },
  iconCircle: { padding: 10, borderRadius: 25, marginBottom: 10 },
  cardTitle: { fontSize: 12, marginBottom: 5 },
  cardValue: { fontSize: 20, fontWeight: 'bold' },
  listRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 8 
  },
  eventCard: {
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
  },
  eventName: { fontSize: 18, fontWeight: 'bold' },
  eventInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  progressContainer: { marginTop: 5 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  progressLabel: { fontSize: 12, color: 'gray' },
  progressValue: { fontSize: 12, fontWeight: 'bold', color: '#4CD964' },
  progressBarBg: { height: 8, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 4 },
  progressBarFill: { height: 8, borderRadius: 4 },
  scannedCount: { fontSize: 11, color: 'gray', marginTop: 5 }
});