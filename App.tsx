import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { registerRootComponent } from 'expo';
import { Bell, Home, Mail, Search, User } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import LandingScreen from './screens/LandingScreen';
import LoginScreen from './screens/LoginScreen';
import ProfileScreen from './screens/ProfileScreen';
import SearchScreen from './screens/SearchScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Cross-platform optimized placeholder screens
const NotificationsScreen = () => (
  <View style={styles.screenContainer}>
    <Text style={styles.screenText}>Notifications</Text>
  </View>
);

const MessagesScreen = () => (
  <View style={styles.screenContainer}>
    <Text style={styles.screenText}>Messages</Text>
  </View>
);

// Main Tab Navigator (shown after successful login)
function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 88 : 70,
          paddingBottom: Platform.OS === 'ios' ? 34 : 10,
          paddingTop: 8,
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#E5E5EA',
        },
        headerShown: false,
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={LandingScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <Home size={focused ? 26 : 24} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen 
        name="Search" 
        component={SearchScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <Search size={focused ? 26 : 24} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen 
        name="Notifications" 
        component={NotificationsScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <Bell size={focused ? 26 : 24} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen 
        name="Messages" 
        component={MessagesScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <Mail size={focused ? 26 : 24} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <User size={focused ? 26 : 24} color={color} strokeWidth={2} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuthStatus = async () => {
    try {
      const userToken = await AsyncStorage.getItem('userToken');
      console.log('Auth check - userToken:', userToken);
      
      // Only consider authenticated if token exists and is valid
      const isValidToken = userToken === 'logged_in';
      setIsAuthenticated(isValidToken);
      
      console.log('Auth status:', isValidToken ? 'Authenticated' : 'Not authenticated');
    } catch (error) {
      console.log('Error checking auth status:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial auth check
    checkAuthStatus();
    
    // Set up periodic check to detect login/logout changes
    const authCheckInterval = setInterval(checkAuthStatus, 1000);
    
    return () => clearInterval(authCheckInterval);
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading Gardi...</Text>
      </View>
    );
  }

  console.log('Rendering app - isAuthenticated:', isAuthenticated);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          // Show login screen when not authenticated
          <Stack.Screen 
            name="Login" 
            component={LoginScreen}
            options={{ gestureEnabled: false }} // Prevent swipe back
          />
        ) : (
          // Show main app with tabs when authenticated
          <Stack.Screen 
            name="Main" 
            component={MainTabNavigator}
            options={{ gestureEnabled: false }} // Prevent swipe back to login
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  screenText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1D1D1F',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '500',
  },
});

registerRootComponent(App);
export default App;