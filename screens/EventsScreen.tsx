import { AlertTriangle, Calendar, Clock, MapPin, Video } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Platform,
    RefreshControl,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Import themed components
import EventDetailModal from '../components/EventDetailModal';
import ThemedText from '../components/ThemedText';
import ThemedView from '../components/ThemedView';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

// Backend API configuration
const API_BASE_URL = 'https://api.garditech.com/api';

// Event interface matching Surfsight API response
interface DeviceEvent {
  id: string | number;
  eventType: string;
  time: string; // Surfsight uses 'time' not 'timestamp'
  lat: number;
  lon: number;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  severity?: number; // Surfsight uses numeric severity (1-5)
  status?: 'new' | 'resolved';
  description?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  speed?: number;
  metadata?: string | Record<string, any>;
  files?: any[];
  driver?: boolean;
  eventComments?: any[];
}

export default function EventsScreen() {
  const [events, setEvents] = useState<DeviceEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<'all' | 'today'>('all');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const { theme } = useTheme();
  const { user, authToken } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (user?.imei) {
      loadEvents(true); // true = reset/initial load
    }
  }, [user?.imei]);

  // Load events from backend with device IMEI
  const loadEvents = async (reset: boolean = false) => {
    if (!user?.imei) {
      setLoading(false);
      return;
    }
    
    // If loading more and already at the end, don't fetch
    if (!reset && !hasMore) {
      console.log('📭 No more events to load');
      return;
    }

    try {
      const currentOffset = reset ? 0 : offset;
      
      if (reset) {
        setLoading(true);
        setOffset(0);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }
      
      console.log('🔄 Loading device events for IMEI:', user.imei);
      console.log('📊 Offset:', currentOffset, '| Reset:', reset);
      console.log('🔑 Auth token:', authToken ? 'Present' : 'Missing');
      
      // Get events from last 7 days
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Note: API spec says GET with body, but React Native fetch doesn't support that
      // Backend must be accepting query params as well, since it was working
      const queryParams = new URLSearchParams({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        limit: '50',
        offset: String(currentOffset),
      });
      
      const url = `${API_BASE_URL}/events/${user.imei}?${queryParams.toString()}`;
      console.log('📍 API URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      console.log('📡 Events response status:', response.status);

      const responseText = await response.text();
      console.log('📦 Raw response (first 500 chars):', responseText.substring(0, 500));

      if (!response.ok) {
        console.error('❌ HTTP Error:', response.status);
        console.error('❌ Response body:', responseText);
        const errorData = JSON.parse(responseText || '{}');
        console.error('❌ Failed to load events:', errorData);
        Alert.alert('Error', errorData.error || errorData.message || responseText || 'Failed to load events');
        if (reset) {
          setEvents([]);
        }
        return;
      }

      if (response.ok) {
        const responseData = JSON.parse(responseText);
        console.log('📦 Response keys:', Object.keys(responseData || {}));
        
        const allEvents = responseData.data || [];
        const eventMetadata = responseData.metadata || {};
        
        // Filter out accOn events - we only care about other event types
        const filteredEvents = allEvents.filter((event: DeviceEvent) => 
          event.eventType?.toLowerCase() !== 'accon'
        );
        
        // TODO: Re-enable driver filter when driver assignments are working
        // const driverEvents = filteredEvents.filter((event: DeviceEvent) => event.driver === true);
        const driverEvents = filteredEvents; // Show all events for now
        
        // Update state based on whether this is a reset or loading more
        if (reset) {
          setEvents(driverEvents);
        } else {
          setEvents(prevEvents => [...prevEvents, ...driverEvents]);
        }
        
        // Update pagination state - use allEvents.length for offset (before filtering)
        const newOffset = currentOffset + allEvents.length;
        setOffset(newOffset);
        
        // Check if there are more events to load
        // If we received fewer than 50 total events, we've reached the end
        setHasMore(allEvents.length === 50);
        
        // Update total count if available in metadata
        if (eventMetadata.total !== undefined) {
          setTotalCount(eventMetadata.total);
        }
        
        console.log('✅ Total events received:', allEvents.length);
        console.log('✅ Events loaded:', driverEvents.length);
        console.log('📊 Metadata:', eventMetadata);
        console.log('📊 New offset:', newOffset, '| Has more:', allEvents.length === 50);
        
        if (driverEvents.length > 0) {
          console.log('✅ First event:', JSON.stringify(driverEvents[0], null, 2));
        } else {
          console.log('ℹ️ No events found for this time range');
        }
      } else {
        const errorData = JSON.parse(responseText || '{}');
        console.log('❌ Failed to load events:', errorData);
        Alert.alert('Error', errorData.error || errorData.message || 'Failed to load events');
        if (reset) {
          setEvents([]);
        }
      }
    } catch (error) {
      console.log('❌ Network error loading events:', error);
      Alert.alert('Error', 'Failed to load events. Please try again.');
      if (reset) {
        setEvents([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Load more events (pagination)
  const loadMoreEvents = () => {
    if (!loadingMore && hasMore) {
      console.log('📥 Loading more events...');
      loadEvents(false);
    }
  };

  // Pull-to-refresh functionality
  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents(true); // Reset and reload from beginning
    setRefreshing(false);
  };

  // Fetch individual event details
  const openEventDetail = (eventId: string) => {
    setSelectedEventId(eventId);
    setModalVisible(true);
  };

  // Get severity icon and color based on Surfsight numeric severity (1-5)
  const getSeverityInfo = (severity?: number) => {
    if (!severity) return { color: theme.colors.textSecondary, icon: '📍' };
    
    // Surfsight severity scale: 1=lowest, 5=highest
    if (severity >= 4) {
      return { color: '#FF3B30', icon: '🚨' }; // Critical (4-5)
    } else if (severity === 3) {
      return { color: '#FF9500', icon: '⚠️' }; // High (3)
    } else if (severity === 2) {
      return { color: '#FFCC00', icon: '⚡' }; // Medium (2)
    } else {
      return { color: '#34C759', icon: 'ℹ️' }; // Low (1)
    }
  };

  // Format timestamp - Surfsight uses 'time' field
  const formatEventTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = date.toDateString() === new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString();
    
    let dateStr = '';
    if (isToday) dateStr = 'Today';
    else if (isYesterday) dateStr = 'Yesterday';
    else dateStr = date.toLocaleDateString();
    
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    return `${dateStr} • ${timeStr}`;
  };

  // Filter events
  const getFilteredEvents = () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filter) {
      case 'today':
        return events.filter(event => new Date(event.time) >= todayStart);
      default:
        return events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    }
  };

  // Render event card
  const renderEvent = ({ item }: { item: DeviceEvent }) => {
    const severityInfo = getSeverityInfo(item.severity);
    
    return (
      <TouchableOpacity
        style={[
          styles.eventItem,
          {
            backgroundColor: theme.colors.surface,
            borderColor: '#00ACB4',
          }
        ]}
        onPress={() => openEventDetail(String(item.id))}
        activeOpacity={0.7}
      >
        {item.thumbnailUrl && (
          <Image 
            source={{ uri: item.thumbnailUrl }} 
            style={styles.thumbnail}
            resizeMode="cover"
          />
        )}
        
        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            <View style={styles.eventInfo}>
              <View style={styles.eventTitleRow}>
                <ThemedText type="subtitle" style={styles.eventTitle}>
                  {item.eventType || 'Event'}
                </ThemedText>
                <View style={[styles.severityBadge, { backgroundColor: severityInfo.color + '20' }]}>
                  <ThemedText style={[styles.severityText, { color: severityInfo.color }]}>
                    {severityInfo.icon} {item.severity || 'Info'}
                  </ThemedText>
                </View>
              </View>
              
              <View style={styles.eventMeta}>
                <Clock size={14} color={theme.colors.textSecondary} strokeWidth={2} />
                <ThemedText type="secondary" style={styles.eventTime}>
                  {formatEventTime(item.time)}
                </ThemedText>
              </View>
            </View>
          </View>
          
          {item.description && (
            <ThemedText style={styles.eventDescription} numberOfLines={2}>
              {item.description}
            </ThemedText>
          )}

          <View style={styles.eventDetails}>
            {/* Show coordinates if available (lat/lon from Surfsight) */}
            {item.lat !== -1 && item.lon !== -1 && (
              <View style={styles.eventLocation}>
                <MapPin size={14} color={theme.colors.textSecondary} strokeWidth={2} />
                <ThemedText type="secondary" style={styles.locationText} numberOfLines={1}>
                  {item.lat.toFixed(5)}, {item.lon.toFixed(5)}
                </ThemedText>
              </View>
            )}
            
            {/* Show video indicator if files are available */}
            {item.files && item.files.length > 0 && (
              <View style={styles.videoIndicator}>
                <Video size={14} color={theme.colors.primary} strokeWidth={2} />
                <ThemedText type="secondary" style={[styles.videoText, { color: theme.colors.primary }]}>
                  {item.files.length} Video{item.files.length > 1 ? 's' : ''}
                </ThemedText>
              </View>
            )}
            
            {/* Show speed if available */}
            {item.speed !== undefined && item.speed > 0 && (
              <ThemedText type="secondary" style={styles.speedText}>
                {item.speed} mph
              </ThemedText>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Filter button component
  const FilterButton = ({ title, filterValue }: { title: string; filterValue: typeof filter }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filter === filterValue && { backgroundColor: '#00ACB4' },
        { borderColor: '#00ACB4' }
      ]}
      onPress={() => setFilter(filterValue)}
      activeOpacity={0.7}
    >
      <ThemedText style={[
        styles.filterButtonText,
        { color: filter === filterValue ? '#FFFFFF' : '#00ACB4' }
      ]}>
        {title}
      </ThemedText>
    </TouchableOpacity>
  );

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingTop: insets.top,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
  });

  const filteredEvents = getFilteredEvents();

  // No IMEI state
  if (!user?.imei) {
    return (
      <ThemedView style={dynamicStyles.container}>
        <View style={dynamicStyles.header}>
          <ThemedText type="title">Events</ThemedText>
        </View>
        <View style={dynamicStyles.emptyContainer}>
          <AlertTriangle size={48} color={theme.colors.textSecondary} strokeWidth={1.5} />
          <ThemedText type="title" style={styles.emptyTitle}>
            No Device Connected
          </ThemedText>
          <ThemedText type="secondary" style={styles.emptySubtitle}>
            Please register a device to view events.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  // Loading state
  if (loading) {
    return (
      <ThemedView style={dynamicStyles.container}>
        <View style={dynamicStyles.header}>
          <ThemedText type="title">Events</ThemedText>
        </View>
        <View style={dynamicStyles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <ThemedText type="secondary" style={{ marginTop: 16 }}>
            Loading events...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={dynamicStyles.container}>
      {/* Header */}
      <View style={dynamicStyles.header}>
        <ThemedText type="title">Events</ThemedText>
      </View>

      {/* Filter buttons */}
      <View style={styles.filterContainer}>
        <FilterButton title="All" filterValue="all" />
        <FilterButton title="Today" filterValue="today" />
      </View>

      {filteredEvents.length === 0 ? (
        <View style={dynamicStyles.emptyContainer}>
          <Calendar size={48} color={theme.colors.textSecondary} strokeWidth={1.5} />
          <ThemedText type="title" style={styles.emptyTitle}>
            No Events Found
          </ThemedText>
          <ThemedText type="secondary" style={styles.emptySubtitle}>
            {filter === 'all' 
              ? "No events recorded for this device."
              : "No events recorded today."
            }
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          renderItem={renderEvent}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          onEndReached={loadMoreEvents}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadingFooter}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <ThemedText type="secondary" style={styles.loadingText}>
                  Loading more events...
                </ThemedText>
              </View>
            ) : !hasMore && events.length > 0 ? (
              <View style={styles.loadingFooter}>
                <ThemedText type="secondary" style={styles.loadingText}>
                  No more events
                </ThemedText>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      )}

      {/* Event Detail Modal */}
      {selectedEventId && user?.imei && (
        <EventDetailModal
          visible={modalVisible}
          eventId={selectedEventId}
          imei={user.imei}
          onClose={() => {
            setModalVisible(false);
            setSelectedEventId(null);
          }}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    paddingVertical: 8,
  },
  loadingFooter: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  eventItem: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#00ACB4',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  thumbnail: {
    width: '100%',
    height: 120,
    backgroundColor: '#000',
  },
  eventContent: {
    padding: 16,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  eventTitle: {
    flex: 1,
    marginRight: 8,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  severityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventTime: {
    fontSize: 12,
    marginLeft: 4,
  },
  eventDescription: {
    marginBottom: 12,
    lineHeight: 20,
  },
  eventDetails: {
    gap: 8,
  },
  eventLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 14,
    marginLeft: 6,
    flex: 1,
  },
  videoIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoText: {
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '500',
  },
  speedText: {
    fontSize: 12,
    marginLeft: 4,
  },
  emptyTitle: {
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
    lineHeight: 20,
  },
});
