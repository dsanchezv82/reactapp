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
import ThemedText from '../components/ThemedText';
import ThemedView from '../components/ThemedView';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

// Backend API configuration
const API_BASE_URL = 'https://api.garditech.com/api';

// Event interface matching Surfsight API response
interface DeviceEvent {
  id: string;
  eventType: string;
  timestamp: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  severity?: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  speed?: number;
  metadata?: Record<string, any>;
}

export default function EventsScreen() {
  const [events, setEvents] = useState<DeviceEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'critical' | 'today'>('all');

  const { theme } = useTheme();
  const { user, authToken } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (user?.imei) {
      loadEvents();
    }
  }, [user?.imei]);

  // Load events from backend with device IMEI
  const loadEvents = async () => {
    if (!user?.imei) {
      setLoading(false);
      return;
    }

    try {
      console.log('🔄 Loading device events for IMEI:', user.imei);
      console.log('🔑 Auth token:', authToken ? 'Present' : 'Missing');
      console.log('📍 API URL:', `${API_BASE_URL}/events/${user.imei}`);
      
      const response = await fetch(`${API_BASE_URL}/events/${user.imei}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      console.log('📡 Events response status:', response.status);
      console.log('📡 Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));

      const responseText = await response.text();
      console.log('📦 Raw response:', responseText.substring(0, 500)); // First 500 chars

      if (response.ok) {
        const data = JSON.parse(responseText);
        console.log('📦 Full response data:', JSON.stringify(data, null, 2));
        console.log('📦 Data type:', typeof data);
        console.log('📦 Is array?', Array.isArray(data));
        console.log('📦 Data keys:', Object.keys(data || {}));
        
        const eventsList = data.events || data.data || (Array.isArray(data) ? data : []);
        setEvents(eventsList);
        console.log('✅ Events loaded successfully:', eventsList.length);
        console.log('✅ First event:', eventsList[0] ? JSON.stringify(eventsList[0], null, 2) : 'No events');
      } else {
        const errorData = JSON.parse(responseText || '{}');
        console.log('❌ Failed to load events:', errorData);
        Alert.alert('Error', errorData.error || errorData.message || 'Failed to load events');
        setEvents([]);
      }
    } catch (error) {
      console.log('❌ Network error loading events:', error);
      Alert.alert('Error', 'Failed to load events. Please try again.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  // Pull-to-refresh functionality
  const onRefresh = async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  };

  // Fetch individual event details
  const fetchEventDetails = async (eventId: string) => {
    if (!user?.imei) return;

    try {
      console.log('🔄 Loading event details:', eventId);
      
      const response = await fetch(`${API_BASE_URL}/events/${user.imei}/${eventId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Event details loaded:', data);
        // Handle event details (could open a modal or navigate to detail screen)
        Alert.alert('Event Details', JSON.stringify(data, null, 2));
      } else {
        Alert.alert('Error', 'Failed to load event details');
      }
    } catch (error) {
      console.log('❌ Error loading event details:', error);
      Alert.alert('Error', 'Failed to load event details');
    }
  };

  // Get severity icon and color
  const getSeverityInfo = (severity?: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return { color: '#FF3B30', icon: '🚨' };
      case 'high':
        return { color: '#FF9500', icon: '⚠️' };
      case 'medium':
        return { color: '#FFCC00', icon: '⚡' };
      case 'low':
        return { color: '#34C759', icon: 'ℹ️' };
      default:
        return { color: theme.colors.textSecondary, icon: '📍' };
    }
  };

  // Format timestamp
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
      case 'critical':
        return events.filter(event => 
          event.severity?.toLowerCase() === 'critical' || event.severity?.toLowerCase() === 'high'
        );
      case 'today':
        return events.filter(event => new Date(event.timestamp) >= todayStart);
      default:
        return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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
            borderColor: theme.colors.border,
          }
        ]}
        onPress={() => fetchEventDetails(item.id)}
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
                  {formatEventTime(item.timestamp)}
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
            {item.location?.address && (
              <View style={styles.eventLocation}>
                <MapPin size={14} color={theme.colors.textSecondary} strokeWidth={2} />
                <ThemedText type="secondary" style={styles.locationText} numberOfLines={1}>
                  {item.location.address}
                </ThemedText>
              </View>
            )}
            
            {item.videoUrl && (
              <View style={styles.videoIndicator}>
                <Video size={14} color={theme.colors.primary} strokeWidth={2} />
                <ThemedText type="secondary" style={[styles.videoText, { color: theme.colors.primary }]}>
                  Video Available
                </ThemedText>
              </View>
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
        filter === filterValue && { backgroundColor: theme.colors.primary },
        { borderColor: theme.colors.primary }
      ]}
      onPress={() => setFilter(filterValue)}
      activeOpacity={0.7}
    >
      <ThemedText style={[
        styles.filterButtonText,
        { color: filter === filterValue ? '#FFFFFF' : theme.colors.primary }
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
        <FilterButton title="Critical" filterValue="critical" />
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
              : filter === 'critical'
              ? "No critical events found."
              : "No events recorded today."
            }
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          renderItem={renderEvent}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    paddingVertical: 8,
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
    borderWidth: StyleSheet.hairlineWidth,
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
