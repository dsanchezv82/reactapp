import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { RTCView, RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, mediaDevices } from 'react-native-webrtc';

interface NativeLiveVideoProps {
  imei: string;
  cameraId: number;
  authToken: string;
  organizationId: number;
}

interface MediaCredentials {
  serverAddress: string;
  mediaToken: string;
}

export default function NativeLiveVideo({
  imei,
  cameraId,
  authToken,
  organizationId,
}: NativeLiveVideoProps) {
  const [status, setStatus] = useState<string>('Initializing...');
  const [error, setError] = useState<string | null>(null);
  const [streamURL, setStreamURL] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    console.log('🎥 Native live video component mounted');
    console.log('📱 IMEI:', imei, 'Camera:', cameraId);
    
    initializeStream();
    
    return () => {
      cleanup();
    };
  }, [imei, cameraId]);

  const cleanup = () => {
    console.log('🧹 Cleaning up WebRTC resources...');
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
  };

  const initializeStream = async () => {
    try {
      // Step 1: Get media credentials from SurfSight API
      setStatus('Getting media credentials...');
      console.log('🔑 Fetching media credentials...');
      
      const credentials = await getMediaCredentials();
      console.log('✅ Got credentials:', credentials);
      
      // Step 2: Establish WebSocket connection
      setStatus('Connecting to media server...');
      await connectWebSocket(credentials);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('❌ Stream initialization failed:', errorMsg);
      setError(errorMsg);
      setStatus('Failed');
    }
  };

  const getMediaCredentials = async (): Promise<MediaCredentials> => {
    const url = `https://api-prod.surfsight.net/v2/devices/${imei}/connect-media`;
    
    console.log('📡 Calling connect-media API:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cameraId: cameraId,
        organizationId: organizationId,
      }),
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📦 API response:', data);

    if (!data.data?.address || !data.data?.mediaToken) {
      throw new Error('Invalid API response: missing address or mediaToken');
    }

    return {
      serverAddress: data.data.address,
      mediaToken: data.data.mediaToken,
    };
  };

  const connectWebSocket = async (credentials: MediaCredentials): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Try different WebSocket URL formats
      // Based on error 400, server might expect specific format
      
      // Format attempts:
      // 1. Path-based: wss://server/media/{imei}/{cameraId}/{token}
      // 2. Root with token only: wss://server/{token}
      // 3. Query params: wss://server?token={token}&imei={imei}&camera={cameraId}
      
      // Let's try the simplest: just the token in the path
      const wsUrl = `wss://${credentials.serverAddress}/${credentials.mediaToken}`;
      
      console.log('🔌 Connecting to WebSocket...');
      console.log('   Format: wss://server/{token}');
      console.log('   Server:', credentials.serverAddress);
      console.log('   Token:', credentials.mediaToken.substring(0, 8) + '...');

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected!');
        setStatus('Connected - waiting for stream');
        console.log('⏳ Waiting for server to send WebRTC signaling messages...');
        resolve();
      };

      ws.onmessage = (event) => {
        console.log('📨 WebSocket message received:', event.data);
        
        try {
          const message = JSON.parse(event.data);
          handleSignalingMessage(message, credentials);
        } catch (err) {
          console.error('❌ Failed to parse WebSocket message:', err);
          console.log('Raw message:', event.data);
        }
      };

      ws.onerror = (error: any) => {
        console.error('❌ WebSocket error:', error);
        console.log('❌ Error details:', JSON.stringify(error, null, 2));
        console.log('❌ Error message:', error?.message);
        console.log('❌ Error code:', error?.code);
        setError('WebSocket connection failed');
        setStatus('Connection failed');
        reject(new Error('WebSocket connection failed'));
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        console.log('🔍 Close event details:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        setStatus('Disconnected');
        
        if (event.code === 1006) {
          console.error('⚠️ Abnormal closure (1006) - server rejected connection');
          console.error('💡 Possible reasons:');
          console.error('   1. Token needs to be in WebSocket handshake headers');
          console.error('   2. Different URL path required (e.g., /stream, /media, /ws)');
          console.error('   3. Additional parameters needed (imei, cameraId in URL)');
          console.error('   4. Token format incorrect');
          setError('Server rejected connection - authentication may have failed');
        }
      };
    });
  };

  const handleSignalingMessage = async (message: any, credentials: MediaCredentials) => {
    console.log('🎯 Handling signaling message:', message);
    
    // Log the message structure to understand the protocol
    console.log('Message type:', message.type);
    console.log('Message keys:', Object.keys(message));
    
    // TODO: Implement WebRTC signaling based on message protocol
    // This will be updated once we see the actual message format from the server
    
    switch (message.type) {
      case 'offer':
        console.log('📥 Received SDP offer');
        await handleOffer(message);
        break;
        
      case 'ice-candidate':
      case 'candidate':
        console.log('📥 Received ICE candidate');
        await handleIceCandidate(message);
        break;
        
      case 'authenticated':
      case 'auth-success':
        console.log('✅ Authentication successful!');
        setStatus('Authenticated - waiting for stream...');
        break;
        
      case 'error':
        console.error('❌ Server error:', message);
        setError(message.message || 'Server error');
        break;
        
      default:
        console.log('ℹ️ Unknown message type, logging for discovery:', message);
    }
  };

  const handleOffer = async (message: any) => {
    console.log('🔧 Creating RTCPeerConnection...');
    
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    };
    
    const pc = new RTCPeerConnection(configuration);
    pcRef.current = pc;
    
    // @ts-ignore - react-native-webrtc uses non-standard event API
    pc._iceGatheringState = 'new';
    // @ts-ignore
    pc.onicecandidate = (event: any) => {
      if (event.candidate && wsRef.current) {
        console.log('📤 Sending ICE candidate to server');
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
        }));
      }
    };
    
    // @ts-ignore
    pc.ontrack = (event: any) => {
      console.log('📺 Received remote track!', event.streams);
      if (event.streams && event.streams[0]) {
        console.log('✅ Got video stream!');
        const streamUrl = event.streams[0].toURL();
        setStreamURL(streamUrl);
        setStatus('Streaming');
      }
    };
    
    // @ts-ignore
    pc.onconnectionstatechange = () => {
      // @ts-ignore
      console.log('🔄 Connection state:', pc.connectionState);
      // @ts-ignore
      setStatus(`Connection: ${pc.connectionState}`);
    };
    
    // Set remote description (offer)
    const offer = new RTCSessionDescription({
      type: 'offer',
      sdp: message.sdp,
    });
    
    await pc.setRemoteDescription(offer);
    console.log('✅ Set remote description');
    
    // Create answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    console.log('✅ Created answer');
    
    // Send answer to server
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'answer',
        sdp: answer.sdp,
      }));
      console.log('📤 Sent answer to server');
    }
  };

  const handleIceCandidate = async (message: any) => {
    if (pcRef.current && message.candidate) {
      const candidate = new RTCIceCandidate(message.candidate);
      await pcRef.current.addIceCandidate(candidate);
      console.log('✅ Added ICE candidate');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Camera {cameraId} - Native WebRTC</Text>
        <Text style={styles.status}>Status: {status}</Text>
        {error && <Text style={styles.error}>Error: {error}</Text>}
      </View>
      
      {streamURL ? (
        <RTCView
          streamURL={streamURL}
          style={styles.video}
          objectFit="cover"
        />
      ) : (
        <View style={styles.placeholder}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.placeholderText}>{status}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  status: {
    color: '#0f0',
    fontSize: 12,
    marginTop: 5,
  },
  error: {
    color: '#f00',
    fontSize: 12,
    marginTop: 5,
  },
  video: {
    flex: 1,
    backgroundColor: '#000',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222',
  },
  placeholderText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 14,
  },
});
