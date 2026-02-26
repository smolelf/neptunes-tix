import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, Keyboard, TouchableWithoutFeedback,
  KeyboardAvoidingView, Platform } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons'; // 🚀 Added for the back icon
import apiClient from '../api/client';

export default function LoginScreen({ route, navigation }: any) { 
    const { login } = useContext(AuthContext);
    const { colors, isDark } = useContext(ThemeContext);
    const { targetTicket } = route.params || {};

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async () => {
        try {
            const response = await apiClient.post('/login', { email, password });
            const { token } = response.data;
            await login(token);

            if (targetTicket) {
                navigation.navigate('Home', { 
                    screen: 'Marketplace', 
                    params: { autoOpenTicket: targetTicket } 
                });
            } else {
                navigation.replace('Home');
            }
        } catch (error: any) {
            Alert.alert("Login Failed", error.response?.data?.error || "Invalid credentials");
        }
    };
  
    return (
      <KeyboardAvoidingView 
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  style={{ flex: 1 }}
              >
                  <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={[styles.container, { backgroundColor: colors.background }]}>
                        <StatusBar style={isDark ? 'light' : 'dark'} />
                        
                        {/* 🚀 NEW: Back Button */}
                        <TouchableOpacity 
                            style={styles.backButton} 
                            onPress={() => navigation.goBack()}
                        >
                            <Ionicons name="chevron-back" size={28} color={colors.text} />
                        </TouchableOpacity>
                
                        <View style={styles.headerArea}>
                            <Text style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
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
                                <Text style={styles.buttonText}>Login</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity onPress={() => navigation.navigate('Signup', { targetTicket })}>
                                <Text style={styles.signupLink}>Don't have an account? Sign up</Text>
                            </TouchableOpacity>
                        </View>
                      </View>
                  </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20 },
    // 🚀 NEW: Back Button Style
    backButton: {
        position: 'absolute',
        top: 60, // Adjust based on SafeArea status bar height
        left: 20,
        zIndex: 10,
        padding: 5,
    },
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
    signupLink: { color: '#007AFF', marginTop: 15, textAlign: 'center' },
});