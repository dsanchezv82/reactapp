import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useTheme } from '../contexts/ThemeContext';
import ThemedText from './ThemedText';

interface LiveVideoPlayerProps {
  imei: string;
  authToken: string;
  organizationId: string;
  cameraId: number; // 1: road-facing, 2: in-cab, 51-54: auxiliary
  protocol?: 'hls' | 'webrtc'; // Default: webrtc
  onClose?: () => void;
  onError?: (error: string) => void;
}

/**
 * LiveVideoPlayer - SurfSight Live Video Component for React Native
 * 
 * Embeds the SurfSight live video player using WebView for iOS and Android.
 * Supports both HLS and WebRTC streaming protocols.
 * 
 * Required props:
 * - imei: Device IMEI number
 * - authToken: SurfSight authentication token (from login)
 * - organizationId: Organization ID for the device
 * - cameraId: Camera lens ID (1=road, 2=in-cab, 51-54=auxiliary)
 * 
 * Optional props:
 * - protocol: 'hls' or 'webrtc' (default: webrtc)
 * - onClose: Callback when user closes the player
 * - onError: Callback for error handling
 * 
 * @see https://developer.surfsight.net/developer-portal/components/component-live-video/
 */
export default function LiveVideoPlayer({
  imei,
  authToken,
  organizationId,
  cameraId,
  protocol = 'webrtc',
  onClose,
  onError,
}: LiveVideoPlayerProps) {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  // Generate the HTML content with SurfSight component
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: ${theme.isDark ? '#000000' : '#FFFFFF'};
    }
    #video-container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    lytx-live-video {
      width: 100%;
      height: 100%;
    }
  </style>
  <!-- SurfSight Cloud-Hosted UI Components (US) -->
  <script type="module" src="https://ui-components.surfsight.net/latest/build/cloud-ui-components.esm.js"></script>
</head>
<body>
  <div id="video-container">
    <lytx-live-video
      auth-token="${authToken}"
      imei="${imei}"
      camera-id="${cameraId}"
      organization-id="${organizationId}"
      protocol-settings="${protocol}"
      fullscreen="true"
      close-player="true"
      lens-name="true"
      device-name="true"
      live-label="true"
    ></lytx-live-video>
  </div>

  <script>
    // Setup communication with React Native
    const liveVideoElement = document.querySelector('lytx-live-video');
    
    if (liveVideoElement) {
      // Handle close event
      liveVideoElement.addEventListener('close', (event) => {
        console.log('Live video closed:', event);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'close',
          data: event.detail
        }));
      });

      // Handle component errors
      liveVideoElement.addEventListener('componentError', (event) => {
        console.error('Live video error:', event);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'error',
          data: event.detail || 'Unknown error occurred'
        }));
      });

      // Notify when component loads successfully
      setTimeout(() => {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'ready',
          data: 'Live video component loaded'
        }));
      }, 1000);
    } else {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error',
        data: 'Failed to initialize live video component'
      }));
    }

    // Log any console errors for debugging
    window.addEventListener('error', (event) => {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error',
        data: event.message || 'JavaScript error occurred'
      }));
    });
  </script>
</body>
</html>
  `.trim();

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      console.log('📹 Live video message:', message);

      switch (message.type) {
        case 'ready':
          setLoading(false);
          setError(null);
          console.log('✅ Live video player ready');
          break;

        case 'close':
          console.log('🔒 Live video closed by user');
          setLoading(false);
          onClose?.();
          break;

        case 'error':
          const errorMsg = typeof message.data === 'string' 
            ? message.data 
            : message.data?.message || 'Unknown error';
          
          console.error('❌ Live video error:', errorMsg);
          setError(errorMsg);
          setLoading(false);
          
          onError?.(errorMsg);
          
          // Show user-friendly error alert
          Alert.alert(
            'Live Video Error',
            errorMsg,
            [{ text: 'OK', onPress: onClose }]
          );
          break;

        default:
          console.log('📹 Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('❌ Failed to parse WebView message:', error);
    }
  };

  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('❌ WebView error:', nativeEvent);
    
    const errorMsg = 'Failed to load live video player. Please check your connection.';
    setError(errorMsg);
    setLoading(false);
    onError?.(errorMsg);
  };

  const handleLoadEnd = () => {
    console.log('📹 WebView finished loading');
    // Keep loading state until we get 'ready' message from component
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.isDark ? '#000' : '#FFF' }]}>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Loading live video...</ThemedText>
        </View>
      )}
      
      {error && (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorText}>⚠️ {error}</ThemedText>
        </View>
      )}

      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        onMessage={handleMessage}
        onError={handleError}
        onLoadEnd={handleLoadEnd}
        // iOS specific
        allowsFullscreenVideo={true}
        scrollEnabled={false}
        bounces={false}
        // Android specific
        mixedContentMode="always"
        androidLayerType="hardware"
        // Security
        originWhitelist={['*']}
        // Performance
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#FFFFFF',
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    zIndex: 999,
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    lineHeight: 24,
  },
});
