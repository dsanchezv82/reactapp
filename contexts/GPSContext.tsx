import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

const API_BASE_URL = 'https://api.garditech.com/api';
const GPS_CACHE_KEY = '@gps_history_cache';

interface GpsDataPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  speed?: number;
  heading?: number;
  accuracy?: number;
}

interface GPSContextType {
  gpsHistory: GpsDataPoint[];
  lastGpsUpdate: Date | null;
  loading: boolean;
  error: string | null;
  refreshGpsData: () => Promise<void>;
  isUsingCachedData: boolean;
}

const GPSContext = createContext<GPSContextType | undefined>(undefined);

export function GPSProvider({ children }: { children: React.ReactNode }) {
  const { authToken, user, isAuthenticated } = useAuth();
  const [gpsHistory, setGpsHistory] = useState<GpsDataPoint[]>([]);
  const [lastGpsUpdate, setLastGpsUpdate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingCachedData, setIsUsingCachedData] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load cached GPS data on mount
  useEffect(() => {
    loadCachedGpsData();
  }, []);

  const loadCachedGpsData = async () => {
    try {
      const cached = await AsyncStorage.getItem(GPS_CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Only use cached data if it's less than 24 hours old
        const cacheAge = Date.now() - new Date(timestamp).getTime();
        if (cacheAge < 24 * 60 * 60 * 1000) {
          console.log('📦 [GPSContext] Loaded cached GPS data:', data.length, 'points');
          setGpsHistory(data);
          setLastGpsUpdate(new Date(timestamp));
          setIsUsingCachedData(true);
        } else {
          console.log('🗑️ [GPSContext] Cached GPS data too old, clearing...');
          await AsyncStorage.removeItem(GPS_CACHE_KEY);
        }
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

  // Fetch GPS data from backend
  const fetchGpsData = async (isBackgroundRefresh: boolean = false) => {
    if (!authToken || !user?.imei) {
      console.log('⚠️ [GPSContext] Cannot fetch GPS data: missing auth or IMEI');
      return;
    }
    
    try {
      if (!isBackgroundRefresh) {
        setLoading(true);
      }
      setError(null);
      console.log('🌍 [GPSContext] Fetching GPS data for IMEI:', user.imei);
      
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
        throw new Error(`GPS API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📊 [GPSContext] GPS data array length:', data.gpsData?.length || 0);

      if (data.gpsData && Array.isArray(data.gpsData) && data.gpsData.length > 0) {
        // Transform API data (lat/lon) to our format (latitude/longitude)
        const transformedData = data.gpsData.map((point: any) => ({
          latitude: point.lat,
          longitude: point.lon,
          timestamp: new Date(point.time * 1000).toISOString(),
          speed: point.speed,
          heading: point.heading,
          accuracy: point.accuracy,
        }));
        
        // Sort by timestamp and get the 4 most recent points for logging
        const sortedForLogging = [...transformedData].sort((a: GpsDataPoint, b: GpsDataPoint) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        const latest4 = sortedForLogging.slice(0, 4);
        console.log('✅ [GPSContext] Latest 4 GPS points:', latest4.map((p: GpsDataPoint) => ({
          lat: p.latitude,
          lon: p.longitude,
          speed: p.speed,
          time: p.timestamp
        })));
        
        setGpsHistory(transformedData);
        setLastGpsUpdate(new Date());
        setIsUsingCachedData(false);
        
        // Save to cache for offline use
        await saveCachedGpsData(transformedData);
      } else {
        console.log('ℹ️ [GPSContext] No GPS data available for this time range');
        // If no fresh data but we have cached data, keep showing it
        if (gpsHistory.length === 0) {
          await loadCachedGpsData();
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load GPS data';
      console.error('❌ [GPSContext] Error fetching GPS data:', errorMessage);
      setError(errorMessage);
      
      // On error, if we don't have data already, try to load from cache
      if (gpsHistory.length === 0) {
        console.log('📦 [GPSContext] API failed, attempting to load cached data...');
        await loadCachedGpsData();
      } else {
        console.log('📍 [GPSContext] API failed but keeping existing GPS data');
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
    <GPSContext.Provider value={{ gpsHistory, lastGpsUpdate, loading, error, refreshGpsData, isUsingCachedData }}>
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
