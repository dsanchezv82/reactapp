const API_BASE_URL = 'https://api.garditech.com/api';

/**
 * Wake up a device by sending a request to the backend
 * @param imei - Device IMEI number
 * @param authToken - User's authentication token
 * @returns Promise with success status and message
 */
export async function wakeUpDevice(
  imei: string,
  authToken: string
): Promise<{ success: boolean; message: string }> {
  try {
    console.log('🔔 Attempting to wake device:', imei);
    
    const url = `${API_BASE_URL}/devices/${imei}/wake-up`;
    console.log('🌐 Wake-up URL:', url);
    
    const response = await fetch(
      url,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('📡 Wake-up response status:', response.status);
    
    // Read response body once
    const responseText = await response.text();
    console.log('📄 Wake-up response body:', responseText);
    
    if (!response.ok) {
      let errorMessage = 'Failed to wake up device';
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error || errorMessage;
      } catch {
        // If JSON parsing fails, use the text response
        if (responseText) {
          errorMessage = responseText;
        }
      }
      console.error('❌ Wake-up failed:', errorMessage);
      
      // Provide more helpful message for common errors
      if (errorMessage.includes('Something went wrong')) {
        throw new Error('Unable to wake camera. The device may be offline or unreachable. Please ensure the device has cellular signal.');
      }
      throw new Error(errorMessage);
    }

    // Parse the successful response
    const data = JSON.parse(responseText);
    console.log('✅ Wake-up successful:', data);

    if (data.success) {
      return {
        success: true,
        message: '✅ Camera wake command sent! Wait 30-60 seconds, then tap Retry.'
      };
    } else {
      return {
        success: false,
        message: 'Failed to wake up the camera. Please try again.'
      };
    }
  } catch (error: any) {
    console.error('❌ Wake up device error:', error);
    return {
      success: false,
      message: error.message || 'Unable to wake up the camera. Please check your connection.'
    };
  }
}
