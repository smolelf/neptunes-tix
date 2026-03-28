import React, { useState, useContext } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, Alert, Keyboard, TouchableWithoutFeedback,
    KeyboardAvoidingView, Platform, ActivityIndicator 
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen({ route, navigation }: any) { 
    const { login } = useContext(AuthContext);
    const { colors, isDark } = useContext(ThemeContext);
    const { targetTicket } = route.params || {};
    const insets = useSafeAreaInsets();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert("Missing Fields", "Please enter both email and password.");
            return;
        }

        Keyboard.dismiss();
        setIsLoading(true);

        try {
            const response = await apiClient.post('/login', { email, password });
            const { token } = response.data;
            await login(token);

            if (targetTicket) {
                // Return to the Discover screen and pop open the checkout modal
                navigation.navigate('Home', { 
                    screen: 'Marketplace', 
                    params: { autoOpenTicket: targetTicket } 
                });
            } else {
                navigation.replace('Home');
            }
        } catch (error: any) {
            Alert.alert("Login Failed", error.response?.data?.error || "Invalid credentials");
        } finally {
            setIsLoading(false);
        }
    };
  
    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: colors.background }}
        >
            <StatusBar style={isDark ? 'light' : 'dark'} />
            
            {/* 🚀 Floating Back Button */}
            <TouchableOpacity 
                style={[styles.backButton, { top: Math.max(insets.top, 20) + 10 }]} 
                onPress={() => navigation.goBack()}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
                <Ionicons name="chevron-back" size={28} color={colors.text} />
            </TouchableOpacity>

            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.innerContainer}>
                    
                    <View style={styles.headerArea}>
                        <View style={[styles.iconCircle, { backgroundColor: 'rgba(0,122,255,0.1)' }]}>
                            <Ionicons name="lock-closed" size={40} color="#007AFF" />
                        </View>
                        <Text style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
                        <Text style={[styles.subtitle, { color: colors.subText }]}>Secure Entry, Seamless Experience</Text>
                    </View>
            
                    <View style={styles.formArea}>
                        {/* Email Input */}
                        <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Ionicons name="mail-outline" size={20} color={colors.subText} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { color: colors.text }]}
                                placeholder="Email Address"
                                placeholderTextColor={colors.subText}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                keyboardAppearance={isDark ? 'dark' : 'light'}
                                editable={!isLoading}
                            />
                        </View>

                        {/* Password Input */}
                        <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Ionicons name="key-outline" size={20} color={colors.subText} style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, { color: colors.text }]}
                                placeholder="Password"
                                placeholderTextColor={colors.subText}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                keyboardAppearance={isDark ? 'dark' : 'light'}
                                editable={!isLoading}
                            />
                            <TouchableOpacity 
                                onPress={() => setShowPassword(!showPassword)}
                                style={styles.eyeIcon}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.subText} />
                            </TouchableOpacity>
                        </View>
                        
                        {/* Login Button */}
                        <TouchableOpacity 
                            style={[styles.primaryButton, isLoading && { opacity: 0.7 }]} 
                            onPress={handleLogin}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.primaryButtonText}>Sign In</Text>
                            )}
                        </TouchableOpacity>
                        
                        {/* Signup Link */}
                        <View style={styles.footerRow}>
                            <Text style={{ color: colors.subText, fontSize: 15 }}>Don't have an account? </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Signup', { targetTicket })} disabled={isLoading}>
                                <Text style={styles.signupLink}>Sign up</Text>
                            </TouchableOpacity>
                        </View>

                    </View>
                </View>
            </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    innerContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
    
    backButton: { position: 'absolute', left: 20, zIndex: 10, padding: 5 },
    
    headerArea: { alignItems: 'center', marginBottom: 40 },
    iconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8 },
    subtitle: { fontSize: 16 },
    
    formArea: { width: '100%' },
    
    inputContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        height: 56, 
        borderWidth: 1, 
        borderRadius: 16, 
        paddingHorizontal: 15, 
        marginBottom: 16 
    },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, fontSize: 16, height: '100%' },
    eyeIcon: { padding: 5 },
    
    primaryButton: { 
        backgroundColor: '#007AFF', 
        height: 56, 
        borderRadius: 16, 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginTop: 10,
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4
    },
    primaryButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    
    footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
    signupLink: { color: '#007AFF', fontSize: 15, fontWeight: '700' },
});