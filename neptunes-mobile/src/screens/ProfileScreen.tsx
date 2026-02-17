import React, { useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch } from 'react-native'; // Changed Switch source
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';

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

export default function ProfileScreen({ navigation }: any) {
  const { user, logout } = useContext(AuthContext);
  const { colors, isDark, toggleTheme } = useContext(ThemeContext);

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Logout", 
        style: "destructive", 
        onPress: async () => {
          await logout();
          navigation.getParent()?.replace('Login');
        } 
      }
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      <View style={styles.header}>
        <Ionicons name="person-circle" size={100} color="#007AFF" />
        <Text style={[styles.name, { color: colors.text }]}>{user?.user_name || 'Neptunes User'}</Text>
      </View>

      {/* Dark Mode Toggle Row */}
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
            thumbColor={isDark ? "#f4f3f4" : "#f4f3f4"}
          />
        </View>
      </View>
  
      {/* User Info Section */}
      <View style={[styles.infoContainer, { backgroundColor: colors.card }]}>
        <ProfileItem 
          icon="person-outline" 
          label="Name" 
          value={user?.user_name || 'Not Set'} 
          textColor={colors.text} 
        />
        <ProfileItem 
          icon="mail-outline" 
          label="Email" 
          value={user?.user_email} 
          textColor={colors.text} 
        />
        <ProfileItem 
          icon="shield-checkmark-outline" 
          label="Role" 
          value={user?.user_role?.toUpperCase()} 
          textColor={colors.text} 
        />
      </View>
  
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
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
      marginBottom: 30,
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
    }
});