import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

// Backend API configuration for real-time map data
const API_BASE_URL = 'https://api.garditech.com/api';

interface MapLocation {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description: string;
  type: 'vehicle' | 'alert' | 'checkpoint';
  timestamp: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export default function LandingScreen() {
  const [mapData, setMapData] = useState<MapLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: 37.78825, // Default to San Francisco
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  
  const { theme } = useTheme();
  const { authToken } = useAuth();
  const insets = useSafeAreaInsets();

  // Request location permissions and get current location
  const requestLocationPermission = async () => {
    setLoading(true);
    try {
      console.log('📍 Checking current location permission status...');
      
      // First check current permission status
      let { status } = await Location.getForegroundPermissionsAsync();
      console.log('📍 Current permission status:', status);
      
      // If not granted, request permission
      if (status !== 'granted') {
        console.log('📍 Requesting location permission...');
        const result = await Location.requestForegroundPermissionsAsync();
        status = result.status;
        console.log('📍 Permission request result:', status);
      }
      
      if (status !== 'granted') {
        console.log('❌ Location permission denied - using demo location');
        Alert.alert(
          'Location Permission',
          'Location access is needed to show your position on the map. Using demo location for now.',
          [
            {
              text: 'Settings',
              onPress: () => {
                // You can add deep link to settings if needed
                Alert.alert('Settings', 'Please enable location access in your device settings.');
              }
            },
            { text: 'Use Demo Location', style: 'cancel' }
          ]
        );
        // Still use demo location but let user know
        const demoLat = 37.78825;
        const demoLng = -122.4324;
        setCurrentLocation({ latitude: demoLat, longitude: demoLng });
        setMapRegion({
          latitude: demoLat,
          longitude: demoLng,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
        generateSampleData(demoLat, demoLng);
        setLoading(false);
        return false;
      }

      console.log('✅ Location permission granted - getting your current location...');
      setLocationPermission(true);

      // Get your actual current location with high accuracy
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High, // Use high accuracy for better precision
      });

      const { latitude, longitude } = location.coords;
      setCurrentLocation({ latitude, longitude });
      
      // Update map region to center on user's location
      const newRegion = {
        latitude,
        longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
      setMapRegion(newRegion);
      
      console.log('📍 Current location:', latitude, longitude);
      console.log('🗺️ Updated map region to:', newRegion);

      // Generate sample data points around current location
      generateSampleData(latitude, longitude);
      
      setLoading(false);
      return true;
    } catch (error) {
      console.log('❌ Error getting your location:', error);
      Alert.alert(
        'Location Error', 
        'Unable to get your current location. This might be due to location services being disabled or GPS signal issues. Using demo location for now.',
        [
          {
            text: 'Retry Location',
            onPress: () => {
              // Retry getting location
              setTimeout(() => requestLocationPermission(), 1000);
            }
          },
          { text: 'Use Demo Location', style: 'cancel' }
        ]
      );
      
      // Fallback to San Francisco
      const fallbackLat = 37.78825;
      const fallbackLng = -122.4324;
      setCurrentLocation({ latitude: fallbackLat, longitude: fallbackLng });
      setMapRegion({
        latitude: fallbackLat,
        longitude: fallbackLng,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
      generateSampleData(fallbackLat, fallbackLng);
      
      setLoading(false);
      return false;
    }
  };

  // Static pins that you can customize
  const generateSampleData = (centerLat: number, centerLng: number) => {
    const staticLocations: MapLocation[] = [
      {
        id: '1',
        latitude: centerLat + 0.01,
        longitude: centerLng + 0.009,
        title: 'Oli - Nissan Rogue',
        description: 'Distracted Driving at 35 mph',
        type: 'alert',
        timestamp: new Date().toISOString(),
      },
      {
        id: '2',
        latitude: centerLat - 0.008,
        longitude: centerLng + 0.012,
        title: 'Alert Pin',
        description: 'Description of the alert',
        type: 'alert',
        timestamp: new Date().toISOString(),
      },
      {
        id: '3',
        latitude: centerLat + 0.015,
        longitude: centerLng - 0.008,
        title: 'Checkpoint Pin',
        description: 'Description of the checkpoint',
        type: 'checkpoint',
        timestamp: new Date().toISOString(),
      },
      {
        id: '4',
        latitude: centerLat - 0.012,
        longitude: centerLng - 0.015,
        title: 'Vehicle Pin',
        description: 'This can be something else',
        type: 'vehicle',
        timestamp: new Date().toISOString(),
      },
    ];

    setMapData(staticLocations);
    console.log('✅ Set up 4 static pins for customization');
  };

  // Load real-time map data from backend
  const loadMapData = async () => {
    if (!authToken) return;
    
    try {
      setLoading(true);
      console.log('🗺️ Loading real-time map data from backend...');
      
      const response = await fetch(`${API_BASE_URL}/map/locations`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // Backend endpoint doesn't exist yet - this is expected during development
        console.log('ℹ️ Backend map endpoint not available yet (status:', response.status, ') - using sample data');
        return;
      }

      const data: ApiResponse<MapLocation[]> = await response.json();

      if (response.ok && data.success) {
        setMapData(data.data || []);
        console.log('✅ Map data loaded successfully:', data.data?.length || 0, 'locations');
      } else {
        console.log('ℹ️ Backend map data not available:', data.error);
      }
    } catch (error) {
      console.log('ℹ️ Backend map service unavailable (expected during development):', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initialize location and load data on component mount
  useEffect(() => {
    console.log('🚀 LandingScreen initialized, requesting location...');
    const initializeLocation = async () => {
      // First request location permission and get current location
      await requestLocationPermission();
      
      // Note: Backend data loading disabled during development
      // Uncomment when backend /api/map/locations endpoint is ready:
      // loadMapData();
    };
    
    initializeLocation();
    
    // Note: Auto-refresh disabled during development to avoid console spam 
    // Uncomment when backend is ready:
    // const interval = setInterval(loadMapData, 30000);
    // return () => clearInterval(interval);
  }, [authToken]);

  // Zoom functions
  const zoomIn = () => {
    setMapRegion(prevRegion => ({
      ...prevRegion,
      latitudeDelta: prevRegion.latitudeDelta * 0.5,
      longitudeDelta: prevRegion.longitudeDelta * 0.5,
    }));
  };

  const zoomOut = () => {
    setMapRegion(prevRegion => ({
      ...prevRegion,
      latitudeDelta: prevRegion.latitudeDelta * 2,
      longitudeDelta: prevRegion.longitudeDelta * 2,
    }));
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header with logo */}
      <View style={[styles.banner, { 
        backgroundColor: theme.colors.surface,
        borderBottomColor: theme.colors.border,
        paddingTop: insets.top + 16 
      }]}>
        <Image 
          source={require('../assets/images/brand-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      
      {/* Real-Time Map - Full screen between header and navigation */}
      <View style={styles.mapContainer}>
        {/* Real-Time Interactive Map with Current Location */}
        <MapView
          style={styles.map}
          region={mapRegion}
          onRegionChangeComplete={setMapRegion}
          showsUserLocation={true}
          showsMyLocationButton={true}
          showsCompass={true}
          showsScale={true}
          followsUserLocation={false}
          zoomEnabled={true}
          scrollEnabled={true}
          pitchEnabled={true}
          rotateEnabled={true}
        >
          {/* Render sample location markers around your current position */}
          {mapData.map((location) => (
            <Marker
              key={location.id}
              coordinate={{
                latitude: location.latitude,
                longitude: location.longitude,
              }}
              title={location.title}
              description={`${location.description} • ${new Date(location.timestamp).toLocaleTimeString()}`}
              pinColor={
                location.type === 'vehicle' ? '#007AFF' :
                location.type === 'alert' ? '#FF3B30' :
                location.type === 'checkpoint' ? '#34C759' : '#FF9500'
              }
            />
          ))}
        </MapView>
        
        {/* Loading overlay for real-time data updates */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <View style={[styles.loadingContainer, { backgroundColor: theme.colors.surface }]}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.text }]}>
                Loading real-time data...
              </Text>
            </View>
          </View>
        )}
        
        {/* Control buttons overlay - top right */}
        <View style={styles.controlsOverlay}>
          {/* Location refresh button */}
          <TouchableOpacity 
            style={[styles.refreshButton, { 
              backgroundColor: '#34C759', // Green for location
              opacity: loading ? 0.7 : 1
            }]}
            onPress={requestLocationPermission}
            disabled={loading}
          >
            <Text style={styles.refreshButtonText}>
              📍
            </Text>
          </TouchableOpacity>
        </View>

        {/* Zoom controls - bottom right */}
        <View style={styles.zoomControlsOverlay}>
          {/* Zoom in button */}
          <TouchableOpacity 
            style={[styles.zoomButton, { backgroundColor: theme.colors.surface }]}
            onPress={zoomIn}
          >
            <Text style={[styles.zoomButtonText, { color: theme.colors.text }]}>
              +
            </Text>
          </TouchableOpacity>
          
          {/* Zoom out button */}
          <TouchableOpacity 
            style={[styles.zoomButton, { backgroundColor: theme.colors.surface, marginTop: 8 }]}
            onPress={zoomOut}
          >
            <Text style={[styles.zoomButtonText, { color: theme.colors.text }]}>
              −
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  banner: {
    width: '100%',
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logo: {
    width: 200,
    height: 60,
  },
  mapContainer: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  mapInfo: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  mapTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  mapSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  mapDetails: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  controlsOverlay: {
    position: 'absolute',
    top: 20,
    right: 20,
    alignItems: 'flex-end',
  },
  refreshButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  statusIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  locationsList: {
    marginTop: 20,
    width: '100%',
    maxWidth: 300,
  },
  locationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  locationItem: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  locationDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  zoomControlsOverlay: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    flexDirection: 'column',
  },
  zoomButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  zoomButtonText: {
    fontSize: 24,
    fontWeight: '600',
  },
});


