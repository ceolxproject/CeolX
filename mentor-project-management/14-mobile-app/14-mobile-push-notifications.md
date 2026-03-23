# Mobile Push Notifications

## Description

Implement push notification system using Firebase Cloud Messaging (FCM) + expo-notifications, with token registration, foreground/background/killed-state handling, deep link routing to relevant screens, permission request flows, and badge management for both iOS and Android.

## Affected Apps/Packages

- `apps/mobile/src/services/notificationService.ts` (new)
- `apps/mobile/src/hooks/usePushNotifications.ts` (new)
- `packages/shared/src/services/notificationService.ts` (updated)

## Requirements

### 1. Notification Service Setup

File: `src/services/notificationService.ts`

Core notification configuration:

```typescript
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

// Set up notification handler
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Process notification in foreground
    console.log("Foreground notification:", notification);

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
});

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Check if physical device
    if (!Device.isDevice) {
      console.log("Push notifications only work on physical devices");
      return null;
    }

    // Request permission
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Failed to get push token for push notification");
      return null;
    }

    // Get project ID
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      throw new Error("Missing projectId in app.json");
    }

    // Get FCM token (Android) or APNs token (iOS)
    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    return token.data;
  } catch (error) {
    console.error("Error registering for push notifications:", error);
    return null;
  }
}

export async function registerDeviceToken(token: string): Promise<void> {
  try {
    await notificationBackendService.registerToken({
      token,
      platform: Platform.OS,
      deviceId: await Device.getDeviceTypeAsync(),
    });
  } catch (error) {
    console.error("Failed to register device token:", error);
  }
}

export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error("Failed to set badge count:", error);
  }
}

export async function removeBadge(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    console.error("Failed to remove badge:", error);
  }
}
```

### 2. Push Notifications Hook

File: `src/hooks/usePushNotifications.ts`

Manage notification listeners and routing:

```typescript
interface NotificationData {
  type: "course" | "comment" | "message" | "achievement" | "reminder";
  courseId?: string;
  postId?: string;
  lessonId?: string;
  title: string;
  body: string;
  image?: string;
}

export function usePushNotifications() {
  const navigation = useNavigation();
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    initializePushNotifications();
  }, []);

  const initializePushNotifications = async () => {
    try {
      // Register for push notifications
      const token = await registerForPushNotifications();

      if (token) {
        await registerDeviceToken(token);
        setIsRegistered(true);

        // Listen for foreground notifications
        const subscription = Notifications.addNotificationReceivedListener(
          (notification) => {
            handleNotificationReceived(notification);
          }
        );

        // Listen for notification taps
        const responseSubscription =
          Notifications.addNotificationResponseReceivedListener((response) => {
            handleNotificationResponse(response);
          });

        return () => {
          subscription.remove();
          responseSubscription.remove();
        };
      }
    } catch (error) {
      console.error("Error initializing push notifications:", error);
    }
  };

  const handleNotificationReceived = (
    notification: Notifications.Notification
  ) => {
    const data = notification.request.content.data as NotificationData;

    // Update badge count
    if (data.type === "comment") {
      const currentBadge =
        UIManager.getViewManagerConfig("RCTBadgeView")?.Commands?.setBadge;
      if (currentBadge) {
        setBadgeCount((currentBadge || 0) + 1);
      }
    }
  };

  const handleNotificationResponse = (
    response: Notifications.NotificationResponse
  ) => {
    const data = response.notification.request.content.data as NotificationData;

    // Route to appropriate screen
    switch (data.type) {
      case "course":
        if (data.courseId) {
          navigation.navigate("home", {
            screen: "CourseDetail",
            params: { courseId: data.courseId },
          });
        }
        break;

      case "comment":
        if (data.postId) {
          navigation.navigate("community", {
            screen: "PostDetail",
            params: { postId: data.postId },
          });
        }
        break;

      case "reminder":
        if (data.lessonId && data.courseId) {
          navigation.navigate("home", {
            screen: "LessonPlayer",
            params: {
              courseId: data.courseId,
              lessonId: data.lessonId,
            },
          });
        }
        break;

      case "achievement":
        navigation.navigate("profile");
        break;

      default:
        break;
    }
  };

  return { isRegistered };
}
```

### 3. Notification Request Flow

File: `src/components/notifications/NotificationPermissionModal.tsx`

First-run permission request:

```typescript
export function NotificationPermissionModal({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      const token = await registerForPushNotifications();

      if (token) {
        await registerDeviceToken(token);
      }

      // Mark as requested (show only once)
      await AsyncStorage.setItem('notification_permission_requested', 'true');
      onDismiss();
    } catch (error) {
      showError('Failed to enable notifications');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = async () => {
    // Save preference to not show again
    await AsyncStorage.setItem('notification_permission_dismissed', 'true');
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.container}>
        <View style={styles.content}>
          <Ionicons
            name="notifications"
            size={60}
            color={colors.primary}
          />

          <Text style={styles.title}>Stay Updated</Text>

          <Text style={styles.description}>
            Get notified when instructors reply to your questions, new courses
            are added, or you have learning reminders.
          </Text>

          <Button
            title="Enable Notifications"
            onPress={handleRequestPermission}
            loading={isRequesting}
            style={styles.button}
          />

          <Pressable onPress={handleDismiss}>
            <Text style={styles.laterButton}>Maybe Later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    width: '100%',
  },
  laterButton: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
```

### 4. App.tsx Integration

File: `src/App.tsx` (updated)

Initialize notifications on app start:

```typescript
import { usePushNotifications } from '@hooks/usePushNotifications';

export default function App() {
  const { isRegistered } = usePushNotifications();
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  useEffect(() => {
    checkNotificationPrompt();
  }, []);

  const checkNotificationPrompt = async () => {
    const hasRequested = await AsyncStorage.getItem('notification_permission_requested');
    const hasDismissed = await AsyncStorage.getItem('notification_permission_dismissed');

    // Show prompt if not requested yet (and haven't dismissed)
    if (!hasRequested && !hasDismissed) {
      setShowNotificationPrompt(true);
    }
  };

  return (
    <>
      <RootNavigator />
      <NotificationPermissionModal
        visible={showNotificationPrompt}
        onDismiss={() => setShowNotificationPrompt(false)}
      />
    </>
  );
}
```

### 5. Backend Notification Service

File: `packages/shared/src/services/notificationService.ts`

Register and manage tokens:

```typescript
export class NotificationBackendService {
  private api = axios.create({
    baseURL: process.env.EXPO_PUBLIC_API_URL,
  });

  async registerToken(data: {
    token: string;
    platform: "ios" | "android";
    deviceId: string;
  }): Promise<void> {
    await this.api.post("/notifications/register-token", data);
  }

  async unregisterToken(token: string): Promise<void> {
    await this.api.post("/notifications/unregister-token", { token });
  }

  async getNotificationPreferences(): Promise<NotificationPreferences> {
    const { data } = await this.api.get("/notifications/preferences");
    return data.preferences;
  }

  async updateNotificationPreferences(
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    await this.api.patch("/notifications/preferences", preferences);
  }

  async sendTestNotification(): Promise<void> {
    await this.api.post("/notifications/send-test");
  }
}

export const notificationBackendService = new NotificationBackendService();
```

### 6. Firebase Cloud Messaging (FCM) Configuration

File: `app.config.ts` (updated plugins)

```typescript
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  plugins: [
    // ... existing plugins
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#FF6B6B",
        sounds: ["./assets/notification-sound.wav"],
        modes: "default",
      },
    ],
  ],
});
```

### 7. Notification Payload Types

File: `packages/types/src/notifications.ts`

```typescript
export interface NotificationPayload {
  type: "course" | "comment" | "message" | "achievement" | "reminder";
  title: string;
  body: string;
  image?: string;
  data: {
    courseId?: string;
    postId?: string;
    lessonId?: string;
    userId?: string;
    [key: string]: any;
  };
  badge?: number;
  sound?: "default" | "none";
  priority?: "high" | "default" | "low";
  ttl?: number; // seconds
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  newCourseNotifications: boolean;
  commentNotifications: boolean;
  reminderNotifications: boolean;
  promotionalNotifications: boolean;
  quietHoursStart?: string; // HH:MM
  quietHoursEnd?: string; // HH:MM
}
```

## Acceptance Criteria

- [ ] Push notifications enabled on both iOS and Android
- [ ] FCM token registered on first app launch
- [ ] Token sent to backend for server-side sending
- [ ] Foreground notifications display with sound/badge
- [ ] Background notifications open app and route correctly
- [ ] Killed-state notifications route when app reopens
- [ ] Tapping notification routes to correct screen
- [ ] Badge count updates correctly
- [ ] Notification permission request shown once
- [ ] User can disable notifications in settings
- [ ] Deep links work from notifications
- [ ] No console errors
- [ ] Token refreshed on app updates
- [ ] Battery/data impact minimal
- [ ] Quiet hours respected (future)

## Dependencies

- expo-notifications
- expo-device
- expo-constants
- firebase (FCM on backend)
- @react-native-async-storage/async-storage

## Technical Notes

### FCM vs APNs

- Android: FCM (Firebase Cloud Messaging)
- iOS: APNs (Apple Push Notification service)
- Expo handles both via expo-notifications

### Token Management

- Register token on first launch
- Unregister on logout
- Refresh token annually
- Handle token rotation

### Notification Types

1. **Course Updates**: New lessons, course completed
2. **Social**: Comments, likes, Q&A responses
3. **Reminders**: Resume course, assignment due
4. **Achievements**: Milestones, badges earned
5. **System**: Account activity, security alerts

### Payload Size Limit

- APNs: 4KB max
- FCM: 4KB max
- Keep title + body concise

### Quiet Hours

- Respect user-set quiet hours
- Don't send notifications between times
- High-priority only (security, urgent)

### Testing

```typescript
// Send test notification
await notificationBackendService.sendTestNotification();
```
