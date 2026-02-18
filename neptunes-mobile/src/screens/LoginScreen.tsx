import React, { useState, useContext } from 'react';
import { View, Text, TextInput, Button, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext'; // Import this
import { StatusBar } from 'expo-status-bar';
import apiClient from '../api/client';

interface LoginResponse {
    token: string;
  }

// 1. Accept the 'navigation' prop
export default function LoginScreen({ navigation }: any) { 
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login } = useContext(AuthContext);
    const { colors, isDark } = useContext(ThemeContext); // Hook into theme

    const handleLogin = async () => {
        try {
          const response = await apiClient.post<LoginResponse>('/login', { email, password });
          const { token } = response.data;
      
          await login(token); 
          
          // Move the user to the main app
          navigation.replace('Home');
        } catch (error: any) {
          const errorMsg = error.response?.data?.error || 'Invalid credentials';
          Alert.alert('Login Failed', errorMsg);
        }
      };
  
      return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          
          <View style={styles.headerArea}>
            <Text style={[styles.title, { color: colors.text }]}>Neptunes-Tix</Text>
            <Text style={{ color: colors.subText }}>Secure Entry, Seamless Experience</Text>
          </View>
    
          <View style={styles.inputArea}>
            <TextInput
              style={[styles.input, { 
                backgroundColor: colors.card, 
                color: colors.text,
                borderColor: isDark ? '#333' : '#ddd' 
              }]}
              placeholder="Email"
              placeholderTextColor={colors.subText}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardAppearance={isDark ? 'dark' : 'light'}
            />
            <TextInput
              style={[styles.input, { 
                backgroundColor: colors.card, 
                color: colors.text,
                borderColor: isDark ? '#333' : '#ddd' 
              }]}
              placeholder="Password"
              placeholderTextColor={colors.subText}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              keyboardAppearance={isDark ? 'dark' : 'light'}
            />
            
            <TouchableOpacity style={styles.button} onPress={handleLogin}>
              <Text style={styles.buttonText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20 },
    headerArea: { alignItems: 'center', marginBottom: 40 },
    title: { fontSize: 32, fontWeight: 'bold' },
    inputArea: { width: '100%' },
    input: {
      height: 55,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 15,
      marginBottom: 15,
      fontSize: 16,
    },
    button: {
      backgroundColor: '#007AFF',
      height: 55,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 10,
    },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  });