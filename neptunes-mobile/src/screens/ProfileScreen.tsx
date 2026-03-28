import React, { useContext, useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Alert,
  Switch, ScrollView, RefreshControl, Image, Platform 
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 🚀 Upgraded Profile Item: Horizontal layout like native settings
const ProfileItem = ({ icon, label, value, textColor, colors, isLast }: any) => (
  <View style={[styles.itemRow, { borderBottomColor: colors.border, borderBottomWidth: isLast ? 0 : 1 }]}>
    <View style={styles.itemLeft}>
        <View style={[styles.iconContainer, { backgroundColor: 'rgba(0,122,255,0.1)' }]}>
            <Ionicons name={icon} size={20} color="#007AFF" />
        </View>
        <Text style={[styles.itemLabel, { color: colors.text }]}>{label}</Text>
    </View>
    <Text style={[styles.itemValue, { color: colors.subText }]} numberOfLines={1}>{value}</Text>
  </View>
);

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useContext(AuthContext);
  const { colors, isDark, toggleTheme } = useContext(ThemeContext);
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  
  const [refreshing, setRefreshing] = useState(false);
  const [avatar] = useState(user?.avatar_url || null);
  
  // --- 🔒 UNAUTHENTICATED STATE ---
  if (!user) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <View style={styles.guestIconCircle}>
            <Ionicons name="person" size={60} color={colors.subText} />
        </View>
        <Text style={[styles.name, { color: colors.text, marginBottom: 10, fontSize: 28 }]}>Ready to join us?</Text>
        <Text style={{ color: colors.subText, textAlign: 'center', marginBottom: 40, fontSize: 16, lineHeight: 24, paddingHorizontal: 20 }}>
          Sign in to track your tickets, checkout faster, and start earning loyalty points! 🎁
        </Text>
        
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.primaryButtonText}>Sign In</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Signup')}>
          <Text style={styles.secondaryButtonText}>Create Account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- 🔓 AUTHENTICATED STATE ---
  useFocusEffect(
    useCallback(() => {
      refreshUser();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshUser();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Logout", 
        style: "destructive", 
        onPress: async () => {
          await logout();
          navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
        } 
      }
    ]);
  };

  const points = user?.points || 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        
        {/* Custom Header with Safe Area */}
        <View style={[styles.topHeader, { paddingTop: Math.max(insets.top, 20) }]}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        </View>

        <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />}
        >
            {/* 🚀 Hero Profile Header */}
            <View style={styles.profileHeader}>
                <View style={[styles.avatarContainer, { borderColor: colors.border }]}>
                    {avatar ? (
                        <Image source={{ uri: avatar }} style={styles.avatar} />
                    ) : (
                        <Ionicons name="person" size={50} color={colors.subText} />
                    )}
                </View>
                <Text style={[styles.name, { color: colors.text }]}>
                    {user?.user_name || user?.name || 'Neptunes User'}
                </Text>
                <TouchableOpacity style={styles.editProfileBtn} onPress={() => navigation.navigate('EditProfile')}>
                    <Text style={styles.editProfileText}>Edit Profile</Text>
                </TouchableOpacity>
            </View>

            {/* 🚀 Loyalty Points Card */}
            <TouchableOpacity 
                style={[styles.loyaltyCard, { backgroundColor: isDark ? '#2C2C2E' : '#FFD60A' }]}
                onPress={() => navigation.navigate('PointsHistory')}
                activeOpacity={0.8}
            >
                <View style={styles.loyaltyLeft}>
                    <View style={styles.starCircle}>
                        <Ionicons name="star" size={24} color={isDark ? '#FFD60A' : '#000'} />
                    </View>
                    <View>
                        <Text style={[styles.loyaltyLabel, { color: isDark ? '#8E8E93' : '#B28200' }]}>LOYALTY POINTS</Text>
                        <Text style={[styles.loyaltyValue, { color: isDark ? '#FFF' : '#000' }]}>
                            {points.toLocaleString()}
                        </Text>
                    </View>
                </View>
                <View style={[styles.arrowCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
                    <Ionicons name="chevron-forward" size={20} color={isDark ? '#FFF' : '#000'} />
                </View>
            </TouchableOpacity>

            {/* 🚀 Grouped Settings Card */}
            <Text style={[styles.sectionTitle, { color: colors.subText }]}>ACCOUNT SETTINGS</Text>
            <View style={[styles.infoGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                
                <ProfileItem icon="person" label="Name" value={user?.name || 'Not Set'} colors={colors} />
                <ProfileItem icon="mail" label="Email" value={user?.email} colors={colors} />
                {(user?.role === 'agent' || user?.role === 'admin') && (
                  <ProfileItem icon="shield-checkmark" label="Role" value={user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)} colors={colors} />
                )}
                {/* Dark Mode inside the card */}
                <View style={[styles.itemRow, { borderBottomWidth: 0 }]}>
                    <View style={styles.itemLeft}>
                        <View style={[styles.iconContainer, { backgroundColor: 'rgba(0,122,255,0.1)' }]}>
                            <Ionicons name={isDark ? "moon" : "sunny"} size={20} color="#007AFF" />
                        </View>
                        <Text style={[styles.itemLabel, { color: colors.text }]}>Dark Mode</Text>
                    </View>
                    <Switch 
                        value={isDark} 
                        onValueChange={toggleTheme}
                        trackColor={{ false: "#E5E5EA", true: "#34C759" }}
                        thumbColor="#FFF"
                    />
                </View>

            </View>
        
            {/* 🚀 Admin Management Section */}
            {(user?.role === 'admin') && (
                <>
                    <Text style={[styles.sectionTitle, { color: colors.subText }]}>MANAGEMENT</Text>
                    <View style={[styles.infoGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <TouchableOpacity 
                            style={[styles.itemRow, { borderBottomWidth: 0 }]}
                            activeOpacity={0.7}
                            onPress={() => navigation.navigate('AdminDashboard')}
                        >
                            <View style={styles.itemLeft}>
                                <View style={[styles.iconContainer, { backgroundColor: 'rgba(255,149,0,0.1)' }]}>
                                    <Ionicons name="stats-chart" size={20} color="#FF9500" />
                                </View>
                                <Text style={[styles.itemLabel, { color: colors.text }]}>Admin Dashboard</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.subText} />
                        </TouchableOpacity>
                    </View>
                </>
            )}

            {/* Logout Button */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>

        </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { justifyContent: 'center', alignItems: 'center', padding: 20 },
    
    // Top Header
    topHeader: { paddingHorizontal: 20, paddingBottom: 15 },
    headerTitle: { fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },

    // Unauthenticated State
    guestIconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(128,128,128,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    primaryButton: { backgroundColor: '#007AFF', width: '100%', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginBottom: 12 },
    primaryButtonText: { color: '#FFF', fontSize: 17, fontWeight: 'bold' },
    secondaryButton: { backgroundColor: 'transparent', width: '100%', paddingVertical: 16, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#007AFF' },
    secondaryButtonText: { color: '#007AFF', fontSize: 17, fontWeight: 'bold' },

    // Profile Hero
    profileHeader: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
    avatarContainer: { width: 100, height: 100, borderRadius: 50, borderWidth: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', backgroundColor: 'rgba(128,128,128,0.05)' },
    avatar: { width: '100%', height: '100%', resizeMode: 'cover' },
    name: { fontSize: 24, fontWeight: '800', marginTop: 15 },
    editProfileBtn: { marginTop: 8, backgroundColor: 'rgba(0,122,255,0.1)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
    editProfileText: { color: '#007AFF', fontWeight: '700', fontSize: 14 },

    // Loyalty Card
    loyaltyCard: { padding: 20, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
    loyaltyLeft: { flexDirection: 'row', alignItems: 'center' },
    starCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.4)', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    loyaltyLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
    loyaltyValue: { fontSize: 28, fontWeight: '900' },
    arrowCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },

    // Grouped Settings
    sectionTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 1, marginLeft: 15, marginBottom: 8 },
    infoGroup: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 25 },
    
    // List Items
    itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingRight: 15, marginLeft: 15 },
    itemLeft: { flexDirection: 'row', alignItems: 'center' },
    iconContainer: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    itemLabel: { fontSize: 16, fontWeight: '500' },
    itemValue: { fontSize: 16, maxWidth: '50%' },

    // Logout
    logoutButton: { backgroundColor: 'rgba(255,59,48,0.1)', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 10 },
    logoutText: { color: '#FF3B30', fontWeight: 'bold', fontSize: 17 },
});