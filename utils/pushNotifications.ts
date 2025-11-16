import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const API_BASE_URL = 'https://api.garditech.com/api';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register for push notifications and get device token
 * iOS will prompt user for permission
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('⚠️ Push notifications only work on physical devices');
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('⚠️ Permission for push notifications was denied');
      return null;
    }

    // Get the device push token
    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData.data;
    
    console.log('✅ Device push token:', token);
    return token;
  } catch (error) {
    console.error('❌ Error getting push token:', error);
    return null;
  }
}

/**
 * Send device token to backend for registration
 */
export async function sendDeviceTokenToBackend(
  deviceToken: string,
  authToken: string
): Promise<boolean> {
  try {
    console.log('📤 Sending device token to backend...');
    
    const response = await fetch(`${API_BASE_URL}/notifications/mobile/subscribe`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `authToken=${authToken}`,
      },
      credentials: 'include',
      body: JSON.stringify({ 
        deviceToken,
        platform: Platform.OS === 'ios' ? 'ios' : 'android'
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to register token: ${error}`);
    }

    const result = await response.json();
    console.log('✅ Device token registered:', result);
    return true;
  } catch (error) {
    console.error('❌ Error registering device token:', error);
    return false;
  }
}

/**
 * Remove device token from backend (call on logout)
 * Sets the token to null by calling subscribe with empty platform
 */
export async function removeDeviceTokenFromBackend(authToken: string): Promise<boolean> {
  try {
    console.log('🗑️ Removing device token from backend...');
    
    // Backend doesn't have a delete endpoint, so we'll set token to null
    // by updating with an empty/null token
    const response = await fetch(`${API_BASE_URL}/notifications/mobile/subscribe`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `authToken=${authToken}`,
      },
      credentials: 'include',
      body: JSON.stringify({ 
        deviceToken: null,
        platform: Platform.OS === 'ios' ? 'ios' : 'android'
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to remove token');
    }

    console.log('✅ Device token removed from backend');
    return true;
  } catch (error) {
    console.error('❌ Error removing device token:', error);
    return false;
  }
}

/**
 * Set up notification listeners
 * Returns cleanup function
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationTapped?: (response: Notifications.NotificationResponse) => void
) {
  // Listen for notifications while app is in foreground
  const receivedSubscription = Notifications.addNotificationReceivedListener(notification => {
    console.log('🔔 Notification received:', notification);
    onNotificationReceived?.(notification);
  });

  // Listen for user tapping notification
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('👆 Notification tapped:', response);
    onNotificationTapped?.(response);
  });

  // Return cleanup function
  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
