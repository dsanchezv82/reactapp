# GPS Tracking Implementation

## Overview ✅

**Status:** WORKING - Real-time GPS tracking with live map display, trip detection, persistent caching, and **background refresh support**.

The app tracks vehicle location using GPS data from the Gardi backend, displays it on an interactive map with speed-coded trails, automatically segments trips, and **continues tracking GPS data even when the app is in the background**.

## Files Used in GPS Implementation

### Core Files

| File | Purpose | Lines | Key Responsibilities |
|------|---------|-------|---------------------|
| `contexts/GPSContext.tsx` | GPS data provider | 630 | Global state, API calls, caching, trip detection, foreground/background refresh, AppState monitoring |
| `screens/LandingScreen.tsx` | Map display screen | 849 | Map rendering, GPS visualization, speed-coded trails, controls |
| `utils/vehicleStatus.ts` | Stationary detection | 106 | Vehicle status logic, trip boundary detection |
| `contexts/AuthContext.tsx` | Authentication | 425 | JWT token management, user session, logout |
| `contexts/ThemeContext.tsx` | Theme provider | ~200 | Dark/light mode, color schemes |
| `components/LiveVideoPlayer.tsx` | Live video modal | 493 | WebRTC video streaming (integrated in map) |

### Supporting Files

| File | Purpose |
|------|---------|
| `constants/Colors.ts` | Color definitions for map elements |
| `utils/pushNotifications.ts` | Device token management (referenced by AuthContext) |
| `app.json` | App configuration with permissions |
| `package.json` | Dependencies (react-native-maps, AsyncStorage, expo-location) |

### Configuration Files

- **Location Permissions**: Configured in `app.json` (iOS) and `AndroidManifest.xml` (Android)
- **API Endpoints**: Defined in `GPSContext.tsx` and `LandingScreen.tsx`
- **Cache Keys**: `@gps_history_cache`, `@gps_trips_history` (AsyncStorage)

## Architecture

```
Backend GPS API
    ↓
GPSContext (Global Provider)
    ↓ Fetches GPS data every 30 seconds
    ↓ Filters for current trip
    ↓ Caches data locally
LandingScreen
    ↓ Subscribes to GPS updates
    ↓ Displays location on map
MapView (react-native-maps)
    ↓ Shows GPS trail with speed colors
    ↓ Live location marker
Real-Time Map Display 🗺️
```

## Key Components

### 1. GPSContext (Global State Provider)

**File:** `contexts/GPSContext.tsx`

**Purpose:** Centralized GPS data management that works across all screens

**Key Features:**
- Automatic GPS polling every 30 seconds (foreground)
- Background GPS refresh every 15 minutes (iOS minimum)
- AppState monitoring for foreground/background transitions
- Trip detection & segmentation (20-minute gap threshold)
- Persistent caching (AsyncStorage)
- Trip history storage (last 7 days)
- Token expiration detection
- Fallback to cached data on API failure

**State:**
```typescript
{
  gpsHistory: GpsDataPoint[],      // Current trip GPS points
  lastGpsUpdate: Date | null,      // Last successful update
  loading: boolean,                 // Initial load state
  error: string | null,            // Error message
  isUsingCachedData: boolean,      // Fallback mode indicator
  savedTrips: TripData[]           // Historical trips
}
```

### 2. LandingScreen (Map Display)

**File:** `screens/LandingScreen.tsx`

**Purpose:** Display vehicle location on interactive map

**Key Features:**
- Real-time map with GPS trail
- Speed-coded polylines (blue→green→yellow→red)
- Live location marker (pulsing blue dot)
- Stationary detection (hides trail when parked)
- Auto-center on first load
- Manual recenter + refresh button
- Zoom controls
- Speed legend
- Live video integration

## Data Flow

### Initial Load

```
1. App Launch
   ↓
2. User Authenticates
   ↓
3. GPSContext Initializes
   ↓
4. Load Cached GPS Data (if available)
   - Shows last known location immediately
   ↓
5. Fetch Fresh GPS Data from API
   - Gets last 24 hours of GPS data
   ↓
6. Filter for Current Trip
   - Remove old trips (20+ minute gaps)
   ↓
7. Update Map Display
   - Center on latest GPS point
   - Draw speed-coded trail
```

### Auto-Refresh Cycle (Every 30 Seconds)

```
1. Timer Triggers (30s interval)
   ↓
2. Fetch Latest GPS Data
   ↓
3. Check for Trip Boundary
   - If 20+ minute gap detected:
     * Save previous trip to cache
     * Start new current trip
   ↓
4. Update Map
   - Add new GPS points
   - Extend trail
   - Update marker position
   ↓
5. Cache Updated Data
   - Save to AsyncStorage
   - Update timestamp
```

### Manual Refresh

```
User Taps Recenter Button
   ↓
1. Trigger GPS Fetch
   ↓
2. Center Map on Latest Location
   ↓
3. Zoom to 0.01° delta (close-up)
```

## GPS Data Structure

### API Response Format

```typescript
{
  gpsData: [
    {
      lat: 32.81234,         // Latitude
      lon: -117.19267,       // Longitude
      time: 1700000000,      // Unix timestamp (seconds)
      speed: 15.6,           // Speed in meters/second
      heading: 180,          // Heading in degrees
      accuracy: 10.5         // Accuracy in meters
    },
    // ... more points
  ]
}
```

### Transformed Format (Used in App)

```typescript
interface GpsDataPoint {
  latitude: number;        // Converted from lat
  longitude: number;       // Converted from lon
  timestamp: string;       // ISO 8601 format
  speed?: number;          // Converted to mph (m/s × 2.23694)
  heading?: number;        // Degrees
  accuracy?: number;       // Meters
}
```

### Trip Data Structure

```typescript
interface TripData {
  id: string;                    // Unique trip ID
  startTime: string;             // ISO timestamp
  endTime: string;               // ISO timestamp
  gpsPoints: GpsDataPoint[];     // All GPS points for trip
  distance: number;              // Total distance in miles
  maxSpeed: number;              // Max speed in mph
  avgSpeed: number;              // Average speed in mph
  pointCount: number;            // Number of GPS points
}
```

## Trip Detection Algorithm

### Concept

Trips are automatically detected based on time gaps between GPS points. If there's a gap of **20+ minutes** between consecutive points, the algorithm assumes the vehicle was stationary (parked) and treats the data before the gap as a separate completed trip.

### Implementation

```typescript
const TRIP_GAP_THRESHOLD = 20 * 60 * 1000; // 20 minutes in milliseconds

// Sort GPS data newest to oldest
const sortedData = data.sort((a, b) => 
  new Date(b.timestamp) - new Date(a.timestamp)
);

// Iterate through data to find trip boundaries
for each point in sortedData:
  if (previousPoint exists):
    timeDiff = previousPoint.time - currentPoint.time
    
    if (timeDiff > TRIP_GAP_THRESHOLD):
      // Gap detected - previous trip ended here
      saveCompletedTrip(pointsBeforeGap)
      startNewTrip(currentPoint)
    else:
      // Same trip continues
      addPointToCurrentTrip(currentPoint)
```

### Why 20 Minutes?

- **Short stops** (gas, traffic lights): <5 minutes - same trip
- **Medium stops** (quick errand): 5-15 minutes - same trip
- **Long stops** (destination, parking): 20+ minutes - new trip

This threshold balances between:
- Not splitting trips during brief stops
- Separating actual distinct journeys

### Trip Storage

Completed trips are:
1. Saved to AsyncStorage (`@gps_trips_history`)
2. Kept for 7 days
3. Automatically cleaned up (old trips deleted)
4. Available for trip history viewing (future feature)

## Caching Strategy

### GPS Data Cache

**Key:** `@gps_history_cache`

**Stored Data:**
```json
{
  "data": [/* GPS points array */],
  "timestamp": "2025-11-17T12:00:00Z"
}
```

**Cache Duration:** 7 days

**Purpose:**
- Show last known location when offline
- Instant map display on app launch
- Fallback when API fails

### Trip History Cache

**Key:** `@gps_trips_history`

**Stored Data:**
```json
[
  {
    "id": "trip_1700000000_865509052362369",
    "startTime": "2025-11-17T10:00:00Z",
    "endTime": "2025-11-17T11:30:00Z",
    "gpsPoints": [/* array */],
    "distance": 25.4,
    "maxSpeed": 68.2,
    "avgSpeed": 45.6,
    "pointCount": 180
  },
  // ... more trips
]
```

**Cache Duration:** 7 days (auto-cleanup)

**Purpose:**
- Trip history review
- Distance/speed analytics
- Historical route viewing

## Map Features

### Speed-Coded Trail

GPS trail color changes based on vehicle speed:

| Speed Range | Color | Code |
|-------------|-------|------|
| 0-20 mph | Light Blue | `#87CEEB` |
| 20-40 mph | Green | `#00C853` |
| 40-60 mph | Light Green | `#64DD17` |
| 60-70 mph | Yellow | `#FFD600` |
| 70-75 mph | Light Red | `#FF6B6B` |
| 75+ mph | Red | `#FF0000` |

**Implementation:**
```typescript
// Create segments between each pair of points
for (let i = 0; i < points.length - 1; i++) {
  const color = getSpeedColor(points[i].speed);
  
  <Polyline
    coordinates={[points[i], points[i + 1]]}
    strokeColor={color}
    strokeWidth={4}
    lineDashPattern={[1, 10]} // Dotted line
  />
}
```

### Stationary Detection

**Purpose:** Hide GPS trail when vehicle is stationary (parked)

**Criteria for "Stationary":**
1. Latest GPS point has speed < 1 mph
2. Last data update > 20 minutes ago
3. Trip has < 3 GPS points

**Effect:** Polyline trail is hidden, only marker shown

**Why:** Prevents cluttered map when vehicle hasn't moved

### Live Location Marker

**Style:** Pulsing blue dot with white border

**Components:**
- Outer pulse: 40px, transparent blue, fades
- Inner dot: 16px, solid blue, white border
- Drop shadow for depth

**Animation:** CSS pulse animation (built into design)

### Map Controls

**Recenter Button (Green 📍):**
- Recenters map on latest GPS location
- Triggers GPS data refresh
- Zooms to 0.01° delta (close-up)

**Zoom In/Out (+/−):**
- Adjusts map delta by 2x factor
- Standard pinch-to-zoom also works

**Live Video Button (Teal 🎥):**
- Opens live video modal
- See `LIVE_VIDEO_SETUP.md` for details

## API Integration

### Endpoint

```
GET /api/devices/{imei}/gps?start={startDate}&end={endDate}
```

**Headers:**
```
Authorization: Bearer {jwtToken}
Content-Type: application/json
```

**Query Parameters:**
- `start`: ISO 8601 timestamp (24 hours ago)
- `end`: ISO 8601 timestamp (now)

**Response:**
```json
{
  "gpsData": [
    {
      "lat": 32.81234,
      "lon": -117.19267,
      "time": 1700000000,
      "speed": 15.6,
      "heading": 180,
      "accuracy": 10.5
    }
  ]
}
```

### Error Handling

**401 Unauthorized:**
- Token expired
- Auto-logout user
- Redirect to login

**API Failure:**
- Fall back to cached GPS data
- Show orange banner: "📦 Showing last known location"
- Display last update timestamp

**No GPS Data:**
- Check for cached data
- If no cache, show empty map
- Display message: "No GPS data available"

## Token Management

### JWT Expiration Check

Before every API call, GPSContext validates the JWT token:

```typescript
const isTokenExpired = (token: string): boolean => {
  // Decode JWT payload
  const payload = JSON.parse(atob(token.split('.')[1]));
  
  // Check exp claim
  const expirationTime = payload.exp * 1000;
  const isExpired = Date.now() > expirationTime;
  
  if (isExpired) {
    logout(); // Auto-logout
  }
  
  return isExpired;
}
```

**Benefits:**
- Prevents failed API calls
- Immediate logout on expiration
- Better UX (no confusing errors)

## Performance Optimizations

### 1. Conditional Updates

Only update map when GPS data actually changes:

```typescript
const hasChanged = 
  mapData.length !== markers.length ||
  mapData[mapData.length - 1]?.timestamp !== markers[markers.length - 1]?.timestamp;

if (hasChanged) {
  setMapData(markers);
}
```

### 2. Background Refresh

Auto-refresh uses `isBackgroundRefresh` flag:
- Skips `setLoading(true)` for background updates
- Prevents UI flickering every 30 seconds
- Only shows loading on initial load

### 3. Stationary Check Memoization

```typescript
const isVehicleStationaryNow = useMemo(() => {
  return isVehicleStationary(mapData);
}, [mapData]);
```

Prevents recalculating stationary state on every render.

### 4. Map Region Management

Only auto-center once on first GPS data load:

```typescript
const [hasInitializedMap, setHasInitializedMap] = useState(false);

useEffect(() => {
  if (!hasInitializedMap && mapData.length > 0) {
    centerMapOnLocation();
    setHasInitializedMap(true);
  }
}, [mapData, hasInitializedMap]);
```

### 5. Limited Point Display

Display only 20 most recent GPS points on map:

```typescript
const latest20Points = sortedByTime.slice(0, 20).reverse();
```

**Why:** Prevents performance issues with long trips (hundreds of points)

## User Location vs Device GPS

### Two Location Sources

**User Location (Phone GPS):**
- From `expo-location`
- Shows where the phone is
- Used for: "You are here" reference
- Requested on permission grant
- Not displayed on map (we show device only)

**Device GPS (Vehicle GPS):**
- From backend API
- Shows where the vehicle/dashcam is
- Used for: Map display, trail, marker
- Fetched every 30 seconds
- Primary location source

### Why Two Sources?

- **User location:** For apps where phone = device (navigation, fitness)
- **Device GPS:** For fleet tracking where phone ≠ device (our use case)

User may be at home, but they want to see where their vehicle is.

## Status Indicators

### Orange Banner (Cached Data)

**When:** `isUsingCachedData === true`

**Message:** "📦 Showing last known location"

**Subtext:** "Last updated: 2:45 PM"

**Meaning:** 
- API call failed or returned no data
- Showing last successful GPS data from cache
- May be outdated

### Red Banner (GPS Error)

**When:** `error !== null`

**Message:** "⚠️ GPS connection error"

**Subtext:** "Last updated: 2:45 PM"

**Meaning:**
- API call failed with error
- Cannot connect to backend
- Network issue or server down

### Green Refresh Button

**When:** Always visible

**Action:** Recenter map + force refresh GPS data

**Purpose:**
- Manual update trigger
- Quick way to check for new GPS data
- Recenter if user scrolled away

## Common Issues & Solutions

### Issue: "GPS not updating on app launch"

**Status:** ✅ FIXED (November 18, 2025)

**Previous Behavior:**
- App would show stale cached GPS data on launch
- Manual tap on recenter button required to get fresh data
- Auto-refresh (30s interval) would not trigger properly

**Root Cause:**
- When API returned empty GPS data, the fallback logic checked `if (gpsHistory.length === 0)` before reloading cached data
- This prevented cached data from being reloaded if it was already loaded once
- Result: stale data displayed until manual refresh

**Fix Applied:**
- Changed fallback logic to **always** load cached data when API returns empty, regardless of current `gpsHistory` state
- Ensures the most recent cached data is displayed immediately
- Auto-refresh now works correctly from initial load

**New Behavior:**
- App shows latest available GPS data (live or cached) immediately on launch
- Auto-refresh works from first load
- Orange banner indicates when using cached data
- Manual refresh still available for immediate updates

### Issue: "No GPS data available"

**Causes:**
- Vehicle not turned on
- No cellular connection on device
- Device not sending GPS data
- Time range has no GPS points

**Solutions:**
1. Start vehicle (turn ignition ON)
2. Wait 30-60 seconds for GPS lock
3. Check device has good cellular signal
4. Tap recenter button to refresh

### Issue: Map centered on wrong location

**Causes:**
- Using cached old data
- User manually scrolled map
- GPS data not yet loaded

**Solutions:**
1. Tap green recenter button (📍)
2. Wait for GPS data to load
3. Check for orange/red status banner

### Issue: Trail not showing (only marker)

**Causes:**
- Vehicle is stationary (parked)
- Only 1-2 GPS points (not enough for trail)
- Speed data missing

**Solutions:**
- Normal behavior when parked
- Start driving to see trail appear
- Trail shows after ~3 GPS points collected

### Issue: GPS updates stopped

**Causes:**
- App in background too long (iOS restrictions)
- Token expired
- Backend API down

**Solutions:**
1. Bring app to foreground
2. Tap recenter to force refresh
3. Check for red error banner
4. Re-login if token expired

## Platform Support

### iOS ✅

- **Status:** WORKING
- **Location Permissions:** Required (asks on first map view)
- **Foreground Updates:** 30-second polling works in foreground
- **Background Updates:** 15-minute Background Fetch (system-managed)
- **Caching:** AsyncStorage working
- **Background Modes:** `fetch` and `location` enabled

### Android ⚠️

- **Status:** UNTESTED
- **Expected:** Should work (expo-background-fetch supports Android)
- **Background Updates:** Uses WorkManager (more flexible than iOS)
- **May Need:** 
  - `ACCESS_BACKGROUND_LOCATION` permission (Android 10+)
  - Battery optimization exemption for reliable background updates
  - Foreground service notification (for continuous tracking)

## Dependencies

```json
{
  "react-native-maps": "^1.10.0",
  "@react-native-async-storage/async-storage": "^1.21.0",
  "expo-location": "~16.5.5",
  "expo-background-fetch": "~14.1.3",
  "expo-task-manager": "~13.0.8"
}
```

## Background App Refresh Support ✅

**Status:** IMPLEMENTED (November 18, 2025)

The app now supports GPS tracking when running in the background, ensuring continuous location updates even when the user is not actively viewing the app.

### How It Works

The app uses two different GPS update strategies depending on app state:

#### **Foreground Mode** (App Active)
- **Polling Interval:** Every 30 seconds
- **Method:** JavaScript `setInterval` timer
- **Purpose:** Real-time updates for live map display
- **Battery Impact:** Moderate (frequent network calls)

#### **Background Mode** (App Backgrounded/Inactive)
- **Polling Interval:** Every 15 minutes (iOS minimum)
- **Method:** iOS Background Fetch API via `expo-background-fetch`
- **Purpose:** Periodic updates to keep cached GPS data fresh
- **Battery Impact:** Low (system-managed intervals)

### Architecture

```
App State Monitoring (AppState API)
    ↓
Detects: Active → Background transition
    ↓
Foreground Mode          Background Mode
    ↓                         ↓
setInterval (30s)       BackgroundFetch (15min)
    ↓                         ↓
fetchGpsData()          TaskManager.defineTask()
    ↓                         ↓
Update UI + Cache       Update Cache Only
```

### Implementation Details

**1. AppState Monitoring**

GPSContext listens for app state changes:

```typescript
useEffect(() => {
  const subscription = AppState.addEventListener('change', handleAppStateChange);
  return () => subscription.remove();
}, [isAuthenticated, authToken, user?.imei]);

const handleAppStateChange = async (nextAppState: AppStateStatus) => {
  if (nextAppState === 'active') {
    // App foregrounded - resume 30s polling
    setIsInBackground(false);
    await fetchGpsData(false); // Immediate refresh
  } else if (nextAppState.match(/inactive|background/)) {
    // App backgrounded - switch to BackgroundFetch
    setIsInBackground(true);
  }
};
```

**2. Background Task Registration**

Task is registered when user logs in:

```typescript
await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
  minimumInterval: 60 * 15, // 15 minutes (iOS minimum)
  stopOnTerminate: false,   // Continue after app closed
  startOnBoot: true,        // Start on device reboot
});
```

**3. Background Task Definition**

Task runs independently of app UI:

```typescript
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  // 1. Load auth credentials from AsyncStorage
  const { authToken, imei } = await loadCredentials();
  
  // 2. Fetch GPS data from API
  const gpsData = await fetchGpsFromBackend(authToken, imei);
  
  // 3. Cache data for app to use later
  await AsyncStorage.setItem(GPS_CACHE_KEY, JSON.stringify(gpsData));
  
  return BackgroundFetch.BackgroundFetchResult.NewData;
});
```

### iOS Configuration

**UIBackgroundModes** in `app.json`:

```json
{
  "ios": {
    "infoPlist": {
      "UIBackgroundModes": [
        "fetch",      // Enable Background App Refresh
        "location"    // Enable background location updates
      ]
    }
  }
}
```

**Required Permissions:**
- `NSLocationAlwaysUsageDescription` - For background location access
- `NSLocationWhenInUseUsageDescription` - For foreground location access

### Android Support

Android background fetch works differently:

- Uses **WorkManager** instead of BackgroundFetch
- Can schedule more frequent updates (no 15-minute minimum)
- Requires `ACCESS_BACKGROUND_LOCATION` permission (Android 10+)

**Note:** Android implementation follows same pattern but with platform-specific optimizations.

### Limitations & Considerations

#### **iOS Restrictions**

1. **15-Minute Minimum:** iOS enforces a minimum 15-minute interval for background fetch
2. **System-Controlled:** iOS decides *when* to actually run your background task based on:
   - App usage patterns
   - Battery level
   - Network conditions
   - Time of day
3. **Not Guaranteed:** Background tasks may be delayed or skipped if system is under load
4. **Battery Considerations:** iOS may reduce background refresh frequency for low battery

#### **Why 15 Minutes?**

Apple restricts background fetch to preserve battery life. The system analyzes your app's usage patterns and schedules fetch operations accordingly. Apps that are used frequently get more background time.

#### **Testing Background Fetch**

**⚠️ Background Fetch is Hard to Test:**

```bash
# Simulate background fetch (iOS Simulator/Device)
xcrun simctl spawn booted notify_post com.apple.BackgroundTaskManagementAgent.fetch

# Or use Xcode debug menu:
Debug > Simulate Background Fetch
```

**Real-World Testing:**
1. Build app in production mode (background fetch doesn't work reliably in debug)
2. Run app, then background it
3. Wait 15+ minutes (or iOS decides)
4. Check logs to see if task executed

### Battery Impact

**Foreground (30s polling):**
- ~120 API calls per hour
- Moderate battery drain
- Acceptable for active use

**Background (15min polling):**
- ~4 API calls per hour
- Minimal battery drain
- System-managed throttling

**Compared to Alternatives:**
- ✅ Better than: Continuous background location tracking
- ✅ Better than: Push notifications for every GPS update
- ⚖️ Similar to: Native weather/fitness apps

### Credentials Storage

Background tasks run outside React context, so credentials are stored in AsyncStorage:

```typescript
// Stored on login
await AsyncStorage.setItem(GPS_CREDENTIALS_KEY, JSON.stringify({
  authToken: 'jwt_token_here',
  imei: '865509052362369',
}));

// Retrieved in background task
const credentials = await AsyncStorage.getItem(GPS_CREDENTIALS_KEY);
```

**Security Note:** AsyncStorage is encrypted on iOS by default when device is locked.

### User Experience

**What Users See:**

1. **App Active:**
   - GPS updates every 30 seconds
   - Live trail on map
   - Real-time marker movement

2. **App Backgrounded:**
   - No UI updates (app not visible)
   - GPS data cached every 15 minutes
   - Fresh data ready when app reopens

3. **App Reopened:**
   - Immediate load from cache (last known location)
   - Fresh API fetch triggered within 1 second
   - Map updates with latest data

### Debugging Background Fetch

**Console Logs:**

```
🌙 [BackgroundFetch] GPS background task triggered
🌙 [BackgroundFetch] Fetching GPS data for IMEI: 865509052362369
✅ [BackgroundFetch] Cached 45 GPS points
```

**Check Task Registration:**

```typescript
const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
console.log('Background task registered:', isRegistered);
```

**Check Task Status:**

```typescript
const status = await BackgroundFetch.getStatusAsync();
console.log('BackgroundFetch status:', status);
// 0 = Disabled
// 1 = Available
// 2 = Restricted (Low Power Mode)
```

### Future Enhancements

1. **Adaptive Polling:** Adjust background interval based on vehicle movement
2. **Geofence Triggers:** Wake app when vehicle enters/exits zones
3. **Push Wake-Up:** Backend can trigger immediate GPS fetch via push notification
4. **Location Tracking:** Use native location services instead of polling API

---

## Future Enhancements

### Planned Features

1. **Trip History View**
   - List of past trips
   - Tap to view route on map
   - Distance/speed stats

2. **Geofencing**
   - Define zones on map
   - Alerts when vehicle enters/exits
   - Home, work, school zones

3. **Route Replay**
   - Animated playback of past trips
   - Speed indicators
   - Time slider

4. **Offline Mode**
   - Download map tiles
   - Queue GPS updates
   - Sync when online

5. **Multi-Device Support**
   - Show multiple vehicles on one map
   - Switch between devices
   - Fleet view

## Testing Checklist

- [ ] GPS data loads on app launch
- [ ] Map centers on vehicle location
- [ ] Trail appears after driving
- [ ] Speed colors update correctly
- [ ] Stationary detection works (trail hides when parked)
- [ ] Recenter button works
- [ ] Auto-refresh updates every 30 seconds (foreground)
- [ ] Background fetch registered on login
- [ ] App switches to background mode when backgrounded
- [ ] App resumes foreground polling when foregrounded
- [ ] Cached data loads when offline
- [ ] Status banners show correctly
- [ ] Token expiration triggers logout
- [ ] Trip boundaries detected (20+ minute gaps)
- [ ] Trips saved to cache
- [ ] Zoom controls work
- [ ] Map gestures work (pinch, drag, rotate)
- [ ] Background fetch updates cache (15+ min intervals)
- [ ] GPS data fresh when app reopened from background

## Credits

**Backend API:** Gardi GPS Service  
**Map Provider:** Google Maps (via react-native-maps)  
**Location Services:** Expo Location  
**Storage:** AsyncStorage

---

**Last Updated:** November 18, 2025  
**Status:** ✅ WORKING - Real-time GPS tracking with foreground/background refresh fully functional on iOS
