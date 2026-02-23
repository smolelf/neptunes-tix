import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/client';

interface PointTransaction {
  id: number;
  amount: number;
  reason: string;
  created_at: string;
}

export default function PointsHistoryScreen() {
  const { colors, isDark } = useContext(ThemeContext);
  const [history, setHistory] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = async () => {
    try {
      // 🚀 CHANGE: Use the correct endpoint defined in your main.go
      const res = await apiClient.get('/users/me/points');
      // res.data is the []PointTransaction array from Go
      setHistory(res.data || []); 
    } catch (err) {
      console.error("Points fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const renderItem = ({ item }: { item: PointTransaction }) => {
    const isPositive = item.amount > 0;
    
    return (
      <View style={[styles.item, { backgroundColor: colors.card }]}>
        <View style={[styles.iconContainer, { backgroundColor: isPositive ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)' }]}>
          <Ionicons 
            name={isPositive ? "add-circle" : "remove-circle"} 
            size={24} 
            color={isPositive ? "#28a745" : "#dc3545"} 
          />
        </View>
        <View style={styles.details}>
          <Text style={[styles.reason, { color: colors.text }]}>{item.reason}</Text>
          <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
        <Text style={[styles.amount, { color: isPositive ? "#28a745" : "#dc3545" }]}>
          {isPositive ? '+' : ''}{item.amount.toLocaleString()}
        </Text>
      </View>
    );
  };

  if (loading) return <ActivityIndicator style={{flex:1}} size="large" color="#007AFF" />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        refreshing={refreshing}     // Added
        onRefresh={onRefresh}       // Added
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="gift-outline" size={50} color="gray" />
            <Text style={styles.empty}>No points activity yet.</Text>
          </View>
        }
        contentContainerStyle={{ padding: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  item: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 15, 
    borderRadius: 15, 
    marginBottom: 12,
    elevation: 1 
  },
  iconContainer: { padding: 10, borderRadius: 10, marginRight: 15 },
  details: { flex: 1 },
  reason: { fontWeight: 'bold', fontSize: 14 },
  date: { color: 'gray', fontSize: 11, marginTop: 2 },
  amount: { fontWeight: '900', fontSize: 16 },
  empty: { textAlign: 'center', marginTop: 50, color: 'gray' }
});