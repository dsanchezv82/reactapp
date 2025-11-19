# Live Video Streaming Setup

## Final Solution ✅

**Status:** WORKING - Live video streaming successfully implemented!

The app now streams live video from SurfSight dashcams using the `lytx-live-video` web component served via a local HTTP server.

### Architecture

```
React Native App
    ↓
LiveVideoPlayer.tsx
    ↓
Local HTTP Server (react-native-static-server)
    ↓ Serves HTML on http://localhost:PORT
WebView
    ↓ Loads lytx-live-video component
SurfSight Web Component
    ↓ Uses iOS native WebRTC (built into WKWebView)
WebRTC Connection to SurfSight Servers
    ↓
Live Video Stream 🎥
```

### Key Components

1. **Local HTTP Server**
   - Package: `react-native-static-server`
   - Serves HTML from Documents directory on random port
   - Provides proper `http://localhost:PORT` origin

2. **Embedded HTML Content**
   - HTML string embedded in `LiveVideoPlayer.tsx`
   - Written to Documents directory on component mount
   - Loads SurfSight's `lytx-live-video` web component

3. **WebView**
   - Package: `react-native-webview`
   - Loads HTML from local server
   - Passes credentials via `postMessage()`

4. **iOS Native WebRTC**
   - WKWebView (iOS 14.3+) has built-in WebRTC support
   - No custom native code needed
   - Web component handles all WebRTC directly

### Dependencies

```json
{
  "react-native-webview": "^13.6.3",
  "react-native-static-server": "^0.5.0",
  "react-native-fs": "^2.20.0"
}
```

## Problem History & Debugging Journey

### Initial Approach: Direct WebView (❌ Failed)

**Attempt:** Load `lytx-live-video` component directly in WebView using `file://` URL

**Problem:** 
```javascript
// Inside lytx-live-video component source:
if (window.location.origin === null) {
  return; // Early return - component doesn't initialize!
}
```

**Result:** Component loaded but didn't initialize. Origin check failed because `file://` URLs have `null` origin.

**Logs:**
```
🌐 Page loaded with origin: null
❌ Component not initializing - origin check failed
```

---

### Attempt 2: JavaScript Origin Spoofing (❌ Failed)

**Approach:** Try to override `window.location.origin` with JavaScript

**Code Tried:**
```javascript
Object.defineProperty(window.location, 'origin', {
  value: 'http://localhost',
  writable: true
});
```

**Problem:** `window.location.origin` is non-configurable property

**Result:** 
```
❌ TypeError: Cannot redefine property: origin
```

---

### Attempt 3: Native WebRTC Implementation (❌ Failed)

**Approach:** Build native WebRTC implementation using `react-native-webrtc` package

**Created:** `NativeLiveVideo.tsx` component with:
- RTCPeerConnection
- WebSocket signaling
- Manual ICE candidate handling
- SDP offer/answer exchange

**Problem:** Couldn't determine SurfSight's WebSocket URL format

**Tested URLs (all returned HTTP 400):**
```
❌ wss://prodmedia-us-03.surfsolutions.com/
❌ wss://prodmedia-us-03.surfsolutions.com/?token=...&imei=...&cameraId=...
❌ wss://prodmedia-us-03.surfsolutions.com/media/{imei}/{cameraId}/{token}
❌ wss://prodmedia-us-03.surfsolutions.com/{token}
```

**Error:**
```
❌ WebSocket failed during handshake
❌ Received bad response code from server: 400
Close code: 1006 (abnormal closure)
```

**Conclusion:** SurfSight uses proprietary WebSocket protocol with no public documentation. Reverse-engineering not feasible.

---

### Attempt 4: Bundle Asset Copy (❌ Failed)

**Approach:** Copy HTML file from app bundle to Documents directory, serve via local HTTP server

**Code:**
```typescript
const htmlSource = `${RNFS.MainBundlePath}/assets/lytx-live-video.html`;
const htmlDest = `${RNFS.DocumentDirectoryPath}/lytx-live-video.html`;
await RNFS.copyFile(htmlSource, htmlDest);
```

**Problem:** File not found in bundle even though `assetBundlePatterns: ["**/*"]` was set

**Error:**
```
❌ Failed to start local server: [Error: The file "lytx-live-video.html" 
couldn't be opened because there is no such file.]
```

---

### Final Solution: Embedded HTML + Local HTTP Server (✅ SUCCESS!)

**Approach:** Embed HTML as string constant, write to Documents, serve via local HTTP server

**Implementation:**

1. **HTML Content Embedded in Component:**
```typescript
const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <base href="https://api-prod.surfsight.net/">
  <script type="module" src="https://ui-components.surfsight.net/latest/build/cloud-ui-components.esm.js"></script>
</head>
<body>
  <lytx-live-video id="camera-road" camera-id="1"></lytx-live-video>
  <lytx-live-video id="camera-cabin" camera-id="2"></lytx-live-video>
  <script>
    // Initialize cameras with credentials from React Native
    // Auto-click "Continue watching" button after 30s timeout
  </script>
</body>
</html>`;
```

2. **Write HTML to Documents:**
```typescript
const htmlDest = `${RNFS.DocumentDirectoryPath}/lytx-live-video.html`;
await RNFS.writeFile(htmlDest, htmlContent, 'utf8');
```

3. **Start Local HTTP Server:**
```typescript
server = new StaticServer(0, RNFS.DocumentDirectoryPath); // Port 0 = random
const url = await server.start(); // Returns http://localhost:XXXXX
```

4. **Load in WebView:**
```typescript
<WebView 
  source={{ uri: `${serverUrl}/lytx-live-video.html` }}
  injectedJavaScript={`
    window.postMessage({
      type: 'INIT_LIVE_VIDEO',
      imei: '${imei}',
      familyId: ${familyId},
      authToken: '${surfsightJwt}'
    });
  `}
/>
```

**Why This Works:**

1. ✅ HTML served from `http://localhost:PORT` (not `file://`)
2. ✅ `window.location.origin = "http://localhost:PORT"` (not null!)
3. ✅ Component's origin check passes
4. ✅ Component creates WebSocket connection to SurfSight
5. ✅ iOS WKWebView has native WebRTC support
6. ✅ Video streams successfully! 🎉

**Success Logs:**
```
🌐 Starting local HTTP server...
📋 Writing HTML file to: /path/to/Documents/lytx-live-video.html
✅ HTML file written
✅ Local server started: http://localhost:54321
📄 HTML loaded from local server
🌐 Page loaded with origin: http://localhost:54321
🌐 Origin is null? false  ← KEY SUCCESS!
✅ Origin check should pass: true
✅ Cameras initialized with origin: http://localhost:54321
🔌 WebSocket connecting to SurfSight...
✅ WebSocket connected!
🎥 Video streaming started!
```

## Features

### Auto-Reconnect

The component automatically clicks the "Continue watching" button when it appears after 30 seconds:

```javascript
function setupAutoContinue(cameraElement) {
  const observer = new MutationObserver(() => {
    const shadowRoot = cameraElement.shadowRoot;
    if (shadowRoot) {
      const continueButton = shadowRoot.querySelector('button');
      if (continueButton && continueButton.textContent.includes('Continue')) {
        console.log('🔄 Auto-clicking Continue watching button');
        continueButton.click();
      }
    }
  });
  observer.observe(cameraElement, { childList: true, subtree: true });
}
```

### Dual Camera Support

- **Camera 1:** Road-facing lens (front view)
- **Camera 2:** In-cabin lens (driver view)

Both cameras stream simultaneously in split-screen layout.

### Resource Usage

**Local HTTP Server:**
- Memory: ~1-2 MB
- CPU: Nearly 0% when idle
- Network: Zero (localhost only)
- Battery: Negligible

The server just serves HTML once, then sits idle. All video streaming happens directly between the web component and SurfSight servers.

## API Integration

### Backend Endpoints

**Get SurfSight JWT:**
```
GET /api/devices/{imei}/live-stream-info
Authorization: Bearer {gardiAuthToken}

Response:
{
  "lytxLiveVideoProps": {
    "surfsightJwt": "eyJhbGciOiJIUzI1...",
    "familyId": 56028
  }
}
```

**Wake Device (if in standby):**
```
POST /api/devices/{imei}/wake-up
Authorization: Bearer {gardiAuthToken}

Response: 200 OK
```

### Test Device

- **IMEI:** 865509052362369
- **Name:** "Sanchez Rogue"
- **Organization ID:** 56028
- **User ID:** 36383

## Files

### Primary Implementation

- **`components/LiveVideoPlayer.tsx`** - Main live video component
  - Starts local HTTP server
  - Writes HTML to Documents directory
  - Renders WebView
  - Handles credentials and auto-reconnect

### Reference (Not Used)

- **`components/NativeLiveVideo.tsx`** - Attempted native WebRTC implementation (kept for reference)
- **`assets/lytx-live-video.html`** - Original HTML file (not used, HTML now embedded in component)

## Platform Support

### iOS ✅

- **Minimum Version:** iOS 14.3+
- **WebView:** WKWebView with native WebRTC support
- **Status:** WORKING

### Android ⚠️

- **Status:** UNTESTED
- **Expected:** Should work (Android WebView has WebRTC support since Android 5.0)
- **May Need:** Additional WebView configuration for permissions

## Production Deployment

### Development vs Production

**Development Build (Current):**
- Expo dev client screen on launch
- Metro bundler required
- Hot reload enabled
- Dev tools accessible

**Production Build (For Distribution):**
- No dev client screen
- Standalone app
- Optimized bundle
- No development tools

### Build Commands

**Production Build:**
```bash
# Using EAS Build
eas build --platform ios --profile production
eas build --platform android --profile production

# Or local build
npx expo run:ios --configuration Release
npx expo run:android --variant release
```

## Troubleshooting

### Video Not Loading

1. **Check device status:**
   ```bash
   node /Users/danielsanchez/Desktop/backend-mcp/check-device-status.js
   ```
   - Should show: "Status: online"
   - If "Status: standby", tap "Wake Up Device"

2. **Check server startup:**
   - Look for: `✅ Local server started: http://localhost:...`
   - If missing, check RNFS permissions

3. **Check origin:**
   - Look for: `🌐 Origin is null? false`
   - If true, server didn't start correctly

4. **Check credentials:**
   - SurfSight JWT expires after 30 minutes
   - If expired, close and reopen Live Video screen

### Video Stops After 30 Seconds

- Auto-reconnect should handle this
- Check for: `🔄 Auto-clicking Continue watching button`
- If missing, `MutationObserver` may not be working

### Android Issues (If Occur)

May need to add WebView permissions:

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

## Key Learnings

1. **iOS WKWebView has native WebRTC** - No custom native code needed
2. **Origin matters** - Web components check `window.location.origin`
3. **Local HTTP server** - Elegant solution to provide proper origin
4. **Embedded HTML** - More reliable than bundle assets
5. **SurfSight protocol is proprietary** - Can't reverse-engineer, must use their component

## Credits

**SurfSight Web Components:**
- https://ui-components.surfsight.net/latest/build/cloud-ui-components.esm.js
- https://developer.surfsight.net/developer-portal/components/component-live-video/

**Packages:**
- react-native-webview
- react-native-static-server  
- react-native-fs

---

**Last Updated:** November 17, 2025  
**Status:** ✅ WORKING - Live video streaming fully functional on iOS
