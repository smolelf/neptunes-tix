import React, { useContext } from 'react';
import { View, Text, Platform, TouchableOpacity } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Context Providers
import { AuthProvider, AuthContext } from './src/context/AuthContext';
import { ThemeProvider, ThemeContext } from './src/context/ThemeContext';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import TicketListScreen from './src/screens/TicketListScreen';
import MyTicketsScreen from './src/screens/MyTicketsScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import OrderDetailsScreen from './src/screens/OrderDetailsScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import CreateEventScreen from './src/screens/CreateEventScreen';
import PointsHistoryScreen from './src/screens/PointsHistoryScreen';
import SignupScreen from './src/screens/SignupScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import EditEventScreen from './src/screens/EditEventScreen';
import ManageCouponsScreen from './src/screens/ManageCouponScreen';
import EventDetailScreen from './src/screens/EventDetailScreen';

export type RootStackParamList = {
  Login: undefined;
  Signup: { targetTicket?: any };
  Marketplace: undefined;
  Home: undefined;
  OrderDetails: { orderId: string };
  AdminDashboard: undefined;
  CreateEvent: undefined;
  PointsHistory: undefined;
  EditProfile: undefined;
  EditEvent: { event: any };
  ManageCoupons: undefined;
};

export type MainTabParamList = {
  Marketplace: undefined;
  Wallet: undefined;
  Scanner: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const { colors, isDark } = useContext(ThemeContext);
  const { user } = useContext(AuthContext);
  
  return (
    <Tab.Navigator 
      screenOptions={({ route }) => ({ 
        // 🚀 We hide the native header because our screens have gorgeous custom ones!
        headerShown: false,
        
        // 🚀 Premium Bottom Tab Styling
        tabBarStyle: { 
          backgroundColor: colors.card,
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.3 : 0.05,
          shadowRadius: 8,
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 25 : 10,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: isDark ? '#8E8E93' : '#A2A2A2',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'help-outline';
          if (route.name === 'Marketplace') iconName = focused ? 'compass' : 'compass-outline';
          else if (route.name === 'Wallet') iconName = focused ? 'ticket' : 'ticket-outline';
          else if (route.name === 'Scanner') iconName = focused ? 'scan-circle' : 'scan-circle-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';

          return <Ionicons name={iconName} size={size + 2} color={color} />;
        },
      })}
    >
      <Tab.Screen 
        name="Marketplace" 
        component={TicketListScreen} 
        options={{ tabBarLabel: 'Discover' }}
      />
      
      {/* 🚀 Only show Wallet and Scanner to logged in users */}
      {user && (
        <Tab.Screen 
            name="Wallet" 
            component={MyTicketsScreen} 
            options={{ tabBarLabel: 'My Tickets' }}
        />
      )}

      {(user?.role === 'agent' || user?.role === 'admin') && (
        <Tab.Screen 
            name="Scanner" 
            component={ScannerScreen} 
            options={{ tabBarLabel: 'Scan' }}
        />
      )}

      {/* 🚀 Show Profile to EVERYONE so guests can see the Login prompt */}
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ tabBarLabel: 'Profile' }}
      />
      
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { colors, isDark } = useContext(ThemeContext);
  const { loading } = useContext(AuthContext);

  if (loading) return null; 

  const MyTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: '#007AFF',
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: isDark ? '#333' : '#E5E5EA',
    },
  };

  return (
    <NavigationContainer theme={MyTheme}>
      <Stack.Navigator 
        initialRouteName="Home"
        screenOptions={{
          headerBackTitleVisible: false,
          headerTintColor: '#007AFF', 
          headerTitleStyle: { 
            color: colors.text,
            fontWeight: '700', 
            fontSize: 17 
          },
          // 🚀 Flat headers for sub-screens (removes the ugly line underneath)
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: colors.background,
          }
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={MainTabs} 
          options={{ headerShown: false }} 
        />
        
        {/* Full Screen Auth Modals */}
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
          options={{ headerShown: false, presentation: 'fullScreenModal' }} 
        />
        <Stack.Screen 
          name="Signup" 
          component={SignupScreen} 
          options={{ headerShown: false, presentation: 'fullScreenModal' }} 
        />
        
        {/* Core Modals */}
        <Stack.Screen 
            name="OrderDetails" 
            component={OrderDetailsScreen} 
            options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen 
            name="EventDetail" 
            component={EventDetailScreen} 
            options={{ headerShown: false }} 
        />
        
        {/* Management & Profile Stacks (These USE the native header) */}
        <Stack.Screen 
          name="AdminDashboard" 
          component={AdminDashboardScreen} 
          options={{ title: 'Dashboard' }} 
        />
        <Stack.Screen 
          name="CreateEvent" 
          component={CreateEventScreen} 
          options={{ title: 'Launch New Event' }} 
        />
        <Stack.Screen 
          name="PointsHistory" 
          component={PointsHistoryScreen} 
          options={{ title: 'Points History' }} 
        />
        <Stack.Screen
          name="EditProfile"
          component={EditProfileScreen}
          options={{ title: 'Edit Profile', presentation: 'modal' }}
        />
        <Stack.Screen 
          name="EditEvent" 
          component={EditEventScreen} 
          options={{ title: 'Edit Event', presentation: 'modal' }}
        />
        <Stack.Screen 
          name="ManageCoupons" 
          component={ManageCouponsScreen} 
          options={{ title: 'Manage Coupons' }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}