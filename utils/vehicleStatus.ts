/**
 * Shared vehicle status utilities
 * Used for consistent stationary/trip detection across the app
 */

export interface GpsPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  speed?: number;
}

// Constants
export const STATIONARY_THRESHOLD_MINUTES = 20; // Vehicle considered stationary after 20 minutes
export const STATIONARY_THRESHOLD_MS = STATIONARY_THRESHOLD_MINUTES * 60 * 1000;
export const LOW_SPEED_THRESHOLD_MPH = 3; // Speed below this is considered stopped

/**
 * Check if vehicle is stationary based on GPS data
 * A vehicle is stationary if:
 * 1. Speed has been consistently low (< 3 mph) for 20+ minutes, OR
 * 2. Latest speed is 0 and oldest point in visible data is 20+ minutes old
 */
export function isVehicleStationary(
  gpsData: GpsPoint[],
  currentTime: Date = new Date()
): boolean {
  if (!gpsData || gpsData.length === 0) return false;
  
  const latestPoint = gpsData[gpsData.length - 1];
  const latestTimestamp = new Date(latestPoint.timestamp).getTime();
  const currentTimeMs = currentTime.getTime();
  const timeSinceLastUpdate = currentTimeMs - latestTimestamp;
  const minutesSinceLastUpdate = timeSinceLastUpdate / (60 * 1000);
  
  // If no GPS updates for 20+ minutes, consider stationary (device stopped reporting)
  if (timeSinceLastUpdate >= STATIONARY_THRESHOLD_MS) {
    return true;
  }
  
  const hasLowSpeed = !latestPoint.speed || latestPoint.speed < LOW_SPEED_THRESHOLD_MPH;
  
  // If currently moving, definitely not stationary
  if (!hasLowSpeed) return false;
  
  // Check the time span of the GPS data we have
  // If we have data spanning 20+ minutes and speed has been low, vehicle is stationary
  if (gpsData.length >= 2) {
    const oldestPoint = gpsData[0];
    const oldestTimestamp = new Date(oldestPoint.timestamp).getTime();
    const dataSpanMs = latestTimestamp - oldestTimestamp;
    
    // If we have 20+ minutes of GPS data and all recent points show low speed
    if (dataSpanMs >= STATIONARY_THRESHOLD_MS) {
      // Check if vehicle has been stationary throughout this period
      // Look at the last 10 points (or all if less than 10)
      const recentPoints = gpsData.slice(-10);
      const allLowSpeed = recentPoints.every(p => !p.speed || p.speed < LOW_SPEED_THRESHOLD_MPH);
      
      if (allLowSpeed) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Get human-readable stationary reason
 */
export function getStationaryReason(
  gpsData: GpsPoint[],
  currentTime: Date = new Date()
): string | null {
  if (!isVehicleStationary(gpsData, currentTime)) return null;
  
  if (gpsData.length < 1) return null;
  
  const latestPoint = gpsData[gpsData.length - 1];
  const latestTimestamp = new Date(latestPoint.timestamp).getTime();
  const currentTimeMs = currentTime.getTime();
  const timeSinceLastUpdate = currentTimeMs - latestTimestamp;
  const minutesSinceLastUpdate = Math.floor(timeSinceLastUpdate / (60 * 1000));
  
  // Check if data is stale (no updates for 20+ minutes)
  if (timeSinceLastUpdate >= STATIONARY_THRESHOLD_MS) {
    return `No GPS updates for ${minutesSinceLastUpdate} minutes`;
  }
  
  const hasLowSpeed = !latestPoint.speed || latestPoint.speed < LOW_SPEED_THRESHOLD_MPH;
  
  // Check if we have data spanning 20+ minutes
  if (gpsData.length >= 2) {
    const oldestPoint = gpsData[0];
    const oldestTimestamp = new Date(oldestPoint.timestamp).getTime();
    const dataSpanMinutes = (latestTimestamp - oldestTimestamp) / (1000 * 60);
    
    if (dataSpanMinutes >= STATIONARY_THRESHOLD_MINUTES) {
      return `Low speed for ${dataSpanMinutes.toFixed(1)} minutes`;
    }
  }
  
  return 'Stationary';
}
