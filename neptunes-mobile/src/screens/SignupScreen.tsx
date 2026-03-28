import React, { useState, useContext } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    Alert, ActivityIndicator, KeyboardAvoidingView,
    Platform, Keyboard, TouchableWithoutFeedback, ScrollView 
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SignupScreen({ route, navigation }: any) {
    const { signUp } = useContext(AuthContext);
    const { colors, isDark } = useContext(ThemeContext);
    const { targetTicket } = route.params || {};
    const insets = useSafeAreaInsets();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const getPasswordStrength = (pass: string) => {
        let score = 0;
        if (pass.length > 6) score++; 
        if (/[0-9]/.test(pass)) score++; 
        if (/[^A-Za-z0-9]/.test(pass)) score++; 
        return score;
    };

    const getStrengthDetails = (score: number) => {
        switch (score) {
            case 0: return { label: 'Weak', color: '#FF3B30', width: '25%' };
            case 1: return { label: 'Fair', color: '#FF9500', width: '50%' };
            case 2: return { label: 'Good', color: '#FFCC00', width: '75%' };
            case 3: return { label: 'Strong', color: '#34C759', width: '100%' };
            default: return { label: '', color: 'transparent', width: '0%' };
        }
    };

    const handleSignup = async () => {
        if (!name || !email || !password || !confirmPassword) {
            Alert.alert("Missing Fields", "All fields are required.");
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert("Password Mismatch", "Your passwords do not match.");
            return;
        }

        if (getPasswordStrength(password) < 2) {
            Alert.alert("Security", "Please create a stronger password (include numbers or symbols).");
            return;
        }

        Keyboard.dismiss();
        setLoading(true);

        const result = await signUp(name, email, password);
        
        setLoading(false);

        if (result.success) {
            navigation.goBack();
        } else {
            Alert.alert("Signup Failed", result.error);
        }
    };

    const passStrength = getPasswordStrength(password);
    const strengthDetails = getStrengthDetails(passStrength);
    const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

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
                <ScrollView 
                    contentContainerStyle={[styles.scrollContainer, { paddingTop: insets.top + 0 }]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    
                    {/* Header Area */}
                    <View style={styles.headerArea}>
                        <View style={[styles.iconCircle, { backgroundColor: 'rgba(0,122,255,0.1)' }]}>
                            <Ionicons name="person-add" size={36} color="#007AFF" style={{ marginLeft: 4 }} />
                        </View>
                        <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>
                        <Text style={[styles.subtitle, { color: colors.subText }]}>Join now and get 100 Welcome Points! 🎁</Text>
                    </View>

                    <View style={styles.formArea}>
                        
                        {/* Name Input */}
                        <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Ionicons name="person-outline" size={20} color={colors.subText} style={styles.inputIcon} />
                            <TextInput 
                                style={[styles.input, { color: colors.text }]} 
                                placeholder="Full Name" 
                                placeholderTextColor={colors.subText}
                                value={name}
                                onChangeText={setName}
                                editable={!loading}
                            />
                        </View>

                        {/* Email Input */}
                        <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <Ionicons name="mail-outline" size={20} color={colors.subText} style={styles.inputIcon} />
                            <TextInput 
                                style={[styles.input, { color: colors.text }]} 
                                placeholder="Email Address" 
                                placeholderTextColor={colors.subText}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={email}
                                onChangeText={setEmail}
                                editable={!loading}
                            />
                        </View>

                        {/* Password Input */}
                        <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: password.length > 0 ? 8 : 16 }]}>
                            <Ionicons name="key-outline" size={20} color={colors.subText} style={styles.inputIcon} />
                            <TextInput 
                                style={[styles.input, { color: colors.text }]} 
                                placeholder="Create Password" 
                                placeholderTextColor={colors.subText}
                                secureTextEntry={!showPassword}
                                value={password}
                                onChangeText={setPassword}
                                editable={!loading}
                            />
                            <TouchableOpacity 
                                onPress={() => setShowPassword(!showPassword)}
                                style={styles.eyeIcon}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.subText} />
                            </TouchableOpacity>
                        </View>

                        {/* Password Strength Indicator */}
                        {password.length > 0 && (
                            <View style={styles.strengthWrapper}>
                                <View style={[styles.strengthBarBackground, { backgroundColor: colors.border }]}>
                                    <View 
                                        style={[
                                            styles.strengthBarActive, 
                                            { 
                                                width: strengthDetails.width as any,
                                                backgroundColor: strengthDetails.color 
                                            }
                                        ]} 
                                    />
                                </View>
                                <Text style={[styles.strengthLabel, { color: strengthDetails.color }]}>
                                    {strengthDetails.label}
                                </Text>
                            </View>
                        )}

                        {/* Confirm Password Input */}
                        <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: passwordsMatch ? '#34C759' : colors.border, marginBottom: 8 }]}>
                            <Ionicons name="checkmark-done-outline" size={20} color={passwordsMatch ? '#34C759' : colors.subText} style={styles.inputIcon} />
                            <TextInput 
                                style={[styles.input, { color: colors.text }]} 
                                placeholder="Confirm Password" 
                                placeholderTextColor={colors.subText}
                                secureTextEntry={!showPassword}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                editable={!loading}
                            />
                        </View>

                        {/* Match Indicator */}
                        {confirmPassword.length > 0 && (
                            <Text style={[styles.matchText, { color: passwordsMatch ? '#34C759' : '#FF3B30' }]}>
                                {passwordsMatch ? "✓ Passwords match" : "✗ Passwords do not match"}
                            </Text>
                        )}

                        {/* Submit Button */}
                        <TouchableOpacity 
                            style={[styles.primaryButton, loading && { opacity: 0.7 }]} 
                            onPress={handleSignup} 
                            disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Sign Up</Text>}
                        </TouchableOpacity>

                    </View>
                </ScrollView>
            </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    scrollContainer: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 40 },
    
    backButton: { position: 'absolute', left: 20, zIndex: 10, padding: 5 },
    
    headerArea: { alignItems: 'center', marginBottom: 35 },
    iconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: 16, textAlign: 'center' },
    
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
    
    strengthWrapper: { width: '100%', marginBottom: 16, paddingHorizontal: 4 },
    strengthBarBackground: { height: 4, borderRadius: 2, width: '100%', overflow: 'hidden' },
    strengthBarActive: { height: '100%', borderRadius: 2 },
    strengthLabel: { fontSize: 12, fontWeight: 'bold', marginTop: 6, textAlign: 'right' },
    
    matchText: { fontSize: 12, fontWeight: '600', marginBottom: 16, paddingLeft: 15 },
    
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
    primaryButtonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    
    footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
    loginLink: { color: '#007AFF', fontSize: 15, fontWeight: '700' },
});