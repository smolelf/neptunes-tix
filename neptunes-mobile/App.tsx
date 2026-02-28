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
};

export type MainTabParamList = {
  Marketplace: undefined;
  Wallet: undefined;
  Scanner: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const { colors, isDark } = useContext(ThemeContext);
  const { user } = useContext(AuthContext);
  const navigation = useNavigation<any>();

  const displayName = user?.name || user?.email?.split('@')[0] || 'Guest';
  
  return (
    <Tab.Navigator 
      screenOptions={({ route }) => ({ 
        headerShown: true,
        tabBarStyle: { 
          display: user ? 'flex' : 'none', 
          backgroundColor: colors.background,
          borderTopColor: isDark ? '#333' : '#eee',
        },
        headerStyle: { 
          backgroundColor: colors.background,
          elevation: 0,
          shadowOpacity: 0,
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
                {user ? `Welcome, ${displayName}! 👋` : "Neptunes Tix"}
              </Text>
            </View>
          ),
          headerRight: () => !user && (
            <TouchableOpacity 
              onPress={() => navigation.navigate('Login')}
              style={{
                marginRight: 15,
                backgroundColor: '#007AFF',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20
              }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>Sign In</Text>
            </TouchableOpacity>
          )
        }}
      />
      
      {user && (
        <>
          <Tab.Screen name="Wallet" component={MyTicketsScreen} options={{}}/>
          {(user?.role === 'agent' || user?.role === 'admin') && (
            <Tab.Screen name="Scanner" component={ScannerScreen} options={{ headerShown: false }}/>
          )}
          <Tab.Screen name="Profile" component={ProfileScreen} options={{}}/>
        </>
      )}
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { colors, isDark } = useContext(ThemeContext);
  const { user, loading } = useContext(AuthContext);

  if (loading) return null; 

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
      <Stack.Navigator 
        initialRouteName="Home"
        // 🚀 THE FIX IS HERE: Global options applied to ALL stack screens
        screenOptions={{
          headerBackTitleVisible: false, // Hides "Home" text (just shows arrow on iOS)
          headerTintColor: '#007AFF',    // Ensures the arrow is clearly visible and clickable
          headerTitleStyle: { color: colors.text }, // Adjusts text for dark mode
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={MainTabs} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
          options={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} 
        />
        <Stack.Screen 
          name="Signup" 
          component={SignupScreen} 
          options={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} 
        />
        <Stack.Screen 
          name="OrderDetails" 
          component={OrderDetailsScreen} 
          options={{ title: 'Your Tickets', contentStyle: { backgroundColor: colors.background } }} 
        />
        <Stack.Screen 
          name="AdminDashboard" 
          component={AdminDashboardScreen} 
          options={{ title: 'Event Analytics', contentStyle: { backgroundColor: colors.background } }} 
        />
        <Stack.Screen 
          name="CreateEvent" 
          component={CreateEventScreen} 
          options={{ title: 'Launch New Event', contentStyle: { backgroundColor: colors.background } }} 
        />
        <Stack.Screen 
          name="PointsHistory" 
          component={PointsHistoryScreen} 
          options={{ title: 'Points History', contentStyle: { backgroundColor: colors.background } }} 
        />
        <Stack.Screen
          name="EditProfile"
          component={EditProfileScreen}
          options={{
            title: 'Edit Profile',
            presentation: 'modal',
            contentStyle: { backgroundColor: colors.background }
          }}
        />
        <Stack.Screen 
          name="EditEvent" 
          component={EditEventScreen} 
          options={{
            title: 'Edit Event',
            presentation: 'modal',
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