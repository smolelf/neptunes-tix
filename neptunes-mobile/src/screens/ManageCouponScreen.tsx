import React, { useState, useContext, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  Modal, TextInput, Alert, Switch, KeyboardAvoidingView, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import apiClient from '../api/client';
import * as SecureStore from 'expo-secure-store';

export default function ManageCouponsScreen() {
  const { colors } = useContext(ThemeContext);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Form State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [discount, setDiscount] = useState('');
  const [isPercentage, setIsPercentage] = useState(false); // Toggle: Fixed vs %
  const [usageLimit, setUsageLimit] = useState('100');
  const [eventId, setEventId] = useState(''); // Empty = Global
  const [expiryDays, setExpiryDays] = useState('30'); // Simple approach: Valid for X days

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await apiClient.get('/admin/coupons', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCoupons(response.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (coupon?: any) => {
    if (coupon) {
      setEditingId(coupon.id);
      setCode(coupon.code);
      setDiscount(coupon.discount.toString());
      setIsPercentage(coupon.discount_type === 'percentage');
      setUsageLimit(coupon.usage_limit.toString());
      setEventId(coupon.event_id ? coupon.event_id.toString() : '');
    } else {
      setEditingId(null);
      setCode('');
      setDiscount('');
      setIsPercentage(false);
      setUsageLimit('100');
      setEventId('');
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!code || !discount) {
      Alert.alert("Error", "Code and Discount are required.");
      return;
    }

    // Calculate generic future date (Go backend can handle specific date logic if needed)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(expiryDays));

    const payload = {
      code: code.toUpperCase(),
      discount: parseFloat(discount),
      discount_type: isPercentage ? 'percentage' : 'fixed',
      usage_limit: parseInt(usageLimit),
      event_id: eventId ? parseInt(eventId) : null, // Send null for global
      expiry_date: futureDate.toISOString()
    };

    try {
      const token = await SecureStore.getItemAsync('userToken');
      const config = { headers: { Authorization: `Bearer ${token}` } };

      if (editingId) {
        await apiClient.put(`/admin/coupons/${editingId}`, payload, config);
      } else {
        await apiClient.post('/admin/coupons', payload, config);
      }

      setModalVisible(false);
      fetchCoupons();
      Alert.alert("Success", "Coupon saved!");
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.error || "Failed to save coupon");
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert("Delete Coupon", "Are you sure?", [
      { text: "Cancel" },
      { 
        text: "Delete", 
        style: 'destructive', 
        onPress: async () => {
          const token = await SecureStore.getItemAsync('userToken');
          await apiClient.delete(`/admin/coupons/${id}`, {
             headers: { Authorization: `Bearer ${token}` }
          });
          fetchCoupons();
        }
      }
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Active Coupons</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => openModal()}>
          <Ionicons name="add" size={24} color="white" />
          <Text style={styles.addBtnText}>New Code</Text>
        </TouchableOpacity>
      </View>

      <FlatList 
        data={coupons}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View>
              <Text style={[styles.codeText, { color: colors.text }]}>{item.code}</Text>
              <Text style={{ color: colors.subText, fontSize: 13, marginTop: 4 }}>
                {item.discount_type === 'percentage' ? `${item.discount}% OFF` : `RM${item.discount} OFF`}
                {' • '}{item.event_id ? `Event #${item.event_id}` : 'All Events'}
              </Text>
              <Text style={{ color: colors.subText, fontSize: 12, marginTop: 2 }}>
                Used: {item.used_count} / {item.usage_limit}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 15 }}>
              <TouchableOpacity onPress={() => openModal(item)}>
                <Ionicons name="create-outline" size={22} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Ionicons name="trash-outline" size={22} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* --- ADD/EDIT MODAL --- */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingId ? 'Edit Coupon' : 'New Coupon'}
            </Text>

            <TextInput 
              style={[styles.input, { color: colors.text, borderColor: colors.border }]} 
              placeholder="Code (e.g. SUMMER2026)" 
              placeholderTextColor={colors.subText}
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
            />

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <TextInput 
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]} 
                  placeholder="Discount (e.g. 10)" 
                  placeholderTextColor={colors.subText}
                  keyboardType="numeric"
                  value={discount}
                  onChangeText={setDiscount}
                />
              </View>
              <View style={styles.switchContainer}>
                <Text style={{ color: colors.subText, fontSize: 12, marginBottom: 5 }}>
                    {isPercentage ? 'Percentage %' : 'Fixed RM'}
                </Text>
                <Switch 
                  value={isPercentage} 
                  onValueChange={setIsPercentage} 
                  trackColor={{ false: "#767577", true: "#007AFF" }}
                />
              </View>
            </View>

            <View style={styles.row}>
              <TextInput 
                style={[styles.input, { flex: 1, marginRight: 10, color: colors.text, borderColor: colors.border }]} 
                placeholder="Limit (Qty)" 
                keyboardType="numeric"
                value={usageLimit}
                onChangeText={setUsageLimit}
                placeholderTextColor={colors.subText}
              />
               <TextInput 
                style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border }]} 
                placeholder="Event ID (Optional)" 
                keyboardType="numeric"
                value={eventId}
                onChangeText={setEventId}
                placeholderTextColor={colors.subText}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.border }]} onPress={() => setModalVisible(false)}>
                <Text style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#007AFF' }]} onPress={handleSave}>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Save Coupon</Text>
              </TouchableOpacity>
            </View>

          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 10 },
  title: { fontSize: 24, fontWeight: 'bold' },
  addBtn: { flexDirection: 'row', backgroundColor: '#007AFF', padding: 10, borderRadius: 20, alignItems: 'center', paddingHorizontal: 15 },
  addBtnText: { color: 'white', fontWeight: 'bold', marginLeft: 5 },
  card: { padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  codeText: { fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 },
  modalContent: { padding: 24, borderRadius: 20, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  switchContainer: { alignItems: 'center', justifyContent: 'center', paddingBottom: 10 },
  modalBtn: { flex: 1, padding: 15, borderRadius: 10, alignItems: 'center' }
});