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
  const [venueMapUrl, setVenueMapUrl] = useState('');

  // Date & Time States
  const [date, setDate] = useState(new Date());
  const [doorTime, setDoorTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Ticket Tiers
  const [tiers, setTiers] = useState([{ category: '', price: '', quantity: '' }]);

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios'); 
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

  // 🚀 NEW: Ability to remove a tier before launching
  const removeTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!eventName || !venue) {
      Alert.alert("Error", "Please fill in all event details");
      return;
    }

    // 🚀 NEW: Safety filter to prevent sending empty tiers to the backend
    const formattedTiers = tiers
      .filter(t => t.category && t.price && t.quantity)
      .map(tier => ({
        category: tier.category,
        price: parseFloat(tier.price) || 0,
        quantity: parseInt(tier.quantity) || 0
      }));

    if (formattedTiers.length === 0) {
        Alert.alert("Error", "Please complete at least one ticket tier.");
        return;
    }

    const payload = {
      event_name: eventName,
      description: description,
      venue: venue,
      location_url: venueMapUrl,
      date: date.toISOString().split('T')[0], 
      doors_open: doorTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      tiers: formattedTiers
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
        placeholderTextColor={colors.subText} 
        onChangeText={setEventName} 
      />
      
      <TextInput 
        style={[styles.input, { backgroundColor: colors.card, color: colors.text, height: 80 }]} 
        placeholder="Description" 
        multiline 
        placeholderTextColor={colors.subText} 
        onChangeText={setDescription} 
      />

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

      {/* Date/Time Pickers */}
      {(showDatePicker || showTimePicker) && Platform.OS === 'ios' && (
        <View style={[styles.iosPickerContainer, { backgroundColor: colors.card }]}>
          {showDatePicker && (
            <DateTimePicker value={date} mode="date" display="inline" onChange={onDateChange} />
          )}
          {showTimePicker && (
            <DateTimePicker value={doorTime} mode="time" display="spinner" onChange={onTimeChange} />
          )}
          <TouchableOpacity style={styles.doneBtn} onPress={() => { setShowDatePicker(false); setShowTimePicker(false); }}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} />
      )}
      {Platform.OS === 'android' && showTimePicker && (
        <DateTimePicker value={doorTime} mode="time" display="default" onChange={onTimeChange} />
      )}

      <TextInput 
        style={[styles.input, { backgroundColor: colors.card, color: colors.text }]} 
        placeholder="Venue Name (e.g. Zepp KL)" 
        placeholderTextColor={colors.subText} 
        onChangeText={setVenue} 
      />
      <TextInput 
        style={[styles.input, { backgroundColor: colors.card, color: colors.text }]} 
        placeholder="Google Maps / Waze URL" 
        placeholderTextColor={colors.subText} 
        onChangeText={setVenueMapUrl} 
      />

      <View style={styles.tierHeader}>
        <Text style={[styles.label, { color: colors.text }]}>Ticket Tiers</Text>
        <TouchableOpacity onPress={addTier}>
          <Ionicons name="add-circle" size={28} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* 🚀 NEW: The Boxed Layout for Tiers */}
      {tiers.map((tier, index) => (
        <View key={index} style={[styles.newTierBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={styles.newTierHeader}>
            <Text style={{ color: colors.text, fontWeight: 'bold' }}>Tier #{index + 1}</Text>
            {tiers.length > 1 && (
              <TouchableOpacity onPress={() => removeTier(index)}>
                <Ionicons name="close-circle" size={24} color="#FF3B30" />
              </TouchableOpacity>
            )}
          </View>

          <TextInput 
            style={[styles.inputBoxed, { color: colors.text, borderColor: colors.border }]} 
            placeholder="Category Name (e.g. VIP)" 
            placeholderTextColor={colors.subText} 
            value={tier.category} 
            onChangeText={(v) => updateTier(index, 'category', v)} 
          />
          
          <View style={styles.row}>
            <TextInput 
              style={[styles.inputBoxed, styles.halfInput, { color: colors.text, borderColor: colors.border }]} 
              placeholder="Price (RM)" 
              keyboardType="numeric" 
              placeholderTextColor={colors.subText} 
              value={tier.price} 
              onChangeText={(v) => updateTier(index, 'price', v)} 
            />
            <TextInput 
              style={[styles.inputBoxed, styles.halfInput, { color: colors.text, borderColor: colors.border }]} 
              placeholder="Quantity" 
              keyboardType="numeric" 
              placeholderTextColor={colors.subText} 
              value={tier.quantity} 
              onChangeText={(v) => updateTier(index, 'quantity', v)} 
            />
          </View>
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
  input: { padding: 15, borderRadius: 10, marginBottom: 12 },
  pickerBtn: { padding: 15, borderRadius: 10, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  tierHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 15 },
  btn: { backgroundColor: '#007AFF', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10, marginBottom: 50 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  
  // New Styles imported from EditEventScreen
  newTierBox: { padding: 15, borderWidth: 1, borderRadius: 12, marginBottom: 15 },
  newTierHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  inputBoxed: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 12 },
  halfInput: { width: '48%', marginBottom: 0 },
  
  // iOS Picker constraints
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
  doneBtn: { alignSelf: 'flex-end', padding: 10 },
  doneBtnText: { color: '#007AFF', fontWeight: 'bold', fontSize: 16 },
});