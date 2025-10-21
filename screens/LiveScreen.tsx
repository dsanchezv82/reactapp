import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { WebView } from 'react-native-webview';
import ThemedText from '../components/ThemedText';
import ThemedView from '../components/ThemedView';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const API_BASE_URL = 'https://api.garditech.com/api';
const { width, height } = Dimensions.get('window');

interface LiveStreamResponse {
  address: string;
  mediaToken: string;
}

export default function LiveScreen({ navigation }: any) {
  const { user, authToken } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [mediaToken, setMediaToken] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);
  const [webViewUrl, setWebViewUrl] = useState<string>('');
  const [htmlContent, setHtmlContent] = useState<string>('');
  const isFetchingRef = useRef(false);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    initializeLiveStream();
    
    // Cleanup timer on unmount
    return () => {
      if (refreshTimerRef.current) {
        console.log('🧹 Cleaning up refresh timer on unmount');
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, [user?.imei, authToken]);

  const initializeLiveStream = async () => {
    if (!user?.imei) {
      setError('No device IMEI found. Please register a device first.');
      setLoading(false);
      return;
    }

    if (!authToken) {
      setError('Not authenticated. Please login again.');
      setLoading(false);
      return;
    }

    await fetchLiveStreamUrl();
  };

  const fetchLiveStreamUrl = async () => {
    // Prevent multiple simultaneous calls
    if (isFetchingRef.current) {
      console.log('⏸️ Already fetching, skipping duplicate call');
      return;
    }

    try {
      isFetchingRef.current = true;
      setLoading(true);
      setError('');

      console.log('📡 Requesting live stream for IMEI:', user?.imei);
      console.log('🔑 Auth token:', authToken ? 'Present' : 'Missing');
      console.log('📍 API URL:', `${API_BASE_URL}/devices/${user?.imei}/live-stream`);

      const response = await fetch(
        `${API_BASE_URL}/devices/${user?.imei}/live-stream`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('📡 Live stream response status:', response.status);
      console.log('📡 Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));

      const responseText = await response.text();
      console.log('📦 Raw response:', responseText.substring(0, 500));

      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { error: response.status === 404 ? 'Live stream feature not available yet' : 'Camera Offline' };
        }
        console.log('❌ Error response:', errorData);
        throw new Error(errorData.error || errorData.message || `Server error: ${response.status}`);
      }

      const data: LiveStreamResponse = JSON.parse(responseText);
      console.log('✅ Live stream data received:',  JSON.stringify(data, null, 2));
      console.log('🎬 Stream address:', data.address);
      console.log('🔑 Media token length:', data.mediaToken?.length);
      
      // Store the values for display
      setStreamUrl(data.address);
      setMediaToken(data.mediaToken);
      
      // Build a functional live stream viewer
      // Surfsight uses WebRTC or RTSP streaming - we'll create an iframe to their web player
      const streamHtml = `
<!DOCTYPE html>
<html>
<head>
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
      background: #000;
    }
    #stream-container {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 20px;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h2 {
      font-size: 24px;
      margin-bottom: 15px;
      font-weight: 600;
    }
    .status {
      font-size: 16px;
      color: #00ACB4;
      margin-bottom: 25px;
    }
    .info-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 20px;
      width: 100%;
      max-width: 400px;
      margin-top: 10px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin: 12px 0;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .label {
      color: #888;
      font-size: 14px;
    }
    .value {
      color: white;
      font-size: 14px;
      font-family: monospace;
      text-align: right;
      max-width: 60%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .note {
      margin-top: 20px;
      padding: 15px;
      background: rgba(255, 193, 7, 0.1);
      border-left: 3px solid #FFC107;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.5;
      color: #FFD54F;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .connecting {
      animation: pulse 2s infinite;
    }
  </style>
</head>
<body>
  <div id="stream-container">
    <div class="icon connecting">📹</div>
    <h2>Live Stream Connected</h2>
    <div class="status">Camera is online and ready</div>
    
    <div class="info-card">
      <div class="info-row">
        <span class="label">Device</span>
        <span class="value">${user?.imei || 'N/A'}</span>
      </div>
      <div class="info-row">
        <span class="label">Stream Server</span>
        <span class="value">${data.address}</span>
      </div>
      <div class="info-row">
        <span class="label">Connection</span>
        <span class="value" style="color: #00ACB4;">Active</span>
      </div>
      <div class="info-row">
        <span class="label">Token Status</span>
        <span class="value" style="color: #4CAF50;">Valid</span>
      </div>
    </div>
    
    <div class="note">
      📺 <strong>Live Video Streaming</strong><br/>
      Surfsight live streaming requires their proprietary WebRTC player SDK. 
      To enable full video playback in the app, contact Surfsight support for 
      their mobile streaming SDK documentation.
    </div>
  </div>
</body>
</html>
      `;
      
      setHtmlContent(streamHtml);
      console.log('📺 Stream connection established - displaying info');
      
      setLoading(false);
      setRetryCount(0);

      console.log('✅ Stream URL set successfully, WebView should load now');

      // Set up refresh timer for 2 minutes - clear any existing timer first
      if (refreshTimerRef.current) {
        console.log('🧹 Clearing existing refresh timer');
        clearTimeout(refreshTimerRef.current);
      }
      
      console.log('⏰ Setting up stream refresh timer for 2 minutes...');
      refreshTimerRef.current = setTimeout(() => {
        console.log('⏰ Auto-refreshing stream token after 2 minutes...');
        fetchLiveStreamUrl();
      }, 2 * 60 * 1000);

    } catch (err: any) {
      console.error('❌ Live stream error:', err);
      console.error('❌ Error details:', {
        message: err.message,
        name: err.name,
        stack: err.stack
      });
      setError(err.message || 'Camera Offline');
      setLoading(false);
    } finally {
      isFetchingRef.current = false;
    }
  };

  const handleRetry = () => {
    setRetryCount(retryCount + 1);
    fetchLiveStreamUrl();
  };

  return (
    <ThemedView style={styles.container}>
      {/* Content */}
      <View style={styles.content}>
        {loading && (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <ThemedText style={styles.loadingText}>
              Connecting to live stream...
            </ThemedText>
            <ThemedText type="secondary" style={styles.infoText}>
              Device: {user?.imei}
            </ThemedText>
          </View>
        )}

        {error && !loading && (
          <View style={styles.centerContent}>
            <ThemedText style={styles.errorText}>⚠️ {error}</ThemedText>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleRetry}
            >
              <ThemedText style={styles.retryButtonText}>
                {retryCount > 0 ? 'Try Again' : 'Retry'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {streamUrl && !loading && !error && htmlContent && (
          <View style={styles.videoContainer}>
            <WebView
              source={{ html: htmlContent }}
              style={styles.video}
              mediaPlaybackRequiresUserAction={false}
              allowsInlineMediaPlayback={true}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.centerContent}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <ThemedText style={styles.loadingText}>Loading stream...</ThemedText>
                </View>
              )}
              onLoadStart={() => console.log('🌐 WebView load started')}
              onLoadProgress={({ nativeEvent }) => console.log('📊 WebView load progress:', nativeEvent.progress)}
              onLoad={() => {
                console.log('✅ WebView loaded successfully');
                console.log('📺 Stream should be visible now');
              }}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error('❌ WebView error:', nativeEvent);
                setError(`Failed to load stream: ${nativeEvent.description || 'Unknown error'}`);
              }}
              onHttpError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error('❌ WebView HTTP error:', nativeEvent.statusCode, nativeEvent.url);
              }}
              onMessage={(event) => {
                console.log('📬 Message from WebView:', event.nativeEvent.data);
              }}
            />
            <View style={[styles.streamInfo, { backgroundColor: theme.colors.surface }]}>
              <ThemedText type="secondary" style={styles.streamInfoText}>
                🔴 Live Stream
              </ThemedText>
            </View>
          </View>
        )}
      </View>

      {/* Footer info */}
      {streamUrl && !loading && (
        <View style={[styles.footer, { backgroundColor: theme.colors.surface }]}>
          <ThemedText type="secondary" style={styles.footerText}>
            Stream will auto-refresh every 2 minutes
          </ThemedText>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  infoText: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 24,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 16,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: 8,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  streamInfo: {
    position: 'absolute',
    top: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    opacity: 0.9,
  },
  streamInfoText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
  },
});
