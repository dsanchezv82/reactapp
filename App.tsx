import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { registerRootComponent } from 'expo';
import { Bell, Camera, Home, Mail, User } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';

import LandingScreen from './screens/LandingScreen';
import LoginScreen from './screens/LoginScreen';
import ProfileScreen from './screens/ProfileScreen';
import VideoScreen from './screens/VideoScreen';

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

// Main Tab Navigator with cross-platform optimizations
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
        name="Video" 
        component={VideoScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <Camera size={focused ? 26 : 24} color={color} strokeWidth={2} />
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

  // Optimized auth check - runs only when needed for mobile performance
  const checkAuthStatus = async () => {
    try {
      const userToken = await AsyncStorage.getItem('userToken');
      const isValidToken = userToken === 'logged_in';
      setIsAuthenticated(isValidToken);
      
      // Only log during development - removed in production builds
      if (__DEV__) {
        console.log('Auth check completed:', isValidToken ? 'Authenticated' : 'Not authenticated');
      }
    } catch (error) {
      console.log('Error checking auth status:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial auth check on app load
    checkAuthStatus();

    // Listen for app state changes (foreground/background) for mobile security
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        // Re-check auth when app becomes active (mobile best practice)
        checkAuthStatus();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup subscription on unmount for memory management
    return () => {
      subscription?.remove();
    };
  }, []);

  // Loading screen with proper mobile UX
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading Gardi...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen 
            name="Login" 
            component={LoginScreen}
            options={{ 
              gestureEnabled: false,
              animationTypeForReplace: 'push'
            }}
          />
        ) : (
          <Stack.Screen 
            name="Main" 
            component={MainTabNavigator}
            options={{ 
              gestureEnabled: false,
              animationTypeForReplace: 'push'
            }}
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

// Register the root component for proper Expo initialization
registerRootComponent(App);

export default App;