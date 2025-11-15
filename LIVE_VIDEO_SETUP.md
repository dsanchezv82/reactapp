# SurfSight Live Video Integration

## ✅ Installation Complete

The SurfSight live video player has been successfully integrated into your React Native app and is accessible via the **Live Stream button** on the LandingScreen map.

## 📁 Files Created/Modified

1. **`components/LiveVideoPlayer.tsx`** - WebView-based player component
2. **`screens/LandingScreen.tsx`** - Added Modal with live video player (triggered by existing 📹 button)

## 🚀 How to Use

### Access Live Video

Simply tap the **teal camera button** (📹) in the bottom-right corner of the LandingScreen map. The button will:

1. Check if your device (IMEI) is configured
2. Open a fullscreen modal with the SurfSight live video player
3. Default to the road-facing camera (camera ID: 1)
4. Use WebRTC protocol for lowest latency

## 📋 Required Data

The live video player requires these values from your user object:

- **`user.imei`** - Device IMEI number (already in AuthContext)
- **`authToken`** - SurfSight authentication token (from login)
- **`user.familyId`** - Organization ID (already in AuthContext)

## 🎥 Camera IDs

- `1` - Road-facing camera
- `2` - In-cab camera
- `51-54` - Auxiliary cameras (if available)

## 🌐 Streaming Protocols

Two protocols are supported:

1. **WebRTC (Recommended)** ⚡
   - Lower latency
   - Better for real-time monitoring
   - Requires stable connection

2. **HLS** 📶
   - More compatible
   - Better for slower connections
   - Slightly higher latency

## 🔧 Configuration

The LiveVideoPlayer component accepts these props:

```tsx
<LiveVideoPlayer
  imei={string}              // Required: Device IMEI
  authToken={string}          // Required: SurfSight auth token
  organizationId={string}     // Required: Organization/Family ID
  cameraId={number}           // Required: Camera lens ID (1, 2, 51-54)
  protocol={'webrtc'|'hls'}  // Optional: Streaming protocol (default: webrtc)
  onClose={() => void}        // Optional: Callback when user closes player
  onError={(error) => void}   // Optional: Callback for error handling
/>
```

## 🎨 Features Included

✅ Camera selection UI (road-facing, in-cab)
✅ Protocol selection (WebRTC, HLS)
✅ Full-screen video player
✅ Loading states
✅ Error handling with user-friendly messages
✅ Dark mode support
✅ Close button functionality
✅ Device offline/standby detection
✅ Automatic connection management

## 🐛 Error Handling

The player automatically handles:

- Device offline/standby mode
- Invalid IMEI or camera ID
- Network connection issues
- Authentication errors
- Component loading failures

Errors are displayed to the user with helpful messages and automatically close the player.

## 📱 Platform Support

✅ **iOS** - Full support with native fullscreen
✅ **Android** - Full support with hardware acceleration

## 🔗 SurfSight Documentation

- [Live Video Component](https://developer.surfsight.net/developer-portal/components/component-live-video/)
- [Cloud-Hosted Installation](https://developer.surfsight.net/developer-portal/components/reusable-option1/)
- [Component Parameters](https://developer.surfsight.net/developer-portal/components/component-live-video/#video-component-parameters)

## 🎯 Next Steps

1. **Test the integration:**
   ```bash
   npx expo run:ios
   # or
   npx expo run:android
   ```

2. **Add navigation button** to one of your screens (see examples above)

3. **Test with real device:**
   - Ensure device (IMEI) is online
   - Verify auth token is valid
   - Check organization ID is correct

4. **Customize UI** (optional):
   - Modify `LiveVideoScreen.tsx` styling
   - Add more camera options if you have auxiliary cameras
   - Customize error messages

## ⚠️ Important Notes

- **Device must be online** for live streaming to work
- **Requires active internet connection** on mobile device
- **Auth token** must be valid (automatically managed by AuthContext)
- **IMEI must be registered** in SurfSight system
- **SurfSight component** is loaded from their CDN (always up-to-date)

## 🔐 Security

- Uses HTTPS for all connections
- WebView security policies enforced
- Auth token passed securely to SurfSight component
- No credentials stored in WebView

## 📞 Support

If you encounter issues:

1. Check device is online in SurfSight portal
2. Verify IMEI is correct in user object
3. Check auth token is valid (re-login if needed)
4. Review browser console logs in WebView
5. Contact SurfSight support: developer-surfsight@surfsight.com
