import React, { useState, useContext } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import apiClient from '../api/client';
import { Ionicons } from '@expo/vector-icons';

export default function CreateEventScreen({ navigation }: any) {
  const { colors } = useContext(ThemeContext);
  
  // Basic Info
  const [eventName, setEventName] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState('');

  // Ticket Tiers
  const [tiers, setTiers] = useState([{ category: 'General', price: '', quantity: '' }]);

  const addTier = () => setTiers([...tiers, { category: '', price: '', quantity: '' }]);

  const updateTier = (index: number, field: string, value: string) => {
    const newTiers = [...tiers];
    (newTiers[index] as any)[field] = value;
    setTiers(newTiers);
  };

  const handleCreate = async () => {
    // 1. Validation
    if (!eventName || !venue || !date) {
      Alert.alert("Error", "Please fill in all event details");
      return;
    }

    // 2. Format the dynamic tiers from state
    const formattedTiers = tiers.map(tier => ({
      category: tier.category,
      price: parseFloat(tier.price) || 0,
      quantity: parseInt(tier.quantity) || 0
    }));

    const payload = {
      event_name: eventName,
      description: description,
      venue: venue,
      date: date,
      tiers: formattedTiers
    };

    try {
      await apiClient.post('/admin/events/create', payload);
      Alert.alert("Success", "Event and tickets generated!");
      navigation.goBack();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Failed to create event";
      Alert.alert("Error", errorMsg);
      console.error(err);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.label, { color: colors.text }]}>Event Details</Text>
      <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text }]} placeholder="Event Name" placeholderTextColor="gray" onChangeText={setEventName} />
      <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text, height: 80 }]} placeholder="Description" multiline placeholderTextColor="gray" onChangeText={setDescription} />
      <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text }]} placeholder="Venue" placeholderTextColor="gray" onChangeText={setVenue} />
      <TextInput style={[styles.input, { backgroundColor: colors.card, color: colors.text }]} placeholder="Date (e.g. 2026-05-20)" placeholderTextColor="gray" onChangeText={setDate} />

      <View style={styles.tierHeader}>
        <Text style={[styles.label, { color: colors.text }]}>Ticket Tiers</Text>
        <TouchableOpacity onPress={addTier}><Ionicons name="add-circle" size={28} color="#007AFF" /></TouchableOpacity>
      </View>

      {tiers.map((tier, index) => (
        <View key={index} style={[styles.tierRow, { backgroundColor: colors.card }]}>
          <TextInput style={[styles.tierInput, { color: colors.text }]} placeholder="Category (VIP)" placeholderTextColor="gray" value={tier.category} onChangeText={(v) => updateTier(index, 'category', v)} />
          <TextInput style={[styles.tierInput, { color: colors.text }]} placeholder="Price" keyboardType="numeric" placeholderTextColor="gray" value={tier.price} onChangeText={(v) => updateTier(index, 'price', v)} />
          <TextInput style={[styles.tierInput, { color: colors.text }]} placeholder="Qty" keyboardType="numeric" placeholderTextColor="gray" value={tier.quantity} onChangeText={(v) => updateTier(index, 'quantity', v)} />
        </View>
      ))}

      <TouchableOpacity style={styles.btn} onPress={handleCreate}>
        <Text style={styles.btnText}>Launch Event</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  label: { fontSize: 18, fontWeight: 'bold', marginVertical: 10 },
  input: { padding: 15, borderRadius: 10, marginBottom: 10 },
  tierHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  tierRow: { flexDirection: 'row', padding: 10, borderRadius: 10, marginBottom: 10, justifyContent: 'space-between' },
  tierInput: { width: '30%', paddingVertical: 10, borderBottomWidth: 0.2, borderBottomColor: '#ddd' },
  btn: { backgroundColor: '#007AFF', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 20, marginBottom: 50 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});