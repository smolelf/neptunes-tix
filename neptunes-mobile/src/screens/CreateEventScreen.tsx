import React, { useState, useContext } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import apiClient from '../api/client';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function CreateEventScreen({ navigation }: any) {
  const { colors } = useContext(ThemeContext);
  
  // Basic Info
  const [eventName, setEventName] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [venueMapUrl, setVenueMapUrl] = useState(''); // 📍 New field

  // Date & Time States
  const [date, setDate] = useState(new Date());
  const [doorTime, setDoorTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Ticket Tiers
  const [tiers, setTiers] = useState([{ category: 'General', price: '', quantity: '' }]);

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios'); // Keep open on iOS, close on Android
    if (selectedDate) setDate(selectedDate);
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) setDoorTime(selectedTime);
  };

  const addTier = () => setTiers([...tiers, { category: '', price: '', quantity: '' }]);

  const updateTier = (index: number, field: string, value: string) => {
    const newTiers = [...tiers];
    (newTiers[index] as any)[field] = value;
    setTiers(newTiers);
  };

  const handleCreate = async () => {
    if (!eventName || !venue) {
      Alert.alert("Error", "Please fill in all event details");
      return;
    }

    // Combine date and time for backend or send separately
    const payload = {
      event_name: eventName,
      description: description,
      venue: venue,
      location_url: venueMapUrl, // 📍 Sending the Map Link
      date: date.toISOString().split('T')[0], // YYYY-MM-DD
      doors_open: doorTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      tiers: tiers.map(tier => ({
        category: tier.category,
        price: parseFloat(tier.price) || 0,
        quantity: parseInt(tier.quantity) || 0
      }))
    };

    try {
      await apiClient.post('/admin/events/create', payload);
      Alert.alert("Success", "Event launched!");
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.error || "Failed to create event");
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.label, { color: colors.text }]}>Event Details</Text>
      
      <TextInput 
        style={[styles.input, { backgroundColor: colors.card, color: colors.text }]} 
        placeholder="Event Name" 
        placeholderTextColor="gray" 
        onChangeText={setEventName} 
      />
      
      <TextInput 
        style={[styles.input, { backgroundColor: colors.card, color: colors.text, height: 80 }]} 
        placeholder="Description" 
        multiline 
        placeholderTextColor="gray" 
        onChangeText={setDescription} 
      />

      {/* 📅 Date & Time Row */}
      <View style={styles.row}>
        {/* Date Button */}
        <TouchableOpacity 
          style={[styles.pickerBtn, { backgroundColor: colors.card, width: '48%' }]} 
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={20} color={colors.subText} />
          <View style={{ marginLeft: 10 }}>
            <Text style={{ fontSize: 10, color: colors.subText }}>Date</Text>
            <Text style={{ color: colors.text, fontWeight: '500' }}>
              {date.toLocaleDateString('en-GB')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Time Button */}
        <TouchableOpacity 
          style={[styles.pickerBtn, { backgroundColor: colors.card, width: '48%' }]} 
          onPress={() => setShowTimePicker(true)}
        >
          <Ionicons name="time-outline" size={20} color={colors.subText} />
          <View style={{ marginLeft: 10 }}>
            <Text style={{ fontSize: 10, color: colors.subText }}>Doors Open</Text>
            <Text style={{ color: colors.text, fontWeight: '500' }}>
              {doorTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 🛠️ Picker Rendering (iOS Inline / Android Modal) */}
      {(showDatePicker || showTimePicker) && Platform.OS === 'ios' && (
        <View style={[styles.iosPickerContainer, { backgroundColor: colors.card }]}>
          {showDatePicker && (
            <DateTimePicker 
              value={date} 
              mode="date" 
              display="inline" 
              onChange={onDateChange} 
            />
          )}
          {showTimePicker && (
            <DateTimePicker 
              value={doorTime} 
              mode="time" 
              display="spinner" 
              onChange={onTimeChange} 
            />
          )}
          <TouchableOpacity 
            style={styles.doneBtn} 
            onPress={() => { setShowDatePicker(false); setShowTimePicker(false); }}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Android Modal (Only shows when triggered) */}
      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} />
      )}
      {Platform.OS === 'android' && showTimePicker && (
        <DateTimePicker value={doorTime} mode="time" display="default" onChange={onTimeChange} />
      )}
      {/* 📍 Venue & Map Link */}
      <TextInput 
        style={[styles.input, { backgroundColor: colors.card, color: colors.text }]} 
        placeholder="Venue Name (e.g. Zepp KL)" 
        placeholderTextColor="gray" 
        onChangeText={setVenue} 
      />
      <TextInput 
        style={[styles.input, { backgroundColor: colors.card, color: colors.text }]} 
        placeholder="Google Maps / Waze URL" 
        placeholderTextColor="gray" 
        onChangeText={setVenueMapUrl} 
      />

      <View style={styles.tierHeader}>
        <Text style={[styles.label, { color: colors.text }]}>Ticket Tiers</Text>
        <TouchableOpacity onPress={addTier}>
          <Ionicons name="add-circle" size={28} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {tiers.map((tier, index) => (
        <View key={index} style={[styles.tierRow, { backgroundColor: colors.card }]}>
          <TextInput style={[styles.tierInput, { color: colors.text }]} placeholder="Cat" placeholderTextColor="gray" value={tier.category} onChangeText={(v) => updateTier(index, 'category', v)} />
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
  pickerBtn: { padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  tierHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  tierRow: { flexDirection: 'row', padding: 10, borderRadius: 10, marginBottom: 10, justifyContent: 'space-between' },
  tierInput: { width: '30%', paddingVertical: 10, borderBottomWidth: 0.2, borderBottomColor: '#ddd' },
  btn: { backgroundColor: '#007AFF', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 20, marginBottom: 50 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  row: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 10 
  },
  iosPickerContainer: {
    borderRadius: 15,
    padding: 10,
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  doneBtn: {
    alignSelf: 'flex-end',
    padding: 10,
  },
  doneBtnText: {
    color: '#007AFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});