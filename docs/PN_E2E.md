# Push Notifications End-to-End Technical Documentation

## Overview

This document details how push notifications work in the Gardi system, from device registration to event delivery. The system uses **Expo Push Notifications** for React Native apps and integrates with **SurfSight webhooks** for event-driven notifications.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         NOTIFICATION FLOW                            │
└─────────────────────────────────────────────────────────────────────┘

SurfSight Camera Event
        ↓
SurfSight API (Event Webhook)
        ↓
Backend: POST /api/webhooks/events
        ↓
[Event Processing & Validation]
        ↓
[Push Notification Service]
        ↓
APNS (iOS) / FCM (Android)
        ↓
React Native App (Expo Notifications)
        ↓
User receives notification
```

---

## 1. Device Token Registration (React Native Side)

### **Location**: `reactapp/utils/pushNotifications.ts`

### **Flow**:

1. **App Login** → `AuthContext.tsx` calls `registerForPushNotifications()`
2. **Request Permission** → Expo asks user for notification permission
3. **Get Device Token** → Expo returns APNS (iOS) or FCM (Android) token
4. **Send to Backend** → `sendDeviceTokenToBackend()` sends token to API

### **Code Implementation**:

```typescript
// reactapp/utils/pushNotifications.ts

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
    
    return token; // Returns APNS token (iOS) or FCM token (Android)
  } catch (error) {
    console.error('❌ Error getting push token:', error);
    return null;
  }
}

export async function sendDeviceTokenToBackend(
  deviceToken: string,
  authToken: string
): Promise<boolean> {
  try {
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
      throw new Error('Failed to register token');
    }

    return true;
  } catch (error) {
    console.error('❌ Error registering device token:', error);
    return false;
  }
}
```

### **AuthContext Integration**:

```typescript
// reactapp/contexts/AuthContext.tsx (lines 271-291)

// After successful login:
try {
  const deviceToken = await registerForPushNotifications();
  if (deviceToken) {
    const registered = await sendDeviceTokenToBackend(deviceToken, token);
    if (registered) {
      console.log('✅ Push notifications registered successfully');
    }
  }
} catch (error) {
  console.log('⚠️ Push notification registration failed:', error);
  // Don't fail login if push notification registration fails
}
```

---

## 2. Backend Token Storage

### **Location**: `backend/src/modules/notification/`

### **Database Schema**:

```typescript
// backend/src/modules/notification/notification.schema.ts

export const notificationTable = pgTable('notification', {
    userId: integer()
        .primaryKey()
        .notNull()
        .references(() => userTable.userId, { onDelete: 'cascade' }),

    apnsDeviceToken: varchar({ length: 70 }).unique(),  // iOS tokens
    fcmDeviceToken: varchar({ length: 255 }).unique(),  // Android tokens
});
```

### **API Endpoint**:

**Endpoint**: `PATCH /api/notifications/mobile/subscribe`  
**Auth**: Required (JWT via cookie)  
**Request Body**:
```json
{
  "deviceToken": "ExponentPushToken[xxxxxxxxxxxxxx]",
  "platform": "ios" | "android"
}
```

### **Controller Implementation**:

```typescript
// backend/src/modules/notification/notification.controller.ts

export async function subscribeToMobileNotificationsController(req: Request, res: Response) {
    try {
        const userId = Number(req.userId);
        const { deviceToken, platform } = req.body;

        if (!deviceToken || !platform || (platform !== 'ios' && platform !== 'android')) {
            res.status(400).json({
                error: 'deviceToken and valid platform (ios or android) are required.',
            });
            return;
        }

        // Check that the given user exists
        const user = await db.transaction(async (tx: any) => {
            return await getUserByIdTx(tx, userId);
        });
        
        if (!user) {
            res.status(404).json({ error: `User with userId ${userId} not found.` });
            return;
        }

        // Get existing notification record
        const notificationRecord = await db.transaction(async (tx: any) => {
            return await getNotificationRecordByUserIdTx(tx, userId);
        });

        // Create notification record if it doesn't exist
        if (!notificationRecord) {
            await db.transaction(async (tx: any) => {
                await createNotificationRecordTx(tx, userId);
            });
        }

        // Save device token
        if (platform === 'ios') {
            await db.transaction(async (tx: any) => {
                await updateApnsDeviceTokenTx(tx, userId, deviceToken);
            });
            res.status(200).json({ message: 'APNS device token saved successfully.' });
        } else if (platform === 'android') {
            await db.transaction(async (tx: any) => {
                await updateFcmDeviceTokenTx(tx, userId, deviceToken);
            });
            res.status(200).json({ message: 'FCM device token saved successfully.' });
        }
    } catch (err: any) {
        console.error('Error in subscribeToMobileNotificationsController:', err);
        res.status(500).json({ error: 'Something went wrong.' });
    }
}
```

### **Repository Functions**:

```typescript
// backend/src/modules/notification/notification.repository.ts

export async function createNotificationRecordTx(tx: any, userId: number) {
    const user = await getUserByIdTx(tx, userId);
    if (!user.deviceId) {
        throw new Error(`No device associated for user with userId ${userId}.`);
    }

    await tx.insert(notificationTable).values({
        userId: userId,
        apnsDeviceToken: null,
        fcmDeviceToken: null,
    });
}

export async function updateApnsDeviceTokenTx(tx: any, userId: number, apnsDeviceToken: string) {
    await tx
        .update(notificationTable)
        .set({ apnsDeviceToken })
        .where(eq(notificationTable.userId, userId));
}

export async function updateFcmDeviceTokenTx(tx: any, userId: number, fcmDeviceToken: string) {
    await tx
        .update(notificationTable)
        .set({ fcmDeviceToken })
        .where(eq(notificationTable.userId, userId));
}
```

---

## 3. SurfSight Webhook Configuration

### **Location**: `backend/src/services/surfsight/surfsight.organization.ts`

### **When Configured**:
Webhooks are set up during **organization registration** (when new user signs up):

```typescript
// backend/src/modules/auth/auth.controller.ts (line 104+)

export async function startRegistrationController(req: Request, res: Response) {
    try {
        // ... create organization in SurfSight ...
        
        // Set up event webhooks for this organization
        await setWebhooksForEntireOrganizationSurfsight(organizationId);
        
        // ... continue registration ...
    } catch (error) {
        // ...
    }
}
```

### **Webhook Setup Function**:

```typescript
// backend/src/services/surfsight/surfsight.organization.ts

export async function setWebhooksForEntireOrganizationSurfsight(orgId: string) {
    try {
        const surfsightPartnerJwt = await generatePartnerTokenSurfsight();

        const res = await fetch(
            `${SURFSIGHT_API_URL}/${SURFSIGHT_API_VERSION}/organizations/${orgId}/webhook-settings`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + surfsightPartnerJwt,
                },
                body: JSON.stringify({
                    eventWebhookUrl: [process.env.EVENTS_WEBHOOK_URL as string],
                    eventWebhookConfig: {
                        notifyMediaAvailable: { isEnabled: false },
                    },
                    // Other webhook types (GPS, alarms, system messages) can be added here
                }),
            },
        );

        const json = await res.json();

        if (!res.ok) {
            const errorMsg = json?.message || 'Unknown Surfsight error';
            throw new Error(`Surfsight error (${res.status}): ${errorMsg}`);
        }

        return json;
    } catch (err: any) {
        throw new Error(`Surfsight webhook setup failed: ${err.message}`);
    }
}
```

### **Environment Variable Required**:
```bash
EVENTS_WEBHOOK_URL=https://api.garditech.com/api/webhooks/events
```

---

## 4. Event Webhook Reception & Processing

### **Location**: `backend/src/services/webhooks/index.ts`

### **Endpoint**: `POST /api/webhooks/events`

### **Flow**:

1. SurfSight camera detects event (harsh braking, collision, button press, etc.)
2. SurfSight API sends webhook to `EVENTS_WEBHOOK_URL`
3. Backend validates webhook signature using organization's SSO secret
4. Backend processes event data
5. **[TODO]** Backend sends push notification to user's device

### **Current Implementation**:

```typescript
// backend/src/services/webhooks/index.ts

webhooksRouter.post('/events', express.json(), async (req, res) => {
    try {
        const data = req.body;

        // Get the SSO secret for the organization
        const orgId = req.body.data.driver.organizationId;
        const orgData = await getOrganizationSurfsight(orgId);
        const ssoSecret = orgData.ssoSecret;

        const signature = req.get('X-Surfsight-Signature');

        const webhookResponse = {
            type: 'event',
            data: data,
        };

        // Validate the webhook signature
        const isValidWebhookSignature = await validateWebhookSignature(
            process.env.EVENT_WEBHOOK_URL as string,
            ssoSecret,
            webhookResponse,
            signature as string,
        );

        if (!isValidWebhookSignature) {
            res.status(401).send('Invalid webhook signature.');
            return;
        }

        // TODO: Handle webhook appropriately (send push notification)
        
        res.status(200).send('OK');
    } catch (err: any) {
        console.error('Error handling webhook event:', err);
        res.status(500).send('Internal Server Error');
    }
});

async function validateWebhookSignature(
    webhookUrl: string,
    ssoSecret: string,
    webhookResponse: any,
    xSurfsightSignature: string,
) {
    const validSignature = crypto
        .createHmac('sha512', ssoSecret)
        .update(JSON.stringify(webhookResponse) + webhookUrl)
        .digest('hex');

    return validSignature === xSurfsightSignature;
}
```

### **SurfSight Event Payload Example**:

```json
{
  "type": "event",
  "data": {
    "id": 5353262438,
    "serialNumber": "357660105105563",
    "eventType": "button",           // button, harsh_brake, collision, etc.
    "time": 1732037132,               // Unix timestamp
    "lat": -1,
    "lon": -1,
    "alt": -1,
    "speed": 0,
    "metadata": null,
    "other": "",
    "files": [
      {
        "cameraId": 1,
        "file": 1732037132,
        "fileType": "video",
        "mediaAvailable": true
      },
      {
        "cameraId": 2,
        "file": 1732037132,
        "fileType": "video",
        "mediaAvailable": false
      }
    ],
    "driver": {
      "_id": "67f36ed53c42617ee090ed37",
      "isActive": true,
      "drivingLicense": "1234",
      "lastName": "abc",
      "firstName": "driver-1",
      "driverThirdPartyId": "test-driver-1",
      "organizationId": 100150814,
      "imei": "357660105105563"
    }
  }
}
```

---

## 5. What's Needed for Event Notifications

### **Missing Implementation** (TODO):

The webhook receiver currently validates the signature but **does not send push notifications**. Here's what needs to be implemented:

### **Step-by-Step Implementation Plan**:

#### **5.1. Install Expo Push Notification Service**

```bash
npm install expo-server-sdk
```

#### **5.2. Create Push Notification Service**

**File**: `backend/src/services/push/index.ts`

```typescript
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

const expo = new Expo();

export interface PushNotificationData {
    title: string;
    body: string;
    data?: any;
    badge?: number;
    sound?: 'default' | null;
    priority?: 'default' | 'normal' | 'high';
}

export async function sendPushNotification(
    deviceToken: string,
    notification: PushNotificationData
): Promise<boolean> {
    try {
        // Check if token is valid Expo push token
        if (!Expo.isExpoPushToken(deviceToken)) {
            console.error(`Push token ${deviceToken} is not a valid Expo push token`);
            return false;
        }

        // Construct push message
        const message: ExpoPushMessage = {
            to: deviceToken,
            sound: notification.sound || 'default',
            title: notification.title,
            body: notification.body,
            data: notification.data,
            priority: notification.priority || 'high',
            badge: notification.badge,
        };

        // Send push notification
        const chunks = expo.chunkPushNotifications([message]);
        const tickets = [];

        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                console.error('Error sending push notification chunk:', error);
            }
        }

        // Check if any tickets have errors
        for (const ticket of tickets) {
            if (ticket.status === 'error') {
                console.error(`Error sending push notification: ${ticket.message}`);
                return false;
            }
        }

        console.log('✅ Push notification sent successfully');
        return true;
    } catch (error) {
        console.error('❌ Error in sendPushNotification:', error);
        return false;
    }
}

export async function sendPushNotificationToMultiple(
    deviceTokens: string[],
    notification: PushNotificationData
): Promise<void> {
    const messages: ExpoPushMessage[] = deviceTokens
        .filter(token => Expo.isExpoPushToken(token))
        .map(token => ({
            to: token,
            sound: notification.sound || 'default',
            title: notification.title,
            body: notification.body,
            data: notification.data,
            priority: notification.priority || 'high',
            badge: notification.badge,
        }));

    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
        try {
            await expo.sendPushNotificationsAsync(chunk);
        } catch (error) {
            console.error('Error sending push notification chunk:', error);
        }
    }
}
```

#### **5.3. Update Webhook Handler**

```typescript
// backend/src/services/webhooks/index.ts

import { sendPushNotification } from '../push';
import { getNotificationRecordByUserIdTx } from '../../modules/notification/notification.repository';
import { getUserByImeiTx } from '../../modules/user/user.repository';

webhooksRouter.post('/events', express.json(), async (req, res) => {
    try {
        const data = req.body;

        // ... existing validation code ...

        if (!isValidWebhookSignature) {
            res.status(401).send('Invalid webhook signature.');
            return;
        }

        // Process the event and send notification
        const imei = data.data.driver.imei;
        const eventType = data.data.eventType;
        const eventId = data.data.id;
        const timestamp = data.data.time;

        // Find user by IMEI
        const user = await db.transaction(async (tx) => {
            return await getUserByImeiTx(tx, imei);
        });

        if (!user) {
            console.error(`User not found for IMEI: ${imei}`);
            res.status(200).send('OK'); // Still return 200 to SurfSight
            return;
        }

        // Get user's device token
        const notificationRecord = await db.transaction(async (tx) => {
            return await getNotificationRecordByUserIdTx(tx, user.userId);
        });

        if (!notificationRecord) {
            console.log(`No notification record for user ${user.userId}`);
            res.status(200).send('OK');
            return;
        }

        // Determine device token based on platform
        const deviceToken = notificationRecord.apnsDeviceToken || notificationRecord.fcmDeviceToken;

        if (!deviceToken) {
            console.log(`No device token registered for user ${user.userId}`);
            res.status(200).send('OK');
            return;
        }

        // Format event type for display
        const eventTypeDisplay = formatEventType(eventType);

        // Send push notification
        await sendPushNotification(deviceToken, {
            title: `${eventTypeDisplay} Event Detected`,
            body: `A ${eventTypeDisplay.toLowerCase()} event was recorded at ${new Date(timestamp * 1000).toLocaleString()}`,
            data: {
                eventId: eventId,
                eventType: eventType,
                imei: imei,
                timestamp: timestamp,
                screen: 'Events', // Navigate to Events screen
            },
            sound: 'default',
            priority: 'high',
            badge: 1,
        });

        res.status(200).send('OK');
    } catch (err: any) {
        console.error('Error handling webhook event:', err);
        res.status(500).send('Internal Server Error');
    }
});

function formatEventType(eventType: string): string {
    const eventTypeMap: { [key: string]: string } = {
        'button': 'Button Press',
        'harsh_brake': 'Harsh Braking',
        'harsh_acceleration': 'Harsh Acceleration',
        'harsh_turn': 'Harsh Turn',
        'collision': 'Collision',
        'speeding': 'Speeding',
        'distraction': 'Driver Distraction',
        'drowsiness': 'Driver Drowsiness',
        'phone_use': 'Phone Use',
        'seatbelt': 'Seatbelt Violation',
    };
    
    return eventTypeMap[eventType] || eventType;
}
```

#### **5.4. Add Repository Function**

```typescript
// backend/src/modules/user/user.repository.ts

export async function getUserByImeiTx(tx: any, imei: string) {
    const device = await getDeviceByImeiTx(tx, imei);
    if (!device) return null;

    const [user] = await tx
        .select()
        .from(userTable)
        .where(eq(userTable.deviceId, device.deviceId));
    
    return user;
}
```

#### **5.5. Handle Notification in React Native**

```typescript
// reactapp/utils/pushNotifications.ts

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
    
    // Navigate to appropriate screen based on notification data
    const { eventId, screen } = response.notification.request.content.data || {};
    
    if (screen === 'Events' && eventId) {
      // Navigate to Events screen and open event details
      navigation.navigate('Events', { eventId });
    }
    
    onNotificationTapped?.(response);
  });

  // Return cleanup function
  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
}
```

---

## 6. Event Types & Notification Messages

### **SurfSight Event Types**:

| Event Type | Display Name | Priority | Badge |
|-----------|-------------|----------|-------|
| `button` | Button Press | Normal | 0 |
| `harsh_brake` | Harsh Braking | High | 1 |
| `harsh_acceleration` | Harsh Acceleration | High | 1 |
| `harsh_turn` | Harsh Turn | High | 1 |
| `collision` | Collision | High | 1 |
| `speeding` | Speeding | High | 1 |
| `distraction` | Driver Distraction | High | 1 |
| `drowsiness` | Driver Drowsiness | High | 1 |
| `phone_use` | Phone Use | High | 1 |
| `seatbelt` | Seatbelt Violation | High | 1 |

### **Notification Payload Format**:

```typescript
{
  title: "Harsh Braking Event Detected",
  body: "A harsh braking event was recorded at 11/18/2025, 3:45 PM",
  data: {
    eventId: 5353262438,
    eventType: "harsh_brake",
    imei: "357660105105563",
    timestamp: 1732037132,
    screen: "Events"
  },
  sound: "default",
  priority: "high",
  badge: 1
}
```

---

## 7. Testing Push Notifications

### **7.1. Test Token Registration**:

```bash
# Login and check if token is saved
curl -X POST https://api.garditech.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  -c cookies.txt

# Verify token is registered
curl -X GET https://api.garditech.com/api/users/me \
  -b cookies.txt
```

### **7.2. Test Webhook Reception**:

```bash
# Simulate SurfSight webhook
curl -X POST https://api.garditech.com/api/webhooks/events \
  -H "Content-Type: application/json" \
  -H "X-Surfsight-Signature: <calculated_signature>" \
  -d '{
    "type": "event",
    "data": {
      "id": 5353262438,
      "serialNumber": "357660105105563",
      "eventType": "harsh_brake",
      "time": 1732037132,
      "driver": {
        "organizationId": 100150814,
        "imei": "357660105105563"
      }
    }
  }'
```

### **7.3. Test Push Notification Sending**:

```typescript
// Create test endpoint in backend
app.post('/api/test/push', async (req, res) => {
  const { userId } = req.body;
  
  const notificationRecord = await db.transaction(async (tx) => {
    return await getNotificationRecordByUserIdTx(tx, userId);
  });
  
  const deviceToken = notificationRecord?.apnsDeviceToken || notificationRecord?.fcmDeviceToken;
  
  if (deviceToken) {
    await sendPushNotification(deviceToken, {
      title: 'Test Notification',
      body: 'This is a test push notification',
      data: { test: true },
    });
    res.json({ success: true });
  } else {
    res.json({ success: false, error: 'No device token found' });
  }
});
```

---

## 8. Production Considerations

### **8.1. Rate Limiting**:
- Expo has rate limits (600 notifications per second)
- Implement queue system for high-volume events
- Consider using Redis for notification queue

### **8.2. Error Handling**:
- Handle expired/invalid tokens
- Implement retry logic for failed notifications
- Log notification delivery status

### **8.3. Database Indexing**:
```sql
-- Add index for faster user lookup by IMEI
CREATE INDEX idx_devices_imei ON devices(imei);

-- Add index for notification record lookup
CREATE INDEX idx_notification_user_id ON notification(user_id);
```

### **8.4. Notification Preferences**:
Add user preferences table to control which events trigger notifications:

```typescript
export const notificationPreferencesTable = pgTable('notification_preferences', {
    userId: integer().primaryKey().references(() => userTable.userId),
    harshBraking: boolean().default(true),
    collision: boolean().default(true),
    speeding: boolean().default(true),
    distraction: boolean().default(true),
    // ... other event types
});
```

### **8.5. Monitoring**:
- Track notification delivery success rate
- Monitor webhook reception latency
- Alert on failed webhook signature validations

---

## 9. Summary

### **Current Status**: ✅ Token registration working, ⏳ Event notifications TODO

### **What Works**:
- ✅ Device token registration (iOS & Android)
- ✅ Token storage in database
- ✅ Webhook reception from SurfSight
- ✅ Webhook signature validation
- ✅ Notification listeners in React Native app

### **What's Missing**:
- ❌ Push notification sending service (Step 5.2)
- ❌ Event-to-notification mapping (Step 5.3)
- ❌ User lookup by IMEI (Step 5.4)
- ❌ Notification navigation handling (Step 5.5)

### **Next Steps**:
1. Install `expo-server-sdk` in backend
2. Implement push notification service (Section 5.2)
3. Update webhook handler to send notifications (Section 5.3)
4. Test with real device and SurfSight event
5. Add notification preferences UI in React Native app
6. Implement notification history/logging

---

## 10. Related Documentation

- **LIVE_VIDEO_SETUP.md** - Live video streaming implementation
- **GPS_IMPLEMENTATION.md** - GPS tracking system documentation
- [Expo Push Notifications Documentation](https://docs.expo.dev/push-notifications/overview/)
- [SurfSight API Documentation](https://developer.surfsight.net/)
