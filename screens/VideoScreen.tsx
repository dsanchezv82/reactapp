import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as NavigationBar from 'expo-navigation-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  Camera,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Video as VideoIcon,
  Volume2,
  VolumeX
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface VideoItem {
  id: number;
  title: string;
  description: string;
  source: any;
}

export default function VideoScreen(): React.JSX.Element {
  const [currentVideoIndex, setCurrentVideoIndex] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [screenData, setScreenData] = useState(Dimensions.get('window'));
  const [orientation, setOrientation] = useState<ScreenOrientation.Orientation>(
    ScreenOrientation.Orientation.PORTRAIT_UP
  );
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const parentNavigator = useRef<any>(null);

  // TODO: Replace with backend API endpoint when ready
  // const API_ENDPOINT = 'https://your-backend.com/api/videos';
  
  const sampleVideos: VideoItem[] = [
    {
      id: 1,
      title: 'Gardi Protect',
      description: 'Learn how Gardi keeps your teen protected on the road',
      source: require('../assets/videos/protect-video.mp4'),
      // TODO: Replace with streaming endpoint when backend is ready
      // source: `${API_ENDPOINT}/protect-video.mp4`,
    },
    {
      id: 2,
      title: 'Teen Driver Safety',
      description: 'Best practices for young drivers',
      source: require('../assets/videos/teen-safety.mp4'),
      // TODO: Replace with streaming endpoint when backend is ready
      // source: `${API_ENDPOINT}/teen-safety.mp4`,
    },
  ];

  // Modern expo-video player setup with mobile optimization
  const player = useVideoPlayer(sampleVideos[currentVideoIndex].source, (player) => {
    player.loop = false;
    player.muted = isMuted;
  });

  // Store parent navigator reference
  useEffect(() => {
    parentNavigator.current = navigation.getParent();
  }, [navigation]);

  // Listen for orientation changes
  useEffect(() => {
    const getOrientation = async () => {
      const currentOrientation = await ScreenOrientation.getOrientationAsync();
      setOrientation(currentOrientation);
    };

    getOrientation();

    const subscription = ScreenOrientation.addOrientationChangeListener((event) => {
      setOrientation(event.orientationInfo.orientation);
    });

    const dimensionSubscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenData(window);
    });

    return () => {
      subscription.remove();
      dimensionSubscription?.remove();
    };
  }, []);

  // Auto-hide controls after 3 seconds when playing
  useEffect(() => {
    let hideControlsTimer: NodeJS.Timeout;
    
    if (player.playing && showControls) {
      hideControlsTimer = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }

    return () => {
      if (hideControlsTimer) {
        clearTimeout(hideControlsTimer);
      }
    };
  }, [player.playing, showControls]);

  // Enhanced fullscreen mode with working tab bar suppression
  useEffect(() => {
    const handleFullscreenMode = async () => {
      try {
        if (isFullscreen) {
          // Hide status bar
          StatusBar.setHidden(true, 'slide');
          
          // Working tab bar hiding - target all possible navigation levels
          const rootNavigator = navigation.getParent();
          const tabNavigator = rootNavigator?.getParent();
          
          // Method 1: Direct parent navigator
          if (parentNavigator.current) {
            parentNavigator.current.setOptions({
              tabBarStyle: { 
                display: 'none',
                height: 0,
                opacity: 0,
                position: 'absolute',
                bottom: -100,
              }
            });
          }
          
          // Method 2: Root navigator
          if (rootNavigator) {
            rootNavigator.setOptions({
              tabBarStyle: { 
                display: 'none',
                height: 0,
                opacity: 0,
                position: 'absolute',
                bottom: -100,
              }
            });
          }
          
          // Method 3: Tab navigator (if exists)
          if (tabNavigator) {
            tabNavigator.setOptions({
              tabBarStyle: { 
                display: 'none',
                height: 0,
                opacity: 0,
                position: 'absolute',
                bottom: -100,
              }
            });
          }
          
          // Method 4: Use navigation context to hide tab bar
          try {
            navigation.setOptions({
              tabBarVisible: false,
              tabBarStyle: { display: 'none' },
            });
          } catch (error) {
            console.log('Navigation setOptions error:', error);
          }
          
          // Hide Android navigation bar
          if (Platform.OS === 'android') {
            await NavigationBar.setVisibilityAsync('hidden');
            await NavigationBar.setBehaviorAsync('inset-swipe');
            await NavigationBar.setBackgroundColorAsync('#00000000');
          }
          
          // Allow all orientations in fullscreen
          await ScreenOrientation.unlockAsync();
          
        } else {
          // Restore status bar
          StatusBar.setHidden(false, 'slide');
          
          // Restore tab bar - target all navigation levels
          const rootNavigator = navigation.getParent();
          const tabNavigator = rootNavigator?.getParent();
          
          const originalTabBarStyle = {
            display: 'flex',
            backgroundColor: '#FFFFFF',
            borderTopColor: '#E5E5EA',
            borderTopWidth: StyleSheet.hairlineWidth,
            height: Platform.OS === 'ios' ? 90 : 60,
            position: 'relative',
            bottom: 0,
            opacity: 1,
          };
          
          // Restore all navigation levels
          if (parentNavigator.current) {
            parentNavigator.current.setOptions({
              tabBarStyle: originalTabBarStyle
            });
          }
          
          if (rootNavigator) {
            rootNavigator.setOptions({
              tabBarStyle: originalTabBarStyle
            });
          }
          
          if (tabNavigator) {
            tabNavigator.setOptions({
              tabBarStyle: originalTabBarStyle
            });
          }
          
          try {
            navigation.setOptions({
              tabBarVisible: true,
              tabBarStyle: originalTabBarStyle,
            });
          } catch (error) {
            console.log('Navigation restore setOptions error:', error);
          }
          
          // Restore Android navigation bar
          if (Platform.OS === 'android') {
            await NavigationBar.setVisibilityAsync('visible');
            await NavigationBar.setBackgroundColorAsync('#FFFFFF');
          }
          
          // Lock to portrait when not in fullscreen
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
      } catch (error) {
        console.log('Error handling fullscreen mode:', error);
      }
    };

    handleFullscreenMode();
  }, [isFullscreen, navigation]);

  // Enhanced cleanup with working restoration methods
  useFocusEffect(
    useCallback(() => {
      return () => {
        // Force restore all UI elements
        StatusBar.setHidden(false, 'slide');
        
        const originalTabBarStyle = {
          display: 'flex',
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E5EA',
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === 'ios' ? 90 : 60,
          position: 'relative',
          bottom: 0,
          opacity: 1,
        };
        
        // Restore tab bar at all navigation levels
        const rootNavigator = navigation.getParent();
        const tabNavigator = rootNavigator?.getParent();
        
        if (parentNavigator.current) {
          parentNavigator.current.setOptions({
            tabBarStyle: originalTabBarStyle
          });
        }
        
        if (rootNavigator) {
          rootNavigator.setOptions({
            tabBarStyle: originalTabBarStyle
          });
        }
        
        if (tabNavigator) {
          tabNavigator.setOptions({
            tabBarStyle: originalTabBarStyle
          });
        }
        
        try {
          navigation.setOptions({
            tabBarVisible: true,
            tabBarStyle: originalTabBarStyle,
          });
        } catch (error) {
          console.log('Navigation cleanup error:', error);
        }
        
        if (Platform.OS === 'android') {
          NavigationBar.setVisibilityAsync('visible').catch(console.log);
          NavigationBar.setBackgroundColorAsync('#FFFFFF').catch(console.log);
        }
        
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(console.log);
        
        if (isFullscreen) {
          setIsFullscreen(false);
        }
      };
    }, [isFullscreen, navigation])
  );

  const handlePlayPause = useCallback((): void => {
    if (player.playing) {
      player.pause();
      setShowControls(true);
    } else {
      player.play();
      setShowControls(false);
    }
  }, [player]);

  const handleRestart = useCallback((): void => {
    player.currentTime = 0;
    player.play();
    setShowControls(false);
  }, [player]);

  const toggleMute = useCallback((): void => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    player.muted = newMutedState;
    if (player.playing) {
      setTimeout(() => setShowControls(false), 1500);
    }
  }, [isMuted, player]);

  const toggleFullscreen = useCallback((): void => {
    setIsFullscreen(!isFullscreen);
    setShowControls(true);
  }, [isFullscreen]);

  const loadVideo = useCallback(async (videoIndex: number): Promise<void> => {
    try {
      setCurrentVideoIndex(videoIndex);
      setShowControls(true);
      await player.replace(sampleVideos[videoIndex].source);
    } catch (error) {
      console.log('Error loading video:', error);
      Alert.alert('Error', `Failed to load video: ${sampleVideos[videoIndex].title}`);
    }
  }, [player, sampleVideos]);

  const handleVideoPress = useCallback((): void => {
    setShowControls(!showControls);
  }, [showControls]);

  // Check if device is in landscape orientation
  const isLandscape = orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT || 
                     orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;

  // Responsive fullscreen video player with proper dimensions
  const FullscreenVideoPlayer = () => (
    <View style={styles.fullscreenContainer}>
      <VideoView
        style={{
          width: screenData.width,
          height: screenData.height,
        }}
        player={player}
        allowsFullscreen={false}
        allowsPictureInPicture
        contentFit="contain"
        nativeControls={false}
      />
      
      <TouchableOpacity 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: screenData.width,
          height: screenData.height,
        }}
        onPress={handleVideoPress}
        activeOpacity={1}
      >
        {showControls && (
          <View style={styles.fullscreenOverlay}>
            <View style={styles.fullscreenControlsContainer}>
              <TouchableOpacity 
                style={styles.controlButton} 
                onPress={handleRestart}
                activeOpacity={0.7}
                accessibilityLabel="Restart video"
                accessibilityRole="button"
              >
                <RotateCcw size={28} color="#FFFFFF" strokeWidth={2} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.fullscreenPlayButton} 
                onPress={handlePlayPause}
                activeOpacity={0.7}
                accessibilityLabel={player.playing ? "Pause video" : "Play video"}
                accessibilityRole="button"
              >
                {player.playing ? (
                  <Pause size={40} color="#FFFFFF" strokeWidth={2} />
                ) : (
                  <Play size={40} color="#FFFFFF" strokeWidth={2} />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.controlButton} 
                onPress={toggleMute}
                activeOpacity={0.7}
                accessibilityLabel={isMuted ? "Unmute video" : "Mute video"}
                accessibilityRole="button"
              >
                {isMuted ? (
                  <VolumeX size={28} color="#FFFFFF" strokeWidth={2} />
                ) : (
                  <Volume2 size={28} color="#FFFFFF" strokeWidth={2} />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.controlButton} 
                onPress={toggleFullscreen}
                activeOpacity={0.7}
                accessibilityLabel="Exit fullscreen"
                accessibilityRole="button"
              >
                <Minimize size={28} color="#FFFFFF" strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  // If in fullscreen mode, render responsive video player
  if (isFullscreen) {
    return <FullscreenVideoPlayer />;
  }

  // Normal mode with full UI
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Camera size={32} color="#007AFF" strokeWidth={2} />
        </View>
        <Text style={styles.headerTitle}>Gardi Stream</Text>
        <Text style={styles.headerSubtitle}>Video Library</Text>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.videoContainer}>
          <VideoView
            style={{
              width: screenData.width - 32,
              height: (screenData.width - 32) * (isLandscape ? 0.8 : 0.56),
            }}
            player={player}  
            allowsFullscreen={false}
            allowsPictureInPicture
            contentFit="contain"
            nativeControls={false}
          />
          
          <TouchableOpacity 
            style={styles.videoTouchArea}
            onPress={handleVideoPress}
            activeOpacity={1}
          >
            {showControls && (
              <View style={styles.videoOverlay}>
                <View style={styles.controlsContainer}>
                  <TouchableOpacity 
                    style={styles.controlButton} 
                    onPress={handleRestart}
                    activeOpacity={0.7}
                    accessibilityLabel="Restart video"
                    accessibilityRole="button"
                  >
                    <RotateCcw size={24} color="#FFFFFF" strokeWidth={2} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.playButton} 
                    onPress={handlePlayPause}
                    activeOpacity={0.7}
                    accessibilityLabel={player.playing ? "Pause video" : "Play video"}
                    accessibilityRole="button"
                  >
                    {player.playing ? (
                      <Pause size={32} color="#FFFFFF" strokeWidth={2} />
                    ) : (
                      <Play size={32} color="#FFFFFF" strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.controlButton} 
                    onPress={toggleMute}
                    activeOpacity={0.7}
                    accessibilityLabel={isMuted ? "Unmute video" : "Mute video"}  
                    accessibilityRole="button"
                  >
                    {isMuted ? (
                      <VolumeX size={24} color="#FFFFFF" strokeWidth={2} />
                    ) : (
                      <Volume2 size={24} color="#FFFFFF" strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.controlButton} 
                    onPress={toggleFullscreen}
                    activeOpacity={0.7}
                    accessibilityLabel="Enter fullscreen"
                    accessibilityRole="button"
                  >
                    <Maximize size={24} color="#FFFFFF" strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.playlistSection}>
          <Text style={styles.sectionTitle}>Available Videos</Text>
          
          {sampleVideos.map((videoItem: VideoItem, index: number) => (
            <TouchableOpacity 
              key={videoItem.id} 
              style={[
                styles.playlistItem,
                currentVideoIndex === index && styles.activePlaylistItem
              ]}
              onPress={() => loadVideo(index)}
              activeOpacity={0.7}
              accessibilityLabel={`Play ${videoItem.title}`}
              accessibilityRole="button"
            >
              <View style={[
                styles.playlistThumbnail,
                currentVideoIndex === index && styles.activePlaylistThumbnail
              ]}>
                <VideoIcon 
                  size={24} 
                  color={currentVideoIndex === index ? "#FFFFFF" : "#007AFF"} 
                  strokeWidth={2} 
                />
              </View>
              <View style={styles.playlistInfo}>
                <Text style={[
                  styles.playlistTitle,
                  currentVideoIndex === index && styles.activePlaylistTitle
                ]}>
                  {videoItem.title}
                </Text>
                <Text style={styles.playlistDescription}>
                  {videoItem.description}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1D1D1F',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6E6E73',
  },
  content: {
    flex: 1,
  },
  videoContainer: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  videoTouchArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  videoOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  controlButton: {
    padding: 10,
    marginHorizontal: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    padding: 12,
    marginHorizontal: 16,
    minWidth: 56,
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Responsive fullscreen styles with proper dimensions
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  fullscreenControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  fullscreenPlayButton: {
    padding: 16,
    marginHorizontal: 20,
    minWidth: 72,
    minHeight: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 32,
    borderRadius: 12,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1D1D1F',
    marginBottom: 16,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
    minHeight: 60,
  },
  activePlaylistItem: {
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
    marginHorizontal: -8,
    paddingHorizontal: 12,
  },
  playlistThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activePlaylistThumbnail: {
    backgroundColor: '#007AFF',
  },
  playlistInfo: {
    flex: 1,
  },
  playlistTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1D1D1F',
    marginBottom: 4,
  },
  activePlaylistTitle: {
    color: '#007AFF',
  },
  playlistDescription: {
    fontSize: 14,
    color: '#6E6E73',
  },
});