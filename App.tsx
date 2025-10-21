import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Calendar, Camera, ChevronLeft, Home, Mail, User } from 'lucide-react-native';
import { Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Import contexts
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

// Import components
import ThemedText from './components/ThemedText';
import ThemedView from './components/ThemedView';

// Import screens
import EventsScreen from './screens/EventsScreen';
import LandingScreen from './screens/LandingScreen';
import LiveScreen from './screens/LiveScreen';
import LoginScreen from './screens/LoginScreen';
import ProfileScreen from './screens/ProfileScreen';
import VideoScreen from './screens/VideoScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Loading screen component
function LoadingScreen() {
  const { theme } = useTheme();
  
  return (
    <ThemedView style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
      <ThemedText type="title">Gardi</ThemedText>
      <ThemedText type="secondary" style={{ marginTop: 8 }}>Loading...</ThemedText>
    </ThemedView>
  );
}

// Messages screen placeholder
function MessagesScreen() {
  return (
    <ThemedView style={styles.centerContainer}>
      <ThemedText type="title">Messages</ThemedText>
      <ThemedText type="secondary">Coming soon...</ThemedText>
    </ThemedView>
  );
}

// Theme-aware Tab Navigator
function MainTabNavigator() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 88 : 70,
          paddingBottom: Platform.OS === 'ios' ? 34 : 10,  
          paddingTop: 8,
          backgroundColor: theme.colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border,
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
        name="Events" 
        component={EventsScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <Calendar size={focused ? 26 : 24} color={color} strokeWidth={2} />
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

// App navigator with authentication logic
function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();
  const { theme } = useTheme();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={MainTabNavigator} />
          <Stack.Screen 
            name="LiveStream" 
            component={LiveScreen}
            options={({ navigation }) => ({
              headerShown: true,
              title: 'Live Stream',
              presentation: 'card',
              headerStyle: {
                backgroundColor: theme.colors.surface,
              },
              headerTintColor: theme.colors.text,
              headerLeft: () => (
                <TouchableOpacity 
                  onPress={() => navigation.navigate('Home')}
                  style={{ marginLeft: 15, padding: 5 }}
                >
                  <ChevronLeft size={28} color={theme.colors.text} strokeWidth={2} />
                </TouchableOpacity>
              ),
            })}
          />
        </Stack.Navigator>
      ) : (
        <LoginScreen />
      )}
    </NavigationContainer>
  );
}

// Main App component - production-ready default export
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SafeAreaProvider>
          <AppNavigator />
        </SafeAreaProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});