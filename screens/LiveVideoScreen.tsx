import LiveVideoPlayer from '@/components/LiveVideoPlayer';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

/**
 * LiveVideoScreen - Screen for viewing live video streams from vehicle cameras
 * 
 * Features:
 * - Camera selection (road-facing, in-cab, auxiliary)
 * - Protocol selection (WebRTC, HLS)
 * - Full-screen live video player
 * - Error handling and user feedback
 * 
 * Uses SurfSight API for live streaming via WebRTC/HLS protocols
 */
export default function LiveVideoScreen() {
  const { user, authToken } = useAuth();
  const { theme, isDark } = useTheme();
  const [selectedCamera, setSelectedCamera] = useState<number | null>(null);
  const [protocol, setProtocol] = useState<'webrtc' | 'hls'>('webrtc');

  // Camera options
  const cameras = [
    { id: 1, name: 'Road-Facing Camera', icon: 'car-outline' },
    { id: 2, name: 'In-Cab Camera', icon: 'person-outline' },
  ];

  const handleCameraSelect = (cameraId: number) => {
    if (!user?.imei) {
      Alert.alert(
        'Device Not Found',
        'No device is associated with your account. Please contact support.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!authToken) {
      Alert.alert(
        'Authentication Required',
        'Please log in again to view live video.',
        [{ text: 'OK' }]
      );
      return;
    }

    setSelectedCamera(cameraId);
  };

  const handleCloseVideo = () => {
    console.log('🔒 Closing live video');
    setSelectedCamera(null);
  };

  const handleVideoError = (error: string) => {
    console.error('❌ Live video error:', error);
    // Error is already shown by LiveVideoPlayer component
    // Just reset the selected camera after a delay
    setTimeout(() => {
      setSelectedCamera(null);
    }, 2000);
  };

  // If a camera is selected, show the live video player
  if (selectedCamera && authToken && user?.imei) {
    return (
      <View style={styles.fullscreenContainer}>
        <LiveVideoPlayer
          imei={user.imei}
          authToken={authToken}
          cameraId={selectedCamera}
          onClose={handleCloseVideo}
          onError={handleVideoError}
        />
      </View>
    );
  }

  // Camera selection screen
  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Live Video
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Select a camera to view live streaming
          </ThemedText>
        </View>

        {/* Device Info */}
        {user?.imei && (
          <View style={[styles.deviceInfo, { 
            backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' 
          }]}>
            <Ionicons
              name="hardware-chip-outline" 
              size={24} 
              color={isDark ? '#FFFFFF' : '#000000'} 
            />
            <View style={styles.deviceInfoText}>
              <ThemedText style={styles.deviceLabel}>Device IMEI</ThemedText>
              <ThemedText style={styles.deviceValue}>{user.imei}</ThemedText>
            </View>
          </View>
        )}

        {!user?.imei && (
          <View style={[styles.warningBox, { backgroundColor: '#FFF3CD' }]}>
            <Ionicons name="warning-outline" size={24} color="#856404" />
            <ThemedText style={[styles.warningText, { color: '#856404' }]}>
              No device found. Please contact support to link a device to your account.
            </ThemedText>
          </View>
        )}

        {/* Protocol Selection */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Streaming Protocol
          </ThemedText>
          <View style={styles.protocolButtons}>
            <TouchableOpacity
              style={[
                styles.protocolButton,
                protocol === 'webrtc' && styles.protocolButtonActive,
                { 
                  backgroundColor: protocol === 'webrtc' 
                    ? '#007AFF' 
                    : (isDark ? '#1C1C1E' : '#F2F2F7')
                }
              ]}
              onPress={() => setProtocol('webrtc')}
            >
              <ThemedText style={[
                styles.protocolButtonText,
                protocol === 'webrtc' && styles.protocolButtonTextActive
              ]}>
                WebRTC (Recommended)
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.protocolButton,
                protocol === 'hls' && styles.protocolButtonActive,
                { 
                  backgroundColor: protocol === 'hls' 
                    ? '#007AFF' 
                    : (isDark ? '#1C1C1E' : '#F2F2F7')
                }
              ]}
              onPress={() => setProtocol('hls')}
            >
              <ThemedText style={[
                styles.protocolButtonText,
                protocol === 'hls' && styles.protocolButtonTextActive
              ]}>
                HLS
              </ThemedText>
            </TouchableOpacity>
          </View>
          <ThemedText style={styles.protocolDescription}>
            {protocol === 'webrtc' 
              ? '⚡ Lower latency, better for real-time monitoring' 
              : '📶 More compatible, better for slower connections'}
          </ThemedText>
        </View>

        {/* Camera Selection */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Select Camera
          </ThemedText>
          {cameras.map((camera) => (
            <TouchableOpacity
              key={camera.id}
              style={[styles.cameraCard, {
                backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                borderColor: isDark ? '#38383A' : '#E5E5EA',
              }]}
              onPress={() => handleCameraSelect(camera.id)}
              disabled={!user?.imei}
            >
              <View style={styles.cameraCardIcon}>
                <Ionicons 
                  name={camera.icon as any} 
                  size={32} 
                  color="#007AFF" 
                />
              </View>
              <View style={styles.cameraCardContent}>
                <ThemedText style={styles.cameraName}>{camera.name}</ThemedText>
                <ThemedText style={styles.cameraDescription}>
                  Tap to view live stream
                </ThemedText>
              </View>
              <Ionicons 
                name="chevron-forward" 
                size={24} 
                color={isDark ? '#8E8E93' : '#C7C7CC'} 
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Info Section */}
        <View style={[styles.infoBox, { 
          backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' 
        }]}>
          <Ionicons 
            name="information-circle-outline" 
            size={24} 
            color={isDark ? '#FFFFFF' : '#000000'} 
          />
          <View style={styles.infoTextContainer}>
            <ThemedText style={styles.infoText}>
              Live video streaming requires an active internet connection and the device must be online.
            </ThemedText>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    opacity: 0.6,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  deviceInfoText: {
    marginLeft: 12,
    flex: 1,
  },
  deviceLabel: {
    fontSize: 13,
    opacity: 0.6,
    marginBottom: 4,
  },
  deviceValue: {
    fontSize: 17,
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  warningText: {
    marginLeft: 12,
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  protocolButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  protocolButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  protocolButtonActive: {
    backgroundColor: '#007AFF',
  },
  protocolButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  protocolButtonTextActive: {
    color: '#FFFFFF',
  },
  protocolDescription: {
    fontSize: 13,
    opacity: 0.6,
    textAlign: 'center',
  },
  cameraCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  cameraCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cameraCardContent: {
    flex: 1,
  },
  cameraName: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  cameraDescription: {
    fontSize: 13,
    opacity: 0.6,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  infoTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.8,
  },
});
