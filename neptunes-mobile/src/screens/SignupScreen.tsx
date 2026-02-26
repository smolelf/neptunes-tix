import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet,
    Alert, ActivityIndicator, KeyboardAvoidingView,
    Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons'; // 🚀 Added for the back icon

export default function SignupScreen({ route, navigation }: any) {
    const { signUp } = useContext(AuthContext);
    const { colors } = useContext(ThemeContext);
    const { targetTicket } = route.params || {};

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState('');

    interface StrengthDetails {
        label: string;
        color: string;
        width: string | any; // Use 'any' or 'DimensionValue' for React Native style props
    }
    const getPasswordStrength = (pass: string) => {
        let score = 0;
        if (pass.length > 6) score++; // Minimum length
        if (/[0-9]/.test(pass)) score++; // Contains numbers
        if (/[^A-Za-z0-9]/.test(pass)) score++; // Special chars
        return score;
    };

    const getStrengthDetails = (score: number): StrengthDetails=> {
        switch (score) {
            case 0: return { label: 'Weak', color: '#ff3b30', width: '25%' };
            case 1: return { label: 'Fair', color: '#ff9500', width: '50%' };
            case 2: return { label: 'Good', color: '#ffcc00', width: '75%' };
            case 3: return { label: 'Strong', color: '#34c759', width: '100%' };
            default: return { label: '', color: 'transparent', width: '0%' };
        }
    };

    const LoadingOverlay = ({ visible, colors }: { visible: boolean, colors: any }) => {
        if (!visible) return null;

        return (
            <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
                <View style={[styles.loadingCard, { backgroundColor: colors.card }]}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={[styles.loadingText, { color: colors.text }]}>Creating your account...</Text>
                </View>
            </View>
        );
};

    const handleSignup = async () => {
        if (!name || !email || !password || !confirmPassword) {
            Alert.alert("Error", "All fields are required");
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert("Error", "Passwords do not match");
            return;
        }

        if (getPasswordStrength(password) < 2) {
            Alert.alert("Security", "Please create a stronger password (include numbers or symbols)");
            return;
        }

        setLoading(true);
        const result = await signUp(name, email, password);
        setLoading(false);

        if (result.success) {
            if (targetTicket) {
                // Return to Marketplace and trigger the auto-open logic
                navigation.navigate('Home', { 
                    screen: 'Marketplace', 
                    params: { autoOpenTicket: targetTicket } 
                });
            } else {
                navigation.navigate('Home');
            }
        } else {
            Alert.alert("Signup Failed", result.error);
        }
    };

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={[styles.container, { backgroundColor: colors.background }]}>
                    {/* 🚀 NEW: Back Button */}
                    <TouchableOpacity 
                        style={styles.backButton} 
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="chevron-back" size={28} color={colors.text} />
                    </TouchableOpacity>

                    <View style={styles.content}>
                        {/* 🚀 Changed to center alignment */}
                        <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>
                        <Text style={[styles.subtitle, { color: colors.subText }]}>
                            Join now and get 100 Welcome Points!
                        </Text>

                        <TextInput 
                            style={[styles.input, { backgroundColor: colors.card, color: colors.text }]} 
                            placeholder="Full Name" 
                            placeholderTextColor={colors.subText}
                            value={name}
                            onChangeText={setName}
                        />
                        <TextInput 
                            style={[styles.input, { backgroundColor: colors.card, color: colors.text }]} 
                            placeholder="Email" 
                            placeholderTextColor={colors.subText}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={email}
                            onChangeText={setEmail}
                        />
                        <View style={styles.passwordContainer}>
                            <TextInput 
                                style={[
                                    styles.input, 
                                    { backgroundColor: colors.card, color: colors.text, marginBottom: 0 }
                                ]} 
                                placeholder="Password" 
                                placeholderTextColor={colors.subText}
                                secureTextEntry={!showPassword} // 🚀 Toggle visibility
                                value={password}
                                onChangeText={setPassword}
                            />
                            <TouchableOpacity 
                                style={styles.eyeIcon} 
                                onPress={() => setShowPassword(!showPassword)}
                            >
                                <Ionicons 
                                    name={showPassword ? "eye-off-outline" : "eye-outline"} 
                                    size={22} 
                                    color={colors.subText} 
                                />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.passwordContainer}>
                            <TextInput 
                                style={[styles.input, { backgroundColor: colors.card, color: colors.text, marginBottom: 0 }]} 
                                placeholder="Confirm Password" 
                                placeholderTextColor={colors.subText}
                                secureTextEntry={!showPassword}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                            />
                        </View>

                        {confirmPassword.length > 0 && (
                            <Text style={[
                                styles.matchText, 
                                { color: password === confirmPassword ? '#34c759' : '#ff3b30' }
                            ]}>
                                {password === confirmPassword ? "✓ Passwords match" : "✗ Passwords do not match"}
                            </Text>
                        )}

                        {password.length > 0 && (
                            <View style={styles.strengthWrapper}>
                                <View style={styles.strengthBarBackground}>
                                    <View 
                                        style={[
                                            styles.strengthBarActive, 
                                            { 
                                                width: getStrengthDetails(getPasswordStrength(password)).width,
                                                backgroundColor: getStrengthDetails(getPasswordStrength(password)).color 
                                            }
                                        ]} 
                                    />
                                </View>
                                <Text style={[styles.strengthLabel, { color: getStrengthDetails(getPasswordStrength(password)).color }]}>
                                    {getStrengthDetails(getPasswordStrength(password)).label}
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
                            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Sign Up</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login', { targetTicket })}>
                            <Text style={{ color: '#007AFF' }}>Already have an account? Sign In</Text>
                        </TouchableOpacity>
                    </View>
                    <LoadingOverlay visible={loading} colors={colors} />
                </View>
        </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        paddingHorizontal: 25,
    },
    backButton: {
        position: 'absolute',
        top: 60, 
        left: 20,
        zIndex: 10,
        padding: 5,
    },
    content: {
        flex: 1,
        justifyContent: 'center', // This centers the group vertically
        alignItems: 'center',    // This centers the group horizontally
    },
    title: { 
        fontSize: 32, 
        fontWeight: '800', 
        marginBottom: 10,
        textAlign: 'center' // 🚀 Center the title text
    },
    subtitle: { 
        fontSize: 16, 
        marginBottom: 35,
        textAlign: 'center' // 🚀 Center the subtitle text
    },
    input: { 
        height: 55, 
        borderRadius: 12, 
        paddingHorizontal: 15, 
        marginBottom: 15, 
        fontSize: 16,
        width: '100%' // Ensure inputs take full width of container
    },
    button: { 
        backgroundColor: '#007AFF', 
        height: 55, 
        borderRadius: 12, 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginTop: 10,
        width: '100%'
    },
    buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    loginLink: {
        marginTop: 20,
        padding: 10,
    },
    strengthWrapper: {
        width: '100%',
        marginBottom: 20,
        marginTop: -5, // Pull it closer to the password input
    },
    strengthBarBackground: {
        height: 4,
        backgroundColor: 'rgba(128,128,128,0.2)',
        borderRadius: 2,
        width: '100%',
        overflow: 'hidden',
    },
    strengthBarActive: {
        height: '100%',
        borderRadius: 2,
    },
    strengthLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 5,
        textAlign: 'right',
    },
    passwordContainer: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    eyeIcon: {
        position: 'absolute',
        right: 15,
        height: '100%',
        justifyContent: 'center',
    },
    matchText: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: -10,
        marginBottom: 15,
        alignSelf: 'flex-start',
        paddingLeft: 5
    },
    overlay: {
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    loadingCard: {
        padding: 30,
        borderRadius: 20,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    loadingText: {
        marginTop: 15,
        fontWeight: '600',
        fontSize: 16,
    },
    errorText: {
        color: '#ff3b30',
        fontSize: 12,
        alignSelf: 'flex-start',
        marginBottom: 10,
        marginLeft: 5,
    },
});