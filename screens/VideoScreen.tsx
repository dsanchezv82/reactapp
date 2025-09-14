import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as NavigationBar from 'expo-navigation-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  Camera,
  Maximize,
  Minimize,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Sun,
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
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Import your themed components
import ThemedText from '../components/ThemedText';
import ThemedView from '../components/ThemedView';
import { useTheme } from '../contexts/ThemeContext';

// Mobile-optimized video item interface for backend integration
interface VideoItem {
  id: number;
  title: string;
  description: string;
  source: any; // Will be string URL when connected to backend
  thumbnail?: string; // Optional thumbnail URL for mobile performance
  duration?: number; // Video duration in seconds for UX  
  category?: string; // Video category for organization
  createdAt?: string; // ISO date string for sorting
}

// Mobile-optimized screen dimensions interface
interface ScreenDimensions {
  width: number;
  height: number;
}

export default function VideoScreen(): React.JSX.Element {
  const [currentVideoIndex, setCurrentVideoIndex] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [screenData, setScreenData] = useState<ScreenDimensions>(Dimensions.get('window'));
  const [orientation, setOrientation] = useState<ScreenOrientation.Orientation>(
    ScreenOrientation.Orientation.PORTRAIT_UP
  );
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const parentNavigator = useRef<any>(null);
  const { theme, isDark, toggleTheme } = useTheme();

  // Debug theme state for mobile development
  useEffect(() => {
    console.log('📱 VideoScreen theme state - isDark:', isDark, 'background:', theme.colors.background);
  }, [isDark, theme]);

  // Backend API configuration - secure production domain
  const API_ENDPOINT = 'https://api.garditech.com/api/videos';
  
  // Sample videos with fallback system for mobile development
  const sampleVideos: VideoItem[] = [
    {
      id: 1,
      title: 'Gardi Protect',
      description: 'Learn how Gardi keeps your teen protected on the road',
      source: require('../assets/videos/protect-video.mp4'),
      category: 'Safety',
      duration: 120, // 2 minutes
      // TODO: Replace with streaming endpoint when backend is ready
      // source: `${API_ENDPOINT}/protect-video.mp4`,
      // thumbnail: `${API_ENDPOINT}/thumbnails/protect-video.jpg`,
    },
    {
      id: 2,
      title: 'Teen Driver Safety',
      description: 'Best practices for young drivers',
      source: require('../assets/videos/teen-safety.mp4'),
      category: 'Education',
      duration: 180, // 3 minutes
      // TODO: Replace with streaming endpoint when backend is ready
      // source: `${API_ENDPOINT}/teen-safety.mp4`,
      // thumbnail: `${API_ENDPOINT}/thumbnails/teen-safety.jpg`,
    },
    // Temporarily commented out until asset is available
    // {
    //   id: 3,
    //   title: 'Gardi Features Overview',
    //   description: 'Complete overview of all Gardi safety features',
    //   source: require('../assets/videos/features-overview.mp4'),
    //   category: 'Tutorial',
    //   duration: 240, // 4 minutes
    // },
  ];

  // Modern expo-video player setup with mobile optimization
  const player = useVideoPlayer(sampleVideos[currentVideoIndex].source, (player) => {
    player.loop = false;
    player.muted = isMuted;
    // Mobile optimization: External playback support for AirPlay/Chromecast
    player.allowsExternalPlayback = true;
    // Note: Picture-in-Picture is handled by VideoView component, not player
  });

  // Store parent navigator reference for tab bar control
  useEffect(() => {
    parentNavigator.current = navigation.getParent();
  }, [navigation]);

  // Update status bar style based on theme for cross-platform compatibility
  useEffect(() => {
    if (!isFullscreen) {
      StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor(theme.colors.surface, true);
      }
    }
  }, [isDark, isFullscreen, theme]);

  // Listen for orientation changes with mobile performance optimization
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

  // Auto-hide controls after 3 seconds when playing for better mobile UX
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

  // Enhanced fullscreen mode with cross-platform tab bar suppression
  useEffect(() => {
    const handleFullscreenMode = async () => {
      try {
        if (isFullscreen) {
          // Hide status bar with smooth animation
          StatusBar.setHidden(true, 'slide');
          
          // Multi-level tab bar hiding for React Navigation compatibility
          const rootNavigator = navigation.getParent();
          const tabNavigator = rootNavigator?.getParent();
          
          // Hide tab bar at all navigation levels
          const hiddenTabBarStyle = { 
            display: 'none' as const,
            height: 0,
            opacity: 0,
            position: 'absolute' as const,
            bottom: -100,
          };

          if (parentNavigator.current) {
            parentNavigator.current.setOptions({ tabBarStyle: hiddenTabBarStyle });
          }
          
          if (rootNavigator) {
            rootNavigator.setOptions({ tabBarStyle: hiddenTabBarStyle });
          }
          
          if (tabNavigator) {
            tabNavigator.setOptions({ tabBarStyle: hiddenTabBarStyle });
          }
          
          try {
            navigation.setOptions({
              tabBarVisible: false,
              tabBarStyle: { display: 'none' },
            });
          } catch (error) {
            console.log('Navigation setOptions error:', error);
          }
          
          // Android-specific navigation bar handling
          if (Platform.OS === 'android') {
            await NavigationBar.setVisibilityAsync('hidden');
            await NavigationBar.setBehaviorAsync('inset-swipe');
            await NavigationBar.setBackgroundColorAsync('#00000000');
          }
          
          // Allow all orientations in fullscreen for better video experience
          await ScreenOrientation.unlockAsync();
          
        } else {
          // Restore status bar with theme-appropriate style
          StatusBar.setHidden(false, 'slide');
          StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
          
          // Restore tab bar with theme colors
          const rootNavigator = navigation.getParent();
          const tabNavigator = rootNavigator?.getParent();
          
          const originalTabBarStyle = {
            display: 'flex' as const,
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: Platform.OS === 'ios' ? 90 : 60,
            position: 'relative' as const,
            bottom: 0,
            opacity: 1,
          };
          
          // Restore all navigation levels with theme styling
          if (parentNavigator.current) {
            parentNavigator.current.setOptions({ tabBarStyle: originalTabBarStyle });
          }
          
          if (rootNavigator) {
            rootNavigator.setOptions({ tabBarStyle: originalTabBarStyle });
          }
          
          if (tabNavigator) {
            tabNavigator.setOptions({ tabBarStyle: originalTabBarStyle });
          }
          
          try {
            navigation.setOptions({
              tabBarVisible: true,
              tabBarStyle: originalTabBarStyle,
            });
          } catch (error) {
            console.log('Navigation restore setOptions error:', error);
          }
          
          // Restore Android navigation bar with theme colors
          if (Platform.OS === 'android') {
            await NavigationBar.setVisibilityAsync('visible');
            await NavigationBar.setBackgroundColorAsync(theme.colors.surface);
          }
          
          // Lock to portrait when not in fullscreen for mobile UX
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
      } catch (error) {
        console.log('Error handling fullscreen mode:', error);
      }
    };

    handleFullscreenMode();
  }, [isFullscreen, navigation, isDark, theme]);

  // Enhanced cleanup with React Navigation focus handling
  useFocusEffect(
    useCallback(() => {
      return () => {
        // Force restore all UI elements when screen loses focus
        StatusBar.setHidden(false, 'slide');
        StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
        
        const originalTabBarStyle = {
          display: 'flex' as const,
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === 'ios' ? 90 : 60,
          position: 'relative' as const,
          bottom: 0,
          opacity: 1,
        };
        
        // Restore tab bar at all navigation levels
        const rootNavigator = navigation.getParent();
        const tabNavigator = rootNavigator?.getParent();
        
        if (parentNavigator.current) {
          parentNavigator.current.setOptions({ tabBarStyle: originalTabBarStyle });
        }
        
        if (rootNavigator) {
          rootNavigator.setOptions({ tabBarStyle: originalTabBarStyle });
        }
        
        if (tabNavigator) {
          tabNavigator.setOptions({ tabBarStyle: originalTabBarStyle });
        }
        
        try {
          navigation.setOptions({
            tabBarVisible: true,
            tabBarStyle: originalTabBarStyle,
          });
        } catch (error) {
          console.log('Navigation cleanup error:', error);
        }
        
        // Platform-specific cleanup
        if (Platform.OS === 'android') {
          NavigationBar.setVisibilityAsync('visible').catch(console.log);
          NavigationBar.setBackgroundColorAsync(theme.colors.surface).catch(console.log);
        }
        
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(console.log);
        
        if (isFullscreen) {
          setIsFullscreen(false);
        }
      };
    }, [isFullscreen, navigation, isDark, theme])
  );

  // Mobile-optimized video control handlers
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

  // Enhanced video loading with asset validation for mobile development
  const loadVideo = useCallback(async (videoIndex: number): Promise<void> => {
    try {
      if (videoIndex >= sampleVideos.length || videoIndex < 0) {
        throw new Error('Invalid video index');
      }

      const selectedVideo = sampleVideos[videoIndex];
      
      // Validate video source exists
      if (!selectedVideo.source) {
        throw new Error('Video source not found');
      }

      setCurrentVideoIndex(videoIndex);
      setShowControls(true);
      
      console.log(`📱 Loading video: ${selectedVideo.title}`);
      await player.replace(selectedVideo.source);
      
    } catch (error) {
      console.log('❌ Video loading error:', error);
      
      // Mobile-friendly error handling with specific messaging
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error occurred';
        
      Alert.alert(
        'Video Error', 
        `Failed to load video: ${sampleVideos[videoIndex]?.title || 'Unknown video'}\n\nError: ${errorMessage}`,
        [
          { 
            text: 'Try Again', 
            onPress: () => {
              // Retry loading the same video
              if (videoIndex < sampleVideos.length) {
                loadVideo(videoIndex);
              }
            },
            style: 'default' 
          },
          { 
            text: 'Cancel', 
            style: 'cancel' 
          }
        ]
      );
    }
  }, [player, sampleVideos]);

  const handleVideoPress = useCallback((): void => {
    setShowControls(!showControls);
  }, [showControls]);

  // Check if device is in landscape orientation
  const isLandscape = orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT || 
                     orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;

  // Create dynamic styles based on theme for cross-platform consistency
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.surface,
      paddingTop: 60,
      paddingBottom: 24,
      paddingHorizontal: 24,
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      ...Platform.select({
        ios: {
          shadowColor: theme.colors.shadow,
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
      backgroundColor: theme.colors.secondary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    themeToggle: {
      position: 'absolute',
      top: 60,
      right: 24,
      padding: 12,
      borderRadius: 24,
      backgroundColor: theme.colors.secondary,
      minWidth: 48,
      minHeight: 48,
      justifyContent: 'center',
      alignItems: 'center',
    },
    playlistSection: {
      backgroundColor: theme.colors.surface,
      marginHorizontal: 16,
      marginBottom: 32,
      borderRadius: 12,
      padding: 20,
      ...Platform.select({
        ios: {
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.3 : 0.1,
          shadowRadius: 4,
        },
        android: {
          elevation: 3,
        },
      }),
    },
    playlistItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      minHeight: 60,
    },
    activePlaylistItem: {
      backgroundColor: theme.colors.secondary,
      borderRadius: 8,
      marginHorizontal: -8,
      paddingHorizontal: 12,
    },
    playlistThumbnail: {
      width: 48,
      height: 48,
      borderRadius: 8,
      backgroundColor: theme.colors.secondary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    activePlaylistThumbnail: {
      backgroundColor: theme.colors.primary,
    },
    playlistTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 4,
    },
    activePlaylistTitle: {
      color: theme.colors.primary,
    },
    playlistDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
  });

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

  // Normal mode with themed UI using new components
  return (
    <ThemedView style={dynamicStyles.container}>
      <ThemedView surface style={dynamicStyles.header}>
        <TouchableOpacity 
          style={dynamicStyles.themeToggle}
          onPress={() => {
            console.log('🔘 Theme toggle pressed! Current isDark:', isDark);
            toggleTheme();
          }}
          activeOpacity={0.7}
          accessibilityLabel={isDark ? "Switch to light theme" : "Switch to dark theme"}
          accessibilityRole="button"
        >
          {isDark ? (
            <Sun size={24} color={theme.colors.primary} strokeWidth={2} />
          ) : (
            <Moon size={24} color={theme.colors.primary} strokeWidth={2} />
          )}
        </TouchableOpacity>
        
        <View style={dynamicStyles.headerIcon}>
          <Camera size={32} color={theme.colors.primary} strokeWidth={2} />
        </View>
        <ThemedText type="title">Gardi Stream</ThemedText>
        <ThemedText type="secondary">Video Library</ThemedText>
      </ThemedView>

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

        <ThemedView surface style={dynamicStyles.playlistSection}>
          <ThemedText type="title">Available Videos</ThemedText>
          
          {sampleVideos.map((videoItem: VideoItem, index: number) => (
            <TouchableOpacity 
              key={videoItem.id} 
              style={[
                dynamicStyles.playlistItem,
                currentVideoIndex === index && dynamicStyles.activePlaylistItem
              ]}
              onPress={() => loadVideo(index)}
              activeOpacity={0.7}
              accessibilityLabel={`Play ${videoItem.title}`}
              accessibilityRole="button"
            >
              <View style={[
                dynamicStyles.playlistThumbnail,
                currentVideoIndex === index && dynamicStyles.activePlaylistThumbnail
              ]}>
                <VideoIcon 
                  size={24} 
                  color={currentVideoIndex === index ? "#FFFFFF" : theme.colors.primary} 
                  strokeWidth={2} 
                />
              </View>
              <View style={styles.playlistInfo}>
                <ThemedText 
                  type="subtitle"
                  style={[
                    dynamicStyles.playlistTitle,
                    currentVideoIndex === index && dynamicStyles.activePlaylistTitle
                  ]}
                >
                  {videoItem.title}
                </ThemedText>
                <ThemedText type="secondary" style={dynamicStyles.playlistDescription}>
                  {videoItem.description}
                </ThemedText>
              </View>
            </TouchableOpacity>
          ))}
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

// Static styles that don't change with theme for performance optimization
const styles = StyleSheet.create({
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
  playlistInfo: {
    flex: 1,
  },
});