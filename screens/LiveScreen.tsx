import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

interface LiveStreamResponse {
  address: string;
  mediaToken: string;
}

// Build the WebRTC HTML player based on Surfsight spec
function buildWebRTCPlayer(data: LiveStreamResponse, imei: string, camera: number) {
  const webrtcUrl = `https://${data.address}/webrtc/#PEERID#/${imei}/${camera}/${data.mediaToken}`;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
    #video-container { 
      width: 100%; 
      height: 100%; 
      display: flex; 
      align-items: center; 
      justify-content: center;
      position: relative;
    }
    video { 
      width: 100%; 
      height: 100%; 
      object-fit: contain;
      background: #000;
    }
    #loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: #fff;
      font-family: -apple-system, system-ui;
    }
    #error {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: #ff6b6b;
      font-family: -apple-system, system-ui;
      padding: 20px;
      display: none;
    }
    .spinner {
      border: 3px solid rgba(255,255,255,0.3);
      border-top: 3px solid #007AFF;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div id="video-container">
    <div id="loading">
      <div class="spinner"></div>
      <div style="font-size: 14px;">Connecting to camera...</div>
    </div>
    <video id="video" autoplay playsinline muted style="display:none;"></video>
    <div id="error"></div>
  </div>
  
  <script>
    function sendMessage(type, data) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, data }));
      }
    }

    const videoElement = document.getElementById('video');
    const loadingElement = document.getElementById('loading');
    const errorElement = document.getElementById('error');
    
    let pc = null;
    
    async function startWebRTC() {
      try {
        sendMessage('status', 'Initializing WebRTC connection...');
        
        pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        
        pc.ontrack = (event) => {
          sendMessage('status', 'Stream received');
          if (event.streams && event.streams[0]) {
            videoElement.srcObject = event.streams[0];
            videoElement.style.display = 'block';
            loadingElement.style.display = 'none';
            sendMessage('stream_started', true);
          }
        };
        
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            sendMessage('ice_candidate', event.candidate);
          }
        };
        
        pc.onconnectionstatechange = () => {
          sendMessage('connection_state', pc.connectionState);
          if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            showError('Connection lost. Please try again.');
          }
        };
        
        const offer = await pc.createOffer({ 
          offerToReceiveVideo: true, 
          offerToReceiveAudio: false 
        });
        await pc.setLocalDescription(offer);
        
        const streamUrl = '${webrtcUrl}';
        sendMessage('offer_created', { url: streamUrl });
        
        const response = await fetch(streamUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            type: 'offer',
            sdp: offer.sdp 
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to connect to media server');
        }
        
        const answer = await response.json();
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        sendMessage('stream_connecting', true);
        
      } catch (err) {
        sendMessage('error', err.message);
        showError('Failed to start stream: ' + err.message);
      }
    }
    
    function showError(message) {
      loadingElement.style.display = 'none';
      errorElement.textContent = message;
      errorElement.style.display = 'block';
      videoElement.style.display = 'none';
    }
    
    window.addEventListener('load', () => {
      setTimeout(startWebRTC, 500);
    });
    
    window.addEventListener('beforeunload', () => {
      if (pc) {
        pc.close();
      }
      if (videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(track => track.stop());
      }
    });
  </script>
</body>
</html>
  `;
}

export default function LiveScreen() {
  const { user, authToken } = useAuth();
  const { theme } = useTheme();
  const [cameraId, setCameraId] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamData, setStreamData] = useState<LiveStreamResponse | null>(null);

  useEffect(() => {
    if (user?.imei && authToken) {
      fetchStreamCredentials();
    }
  }, [user?.imei, authToken, cameraId]);

  const fetchStreamCredentials = async () => {
    if (!user?.imei) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('[LiveStream] Fetching credentials for IMEI:', user.imei, 'Camera:', cameraId);
      
      const response = await fetch(`${API_BASE_URL}/devices/${user.imei}/prepare-streaming`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LiveStream] Failed to fetch credentials:', response.status, errorText);
        throw new Error('Failed to prepare streaming');
      }

      const data: LiveStreamResponse = await response.json();
      console.log('[LiveStream] Credentials received:', { address: data.address, hasToken: !!data.mediaToken });
      
      setStreamData(data);
    } catch (err: any) {
      console.error('[LiveStream] Error:', err);
      setError(err.message || 'Failed to connect to streaming service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Camera Selector */}
      <View style={[styles.cameraSelector, { borderBottomColor: theme.colors.border }]}>
        {[1, 2].map((id, idx) => (
          <TouchableOpacity
            key={id}
            style={[
              styles.cameraButton,
              cameraId === id && { backgroundColor: theme.colors.primary },
              idx === 0 && { marginRight: 12 }
            ]}
            onPress={() => setCameraId(id)}
          >
            <ThemedText style={[
              styles.cameraButtonText,
              cameraId === id && { color: '#fff' }
            ]}>
              {id === 1 ? '🚗 Road' : '👤 In-Cabin'}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stream Content */}
      <View style={styles.content}>
        {loading && (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <ThemedText style={styles.statusText}>
              Connecting to live stream...
            </ThemedText>
          </View>
        )}

        {error && !loading && (
          <View style={styles.centerContent}>
            <ThemedText style={styles.errorText}>⚠️ {error}</ThemedText>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
              onPress={fetchStreamCredentials}
            >
              <ThemedText style={styles.retryButtonText}>
                Retry Connection
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {streamData && !loading && !error && (
          <WebView
            source={{ html: buildWebRTCPlayer(streamData, user?.imei || '', cameraId) }}
            style={styles.webview}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            onMessage={(event) => {
              try {
                const message = JSON.parse(event.nativeEvent.data);
                console.log(`[WebRTC ${message.type}]`, message.data);
                
                if (message.type === 'error') {
                  setError(message.data);
                }
              } catch (e) {
                console.log('[WebRTC]', event.nativeEvent.data);
              }
            }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('[WebView Error]', nativeEvent);
              setError('Failed to load video player');
            }}
          />
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cameraSelector: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  cameraButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  cameraButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  statusText: {
    marginTop: 16,
    fontSize: 16,
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
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
