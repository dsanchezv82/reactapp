import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import RNFS from 'react-native-fs';
import StaticServer from 'react-native-static-server';
import { WebView } from 'react-native-webview';
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
 * Uses native WebRTC implementation to connect to SurfSight media servers.
 * Fetches SurfSight JWT from backend using IMEI.
 */
export default function LiveVideoPlayer({
  imei,
  authToken,
  cameraId,
  onClose,
  onError,
}: LiveVideoPlayerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamInfo, setStreamInfo] = useState<LiveStreamInfo['lytxLiveVideoProps'] | null>(null);
  const [wakingUp, setWakingUp] = useState(false);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const { theme } = useTheme();

  // Wake up the camera from standby mode
  const wakeUpCamera = async () => {
    try {
      setWakingUp(true);
      console.log('⏰ Waking up camera for IMEI:', imei);
      
      const response = await fetch(
        `${API_BASE_URL}/devices/${imei}/wake-up`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`Wake-up failed: ${response.status} - ${responseText}`);
      }

      console.log('✅ Wake-up command sent successfully');
      
      // Wait 5 seconds then retry fetching stream info
      setTimeout(() => {
        console.log('🔄 Retrying stream connection after wake-up...');
        setError(null);
        setLoading(true);
        setWakingUp(false);
        fetchStreamInfo();
      }, 5000);
      
    } catch (err: any) {
      console.error('❌ Wake-up error:', err);
      setWakingUp(false);
      
      // Provide helpful error message
      let userMessage = 'Unable to send wake-up command.';
      if (err.message && err.message.includes('500')) {
        userMessage = 'The wake-up command could not be completed. This may be because:\n\n• The device doesn\'t support remote wake-up\n• The camera is already powering on\n• There\'s a temporary connectivity issue\n\nTry starting the vehicle to wake the camera, or tap Retry in a few moments.';
      } else if (err.message && err.message.includes('401')) {
        userMessage = 'Authentication expired. Please log out and log back in.';
      } else if (err.message && err.message.includes('404')) {
        userMessage = 'Device not found. Please contact support.';
      } else if (err.message && err.message.includes('timeout')) {
        userMessage = 'Request timed out. Please check your internet connection and try again.';
      }
      
      setError(userMessage);
    }
  };

  // Fetch SurfSight JWT and family ID from backend
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
      console.log('✅ Stream info received');
      console.log('📋 Family ID:', data.lytxLiveVideoProps.familyId);
      console.log('🔑 SurfSight JWT obtained');
      
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

  // Start local HTTP server and fetch stream info on component mount
  useEffect(() => {
    let server: any = null;
    
    const startServer = async () => {
      try {
        console.log('🌐 Starting local HTTP server...');
        
        // HTML content embedded as string
        const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <base href="https://api-prod.surfsight.net/">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta http-equiv="Feature-Policy" content="camera 'self'; microphone 'self'; display-capture 'self'">
  <meta http-equiv="Permissions-Policy" content="camera=*, microphone=*, display-capture=*">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background-color: #1C1C1E; }
    #video-container { width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 8px; padding: 8px; }
    .camera-view { height: 25%; position: relative; border-radius: 8px; overflow: hidden; background-color: #2C2C2E; display: flex; align-items: center; justify-content: center; }
    lytx-live-video { width: 100%; height: 100%; position: relative; z-index: 2; }
  </style>
  <script type="module" src="https://ui-components.surfsight.net/latest/build/cloud-ui-components.esm.js" data-stencil data-resources-url="https://ui-components.surfsight.net/latest/build/" data-stencil-namespace="cloud-ui-components"></script>
  <script nomodule src="https://ui-components.surfsight.net/latest/build/cloud-ui-components.js" data-stencil></script>
</head>
<body>
  <div id="video-container">
    <div class="camera-view">
      <lytx-live-video id="camera-road" camera-id="1" time-limit="false"></lytx-live-video>
    </div>
    <div class="camera-view">
      <lytx-live-video id="camera-cabin" camera-id="2" time-limit="false"></lytx-live-video>
    </div>
  </div>
  <script>
    console.log('🌐 Page loaded with origin:', window.location.origin);
    console.log('🌐 Origin is null?', window.location.origin === 'null');
    
    window.addEventListener('message', function(event) {
      console.log('📨 Received message from React Native:', event.data);
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.type === 'INIT_LIVE_VIDEO') {
          console.log('🎬 Initializing live video with credentials');
          if (customElements.get('lytx-live-video')) {
            initializeCameras(data);
          } else {
            customElements.whenDefined('lytx-live-video').then(() => initializeCameras(data));
          }
        }
      } catch (err) {
        console.error('❌ Failed to parse message:', err);
      }
    });
    
    function initializeCameras(data) {
      console.log('✅ lytx-live-video component defined, initializing...');
      const roadCamera = document.getElementById('camera-road');
      const cabinCamera = document.getElementById('camera-cabin');
      
      if (roadCamera && cabinCamera) {
        roadCamera.authToken = data.authToken;
        roadCamera.imei = data.imei;
        roadCamera.cameraId = '1';
        roadCamera.organizationId = data.familyId;
        roadCamera.timeLimit = false;
        
        cabinCamera.authToken = data.authToken;
        cabinCamera.imei = data.imei;
        cabinCamera.cameraId = '2';
        cabinCamera.organizationId = data.familyId;
        cabinCamera.timeLimit = false;
        
        console.log('✅ All properties set via JavaScript');
        console.log('✅ Origin check should pass:', window.location.origin !== 'null');
        
        // Auto-click "Continue watching" button when it appears
        setupAutoContinue(roadCamera);
        setupAutoContinue(cabinCamera);
        
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CAMERAS_INITIALIZED', origin: window.location.origin }));
        }
      } else {
        console.error('❌ Camera elements not found');
      }
    }
    
    function setupAutoContinue(cameraElement) {
      const observer = new MutationObserver(() => {
        const shadowRoot = cameraElement.shadowRoot;
        if (shadowRoot) {
          // Look for "Continue watching" button
          const continueButton = shadowRoot.querySelector('button');
          if (continueButton && continueButton.textContent && continueButton.textContent.includes('Continue')) {
            console.log('🔄 Auto-clicking Continue watching button');
            continueButton.click();
          }
        }
      });
      
      observer.observe(cameraElement, { 
        childList: true, 
        subtree: true,
        attributes: true 
      });
    }
    
    window.onerror = function(msg, url, line, col, error) {
      console.error('❌ JavaScript Error:', { msg, url, line, col, error });
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ERROR', error: msg }));
      }
    };
  </script>
</body>
</html>`;
        
        // Write HTML content to Documents directory
        const htmlDest = `${RNFS.DocumentDirectoryPath}/lytx-live-video.html`;
        console.log('📋 Writing HTML file to:', htmlDest);
        
        await RNFS.writeFile(htmlDest, htmlContent, 'utf8');
        console.log('✅ HTML file written');
        
        // @ts-ignore
        server = new StaticServer(0, RNFS.DocumentDirectoryPath);
        
        const url = await server.start();
        console.log('✅ Local server started:', url);
        setServerUrl(url);
      } catch (err: any) {
        console.error('❌ Failed to start local server:', err);
        console.error('❌ Error message:', err.message);
        setError('Failed to start local server');
      }
    };
    
    startServer();
    fetchStreamInfo();
    
    return () => {
      if (server) {
        console.log('🛑 Stopping local HTTP server...');
        server.stop();
      }
    };
  }, [imei, authToken]);

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      {/* Close button */}
      <TouchableOpacity 
        style={styles.closeButton}
        onPress={onClose}
      >
        <ThemedText style={styles.closeButtonText}>✕ Close</ThemedText>
      </TouchableOpacity>

      {/* WebView with local HTTP server */}
      {streamInfo && !loading && !error && serverUrl && (
        <WebView
          source={{ uri: `${serverUrl}/lytx-live-video.html` }}
          style={{ flex: 1 }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          onLoad={() => {
            console.log('📄 HTML loaded from local server');
            console.log('🔑 Sending credentials to WebView...');
          }}
          onMessage={(event) => {
            try {
              const message = JSON.parse(event.nativeEvent.data);
              console.log('📨 Message from WebView:', message.type);
              
              if (message.type === 'console_log') {
                console.log('🌐', message.data);
              } else if (message.type === 'console_error') {
                console.error('🌐', message.data);
              } else if (message.type === 'CAMERAS_INITIALIZED') {
                console.log('✅ Cameras initialized with origin:', message.origin);
              }
            } catch (err) {
              console.error('❌ Failed to parse WebView message:', err);
            }
          }}
          injectedJavaScript={`
            window.postMessage({
              type: 'INIT_LIVE_VIDEO',
              imei: '${imei}',
              familyId: ${streamInfo.familyId},
              authToken: '${streamInfo.surfsightJwt}'
            });
            true;
          `}
        />
      )}

      {/* Loading overlay */}
      {loading && !streamInfo && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>
            {wakingUp ? 'Waking up camera...' : 'Preparing live video...'}
          </ThemedText>
        </View>
      )}

      {/* Error overlay with wake-up option */}
      {error && (
        <View style={styles.errorOverlay}>
          <View style={styles.errorPopup}>
            <ThemedText style={styles.errorPopupTitle}>⚠️ Connection Issue</ThemedText>
            <ThemedText style={styles.errorPopupText}>{error}</ThemedText>
            
            {/* Show wake-up button if error suggests standby */}
            {(() => {
              const showWakeUp = error.includes('standby') || 
                                 error.includes('Starting Up') || 
                                 error.includes('offline') || 
                                 error.includes('Standby') || 
                                 error.includes('wake-up command could not be completed') || 
                                 error.includes('Network Error');
              return showWakeUp;
            })() && (
              <TouchableOpacity 
                style={[styles.wakeUpButton, wakingUp && styles.wakeUpButtonDisabled]}
                onPress={wakeUpCamera}
                disabled={wakingUp}
              >
                <ThemedText style={styles.wakeUpButtonText}>
                  {wakingUp ? '⏳ Waking Up...' : '⏰ Wake Up Camera'}
                </ThemedText>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                setError(null);
                setLoading(true);
                fetchStreamInfo();
              }}
            >
              <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
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
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1000,
    padding: 20,
  },
  errorPopup: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 24,
    maxWidth: 400,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  errorPopupTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorPopupText: {
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    opacity: 0.9,
  },
  wakeUpButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: 12,
  },
  wakeUpButtonDisabled: {
    backgroundColor: '#666666',
    opacity: 0.6,
  },
  wakeUpButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
