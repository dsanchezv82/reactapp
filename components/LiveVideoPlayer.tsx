import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useTheme } from '../contexts/ThemeContext';
import ThemedText from './ThemedText';

const API_BASE_URL = 'https://api.garditech.com/api';

interface LiveVideoPlayerProps {
  imei: string;
  authToken: string; // Gardi auth token for API calls
  cameraId: number; // 1: road-facing, 2: in-cab
  onClose?: () => void;
  onError?: (error: string) => void;
}

interface LiveStreamInfo {
  lytxLiveVideoProps: {
    surfsightJwt: string;
    familyId: number;
  };
}

/**
 * LiveVideoPlayer - SurfSight Live Video Component for React Native
 * 
 * Uses the lytx-live-video web component (same as web app).
 * Fetches SurfSight JWT from backend using IMEI.
 */
export default function LiveVideoPlayer({
  imei,
  authToken,
  cameraId,
  onClose,
  onError,
}: LiveVideoPlayerProps) {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamInfo, setStreamInfo] = useState<LiveStreamInfo['lytxLiveVideoProps'] | null>(null);
  const { theme } = useTheme();

  // Fetch SurfSight JWT and family ID from backend
  useEffect(() => {
    const fetchStreamInfo = async () => {
      try {
        console.log('🎥 Fetching live stream info for IMEI:', imei);
        
        const response = await fetch(
          `${API_BASE_URL}/devices/${imei}/live-stream-info`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Failed to fetch stream info:', response.status, errorText);
          throw new Error('Failed to get live stream credentials');
        }

        const data: LiveStreamInfo = await response.json();
        console.log('✅ Stream info received, familyId:', data.lytxLiveVideoProps.familyId);
        console.log('🔑 SurfSight JWT:', data.lytxLiveVideoProps.surfsightJwt);
        console.log('🔑 SurfSight JWT length:', data.lytxLiveVideoProps.surfsightJwt.length);
        console.log('🔑 Gardi JWT (authToken):', authToken);
        console.log('🔑 Gardi JWT length:', authToken.length);
        console.log('🔍 Are they different?', data.lytxLiveVideoProps.surfsightJwt !== authToken);
        setStreamInfo(data.lytxLiveVideoProps);
        setLoading(false);
      } catch (err: any) {
        console.error('❌ Stream info error:', err);
        const errorMsg = 'Unable to connect to live video. The device may be offline or in standby mode.\n\n• Start the vehicle (turn ignition ON)\n• Wait 30-60 seconds\n• Ensure good cellular signal';
        setError(errorMsg);
        setLoading(false);
        onError?.(errorMsg);
      }
    };

    fetchStreamInfo();
  }, [imei, authToken, cameraId, onClose, onError]);

  // Build HTML with lytx-live-video component (same as web app)
  const buildLiveVideoHTML = (info: LiveStreamInfo['lytxLiveVideoProps']) => {
    return `
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
      background-color: #000000;
    }
    #video-container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
    }
    .camera-view {
      flex: 1;
      position: relative;
      border-radius: 8px;
      overflow: hidden;
    }
    lytx-live-video {
      width: 100%;
      height: 100%;
    }
    .camera-label {
      position: absolute;
      top: 8px;
      left: 8px;
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 600;
      z-index: 10;
    }
  </style>
  <!-- SurfSight Cloud-Hosted UI Components (US) -->
  <script type="module" src="https://ui-components.surfsight.net/latest/build/cloud-ui-components.esm.js"></script>
</head>
<body>
  <div id="video-container">
    <!-- Road-Facing Camera -->
    <div class="camera-view">
      <div class="camera-label">🚗 Road</div>
      <lytx-live-video
        auth-token="${info.surfsightJwt}"
        imei="${imei}"
        camera-id="1"
        organization-id="${info.familyId}"
        protocol-settings="webrtc"
        fullscreen="false"
        close-player="false"
        lens-name="false"
        device-name="false"
        live-label="true"
      ></lytx-live-video>
    </div>
    
    <!-- In-Cabin Camera -->
    <div class="camera-view">
      <div class="camera-label">👤 In-Cabin</div>
      <lytx-live-video
        auth-token="${info.surfsightJwt}"
        imei="${imei}"
        camera-id="2"
        organization-id="${info.familyId}"
        protocol-settings="webrtc"
        fullscreen="false"
        close-player="false"
        lens-name="false"
        device-name="false"
        live-label="true"
      ></lytx-live-video>
    </div>
  </div>

  <script>
    // Capture all console logs and send to React Native
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    console.log = function(...args) {
      originalConsoleLog.apply(console, args);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'console_log',
          data: args.map(a => String(a)).join(' ')
        }));
      }
    };

    console.error = function(...args) {
      originalConsoleError.apply(console, args);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'console_error',
          data: args.map(a => String(a)).join(' ')
        }));
      }
    };

    console.warn = function(...args) {
      originalConsoleWarn.apply(console, args);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'console_warn',
          data: args.map(a => String(a)).join(' ')
        }));
      }
    };

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
        console.error('Live video component error:', event);
        console.error('Error detail:', event.detail);
        console.error('Error detail type:', typeof event.detail);
        console.error('Error detail keys:', event.detail ? Object.keys(event.detail) : 'none');
        console.error('Error detail.error:', event.detail?.error);
        console.error('Error detail.message:', event.detail?.message);
        console.error('Error data:', JSON.stringify(event.detail));
        
        // Extract the actual error message from the event
        let errorMessage = 'Unknown error occurred';
        if (event.detail) {
          if (typeof event.detail === 'string') {
            errorMessage = event.detail;
          } else if (event.detail.error) {
            errorMessage = event.detail.error;
          } else if (event.detail.message) {
            errorMessage = event.detail.message;
          }
        }
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'error',
          data: errorMessage
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
    `;
  };

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('📹 Live video message:', message.type);

      switch (message.type) {
        case 'console_log':
          console.log('🌐 WebView:', message.data);
          break;

        case 'console_error':
          console.error('🌐 WebView Error:', message.data);
          break;

        case 'console_warn':
          console.warn('🌐 WebView Warning:', message.data);
          break;

        case 'ready':
          console.log('✅ Live video player ready');
          break;

        case 'close':
          console.log('🔒 Live video closed by user');
          onClose?.();
          break;

        case 'error':
          const errorData = message.data;
          let errorMsg = 'Unknown error';
          
          // Extract error message from various formats
          if (typeof errorData === 'string') {
            errorMsg = errorData;
          } else if (errorData?.message) {
            errorMsg = errorData.message;
          } else if (errorData?.error) {
            errorMsg = errorData.error;
          }
          
          console.error('❌ Live video error:', errorMsg);
          
          // Provide user-friendly error messages
          let userMessage = errorMsg;
          let shouldCloseModal = false;
          
          if (errorMsg.includes('DeviceStandby') || errorMsg.includes('standby')) {
            userMessage = 'Camera is Starting Up\n\nThe device is powering on. This usually takes 2-3 minutes after starting the vehicle.\n\n• Wait a few minutes for the device to fully boot\n• Ensure the device has cellular signal\n• Tap "Retry" to check again\n\nIf the car has been running for more than 5 minutes, the device may need servicing.';
            // Stay in modal for standby
          } else if (errorMsg.includes('DeviceOffline') || errorMsg.includes('offline')) {
            userMessage = 'Camera is Offline\n\nThe device is not connected to the internet. Check that:\n\n• The device has power\n• Cellular connection is active\n• Device is not in a signal dead zone';
            shouldCloseModal = true;
          } else if (errorMsg.includes('canceled') || errorMsg.includes('ERR_CANCELED')) {
            userMessage = 'Unable to Connect\n\nThe device may be offline or in standby mode.';
            shouldCloseModal = true;
          } else if (errorMsg.includes('timeout')) {
            userMessage = 'Connection Timeout\n\nPlease check your internet connection and try again.';
            shouldCloseModal = true;
          } else if (errorMsg.includes('authentication') || errorMsg.includes('auth')) {
            userMessage = 'Authentication Failed\n\nPlease log out and log back in.';
            shouldCloseModal = true;
          } else {
            userMessage = `Live Video Unavailable\n\n${errorMsg}`;
            shouldCloseModal = true;
          }
          
          setError(userMessage);
          setLoading(false);
          setStreamInfo(null); // Clear stream info on error
          onError?.(userMessage);
          break;

        default:
          console.log('📹 Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('❌ Failed to parse WebView message:', error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      <TouchableOpacity 
        style={styles.closeButton}
        onPress={onClose}
      >
        <ThemedText style={styles.closeButtonText}>✕ Close</ThemedText>
      </TouchableOpacity>

      {loading && !streamInfo && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Preparing live video...</ThemedText>
        </View>
      )}
      
      {error && (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorTitle}>⚠️ Camera Unavailable</ThemedText>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          
          {/* Retry Button */}
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              setLoading(true);
              setStreamInfo(null);
              // Re-fetch to retry
              fetch(`${API_BASE_URL}/devices/${imei}/live-stream-info`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
              })
                .then(res => res.json())
                .then(data => {
                  setStreamInfo(data.lytxLiveVideoProps);
                  setLoading(false);
                })
                .catch(err => {
                  setError('Failed to reconnect. Please try again.');
                  setLoading(false);
                });
            }}
          >
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </TouchableOpacity>
        </View>
      )}

      {streamInfo && !error && (
        <WebView
          ref={webViewRef}
          source={{ html: buildLiveVideoHTML(streamInfo) }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          onMessage={handleMessage}
          allowsFullscreenVideo={true}
          scrollEnabled={false}
          bounces={false}
          mixedContentMode="always"
          androidLayerType="hardware"
          originWhitelist={['*']}
          cacheEnabled={true}
          cacheMode="LOAD_DEFAULT"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 2000,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
