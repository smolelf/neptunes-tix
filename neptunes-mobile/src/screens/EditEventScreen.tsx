import React, { useState, useContext, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';

export default function EditEventScreen({ route, navigation }: any) {
  const { colors } = useContext(ThemeContext);
  
  // We expect the Admin Dashboard to pass the selected event via navigation params
  const { event } = route.params;
  // 1. Basic Details State
  const [name, setName] = useState(event?.event_name || '');
  const [venue, setVenue] = useState(''); 
  const [date, setDate] = useState('');   
  const [currentTiers, setCurrentTiers] = useState<any[]>([]);
  const [locationUrl, setLocationUrl] = useState('');

  // 2. Complex Tier Management States
  // Track how much stock to add to existing categories: { "VIP": 50 }
  const [addStock, setAddStock] = useState<Record<string, number>>({}); 
  // Track which categories to delete entirely
  const [removeTiers, setRemoveTiers] = useState<string[]>([]);
  // Track brand new categories being created
  const [newTiers, setNewTiers] = useState<{ category: string; price: string; quantity: string }[]>([]);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFullDetails = async () => {
      try {
        const token = await SecureStore.getItemAsync('userToken');
        // Use event.event_id here
        const response = await apiClient.get(`/admin/events/${event.event_id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        const fullData = response.data;
        
        // 🚀 FIX 2: Use lowercase to match Go's default JSON output
        setName(fullData.name || fullData.Name || '');
        setVenue(fullData.venue || fullData.Venue || '');
        setDate(fullData.date || fullData.Date || ''); 
        setLocationUrl(fullData.location_url || fullData.LocationURL || '');
        setCurrentTiers(fullData.tiers || []);
        
      } catch (error) {
        console.error("Failed to load event details", error);
        Alert.alert("Error", "Could not load event details.");
      } finally {
        setLoading(false);
      }
    };

    fetchFullDetails();
  }, [event.event_id]);

  // --- Handlers for New Tiers ---
  const addNewTierRow = () => setNewTiers([...newTiers, { category: '', price: '', quantity: '' }]);
  const updateNewTier = (index: number, field: string, value: string) => {
    const updated = [...newTiers];
    updated[index] = { ...updated[index], [field]: value };
    setNewTiers(updated);
  };
  const removeNewTierRow = (index: number) => setNewTiers(newTiers.filter((_, i) => i !== index));

  // --- Handlers for Existing Tiers ---
  const toggleRemoveTier = (category: string) => {
    if (removeTiers.includes(category)) {
      setRemoveTiers(removeTiers.filter(c => c !== category));
    } else {
      Alert.alert(
        "Warning", 
        `Are you sure? This will delete all unsold '${category}' tickets. It will fail if any have already been sold.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Mark for Deletion", style: "destructive", onPress: () => setRemoveTiers([...removeTiers, category]) }
        ]
      );
    }
  };

  const incrementAddStock = (category: string) => {
    setAddStock(prev => ({ ...prev, [category]: (prev[category] || 0) + 1 }));
  };

  const decrementAddStock = (category: string) => {
    setAddStock(prev => {
      const current = prev[category] || 0;
      if (current <= 0) return prev;
      return { ...prev, [category]: current - 1 };
    });
  };

  // --- API Submission ---
  const handleSaveChanges = async () => {
    setLoading(true);

    // Format new tiers safely
    const formattedNewTiers = newTiers
      .filter(t => t.category && t.price && t.quantity)
      .map(t => ({
        category: t.category,
        price: parseFloat(t.price),
        quantity: parseInt(t.quantity, 10)
      }));

    // Format add stock safely (Backend requires price, so we pull it from the existing event data)
    const formattedAddStock = Object.keys(addStock)
      .filter(category => addStock[category] > 0)
      .map(category => {
        const existingTier = currentTiers.find((t: any) => t.category === category);
        return {
          category,
          quantity: addStock[category],
          price: existingTier ? existingTier.price : 0 
        };
      });

    const payload = {
      name: name !== event.event_name ? name : undefined,
      venue: venue !== event.venue ? venue : undefined,
      date: date !== event.date ? date : undefined,
      location_url: locationUrl,
      add_tiers: formattedNewTiers.length > 0 ? formattedNewTiers : undefined,
      add_stock: formattedAddStock.length > 0 ? formattedAddStock : undefined,
      remove_tiers: removeTiers.length > 0 ? removeTiers : undefined,
    };

    try {
      const token = await SecureStore.getItemAsync('userToken');
      await apiClient.put(`/admin/events/${event.event_id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert("Success", "Event updated successfully!", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      Alert.alert("Update Failed", error.response?.data?.error || "Could not update event.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
        
        {/* --- 1. Basic Details --- */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Event Details</Text>
          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={name} onChangeText={setName} placeholder="Event Name" placeholderTextColor={colors.subText} />
          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={venue} onChangeText={setVenue} placeholder="Venue" placeholderTextColor={colors.subText} />
          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} value={date} onChangeText={setDate} placeholder="Date (e.g., 2026-12-31)" placeholderTextColor={colors.subText} />
          <TextInput 
              style={[styles.input, { color: colors.text, borderColor: colors.border }]} 
              value={locationUrl} 
              onChangeText={setLocationUrl} 
              placeholder="Google Maps / Waze URL" 
              placeholderTextColor={colors.subText} 
              keyboardType="url"
              autoCapitalize="none"
          />
        </View>

        {/* --- 2. Manage Existing Tiers --- */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Manage Existing Categories</Text>
          
          {currentTiers.map((tier: any, index: number) => {
            const isMarkedForRemoval = removeTiers.includes(tier.category);
            const stockToAdd = addStock[tier.category] || 0;

            return (
              <View key={index} style={[styles.existingTierRow, { borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tierName, { color: isMarkedForRemoval ? '#FF3B30' : colors.text }]}>
                    {tier.category} {isMarkedForRemoval && "(Deleting)"}
                  </Text>
                  <Text style={{ color: colors.subText }}>RM{tier.price} • {tier.stock} left</Text>
                </View>

                {!isMarkedForRemoval ? (
                  <View style={styles.stockControls}>
                    <TouchableOpacity onPress={() => decrementAddStock(tier.category)} style={styles.circleBtn}>
                      <Ionicons name="remove" size={18} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.addStockText, { color: stockToAdd > 0 ? '#28a745' : colors.text }]}>
                      +{stockToAdd}
                    </Text>
                    <TouchableOpacity onPress={() => incrementAddStock(tier.category)} style={styles.circleBtn}>
                      <Ionicons name="add" size={18} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => toggleRemoveTier(tier.category)} style={[styles.circleBtn, { marginLeft: 10, backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}>
                      <Ionicons name="trash" size={18} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => toggleRemoveTier(tier.category)} style={styles.undoBtn}>
                    <Text style={styles.undoText}>Undo</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {/* --- 3. Add New Tiers --- */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Add New Categories</Text>
            <TouchableOpacity onPress={addNewTierRow}>
              <Ionicons name="add-circle" size={28} color="#007AFF" />
            </TouchableOpacity>
          </View>

          {newTiers.map((tier, index) => (
            <View key={index} style={[styles.newTierBox, { borderColor: colors.border }]}>
              <View style={styles.newTierHeader}>
                <Text style={{ color: colors.text, fontWeight: 'bold' }}>New Tier #{index + 1}</Text>
                <TouchableOpacity onPress={() => removeNewTierRow(index)}>
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                </TouchableOpacity>
              </View>
              <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border }]} placeholder="Category Name (e.g., Early Bird)" placeholderTextColor={colors.subText} value={tier.category} onChangeText={(v) => updateNewTier(index, 'category', v)} />
              <View style={styles.row}>
                <TextInput style={[styles.input, styles.halfInput, { color: colors.text, borderColor: colors.border }]} placeholder="Price (RM)" placeholderTextColor={colors.subText} keyboardType="numeric" value={tier.price} onChangeText={(v) => updateNewTier(index, 'price', v)} />
                <TextInput style={[styles.input, styles.halfInput, { color: colors.text, borderColor: colors.border }]} placeholder="Quantity" placeholderTextColor={colors.subText} keyboardType="numeric" value={tier.quantity} onChangeText={(v) => updateNewTier(index, 'quantity', v)} />
              </View>
            </View>
          ))}
          {newTiers.length === 0 && <Text style={{ color: colors.subText, fontStyle: 'italic', marginTop: 10 }}>No new categories to add.</Text>}
        </View>

        {/* --- Save Button --- */}
        <TouchableOpacity style={[styles.saveBtn, loading && { opacity: 0.7 }]} onPress={handleSaveChanges} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Event Changes</Text>}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 50 },
  card: { padding: 20, borderRadius: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  halfInput: { width: '48%' },
  existingTierRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  tierName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  stockControls: { flexDirection: 'row', alignItems: 'center' },
  circleBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(128,128,128,0.1)', justifyContent: 'center', alignItems: 'center', marginHorizontal: 5 },
  addStockText: { fontSize: 16, fontWeight: 'bold', minWidth: 35, textAlign: 'center' },
  undoBtn: { backgroundColor: 'rgba(0,122,255,0.1)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  undoText: { color: '#007AFF', fontWeight: 'bold' },
  newTierBox: { padding: 15, borderWidth: 1, borderRadius: 12, marginBottom: 15 },
  newTierHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  saveBtn: { backgroundColor: '#007AFF', padding: 16, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});