import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Video } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LiveVideoScreen from '../components/LiveVideoPlayer';
import { useAuth } from '../contexts/AuthContext';
import { useGPS } from '../contexts/GPSContext';
import { useTheme } from '../contexts/ThemeContext';
import { wakeUpDevice } from '../utils/deviceTools';

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
  speed?: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export default function LandingScreen({ navigation }: any) {
  const [mapData, setMapData] = useState<MapLocation[]>([]);
  const [loading, setLoading] = useState(false);
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
  const [wasStationary, setWasStationary] = useState<boolean>(false);
  const [showLiveVideo, setShowLiveVideo] = useState<boolean>(false);
  const [selectedCamera, setSelectedCamera] = useState<number>(1); // Default to road-facing camera
  const [hasInitializedMap, setHasInitializedMap] = useState<boolean>(false);
  const [liveSurfsightToken, setLiveSurfsightToken] = useState<string | null>(null);
  const [liveFamilyId, setLiveFamilyId] = useState<string | null>(null);
  
  const { theme } = useTheme();
  const { authToken, user, surfsightToken } = useAuth();
  const { gpsHistory, lastGpsUpdate, refreshGpsData, isUsingCachedData, error: gpsError } = useGPS();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

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
        console.log('❌ Location permission denied');
        Alert.alert(
          'Location Permission Required',
          'Location access is needed to show your position on the map.',
          [
            {
              text: 'Open Settings',
              onPress: () => {
                Alert.alert('Settings', 'Please enable location access in your device settings.');
              }
            },
            { text: 'OK', style: 'cancel' }
          ]
        );
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
      
      // Only center on user's location if we don't have any device GPS data (live or cached)
      // This prevents overriding the device's position when the app updates
      const hasDeviceGpsData = gpsHistory && gpsHistory.length > 0;
      
      if (!hasDeviceGpsData) {
        const newRegion = {
          latitude,
          longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        };
        setMapRegion(newRegion);
        console.log('🗺️ No GPS data (live or cached) - centered on user location:', newRegion);
      } else {
        console.log(`📍 User location obtained but keeping map centered on device GPS data (${isUsingCachedData ? 'cached' : 'live'})`);
      }
      
      console.log('📍 Current location:', latitude, longitude);

      setLoading(false);
      return true;
    } catch (error) {
      console.log('❌ Error getting your location:', error);
      Alert.alert(
        'Location Error',
        'Unable to get your current location. Please check that location services are enabled and that the camera has been turned on.',
        [
          {
            text: 'Retry',
            onPress: () => {
              setTimeout(() => requestLocationPermission(), 1000);
            }
          },
          { text: 'OK', style: 'cancel' }
        ]
      );
      
      setLoading(false);
      return false;
    }
  };

  // Process GPS data from context and convert to map markers
  const processGpsDataForMap = useCallback(() => {
    if (!gpsHistory || gpsHistory.length === 0) {
      console.log('ℹ️ No GPS data available from context');
      if (mapData.length > 0) {
        setMapData([]);
      }
      return;
    }

    // Filter for valid GPS points
    const validGpsPoints = gpsHistory.filter((point: GpsDataPoint) => 
      point.latitude && 
      point.longitude && 
      !isNaN(point.latitude) && 
      !isNaN(point.longitude) &&
      point.latitude !== 0 &&
      point.longitude !== 0 &&
      Math.abs(point.latitude) <= 90 &&
      Math.abs(point.longitude) <= 180
    );
    
    // Sort by timestamp (newest first), then take the 20 most recent for display
    const sortedByTime = validGpsPoints.sort((a: GpsDataPoint, b: GpsDataPoint) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    // Take the 20 newest points and reverse to show oldest->newest on map
    const latest20Points = sortedByTime.slice(0, 20).reverse();
    
    // Convert GPS data to map markers
    const markers: MapLocation[] = latest20Points
      .map((point: GpsDataPoint, index: number) => ({
        id: `gps-${index}`,
        latitude: point.latitude,
        longitude: point.longitude,
        title: index === latest20Points.length - 1 ? 'Current Location' : `Location ${index + 1}`,
        description: `${new Date(point.timestamp).toLocaleString()}${point.speed ? ` • ${point.speed.toFixed(1)} mph` : ''}`,
        type: index === latest20Points.length - 1 ? 'vehicle' : 'checkpoint',
        timestamp: point.timestamp,
        speed: point.speed,
      }));
    
    // Only update if data actually changed - compare latest timestamp and count
    if (markers.length > 0) {
      const hasChanged = 
        mapData.length !== markers.length ||
        mapData.length === 0 ||
        (mapData[mapData.length - 1]?.timestamp !== markers[markers.length - 1]?.timestamp);
      
      if (hasChanged) {
        setMapData(markers);
        console.log('✅ GPS markers updated:', markers.length, 'points');
      }
    } else if (mapData.length > 0) {
      console.log('⚠️ No valid GPS coordinates found in data');
      setMapData([]);
    }
  }, [gpsHistory, mapData]);

  // Initialize location and process GPS data when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (!user?.userId || !authToken) {
        console.log('⏸️ Waiting for user authentication...');
        return;
      }

      console.log('🚀 LandingScreen focused, requesting location...');
      setLoading(true);
      
      const initializeLocation = async () => {
        // Request location permission and get current location
        await requestLocationPermission();
        
        setLoading(false);
      };
      
      initializeLocation();
    }, [authToken, user?.userId])
  );

  // Update map markers whenever GPS data changes (from global context)
  useEffect(() => {
    processGpsDataForMap();
  }, [gpsHistory, processGpsDataForMap]);

  // Auto-center map on first GPS data load
  useEffect(() => {
    if (!hasInitializedMap && mapData.length > 0) {
      const latestLocation = mapData[mapData.length - 1];
      const newRegion = {
        latitude: latestLocation.latitude,
        longitude: latestLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setMapRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 500);
      setHasInitializedMap(true);
      console.log('🎯 Auto-centered map on GPS location:', latestLocation.latitude, latestLocation.longitude);
    }
  }, [mapData, hasInitializedMap]);

  // Memoize stationary check to prevent recalculating on every render
  const isVehicleStationary = useMemo(() => {
    if (!mapData || mapData.length === 0) return false;
    
    const latestPoint = mapData[mapData.length - 1];
    const hasZeroSpeed = !latestPoint.speed || latestPoint.speed < 3;
    
    const latestTimestamp = new Date(latestPoint.timestamp).getTime();
    const currentTime = new Date().getTime();
    const timeDifferenceMinutes = (currentTime - latestTimestamp) / (1000 * 60);
    const isDataStale = timeDifferenceMinutes >= 5;
    
    let isDeviceOnStandby = false;
    if (mapData.length >= 2) {
      const previousPoint = mapData[mapData.length - 2];
      isDeviceOnStandby = 
        latestPoint.latitude === previousPoint.latitude &&
        latestPoint.longitude === previousPoint.longitude &&
        latestPoint.speed === previousPoint.speed &&
        latestPoint.timestamp === previousPoint.timestamp;
    }
    
    const isStationary = (hasZeroSpeed && isDataStale) || (isDeviceOnStandby && isDataStale);
    
    // Log stationary status (but only when it changes)
    if (isStationary) {
      const reason = isDeviceOnStandby ? 'device on standby' : 'speed: 0';
      const minutes = timeDifferenceMinutes.toFixed(1);
      console.log(`🅿️ Vehicle stationary - hiding trail (${reason} for ${minutes} minutes)`);
    }
    
    return isStationary;
  }, [mapData]);

  // Log only when stationary state changes
  useEffect(() => {
    if (isVehicleStationary !== wasStationary) {
      setWasStationary(isVehicleStationary);
      if (!isVehicleStationary && wasStationary) {
        console.log('🚗 Vehicle is now moving - showing trail');
      }
    }
  }, [isVehicleStationary, wasStationary]);

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

  // Recenter map on current GPS location and refresh GPS data
  const recenterMap = async () => {
    if (mapData.length > 0) {
      const latestLocation = mapData[mapData.length - 1];
      const newRegion = {
        latitude: latestLocation.latitude,
        longitude: latestLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setMapRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 500);
      console.log('🎯 Recentered map on current location:', latestLocation.latitude, latestLocation.longitude);
    }
    
    // Also refresh GPS data to get latest coordinates
    await refreshGpsData();
  };

  // Handle opening live video modal
  const openLiveVideo = async () => {
    if (!user?.imei) {
      Alert.alert(
        'Device Not Found',
        'No device is associated with your account. Please contact support.',
        [{ text: 'OK' }]
      );
      return;
    }

    console.log('🎥 Opening live video...');
    console.log('📱 User IMEI:', user.imei);
    
    // Open modal directly - LiveVideoPlayer will handle authentication
    setSelectedCamera(1); // Default to road-facing camera
    setShowLiveVideo(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Real-Time Map - Full screen */}
      <View style={styles.mapContainer}>
        {/* Real-Time Interactive Map with Current Location */}
        <MapView
          ref={mapRef}
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
          {/* Dotted line connecting GPS points - only show if car is moving, color by speed */}
          {!loading && mapData.length > 1 && !isVehicleStationary && (() => {
            // Function to get color based on speed (in mph)
            const getSpeedColor = (speed?: number): string => {
              if (!speed || speed < 0) return '#87CEEB'; // Light blue for 0-20 mph (default)
              if (speed < 20) return '#87CEEB';  // Light blue: 0-20 mph
              if (speed < 40) return '#00C853';  // Green: 20-40 mph
              if (speed < 60) return '#64DD17';  // Light green: 40-60 mph
              if (speed < 70) return '#FFD600';  // Yellow: 60-70 mph
              if (speed < 75) return '#FF6B6B';  // Light red: 70-75 mph
              return '#FF0000';                   // Red: 75+ mph
            };
            
            // Create segments between each pair of points with colors based on speed
            const segments = [];
            for (let i = 0; i < mapData.length - 1; i++) {
              const currentPoint = mapData[i];
              const nextPoint = mapData[i + 1];
              
              // Use the speed from the starting point of the segment
              const color = getSpeedColor(currentPoint.speed);
              
              segments.push(
                <Polyline
                  key={`segment-${i}`}
                  coordinates={[
                    { latitude: currentPoint.latitude, longitude: currentPoint.longitude },
                    { latitude: nextPoint.latitude, longitude: nextPoint.longitude },
                  ]}
                  strokeColor={color}
                  strokeWidth={4}
                  lineDashPattern={[1, 10]}
                />
              );
            }
            
            return <>{segments}</>;
          })()}
          
          {/* Only render the latest GPS location as a blue pulsing marker */}
          {!loading && mapData.length > 0 && (
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
        
        {/* GPS Status Banner - top center */}
        {(isUsingCachedData || gpsError) && (
          <View style={[styles.statusBanner, { 
            backgroundColor: isUsingCachedData ? '#FF9500' : '#FF3B30',
            borderBottomColor: theme.colors.border,
            top: insets.top
          }]}>
            <Text style={styles.statusBannerText}>
              {isUsingCachedData 
                ? '📦 Showing last known location' 
                : '⚠️ GPS connection error'}
            </Text>
            {lastGpsUpdate && (
              <Text style={styles.statusBannerSubtext}>
                Last updated: {new Date(lastGpsUpdate).toLocaleTimeString()}
              </Text>
            )}
          </View>
        )}
        
        {/* Control buttons overlay - top right */}
        <View style={[styles.controlsOverlay, { top: insets.top + (isUsingCachedData || gpsError ? 60 : 0) }]}>
          {/* Recenter map and refresh GPS button */}
          <TouchableOpacity 
            style={[styles.refreshButton, { 
              backgroundColor: '#34C759', // Green for recenter + refresh
              opacity: loading ? 0.7 : 1
            }]}
            onPress={recenterMap}
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
            onPress={openLiveVideo}
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

        {/* Speed Legend - bottom left */}
        {mapData.length > 1 && (
          <View style={[styles.speedLegend, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.speedLegendTitle, { color: theme.colors.text }]}>Speed</Text>
            <View style={styles.speedLegendItem}>
              <View style={[styles.speedLegendColor, { backgroundColor: '#87CEEB' }]} />
              <Text style={[styles.speedLegendText, { color: theme.colors.text }]}>0-20 mph</Text>
            </View>
            <View style={styles.speedLegendItem}>
              <View style={[styles.speedLegendColor, { backgroundColor: '#00C853' }]} />
              <Text style={[styles.speedLegendText, { color: theme.colors.text }]}>20-40 mph</Text>
            </View>
            <View style={styles.speedLegendItem}>
              <View style={[styles.speedLegendColor, { backgroundColor: '#64DD17' }]} />
              <Text style={[styles.speedLegendText, { color: theme.colors.text }]}>40-60 mph</Text>
            </View>
            <View style={styles.speedLegendItem}>
              <View style={[styles.speedLegendColor, { backgroundColor: '#FFD600' }]} />
              <Text style={[styles.speedLegendText, { color: theme.colors.text }]}>60-70 mph</Text>
            </View>
            <View style={styles.speedLegendItem}>
              <View style={[styles.speedLegendColor, { backgroundColor: '#FF6B6B' }]} />
              <Text style={[styles.speedLegendText, { color: theme.colors.text }]}>70-75 mph</Text>
            </View>
            <View style={styles.speedLegendItem}>
              <View style={[styles.speedLegendColor, { backgroundColor: '#FF0000' }]} />
              <Text style={[styles.speedLegendText, { color: theme.colors.text }]}>75+ mph</Text>
            </View>
          </View>
        )}

        {/* Live Video Modal */}
        <Modal
          visible={showLiveVideo}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowLiveVideo(false)}
        >
          {user?.imei && authToken ? (
            <View style={{ flex: 1 }}>
              <LiveVideoScreen
                imei={user.imei}
                authToken={authToken}
                cameraId={selectedCamera}
                onClose={() => setShowLiveVideo(false)}
                onError={(error) => {
                  console.error('Live video error:', error);
                  // Don't close modal - let user see error and retry
                }}
              />
              
              {/* Wake Camera Button - Bottom Center */}
              <View style={{ position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', zIndex: 1000 }}>
                <TouchableOpacity
                  onPress={async () => {
                    if (user?.imei && authToken) {
                      const result = await wakeUpDevice(user.imei, authToken);
                      Alert.alert(
                        result.success ? 'Success' : 'Error',
                        result.message,
                        [{ text: 'OK' }]
                      );
                    }
                  }}
                  style={{
                    backgroundColor: '#FF9500',
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    borderRadius: 25,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 3.84,
                    elevation: 5,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>⏰ Wake Camera</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={{ color: theme.colors.text, marginTop: 16 }}>Loading video player...</Text>
              <TouchableOpacity 
                onPress={() => setShowLiveVideo(false)}
                style={{ marginTop: 24, padding: 12, backgroundColor: theme.colors.surface, borderRadius: 8 }}
              >
                <Text style={{ color: theme.colors.text }}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
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
    top: 60,
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
  speedLegend: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  speedLegendTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  speedLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  speedLegendColor: {
    width: 20,
    height: 3,
    marginRight: 8,
    borderRadius: 2,
  },
  speedLegendText: {
    fontSize: 11,
    fontWeight: '500',
  },
  statusBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  statusBannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusBannerSubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 2,
  },
});

