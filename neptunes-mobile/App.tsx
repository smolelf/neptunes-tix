import React, { useContext } from 'react';
import { View, Text, Platform } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
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

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  OrderDetails: { orderId: string };
  AdminDashboard: undefined;
  CreateEvent: undefined;
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

  const displayName = user?.name || user?.email?.split('@')[0] || 'User';

  return (
    <Tab.Navigator 
      screenOptions={({ route }) => ({ 
        headerShown: true,
        tabBarStyle: { 
          backgroundColor: colors.background,
          borderTopColor: isDark ? '#333' : '#eee',
        },
        headerStyle: { 
          backgroundColor: colors.background,
          elevation: 0, // Remove shadow on Android
          shadowOpacity: 0, // Remove shadow on iOS
        },
        headerTintColor: colors.text,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'help-outline';
          if (route.name === 'Marketplace') iconName = focused ? 'cart' : 'cart-outline';
          else if (route.name === 'Wallet') iconName = focused ? 'wallet' : 'wallet-outline';
          else if (route.name === 'Scanner') iconName = focused ? 'scan' : 'scan-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen 
        name="Marketplace" 
        component={TicketListScreen} 
        options={{
          headerTitle: () => (
            <View style={{ marginLeft: Platform.OS === 'ios' ? 0 : -10 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>
                Welcome, {displayName}! 👋
              </Text>
            </View>
          )
        }}
      />
      <Tab.Screen name="Wallet" component={MyTicketsScreen} />
      
      {/* Role-based conditional rendering */}
      {(user?.role === 'agent' || user?.role === 'admin') && (
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
      background: colors.background, // Ensure this matches exactly
      card: colors.background,       // This is the background of the "cards" during transitions
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
        <Stack.Screen 
          name="OrderDetails" 
          component={OrderDetailsScreen} 
          options={{ 
            title: 'Your Tickets',
            // This forces the 'canvas' behind the screen to match your theme
            contentStyle: { backgroundColor: colors.background } 
          }} 
        />
        <Stack.Screen 
          name="AdminDashboard" 
          component={AdminDashboardScreen} 
          options={{ 
            title: 'Event Analytics',
            // This forces the 'canvas' behind the screen to match your theme
            contentStyle: { backgroundColor: colors.background } 
          }} 
        />
        <Stack.Screen 
          name="CreateEvent" 
          component={CreateEventScreen} 
          options={{
            title: 'Launch New Event',
            // This forces the 'canvas' behind the screen to match your theme
            contentStyle: { backgroundColor: colors.background }
           }} 
        />
        <Stack.Screen 
          name="PointsHistory" 
          component={PointsHistoryScreen} 
          options={{ 
            title: 'Points History',
            // This forces the 'canvas' behind the screen to match your theme
            contentStyle: { backgroundColor: colors.background }
           }} 
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