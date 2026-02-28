import React, { useContext, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert,
  Switch, ScrollView, RefreshControl, Image } from 'react-native'; // Changed Switch source
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

// 1. Updated Helper Component to accept textColor
const ProfileItem = ({ icon, label, value, textColor }: any) => (
  <View style={styles.itemRow}>
    <Ionicons name={icon} size={24} color="#007AFF" />
    <View style={{ marginLeft: 15 }}>
      <Text style={{ color: 'gray', fontSize: 12 }}>{label}</Text>
      <Text style={{ fontSize: 16, fontWeight: '500', color: textColor }}>{value}</Text>
    </View>
  </View>
);

export default function ProfileScreen() { // Removed { navigation } from props to use hook
  const { user, logout, refreshUser } = useContext(AuthContext);
  const { colors, isDark, toggleTheme } = useContext(ThemeContext);
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [avatar] = useState(user?.avatar_url || null);
  
  
  if (!user) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="person-circle-outline" size={100} color={colors.subText} />
        <Text style={[styles.name, { color: colors.text, marginBottom: 10 }]}>Ready to join us?</Text>
        <Text style={{ color: colors.subText, textAlign: 'center', marginBottom: 30 }}>
          Sign in to track your tickets and start earning loyalty points! 🎁
        </Text>
        
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: '#007AFF' }]} 
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.buttonText}>Sign In</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#007AFF', marginTop: 15 }]} 
          onPress={() => navigation.navigate('Signup')}
        >
          <Text style={[styles.buttonText, { color: '#007AFF' }]}>Create Account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  useFocusEffect(
    useCallback(() => {
      refreshUser();
    }, [])
  );

  // 🚀 Manual pull-to-refresh logic
  const onRefresh = async () => {
    setRefreshing(true);
    await refreshUser();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Logout", 
        style: "destructive", 
        onPress: async () => {
          await logout();
          // Use navigation.reset to clear the history and go to Login
          navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
          });
        } 
      }
    ]);
  };

  const points = user?.points || 0;

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      // 🚀 Added pull-to-refresh here
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />
      }
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <View style={styles.header}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <Ionicons name="person-circle" size={100} color="#007AFF" />
        )}
        <Text style={[styles.name, { color: colors.text }]}>
          {user?.user_name || user?.name || 'Neptunes User'}
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('EditProfile')}>
          <Text style={{ color: '#007AFF', fontWeight: '600', marginTop: 5 }}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Points Section */}
      <TouchableOpacity 
        style={[styles.loyaltyCard, { backgroundColor: isDark ? '#333' : '#FFD60A' }]}
        onPress={() => navigation.navigate('PointsHistory')}
      >
        <View style={styles.loyaltyLeft}>
          <View style={styles.starCircle}>
            <Ionicons name="star" size={24} color={isDark ? '#FFD60A' : '#000'} />
          </View>
          <View>
            <Text style={[styles.loyaltyLabel, { color: isDark ? '#aaa' : '#000' }]}>LOYALTY POINTS</Text>
            <Text style={[styles.loyaltyValue, { color: isDark ? '#fff' : '#000' }]}>
              {points.toLocaleString()}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={isDark ? '#fff' : '#000'} />
      </TouchableOpacity>

      {/* Dark Mode Toggle */}
      <View style={[styles.infoContainer, { backgroundColor: colors.card, marginBottom: 20 }]}>
        <View style={[styles.itemRow, { borderBottomWidth: 0 }]}>
          <Ionicons name={isDark ? "moon" : "sunny"} size={24} color="#007AFF" />
          <View style={{ flex: 1, marginLeft: 15 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '500' }}>Dark Mode</Text>
          </View>
          <Switch 
            value={isDark} 
            onValueChange={toggleTheme}
            trackColor={{ false: "#767577", true: "#81b0ff" }}
          />
        </View>
      </View>
  
      {/* User Info Section */}
      <View style={[styles.infoContainer, { backgroundColor: colors.card }]}>
        <ProfileItem icon="person-outline" label="Name" value={user?.name || 'Not Set'} textColor={colors.text} />
        <ProfileItem icon="mail-outline" label="Email" value={user?.email} textColor={colors.text} />
        <ProfileItem icon="shield-checkmark-outline" label="Role" value={user?.role?.toUpperCase()} textColor={colors.text} />
      </View>
  
      {/* MANAGEMENT SECTION */}
      {(user?.role === 'admin') && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.subText }]}>MANAGEMENT</Text>
          
          <TouchableOpacity 
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('AdminDashboard')}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.iconBg, { backgroundColor: '#4CD964' }]}>
                <Ionicons name="stats-chart" size={20} color="#fff" />
              </View>
              <Text style={[styles.menuText, { color: colors.text }]}>Admin Dashboard</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.subText} />
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
    container: { 
      flex: 1, 
      padding: 20 
    },
    header: { 
      alignItems: 'center', 
      marginTop: 20, 
      marginBottom: 20 
    },
    name: { 
      fontSize: 22, 
      fontWeight: 'bold', 
      marginTop: 10 
    },
    infoContainer: {
      borderRadius: 15,
      padding: 15,
      marginBottom: 10,
      // Adding a subtle shadow for light mode
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2
    },
    itemRow: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.05)'
    },
    logoutButton: { 
      backgroundColor: '#FF3B30', 
      padding: 15, 
      borderRadius: 10, 
      alignItems: 'center',
      marginTop: 'auto', // Pushes button to bottom
      marginBottom: 20
    },
    logoutText: { 
      color: '#fff', 
      fontWeight: 'bold', 
      fontSize: 16 
    },
    section: { marginTop: 10, marginBottom: 20 },
    sectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 10, marginLeft: 5, textTransform: 'uppercase' },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 15,
      borderRadius: 12,
    },
    menuLeft: { flexDirection: 'row', alignItems: 'center' },
    iconBg: { padding: 8, borderRadius: 8, marginRight: 15 },
    menuText: { fontSize: 16, fontWeight: '500' },
    loyaltyCard: {
      padding: 20,
      borderRadius: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 25,
      elevation: 4,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 10,
    },
    loyaltyLeft: { flexDirection: 'row', alignItems: 'center' },
    starCircle: { 
      width: 45, 
      height: 45, 
      borderRadius: 22.5, 
      backgroundColor: 'rgba(255,255,255,0.3)', 
      justifyContent: 'center', 
      alignItems: 'center',
      marginRight: 15 
    },
    loyaltyLabel: { fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
    loyaltyValue: { fontSize: 26, fontWeight: '900' },
    centered: {
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    button: {
      width: '100%',
      height: 55,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonText: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#fff',
    },
    avatar: { width: 100, height: 100, borderRadius: 60 },

});