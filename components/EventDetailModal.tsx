import { VideoView, useVideoPlayer } from 'expo-video';
import { AlertTriangle, Calendar, Clock, MapPin, Pause, Play, RotateCcw, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
    PanResponder,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ThemedText from './ThemedText';
import ThemedView from './ThemedView';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const API_BASE_URL = 'https://api.garditech.com/api';

interface EventFile {
  link: string;
  fileId: string;
  cameraId: number;
  fileType: string;
  size?: number;
  duration?: number;
}

interface EventDetailModalProps {
  visible: boolean;
  eventId: string;
  imei: string;
  onClose: () => void;
}

interface EventDetail {
  id: string | number;
  eventType: string;
  time: string;
  lat: number;
  lon: number;
  severity?: number;
  status?: 'new' | 'resolved';
  description?: string;
  duration?: number;
  speed?: number;
  files?: any[];
  driver?: boolean;
  eventComments?: any[];
  metadata?: string | Record<string, any>;
}

export default function EventDetailModal({ visible, eventId, imei, onClose }: EventDetailModalProps) {
  const { theme } = useTheme();
  const { authToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null);
  const [videoFiles, setVideoFiles] = useState<EventFile[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showRestart, setShowRestart] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  // Create video players for each camera
  const roadFacingVideo = videoFiles.find(f => f.cameraId === 1);
  const cabinVideo = videoFiles.find(f => f.cameraId === 2);

  const roadPlayer = useVideoPlayer(roadFacingVideo?.link || '', player => {
    player.loop = false;
    player.muted = false;
  });

  const cabinPlayer = useVideoPlayer(cabinVideo?.link || '', player => {
    player.loop = false;
    player.muted = false;
  });

  // Sync playback state and time
  useEffect(() => {
    if (!roadPlayer || !cabinPlayer) return;

    const updatePlaybackState = () => {
      // Update current time from road player (primary)
      if (!isSeeking) {
        setCurrentTime(roadPlayer.currentTime || 0);
      }

      // Set duration from road player
      if (roadPlayer.duration && roadPlayer.duration > 0) {
        setDuration(roadPlayer.duration);
      }

      // Check if videos have ended
      if (roadPlayer.status === 'idle' || cabinPlayer.status === 'idle') {
        setShowRestart(true);
        setIsPlaying(false);
      }
    };

    const interval = setInterval(updatePlaybackState, 100); // Update 10 times per second
    return () => clearInterval(interval);
  }, [roadPlayer, cabinPlayer, isSeeking]);

  const handlePlayPause = () => {
    if (isPlaying) {
      // Pause both
      roadPlayer.pause();
      cabinPlayer.pause();
      setIsPlaying(false);
    } else {
      // Play both
      roadPlayer.play();
      cabinPlayer.play();
      setIsPlaying(true);
      setShowRestart(false);
    }
  };

  const handleRestart = () => {
    // Restart both videos from beginning
    roadPlayer.currentTime = 0;
    cabinPlayer.currentTime = 0;
    roadPlayer.play();
    cabinPlayer.play();
    setIsPlaying(true);
    setShowRestart(false);
  };

  const handleSeek = (value: number) => {
    // Seek both videos to the same position
    roadPlayer.currentTime = value;
    cabinPlayer.currentTime = value;
    setCurrentTime(value);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Custom scrubber pan responder
  const [scrubberWidth, setScrubberWidth] = useState(0);
  const [scrubberX, setScrubberX] = useState(0);
  
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      // Pause videos while seeking
      if (isPlaying) {
        roadPlayer?.pause();
        cabinPlayer?.pause();
      }
      setIsSeeking(true);
    },
    onPanResponderMove: (evt) => {
      if (scrubberWidth > 0 && duration > 0) {
        // Get touch position relative to the scrubber track
        const touchX = evt.nativeEvent.locationX;
        const progress = Math.max(0, Math.min(1, touchX / scrubberWidth));
        const newTime = progress * duration;
        setCurrentTime(newTime);
      }
    },
    onPanResponderRelease: (evt) => {
      if (scrubberWidth > 0 && duration > 0) {
        // Get touch position relative to the scrubber track
        const touchX = evt.nativeEvent.locationX;
        const progress = Math.max(0, Math.min(1, touchX / scrubberWidth));
        const newTime = progress * duration;
        handleSeek(newTime);
        
        // Resume playback if it was playing before
        if (isPlaying) {
          setTimeout(() => {
            roadPlayer?.play();
            cabinPlayer?.play();
          }, 50);
        }
      }
      setIsSeeking(false);
    },
  });

  useEffect(() => {
    if (visible && eventId) {
      fetchEventDetail();
    }
  }, [visible, eventId]);

  const fetchEventDetail = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔄 [EventDetailModal] Fetching event details for:', eventId);
      
      // Fetch event details
      const response = await fetch(`${API_BASE_URL}/events/${imei}/${eventId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch event: ${response.status}`);
      }

      const result = await response.json();
      const detail = result.data;
      console.log('✅ [EventDetailModal] Event detail loaded:', {
        id: detail.id,
        eventType: detail.eventType,
        filesCount: detail.files?.length || 0,
        files: detail.files
      });
      setEventDetail(detail);

      // If event has files, fetch the video links
      if (detail.files && detail.files.length > 0) {
        console.log('📹 [EventDetailModal] Event has files, fetching video links...');
        await fetchEventVideoFiles(detail.files);
      } else {
        console.log('⚠️ [EventDetailModal] No files found in event');
      }
    } catch (err: any) {
      console.error('Error fetching event detail:', err);
      setError(err.message || 'Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const fetchEventVideoFiles = async (files: any[]) => {
    setLoadingVideos(true);
    
    try {
      console.log('📹 [EventDetailModal] Fetching video files for:', files);
      
      // Get the first file ID and all camera IDs from the files
      const fileId = files[0]?.fileId;
      const cameraIds = files
        .map(f => f.cameraId)
        .filter((id, index, self) => self.indexOf(id) === index)
        .join(',');

      console.log('📹 [EventDetailModal] Query params:', { fileId, cameraIds });

      // Fetch file links for all cameras at once using the same endpoint as web
      const queryParams = new URLSearchParams({
        fileId: fileId,
        cameraIds: cameraIds,
        fileType: 'video',
      });

      const url = `${API_BASE_URL}/events/${imei}/retrieve-event-files?${queryParams.toString()}`;
      console.log('📹 [EventDetailModal] Fetching from URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      console.log('📹 [EventDetailModal] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [EventDetailModal] Response error:', errorText);
        throw new Error(`Failed to fetch video links: ${response.status}`);
      }

      const result = await response.json();
      console.log('📹 [EventDetailModal] Response data:', result);
      
      // Backend returns { data: { urls: FileLink[] } } where FileLink has { cameraId, url }
      const urls = result.data?.urls || result.data || [];
      console.log('📹 [EventDetailModal] Extracted URLs:', urls);
      
      // Transform to our EventFile format
      const videoFiles = urls.map((link: any) => ({
        link: link.url,
        fileId: fileId,
        cameraId: link.cameraId,
        fileType: 'video',
      }));
      
      console.log('✅ [EventDetailModal] Transformed video files:', videoFiles);
      setVideoFiles(videoFiles);
      
      if (videoFiles.length > 0) {
        console.log(`✅ Loaded ${videoFiles.length} video file(s)`);
      } else {
        console.warn('⚠️ No video files in response');
      }
    } catch (err: any) {
      console.error('Error fetching video files:', err);
      Alert.alert('Error', 'Failed to load video files');
    } finally {
      setLoadingVideos(false);
    }
  };

  const getSeverityInfo = (severity?: number) => {
    if (!severity) return { color: theme.colors.textSecondary, label: 'Info', icon: '📍' };
    
    if (severity >= 4) {
      return { color: '#FF3B30', label: 'Critical', icon: '🚨' };
    } else if (severity === 3) {
      return { color: '#FF9500', label: 'High', icon: '⚠️' };
    } else if (severity === 2) {
      return { color: '#FFCC00', label: 'Medium', icon: '⚡' };
    } else {
      return { color: '#34C759', label: 'Low', icon: 'ℹ️' };
    }
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      })
    };
  };

  const getCameraLabel = (cameraId: number) => {
    switch (cameraId) {
      case 1: return 'Road-Facing';
      case 2: return 'In-Cabin';
      default: return `Camera ${cameraId}`;
    }
  };

  if (!eventDetail && !loading) {
    return null;
  }

  const severityInfo = eventDetail ? getSeverityInfo(eventDetail.severity) : null;
  const dateTime = eventDetail ? formatDateTime(eventDetail.time) : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <ThemedView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <ThemedText type="title" style={styles.headerTitle}>
            Event Details
          </ThemedText>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={theme.colors.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <ThemedText type="secondary" style={styles.loadingText}>
              Loading event details...
            </ThemedText>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <AlertTriangle size={48} color="#FF3B30" strokeWidth={2} />
            <ThemedText type="subtitle" style={styles.errorText}>
              {error}
            </ThemedText>
            <TouchableOpacity 
              style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
              onPress={fetchEventDetail}
            >
              <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
            </TouchableOpacity>
          </View>
        ) : eventDetail ? (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Video Player Section */}
            {videoFiles.length > 0 ? (
              <View style={styles.videoSection}>
                {/* Road-Facing Camera */}
                {roadFacingVideo && (
                  <View style={styles.videoContainer}>
                    <VideoView
                      player={roadPlayer}
                      style={styles.video}
                      nativeControls={true}
                      contentFit="contain"
                      allowsFullscreen={true}
                      allowsPictureInPicture={false}
                      requiresLinearPlayback={false}
                    />
                    {(loadingVideos || !roadPlayer.duration || roadPlayer.duration === 0) && (
                      <View style={styles.videoLoadingOverlay}>
                        <ActivityIndicator size="large" color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                )}

                {/* In-Cabin Camera */}
                {cabinVideo && (
                  <View style={styles.videoContainer}>
                    <VideoView
                      player={cabinPlayer}
                      style={styles.video}
                      nativeControls={true}
                      contentFit="contain"
                      allowsFullscreen={true}
                      allowsPictureInPicture={false}
                      requiresLinearPlayback={false}
                    />
                    {(loadingVideos || !cabinPlayer.duration || cabinPlayer.duration === 0) && (
                      <View style={styles.videoLoadingOverlay}>
                        <ActivityIndicator size="large" color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                )}

                {/* Custom Synchronized Control Bar */}
                <View style={[styles.controlBar, { backgroundColor: theme.colors.surface }]}>
                  {showRestart ? (
                    <TouchableOpacity
                      style={[styles.controlButton, { backgroundColor: theme.colors.primary }]}
                      onPress={handleRestart}
                      activeOpacity={0.8}
                    >
                      <RotateCcw size={24} color="#FFFFFF" strokeWidth={2} />
                      <ThemedText style={styles.controlButtonText}>
                        Restart Both
                      </ThemedText>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.controlButton, 
                        { 
                          backgroundColor: loadingVideos || !roadPlayer || !cabinPlayer || !roadPlayer.duration || roadPlayer.duration === 0 || !cabinPlayer.duration || cabinPlayer.duration === 0
                            ? theme.colors.textSecondary 
                            : theme.colors.primary 
                        }
                      ]}
                      onPress={handlePlayPause}
                      activeOpacity={0.8}
                      disabled={loadingVideos || !roadPlayer || !cabinPlayer || !roadPlayer.duration || roadPlayer.duration === 0 || !cabinPlayer.duration || cabinPlayer.duration === 0}
                    >
                      {isPlaying ? (
                        <>
                          <Pause size={24} color="#FFFFFF" strokeWidth={2} />
                          <ThemedText style={styles.controlButtonText}>
                            Pause Both
                          </ThemedText>
                        </>
                      ) : (
                        <>
                          <Play size={24} color="#FFFFFF" strokeWidth={2} />
                          <ThemedText style={styles.controlButtonText}>
                            Play Both
                          </ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {/* Synchronized Scrubber */}
                  {duration > 0 && (
                    <View style={styles.scrubberContainer}>
                      {/* Time labels */}
                      <View style={styles.timeLabels}>
                        <ThemedText type="secondary" style={styles.timeText}>
                          {formatTime(currentTime)}
                        </ThemedText>
                        <ThemedText type="secondary" style={styles.timeText}>
                          {formatTime(duration)}
                        </ThemedText>
                      </View>

                      {/* Scrubber track */}
                      <View
                        style={styles.scrubberTrack}
                        onLayout={(e) => setScrubberWidth(e.nativeEvent.layout.width)}
                        {...panResponder.panHandlers}
                      >
                        {/* Progress bar */}
                        <View
                          style={[
                            styles.scrubberProgress,
                            {
                              width: `${(currentTime / duration) * 100}%`,
                              backgroundColor: theme.colors.primary,
                            },
                          ]}
                        />
                        {/* Cursor/thumb */}
                        <View
                          style={[
                            styles.scrubberThumb,
                            {
                              left: `${(currentTime / duration) * 100}%`,
                              backgroundColor: theme.colors.primary,
                              borderColor: theme.colors.surface,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  )}
                </View>
                
                {loadingVideos && (
                  <View style={styles.videoLoadingOverlay}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <ThemedText type="secondary" style={styles.videoLoadingText}>
                      Loading videos...
                    </ThemedText>
                  </View>
                )}
              </View>
            ) : null}

            {/* Event Information */}
            <View style={styles.section}>
              <View style={styles.eventTypeRow}>
                <ThemedText type="title" style={styles.eventType}>
                  {eventDetail.eventType || 'Event'}
                </ThemedText>
                {severityInfo && (
                  <View style={[styles.severityBadge, { backgroundColor: severityInfo.color + '20' }]}>
                    <ThemedText style={[styles.severityText, { color: severityInfo.color }]}>
                      {severityInfo.icon} {severityInfo.label}
                    </ThemedText>
                  </View>
                )}
              </View>

              {eventDetail.description && (
                <ThemedText style={styles.description}>
                  {eventDetail.description}
                </ThemedText>
              )}

              {/* Date & Time */}
              {dateTime && (
                <View style={styles.infoRow}>
                  <Calendar size={20} color={theme.colors.primary} strokeWidth={2} />
                  <View style={styles.infoContent}>
                    <ThemedText type="secondary" style={styles.infoLabel}>Date & Time</ThemedText>
                    <ThemedText style={styles.infoValue}>{dateTime.date}</ThemedText>
                    <ThemedText style={styles.infoValue}>{dateTime.time}</ThemedText>
                  </View>
                </View>
              )}

              {/* Location */}
              {eventDetail.lat !== -1 && eventDetail.lon !== -1 && (
                <View style={styles.infoRow}>
                  <MapPin size={20} color={theme.colors.primary} strokeWidth={2} />
                  <View style={styles.infoContent}>
                    <ThemedText type="secondary" style={styles.infoLabel}>Location</ThemedText>
                    <ThemedText style={styles.infoValue}>
                      {eventDetail.lat.toFixed(6)}, {eventDetail.lon.toFixed(6)}
                    </ThemedText>
                  </View>
                </View>
              )}

              {/* Speed */}
              {eventDetail.speed !== undefined && eventDetail.speed > 0 && (
                <View style={styles.infoRow}>
                  <ThemedText style={styles.speedIcon}>🚗</ThemedText>
                  <View style={styles.infoContent}>
                    <ThemedText type="secondary" style={styles.infoLabel}>Speed</ThemedText>
                    <ThemedText style={styles.infoValue}>{eventDetail.speed} mph</ThemedText>
                  </View>
                </View>
              )}

              {/* Duration */}
              {eventDetail.duration !== undefined && eventDetail.duration > 0 && (
                <View style={styles.infoRow}>
                  <Clock size={20} color={theme.colors.primary} strokeWidth={2} />
                  <View style={styles.infoContent}>
                    <ThemedText type="secondary" style={styles.infoLabel}>Duration</ThemedText>
                    <ThemedText style={styles.infoValue}>{eventDetail.duration}s</ThemedText>
                  </View>
                </View>
              )}

              {/* Status */}
              {eventDetail.status && (
                <View style={styles.infoRow}>
                  <ThemedText style={styles.speedIcon}>
                    {eventDetail.status === 'resolved' ? '✅' : '🔔'}
                  </ThemedText>
                  <View style={styles.infoContent}>
                    <ThemedText type="secondary" style={styles.infoLabel}>Status</ThemedText>
                    <ThemedText style={styles.infoValue}>
                      {eventDetail.status.charAt(0).toUpperCase() + eventDetail.status.slice(1)}
                    </ThemedText>
                  </View>
                </View>
              )}
            </View>

            {/* Additional Metadata */}
            {eventDetail.metadata && typeof eventDetail.metadata === 'object' && (
              <View style={styles.section}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>
                  Additional Information
                </ThemedText>
                {Object.entries(eventDetail.metadata).map(([key, value]) => (
                  <View key={key} style={styles.metadataRow}>
                    <ThemedText type="secondary" style={styles.metadataKey}>
                      {key}:
                    </ThemedText>
                    <ThemedText style={styles.metadataValue}>
                      {String(value)}
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        ) : null}
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
    color: '#FF3B30',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  videoSection: {
    backgroundColor: '#000',
    width: SCREEN_WIDTH,
    gap: 2, // Small gap between videos
  },
  videoContainer: {
    backgroundColor: '#000',
    aspectRatio: 16 / 9,
    width: '100%',
    position: 'relative',
  },
  cameraLabel: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
    zIndex: 10,
  },
  cameraLabelText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  cameraSelector: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 8,
  },
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
  },
  cameraButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  videoLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  videoLoadingText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  controlBar: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 10,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  controlButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrubberContainer: {
    width: '100%',
    marginTop: 20,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timeText: {
    fontSize: 12,
  },
  scrubberTrack: {
    height: 40,
    width: '100%',
    justifyContent: 'center',
    position: 'relative',
  },
  scrubberProgress: {
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    left: 0,
  },
  scrubberThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    position: 'absolute',
    marginLeft: -8,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  section: {
    padding: 20,
    gap: 16,
  },
  eventTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  eventType: {
    fontSize: 24,
    fontWeight: '700',
    flex: 1,
  },
  severityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  severityText: {
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  speedIcon: {
    fontSize: 20,
    width: 20,
    textAlign: 'center',
  },
  infoContent: {
    flex: 1,
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  metadataRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  metadataKey: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 120,
  },
  metadataValue: {
    fontSize: 14,
    flex: 1,
  },
});
