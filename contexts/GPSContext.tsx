import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { STATIONARY_THRESHOLD_MS } from '../utils/vehicleStatus';
import { useAuth } from './AuthContext';

const API_BASE_URL = 'https://api.garditech.com/api';
const GPS_CACHE_KEY = '@gps_history_cache';
const TRIPS_CACHE_KEY = '@gps_trips_history';

interface GpsDataPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  speed?: number;
  heading?: number;
  accuracy?: number;
}

interface TripData {
  id: string;
  startTime: string;
  endTime: string;
  gpsPoints: GpsDataPoint[];
  distance: number;
  maxSpeed: number;
  avgSpeed: number;
  pointCount: number;
}

interface GPSContextType {
  gpsHistory: GpsDataPoint[];
  lastGpsUpdate: Date | null;
  loading: boolean;
  error: string | null;
  refreshGpsData: () => Promise<void>;
  isUsingCachedData: boolean;
  savedTrips: TripData[];
  getSavedTrips: () => Promise<TripData[]>;
}

const GPSContext = createContext<GPSContextType | undefined>(undefined);

export function GPSProvider({ children }: { children: React.ReactNode }) {
  const { authToken, user, isAuthenticated, logout } = useAuth();
  const [gpsHistory, setGpsHistory] = useState<GpsDataPoint[]>([]);
  const [lastGpsUpdate, setLastGpsUpdate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingCachedData, setIsUsingCachedData] = useState(false);
  const [savedTrips, setSavedTrips] = useState<TripData[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper: Calculate distance between two GPS points (Haversine formula)
  const calculateDistance = (points: GpsDataPoint[]): number => {
    if (points.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const lat1 = points[i].latitude * Math.PI / 180;
      const lat2 = points[i + 1].latitude * Math.PI / 180;
      const deltaLat = (points[i + 1].latitude - points[i].latitude) * Math.PI / 180;
      const deltaLon = (points[i + 1].longitude - points[i].longitude) * Math.PI / 180;
      
      const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = 6371 * c; // Earth radius in km
      
      totalDistance += distance;
    }
    
    return totalDistance * 0.621371; // Convert km to miles
  };

  // Save a completed trip to storage
  const saveTripToCache = async (trip: TripData) => {
    try {
      // Load existing trips
      const existing = await AsyncStorage.getItem(TRIPS_CACHE_KEY);
      const trips: TripData[] = existing ? JSON.parse(existing) : [];
      
      // Add new trip
      trips.push(trip);
      
      // Filter out trips older than 7 days
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recentTrips = trips.filter(t => new Date(t.endTime).getTime() > sevenDaysAgo);
      
      // Save filtered trips
      await AsyncStorage.setItem(TRIPS_CACHE_KEY, JSON.stringify(recentTrips));
      setSavedTrips(recentTrips);
      
      console.log(`💾 [GPSContext] Saved trip ${trip.id} (${trip.pointCount} points, ${trip.distance.toFixed(2)} miles)`);
      console.log(`📊 [GPSContext] Total saved trips: ${recentTrips.length}`);
    } catch (err) {
      console.error('❌ [GPSContext] Error saving trip:', err);
    }
  };

  // Load saved trips from storage
  const loadSavedTrips = async () => {
    try {
      const cached = await AsyncStorage.getItem(TRIPS_CACHE_KEY);
      if (cached) {
        const trips: TripData[] = JSON.parse(cached);
        
        // Filter out trips older than 7 days
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recentTrips = trips.filter(t => new Date(t.endTime).getTime() > sevenDaysAgo);
        
        setSavedTrips(recentTrips);
        console.log(`📦 [GPSContext] Loaded ${recentTrips.length} saved trips`);
        
        // Update cache if we filtered any old trips
        if (recentTrips.length !== trips.length) {
          await AsyncStorage.setItem(TRIPS_CACHE_KEY, JSON.stringify(recentTrips));
        }
      }
    } catch (err) {
      console.error('❌ [GPSContext] Error loading saved trips:', err);
    }
  };

  // Get saved trips (exposed to consumers)
  const getSavedTrips = async (): Promise<TripData[]> => {
    await loadSavedTrips();
    return savedTrips;
  };

  const loadCachedGpsData = async () => {
    try {
      const cached = await AsyncStorage.getItem(GPS_CACHE_KEY);
      console.log('📦 [GPSContext] Attempting to load cached GPS data...');
      console.log('  - Cache key:', GPS_CACHE_KEY);
      console.log('  - Cached data exists:', !!cached);
      
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        console.log('  - Cached data points:', data?.length || 0);
        console.log('  - Cache timestamp:', timestamp);
        
        // Only use cached data if it's less than 7 days old (extended to preserve last known location)
        const cacheAge = Date.now() - new Date(timestamp).getTime();
        const cacheAgeHours = (cacheAge / (1000 * 60 * 60)).toFixed(1);
        const cacheAgeDays = (cacheAge / (1000 * 60 * 60 * 24)).toFixed(1);
        console.log(`  - Cache age: ${cacheAgeHours} hours (${cacheAgeDays} days)`);
        
        if (cacheAge < 7 * 24 * 60 * 60 * 1000) {
          console.log('✅ [GPSContext] Loaded cached GPS data:', data.length, 'points');
          console.log('📍 [GPSContext] Latest cached point:', data[data.length - 1]);
          setGpsHistory(data);
          setLastGpsUpdate(new Date(timestamp));
          setIsUsingCachedData(true);
        } else {
          console.log('🗑️ [GPSContext] Cached GPS data too old (>7 days), clearing...');
          await AsyncStorage.removeItem(GPS_CACHE_KEY);
        }
      } else {
        console.log('ℹ️ [GPSContext] No cached GPS data found');
      }
    } catch (err) {
      console.error('❌ [GPSContext] Error loading cached GPS data:', err);
    }
  };

  const saveCachedGpsData = async (data: GpsDataPoint[]) => {
    try {
      await AsyncStorage.setItem(GPS_CACHE_KEY, JSON.stringify({
        data,
        timestamp: new Date().toISOString(),
      }));
      console.log('💾 [GPSContext] Cached GPS data saved');
    } catch (err) {
      console.error('❌ [GPSContext] Error saving GPS cache:', err);
    }
  };

  // Helper: Check if JWT token is expired
  const isTokenExpired = (token: string): boolean => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.log('⚠️ [GPSContext] Invalid JWT format (not 3 parts)');
        return true;
      }
      
      const base64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const paddedPayload = base64Payload.padEnd(
        base64Payload.length + (4 - (base64Payload.length % 4)) % 4,
        '='
      );
      const decodedPayload = JSON.parse(atob(paddedPayload));
      
      if (!decodedPayload.exp) {
        console.log('⚠️ [GPSContext] JWT has no expiration (exp claim missing)');
        return false; // If no exp, assume valid
      }
      
      const expirationTime = decodedPayload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const isExpired = currentTime > expirationTime;
      
      if (isExpired) {
        const expiredMs = currentTime - expirationTime;
        console.log(`⏰ [GPSContext] JWT expired ${Math.round(expiredMs / 1000)} seconds ago`);
      } else {
        const validForMs = expirationTime - currentTime;
        console.log(`✓ [GPSContext] JWT valid for ${Math.round(validForMs / 1000)} more seconds`);
      }
      
      return isExpired;
    } catch (err) {
      console.error('❌ [GPSContext] Error checking JWT expiration:', err);
      return false; // Assume valid on error
    }
  };

  // Fetch GPS data from backend
  const fetchGpsData = async (isBackgroundRefresh: boolean = false) => {
    if (!authToken || !user?.imei) {
      console.log('⚠️ [GPSContext] Cannot fetch GPS data: missing auth or IMEI');
      console.log('  - authToken exists:', !!authToken, 'length:', authToken?.length || 0);
      console.log('  - user.imei:', user?.imei || 'missing');
      return;
    }

    // Check token expiration before making API call
    if (isTokenExpired(authToken)) {
      console.log('⛔ [GPSContext] JWT token is expired - logging out user');
      setError('Authentication token expired. Logging out...');
      
      // Automatically logout user
      await logout();
      return;
    }
    
    try {
      if (!isBackgroundRefresh) {
        setLoading(true);
      }
      setError(null);
      console.log('🌍 [GPSContext] Fetching GPS data for IMEI:', user.imei);
      console.log('📋 [GPSContext] Auth token preview:', authToken.substring(0, 20) + '...');
      
      // Get GPS data for the last 24 hours
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
      
      const startStr = startDate.toISOString();
      const endStr = endDate.toISOString();
      
      const url = `${API_BASE_URL}/devices/${user.imei}/gps?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`;
      console.log('📡 [GPSContext] GPS API URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        // Log response body for debugging
        const responseText = await response.text();
        console.log(`❌ [GPSContext] GPS API error response (${response.status}):`, responseText.substring(0, 200));
        
        // If 401 Unauthorized, token is invalid - logout user
        if (response.status === 401) {
          console.log('🔒 [GPSContext] 401 Unauthorized - logging out user');
          setError('Authentication failed. Logging out...');
          await logout();
          return;
        }
        
        throw new Error(`GPS API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📊 [GPSContext] GPS data array length:', data.gpsData?.length || 0);

      if (data.gpsData && Array.isArray(data.gpsData) && data.gpsData.length > 0) {
        // Transform API data (lat/lon) to our format (latitude/longitude)
        // Convert speed from meters/second to miles per hour (1 m/s = 2.23694 mph)
        const transformedData = data.gpsData.map((point: any) => ({
          latitude: point.lat,
          longitude: point.lon,
          timestamp: new Date(point.time * 1000).toISOString(),
          speed: point.speed ? point.speed * 2.23694 : undefined, // Convert m/s to mph
          heading: point.heading,
          accuracy: point.accuracy,
        }));
        
        // Sort by timestamp (newest first)
        const sortedData = transformedData.sort((a: GpsDataPoint, b: GpsDataPoint) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
        // Filter for current trip only: remove old data if there's a significant time gap
        // indicating the vehicle was stationary (e.g., stopped at a location)
        const currentTripData = [];
        let previousTimestamp = null;
        const TRIP_GAP_THRESHOLD = STATIONARY_THRESHOLD_MS; // 20 minutes gap = new trip
        
        for (const point of sortedData) {
          const currentTime = new Date(point.timestamp).getTime();
          
          if (previousTimestamp === null) {
            // First point (newest), always include
            currentTripData.push(point);
            previousTimestamp = currentTime;
          } else {
            const timeDiff = previousTimestamp - currentTime;
            
            if (timeDiff < TRIP_GAP_THRESHOLD) {
              // Part of same trip (less than 20 minute gap)
              currentTripData.push(point);
              previousTimestamp = currentTime;
            } else {
              // Large time gap found - this is a previous trip, save it before stopping
              console.log(`🚗 [GPSContext] Trip boundary detected: ${(timeDiff / 1000 / 60).toFixed(1)} minute gap`);
              
              // Collect all remaining points for the previous trip
              const previousTripPoints = [point];
              let lastTime = currentTime;
              for (let i = sortedData.indexOf(point) + 1; i < sortedData.length; i++) {
                const nextPoint = sortedData[i];
                const nextTime = new Date(nextPoint.timestamp).getTime();
                const gap = lastTime - nextTime;
                if (gap < TRIP_GAP_THRESHOLD) {
                  previousTripPoints.push(nextPoint);
                  lastTime = nextTime;
                } else {
                  break;
                }
              }
              
              // Save the previous trip if it has enough points
              if (previousTripPoints.length > 1) {
                const speeds = previousTripPoints.map(p => p.speed || 0).filter(s => s > 0);
                const previousTrip: TripData = {
                  id: `trip_${Date.now()}_${user?.imei}`,
                  startTime: previousTripPoints[previousTripPoints.length - 1].timestamp,
                  endTime: previousTripPoints[0].timestamp,
                  gpsPoints: [...previousTripPoints].reverse(), // chronological order
                  distance: calculateDistance(previousTripPoints),
                  maxSpeed: speeds.length > 0 ? Math.max(...speeds) : 0,
                  avgSpeed: speeds.length > 0 ? speeds.reduce((a, b) => a + b) / speeds.length : 0,
                  pointCount: previousTripPoints.length
                };
                await saveTripToCache(previousTrip);
              }
              
              break;
            }
          }
        }
        
        // Reverse to get chronological order (oldest to newest)
        const currentTrip = currentTripData.reverse();
        
        console.log(`✅ [GPSContext] Filtered to current trip: ${currentTrip.length} points (from ${transformedData.length} total)`);
        console.log('✅ [GPSContext] Latest 4 GPS points:', currentTrip.slice(-4).map((p: GpsDataPoint) => ({
          lat: p.latitude,
          lon: p.longitude,
          speed: p.speed,
          time: p.timestamp
        })));
        
        setGpsHistory(currentTrip);
        setLastGpsUpdate(new Date());
        setIsUsingCachedData(false);
        
        // Save current trip data to cache
        await saveCachedGpsData(currentTrip);
      } else {
        console.log('ℹ️ [GPSContext] No GPS data available for this time range');
        // Always fall back to cached data when API returns empty
        console.log('📦 [GPSContext] No live data - loading cached data as fallback...');
        await loadCachedGpsData();
        
        // If we successfully loaded cached data, mark it as cached
        // (loadCachedGpsData sets isUsingCachedData internally if cache exists)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load GPS data';
      console.error('❌ [GPSContext] Error fetching GPS data:', errorMessage);
      setError(errorMessage);
      
      // On error, always try to load from cache as fallback
      console.log('📦 [GPSContext] API failed, attempting to load cached data...');
      await loadCachedGpsData();
      
      // If cache load succeeded, keep the data; otherwise user sees empty map
      if (gpsHistory.length > 0) {
        console.log('📍 [GPSContext] Keeping existing GPS data after API failure');
        setIsUsingCachedData(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Manual refresh function that screens can call
  const refreshGpsData = async () => {
    await fetchGpsData(false);
  };

  // Load cached GPS data on mount and when user logs in
  useEffect(() => {
    loadCachedGpsData();
    loadSavedTrips();
  }, [isAuthenticated, user?.imei]);

  // Start GPS tracking when authenticated
  useEffect(() => {
    if (!isAuthenticated || !authToken || !user?.imei) {
      console.log('⏸️ [GPSContext] Not authenticated, skipping GPS tracking');
      // Clear interval if exists
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    console.log('🚀 [GPSContext] Starting GPS tracking for IMEI:', user.imei);
    
    // Initial fetch
    fetchGpsData(false);
    
    // Set up auto-refresh every 30 seconds - runs globally regardless of screen
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(() => {
      console.log('🔄 [GPSContext] Auto-refreshing GPS data...');
      fetchGpsData(true);
    }, 30000); // 30 seconds

    // Cleanup on unmount or when auth changes
    return () => {
      console.log('⏸️ [GPSContext] Stopping GPS tracking');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, authToken, user?.imei]);

  return (
    <GPSContext.Provider value={{ gpsHistory, lastGpsUpdate, loading, error, refreshGpsData, isUsingCachedData, savedTrips, getSavedTrips }}>
      {children}
    </GPSContext.Provider>
  );
}

export function useGPS() {
  const context = useContext(GPSContext);
  if (context === undefined) {
    throw new Error('useGPS must be used within a GPSProvider');
  }
  return context;
}
