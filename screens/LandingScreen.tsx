import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Video } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

// Backend API configuration for real-time map data
const API_BASE_URL = 'https://api.garditech.com/api';

interface GpsDataPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  speed?: number;
  heading?: number;
  accuracy?: number;
}

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

export default function LandingScreen({ navigation }: any) {
  const [mapData, setMapData] = useState<MapLocation[]>([]);
  const [gpsHistory, setGpsHistory] = useState<GpsDataPoint[]>([]);
  const [lastGpsUpdate, setLastGpsUpdate] = useState<Date | null>(null);
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
  const { authToken, user } = useAuth();
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
  // Fetch GPS data from backend
  const fetchGpsData = async (isBackgroundRefresh: boolean = false) => {
    if (!authToken || !user?.userId) {
      console.log('⚠️ Cannot fetch GPS data: missing auth or userId');
      return;
    }
    
    try {
      // Only show loading indicator for initial fetch, not for auto-refresh
      if (!isBackgroundRefresh) {
        setLoading(true);
      }
      console.log('� Fetching GPS data for userId:', user.userId);
      
      // Get GPS data for the last 24 hours
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
      
      // Use full ISO 8601 format (date-time) as required by Surfsight API
      const startStr = startDate.toISOString();
      const endStr = endDate.toISOString();
      
      const url = `${API_BASE_URL}/devices/${user.userId}/gps?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`;
      console.log('📡 GPS API URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`GPS API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📊 GPS data array length:', data.gpsData?.length || 0);
      if (data.gpsData && data.gpsData.length > 0) {
        // Only log the latest 4 valid GPS points to reduce console clutter
        const latestPoints = data.gpsData.slice(-4);
        console.log('✅ Latest 4 GPS points:', latestPoints);
      }

      if (data.gpsData && Array.isArray(data.gpsData) && data.gpsData.length > 0) {
        // Transform API data (lat/lon) to our format (latitude/longitude)
        const transformedData = data.gpsData.map((point: any) => ({
          latitude: point.lat,
          longitude: point.lon,
          timestamp: new Date(point.time * 1000).toISOString(), // Convert Unix timestamp to ISO string
          speed: point.speed,
          heading: point.heading,
          accuracy: point.accuracy,
        }));
        
        setGpsHistory(transformedData);
        setLastGpsUpdate(new Date());
        
        // First filter for valid GPS points
        const validGpsPoints = transformedData.filter((point: GpsDataPoint) => 
          point.latitude && 
          point.longitude && 
          !isNaN(point.latitude) && 
          !isNaN(point.longitude) &&
          point.latitude !== 0 &&
          point.longitude !== 0 &&
          Math.abs(point.latitude) <= 90 &&
          Math.abs(point.longitude) <= 180
        );
        
        // Sort by timestamp (newest first), then take the 4 most recent
        const sortedByTime = validGpsPoints.sort((a: GpsDataPoint, b: GpsDataPoint) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        // Take the 4 newest points and reverse to show oldest->newest on map
        const latest4Points = sortedByTime.slice(0, 4).reverse();
        
        console.log(`🗺️ Valid GPS points: ${validGpsPoints.length}, showing latest 4:`, 
          latest4Points.map((p: GpsDataPoint) => ({lat: p.latitude, lon: p.longitude, time: p.timestamp}))
        );
        
        // Convert GPS data to map markers
        const markers: MapLocation[] = latest4Points
          .map((point: GpsDataPoint, index: number) => ({
            id: `gps-${index}`,
            latitude: point.latitude,
            longitude: point.longitude,
            title: index === latest4Points.length - 1 ? 'Current Location' : `Location ${index + 1}`,
            description: `${new Date(point.timestamp).toLocaleString()}${point.speed ? ` • ${point.speed.toFixed(1)} mph` : ''}`,
            type: index === latest4Points.length - 1 ? 'vehicle' : 'checkpoint',
            timestamp: point.timestamp,
          }));
        
        if (markers.length > 0) {
          setMapData(markers);
          
          // Only center map on latest GPS point during initial load, not during auto-refresh
          if (!isBackgroundRefresh) {
            const latestPoint = latest4Points[latest4Points.length - 1];
            if (latestPoint.latitude && latestPoint.longitude && 
                !isNaN(latestPoint.latitude) && !isNaN(latestPoint.longitude) &&
                latestPoint.latitude !== 0 && latestPoint.longitude !== 0) {
              setMapRegion({
                latitude: latestPoint.latitude,
                longitude: latestPoint.longitude,
                latitudeDelta: 0.01, // Zoom in closer for 4 points
                longitudeDelta: 0.01,
              });
            }
          }
          
          const latestPoint = latest4Points[latest4Points.length - 1];
          console.log('✅ GPS markers created:', markers.length, 'points (latest 4)');
          console.log('📍 Latest location:', latestPoint.latitude, latestPoint.longitude);
        } else {
          console.log('⚠️ No valid GPS coordinates found in data');
        }
      } else {
        console.log('ℹ️ No GPS data available for this time range');
      }
    } catch (error) {
      console.error('❌ Error fetching GPS data:', error instanceof Error ? error.message : String(error));
      Alert.alert('GPS Error', 'Failed to load vehicle location data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initialize location and load GPS data when screen is focused
  useFocusEffect(
    useCallback(() => {
      // Don't run if user is not authenticated
      if (!user?.userId || !authToken) {
        console.log('⏸️ Waiting for user authentication...');
        return;
      }

      console.log('🚀 LandingScreen focused, requesting location...');
      const initializeLocation = async () => {
        // First request location permission and get current location
        await requestLocationPermission();
        
        // Load GPS data from backend (with loading indicator)
        await fetchGpsData(false);
      };
      
      initializeLocation();
      
      // Set up auto-refresh every 60 seconds for real-time GPS updates (only when screen is focused)
      const interval = setInterval(() => {
        console.log('🔄 Auto-refreshing GPS data...');
        fetchGpsData(true); // Pass true for background refresh (no loading indicator)
      }, 60000); // 60 seconds
      
      // Cleanup: stop auto-refresh when screen loses focus
      return () => {
        console.log('⏸️ LandingScreen unfocused, stopping GPS auto-refresh');
        clearInterval(interval);
      };
    }, [authToken, user?.userId])
  );

  // Debug: Monitor mapData changes
  useEffect(() => {
    console.log('🗺️ mapData state updated:', mapData.length, 'markers');
    if (mapData.length > 0) {
      console.log('📍 First marker:', mapData[0]);
    }
  }, [mapData]);

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
          showsUserLocation={false} // Disable default blue dot, we'll use our own marker
          showsMyLocationButton={true}
          showsCompass={true}
          showsScale={true}
          followsUserLocation={false}
          zoomEnabled={true}
          scrollEnabled={true}
          pitchEnabled={true}
          rotateEnabled={true}
        >
          {/* Dotted line connecting GPS points */}
          {mapData.length > 1 && (
            <Polyline
              coordinates={mapData.map(point => ({
                latitude: point.latitude,
                longitude: point.longitude,
              }))}
              strokeColor="#00ACB4"
              strokeWidth={3}
              lineDashPattern={[10, 10]} // Creates dotted line effect
            />
          )}
          
          {/* Only render the latest GPS location as a blue pulsing marker */}
          {mapData.length > 0 && (
            <Marker
              key={mapData[mapData.length - 1].id}
              coordinate={{
                latitude: mapData[mapData.length - 1].latitude,
                longitude: mapData[mapData.length - 1].longitude,
              }}
              title="Current Location"
              description={`${mapData[mapData.length - 1].description}`}
            >
              <View style={styles.liveMarkerContainer}>
                <View style={styles.liveMarkerPulse} />
                <View style={styles.liveMarkerDot} />
              </View>
            </Marker>
          )}
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

        {/* Zoom and Live Stream controls - bottom right */}
        <View style={styles.zoomControlsOverlay}>
          {/* Live Stream button */}
          <TouchableOpacity 
            style={[styles.zoomButton, { 
              backgroundColor: '#00ACB4', // Teal for live stream
              marginBottom: 8
            }]}
            onPress={() => navigation.navigate('LiveStream')}
          >
            <Video size={20} color="#FFFFFF" strokeWidth={2} />
          </TouchableOpacity>

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
  liveMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveMarkerPulse: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
    opacity: 0.8,
  },
  liveMarkerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
});


