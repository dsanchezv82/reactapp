/**
 * Device API utilities
 * Functions to interact with device-related backend endpoints
 */

const API_BASE_URL = 'https://api.garditech.com/api';

/**
 * Fetch device information for the authenticated user
 * Note: The backend doesn't have a direct "get my device" endpoint,
 * so we'll try the GPS endpoint which internally fetches the device by userId
 */
export async function getUserDevice(authToken: string, userId: string) {
  try {
    console.log('📱 Fetching device for userId:', userId);
    
    // The GPS endpoint requires start/end dates but will tell us if device exists
    // We'll use dummy dates just to trigger the device lookup
    const dummyStart = '2025-01-01';
    const dummyEnd = '2025-01-02';
    
    const response = await fetch(
      `${API_BASE_URL}/devices/${userId}/gps?start=${dummyStart}&end=${dummyEnd}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', response.headers.get('content-type'));

    // Check if response is JSON before parsing
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
      console.log('📡 Device response data:', data);
    } else {
      // Response is plain text (likely an error message)
      const textData = await response.text();
      console.log('📡 Device response text:', textData);
      
      if (response.status === 500) {
        return { hasDevice: false, error: 'Server error: ' + textData };
      }
      
      data = { error: textData };
    }

    if (response.status === 404 && data.error?.includes('Device IMEI not found')) {
      console.log('⚠️ No device associated with this user account');
      return { hasDevice: false, error: 'No device registered to this account' };
    }

    if (response.ok) {
      console.log('✅ Device found for user');
      // GPS data returned means device exists
      return { hasDevice: true, gpsData: data.gpsData };
    }

    return { hasDevice: false, error: data.error || 'Failed to fetch device' };
  } catch (error) {
    console.error('❌ Error fetching device:', error);
    return { hasDevice: false, error: String(error) };
  }
}

/**
 * Register a new device for the authenticated user
 */
export async function registerDevice(
  authToken: string,
  deviceInfo: {
    imei: string;
    name: string;
    insurer?: string;
    autoYear?: number;
    autoMake?: string;
    autoModel?: string;
  }
) {
  try {
    console.log('📱 Registering device:', deviceInfo);

    const response = await fetch(`${API_BASE_URL}/devices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deviceInfo),
    });

    const data = await response.json();
    console.log('📡 Register device response:', response.status, data);

    if (response.ok) {
      console.log('✅ Device registered successfully');
      return { success: true, message: data.message };
    }

    return { success: false, error: data.error || 'Failed to register device' };
  } catch (error) {
    console.error('❌ Error registering device:', error);
    return { success: false, error: 'Network error' };
  }
}
