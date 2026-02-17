import React, { useContext } from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Context Providers
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { ThemeProvider, ThemeContext } from './src/context/ThemeContext';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import TicketListScreen from './src/screens/TicketListScreen';
import MyTicketsScreen from './src/screens/MyTicketsScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { colors, isDark } = useContext(ThemeContext);
  const { user } = useContext(AuthContext);

  const displayName = user?.user_name || user?.user_email?.split('@')[0] || 'User';

  return (
    <Tab.Navigator 
      screenOptions={({ route }) => ({ 
        // --- ADD DYNAMIC VISIBILITY HERE ---
        headerShown: true,
        tabBarStyle: { 
          display: 'flex',
          backgroundColor: colors.background,
          borderTopColor: isDark ? '#333' : '#eee',
        },
        // ------------------------------------
        
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any;
          if (route.name === 'Marketplace') iconName = focused ? 'cart' : 'cart-outline';
          else if (route.name === 'Wallet') iconName = focused ? 'wallet' : 'wallet-outline';
          else if (route.name === 'Scanner') iconName = focused ? 'scan' : 'scan-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },

        headerTitle: () => (
          <View style={{ marginLeft: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
              Welcome, {displayName}! 👋
            </Text>
          </View>
        )
      })}
    >
      <Tab.Screen name="Marketplace" component={TicketListScreen} />
      <Tab.Screen name="Wallet" component={MyTicketsScreen} />
      
      {(user?.user_role === 'agent' || user?.user_role === 'admin') && (
        <Tab.Screen name="Scanner" component={ScannerScreen} />
      )}

      <Tab.Screen name="Profile" component={ProfileScreen}/>
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { colors, isDark } = useContext(ThemeContext);

  // Sync React Navigation's internal theme with your ThemeContext
  const MyTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: '#007AFF',
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: isDark ? '#333' : '#eee',
    },
  };

  return (
    <NavigationContainer theme={MyTheme}>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Home" 
          component={MainTabs} 
          options={{ headerShown: false }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider> {/* <--- FIXED: Must wrap everything for insets to work */}
      <ThemeProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}