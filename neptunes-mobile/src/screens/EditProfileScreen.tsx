import React, { useState, useContext } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/client';

export default function EditProfileScreen({ navigation }: any) {
  const { colors } = useContext(ThemeContext);
  const { user, refreshUser } = useContext(AuthContext);

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(user?.avatar_url || null);
  const [loading, setLoading] = useState(false);

  // 📸 Pick Image Logic
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Required", "We need access to your photos to update your profile picture.");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5, // Keep quality low to ensure Base64 string isn't too huge
      base64: true, // 🚀 Request Base64 directly
    });

    if (!result.canceled && result.assets[0].base64) {
      // Prefix with data URI scheme for display and saving
      setAvatar(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await apiClient.put('/my-profile', {
        name,
        email,
        password: password.length > 0 ? password : undefined, // Only send if changed
        avatar: avatar // Send the Base64 string
      });

      await refreshUser(); // Update global context
      Alert.alert("Success", "Profile updated!", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.error || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
        
        {/* Avatar Section */}
        <View style={styles.avatarContainer}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.placeholderAvatar, { backgroundColor: colors.card }]}>
                <Ionicons name="person" size={50} color={colors.subText} />
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={20} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.changePhotoText, { color: '#007AFF' }]}>Change Photo</Text>
        </View>

        {/* Form Fields */}
        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.text }]}>Full Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.text }]}
            value={name}
            onChangeText={setName}
            placeholder="Your Name"
            placeholderTextColor={colors.subText}
          />

          <Text style={[styles.label, { color: colors.text }]}>Email Address</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.text }]}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={[styles.label, { color: colors.text }]}>New Password (Optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.text }]}
            value={password}
            onChangeText={setPassword}
            placeholder="Leave blank to keep current"
            placeholderTextColor={colors.subText}
            secureTextEntry
          />
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, loading && { opacity: 0.7 }]} 
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Changes</Text>}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20 },
  avatarContainer: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  placeholderAvatar: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ccc' },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#007AFF', padding: 8, borderRadius: 20, borderWidth: 3, borderColor: '#fff' },
  changePhotoText: { marginTop: 10, fontSize: 16, fontWeight: '600' },
  form: { width: '100%' },
  label: { fontSize: 14, fontWeight: 'bold', marginBottom: 8, marginLeft: 5 },
  input: { padding: 15, borderRadius: 12, fontSize: 16, marginBottom: 20 },
  saveButton: { backgroundColor: '#007AFF', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  saveText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});