# Task: Localize Firebase Cloud Messaging Push Notifications

## Description

Implement localized push notification system using Firebase Cloud Messaging (FCM) for mobile and web. Create notification templates in all 4 languages (EN, ES, FR, RU) for transactional and engagement notifications. Template system in backend auto-selects language based on user language preference. Support dynamic content (names, course names, etc.). Ensure notification titles and bodies are never hardcoded.

## Affected Apps/Packages

- `services/notifications` (Notification service)
- `apps/api` (Notification trigger endpoints)
- `apps/mobile` (FCM setup and handlers)
- `packages/notifications-core` (Shared notification utilities)

## Requirements

### FCM Setup

- Configure FCM for mobile app (React Native Expo)
- Configure FCM for web (service worker)
- Store device tokens in user profile
- Support multi-device notifications (user may have multiple devices)
- Notification permission handling

### Notification Types to Localize

1. **Course Enrollment** - Student enrolled in new course
2. **New Lesson Available** - Instructor published new lesson
3. **Course Progress** - User completed lesson/module
4. **Payment Success** - Purchase/subscription successful
5. **Payment Failed** - Payment attempt failed
6. **Comment Reply** - Someone replied to user comment
7. **New Message** - Direct message received
8. **Instructor Alert** - New student enrolled in instructor's course
9. **Promotion** - Limited-time offer or discount
10. **Achievement** - User earned certificate/badge
11. **Course Suspension** - Course removed/suspended
12. **Account Activity** - Login from new device
13. **Subscription Expiring** - Subscription expiring soon
14. **Content Update** - Favorite course updated

### Template System

- Template registry with structure: `{NotificationType}-{Language}`
- Variables for dynamic content (user name, course name, etc.)
- Action deeplinks with correct language locale
- Rich notification content (image/icon if applicable)
- Short title + expanded body

### Notification Metadata

- Notification ID (for tracking/analytics)
- User ID (recipient)
- Language (auto-selected)
- Type (course_enrollment, etc.)
- Data payload (course ID, link, etc.)
- Sent timestamp
- Delivered/read tracking (optional)

### Testing & QA

- Test notification delivery (Android, iOS, Web)
- Verify template variable replacement
- Check deeplinks open correct locale
- Test with users in different languages
- Monitor delivery rates

## Acceptance Criteria

- [ ] 14 notification types × 4 languages (56 total) created
- [ ] Notification registry with all templates
- [ ] FCM integration working for mobile
- [ ] FCM integration working for web
- [ ] Device tokens stored per user
- [ ] Multi-device notification support
- [ ] Template variables replace correctly
- [ ] Deeplinks include correct language prefix
- [ ] No hardcoded strings in notifications
- [ ] User language preference respected
- [ ] Fallback to EN if translation missing
- [ ] Delivery tracking enabled
- [ ] Push permissions handled gracefully
- [ ] Opt-in/opt-out per notification type
- [ ] Analytics: open/click tracking working
- [ ] Mobile and web notifications tested

## Dependencies

- Firebase project configured
- FCM API enabled
- Service worker registered (web)
- Expo push notifications configured (mobile)
- User model with language preference and device tokens

## Technical Notes

### FCM Setup - Firebase Configuration

**firebase.config.ts:**

```typescript
import * as admin from "firebase-admin";

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}"
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

export const fcm = admin.messaging();
export const db = admin.firestore();
```

### Notification Template Registry

**services/notifications/template-registry.ts:**

```typescript
export const NOTIFICATION_TEMPLATES = {
  course_enrollment: {
    en: {
      title: "New Course Enrolled",
      body: "You enrolled in {{courseName}}. Start learning now!",
    },
    es: {
      title: "Nuevo curso inscrito",
      body: "Te inscribiste en {{courseName}}. ¡Comienza a aprender ahora!",
    },
    fr: {
      title: "Nouveau cours inscrit",
      body: "Vous vous êtes inscrit au {{courseName}}. Commencez à apprendre maintenant!",
    },
    ru: {
      title: "Зачисление на новый курс",
      body: "Вы записались на {{courseName}}. Начните обучение прямо сейчас!",
    },
  },

  new_lesson_available: {
    en: {
      title: "New Lesson Available",
      body: "{{instructorName}} published a new lesson in {{courseName}}",
    },
    es: {
      title: "Nueva lección disponible",
      body: "{{instructorName}} publicó una nueva lección en {{courseName}}",
    },
    fr: {
      title: "Nouvelle leçon disponible",
      body: "{{instructorName}} a publié une nouvelle leçon dans {{courseName}}",
    },
    ru: {
      title: "Новый урок доступен",
      body: "{{instructorName}} опубликовал новый урок в {{courseName}}",
    },
  },

  course_progress: {
    en: {
      title: "Keep Learning!",
      body: "You're {{progressPercent}}% through {{courseName}}. Keep going!",
    },
    es: {
      title: "¡Sigue aprendiendo!",
      body: "Ya completaste {{progressPercent}}% de {{courseName}}. ¡Sigue adelante!",
    },
    fr: {
      title: "Continuez à apprendre!",
      body: "Vous avez complété {{progressPercent}}% de {{courseName}}. Continuez!",
    },
    ru: {
      title: "Продолжайте учиться!",
      body: "Вы завершили {{progressPercent}}% {{courseName}}. Продолжайте!",
    },
  },

  payment_success: {
    en: {
      title: "Payment Successful",
      body: "Your purchase of {{productName}} for {{amount}} {{currency}} is complete",
    },
    es: {
      title: "Pago exitoso",
      body: "Tu compra de {{productName}} por {{amount}} {{currency}} está completa",
    },
    fr: {
      title: "Paiement réussi",
      body: "Votre achat de {{productName}} pour {{amount}} {{currency}} est terminé",
    },
    ru: {
      title: "Платеж выполнен",
      body: "Ваша покупка {{productName}} за {{amount}} {{currency}} завершена",
    },
  },

  payment_failed: {
    en: {
      title: "Payment Failed",
      body: "Your payment for {{productName}} failed. Please try again.",
    },
    es: {
      title: "Error en el pago",
      body: "Tu pago de {{productName}} falló. Por favor intenta de nuevo.",
    },
    fr: {
      title: "Le paiement a échoué",
      body: "Votre paiement pour {{productName}} a échoué. Réessayez.",
    },
    ru: {
      title: "Ошибка платежа",
      body: "Ваш платеж за {{productName}} не выполнен. Попробуйте снова.",
    },
  },

  comment_reply: {
    en: {
      title: "New Reply to Your Comment",
      body: '{{userName}} replied: "{{replyPreview}}"',
    },
    es: {
      title: "Nueva respuesta a tu comentario",
      body: '{{userName}} respondió: "{{replyPreview}}"',
    },
    fr: {
      title: "Nouvelle réponse à votre commentaire",
      body: '{{userName}} a répondu: "{{replyPreview}}"',
    },
    ru: {
      title: "Новый ответ на ваш комментарий",
      body: '{{userName}} ответил: "{{replyPreview}}"',
    },
  },

  new_message: {
    en: {
      title: "New Message from {{senderName}}",
      body: "{{messagePreview}}",
    },
    es: {
      title: "Nuevo mensaje de {{senderName}}",
      body: "{{messagePreview}}",
    },
    fr: {
      title: "Nouveau message de {{senderName}}",
      body: "{{messagePreview}}",
    },
    ru: {
      title: "Новое сообщение от {{senderName}}",
      body: "{{messagePreview}}",
    },
  },

  instructor_alert: {
    en: {
      title: "New Student Enrolled",
      body: "{{studentName}} enrolled in {{courseName}}",
    },
    es: {
      title: "Nuevo estudiante inscrito",
      body: "{{studentName}} se inscribió en {{courseName}}",
    },
    fr: {
      title: "Nouvel étudiant inscrit",
      body: "{{studentName}} sest inscrit à {{courseName}}",
    },
    ru: {
      title: "Новый ученик зачислен",
      body: "{{studentName}} записался на {{courseName}}",
    },
  },

  promotion: {
    en: {
      title: "Special Offer: {{discountPercent}}% Off",
      body: "Limited time offer on {{courseName}}. Ends {{endDate}}",
    },
    es: {
      title: "Oferta especial: {{discountPercent}}% descuento",
      body: "Oferta limitada en {{courseName}}. Finaliza {{endDate}}",
    },
    fr: {
      title: "Offre spéciale: {{discountPercent}}% de réduction",
      body: "Offre limitée sur {{courseName}}. Se termine {{endDate}}",
    },
    ru: {
      title: "Специальное предложение: {{discountPercent}}% скидка",
      body: "Ограниченное предложение на {{courseName}}. Заканчивается {{endDate}}",
    },
  },

  achievement: {
    en: {
      title: "Congratulations!",
      body: "You earned {{achievementName}} for completing {{courseName}}",
    },
    es: {
      title: "¡Felicidades!",
      body: "Obtuviste {{achievementName}} por completar {{courseName}}",
    },
    fr: {
      title: "Félicitations!",
      body: "Vous avez obtenu {{achievementName}} pour avoir complété {{courseName}}",
    },
    ru: {
      title: "Поздравляем!",
      body: "Вы получили {{achievementName}} за завершение {{courseName}}",
    },
  },

  course_suspension: {
    en: {
      title: "Course Suspended",
      body: "{{courseName}} has been removed. Your enrollment has been refunded.",
    },
    es: {
      title: "Curso suspendido",
      body: "{{courseName}} ha sido eliminado. Tu inscripción ha sido reembolsada.",
    },
    fr: {
      title: "Cours suspendu",
      body: "{{courseName}} a été supprimé. Votre inscription a été remboursée.",
    },
    ru: {
      title: "Курс заморожен",
      body: "{{courseName}} был удален. Ваша регистрация возвращена.",
    },
  },

  account_activity: {
    en: {
      title: "New Login Detected",
      body: "Your account was accessed from {{device}} in {{location}}",
    },
    es: {
      title: "Nuevo acceso detectado",
      body: "Tu cuenta fue accedida desde {{device}} en {{location}}",
    },
    fr: {
      title: "Nouveau connexion détectée",
      body: "Votre compte a été accédé à partir de {{device}} à {{location}}",
    },
    ru: {
      title: "Обнаружен новый вход",
      body: "Ваша учетная запись была открыта с {{device}} в {{location}}",
    },
  },

  subscription_expiring: {
    en: {
      title: "Subscription Expiring Soon",
      body: "Your subscription expires on {{expiryDate}}. Renew to continue.",
    },
    es: {
      title: "Suscripción próxima a expirar",
      body: "Tu suscripción expira el {{expiryDate}}. Renuévala para continuar.",
    },
    fr: {
      title: "Abonnement expire bientôt",
      body: "Votre abonnement expire le {{expiryDate}}. Renouvelez pour continuer.",
    },
    ru: {
      title: "Подписка скоро истечет",
      body: "Ваша подписка истекает {{expiryDate}}. Продлите, чтобы продолжить.",
    },
  },

  content_update: {
    en: {
      title: "Course Updated",
      body: "{{courseName}} has new content. Check it out!",
    },
    es: {
      title: "Curso actualizado",
      body: "{{courseName}} tiene nuevo contenido. ¡Échale un vistazo!",
    },
    fr: {
      title: "Cours mis à jour",
      body: "{{courseName}} a du nouveau contenu. Consultez-le!",
    },
    ru: {
      title: "Курс обновлен",
      body: "{{courseName}} имеет новый контент. Проверьте это!",
    },
  },
};

export type NotificationType = keyof typeof NOTIFICATION_TEMPLATES;
export type Language = "en" | "es" | "fr" | "ru";

export interface NotificationTemplate {
  title: string;
  body: string;
}

export const getNotificationTemplate = (
  type: NotificationType,
  language: Language = "en"
): NotificationTemplate => {
  const template = NOTIFICATION_TEMPLATES[type];
  if (!template) {
    throw new Error(`Unknown notification type: ${type}`);
  }

  // Fallback to EN if language not available
  return template[language] || template["en"];
};
```

### FCM Service Implementation

**services/notifications/fcm-service.ts:**

```typescript
import { fcm } from "@lib/firebase";
import {
  NotificationType,
  Language,
  getNotificationTemplate,
} from "./template-registry";

export interface NotificationPayload {
  type: NotificationType;
  userId: string;
  language: Language;
  variables: Record<string, string>;
  deeplink?: string;
  image?: string;
  badge?: string;
  tag?: string;
}

export class FCMService {
  /**
   * Send localized notification to user
   */
  async sendToUser(payload: NotificationPayload): Promise<string[]> {
    try {
      const { type, userId, language, variables, deeplink, image, badge, tag } =
        payload;

      // Get user devices
      const devices = await this.getUserDevices(userId);
      if (devices.length === 0) {
        console.log(`No devices found for user ${userId}`);
        return [];
      }

      // Get template
      const template = getNotificationTemplate(type, language);

      // Replace variables in template
      const title = this.replaceVariables(template.title, variables);
      const body = this.replaceVariables(template.body, variables);

      // Prepare notification
      const notification = {
        title,
        body,
      };

      // Prepare data payload
      const data: Record<string, string> = {
        type,
        userId,
        language,
        ...(deeplink && { deeplink }),
        ...(image && { image }),
        ...(tag && { tag }),
      };

      // Send to all user devices
      const messageIds: string[] = [];

      for (const deviceToken of devices) {
        try {
          const messageId = await fcm.send({
            notification,
            data,
            token: deviceToken,
            android: {
              priority: "high",
              notification: {
                clickAction: "FLUTTER_NOTIFICATION_CLICK",
                sound: "default",
                channelId: "mentor_notifications",
                ...(image && { image }),
                ...(badge && { icon: badge }),
              },
            },
            apns: {
              payload: {
                aps: {
                  alert: {
                    title,
                    body,
                  },
                  sound: "default",
                  badge: 1,
                  "content-available": 1,
                },
              },
            },
            webpush: {
              notification: {
                title,
                body,
                ...(image && { image }),
                badge: "/images/badge-icon.png",
                tag: tag || type,
                requireInteraction: false,
              },
              data,
              fcmOptions: {
                link: deeplink,
              },
            },
          });

          messageIds.push(messageId);
          console.log(
            `Notification sent to device: ${deviceToken}, messageId: ${messageId}`
          );
        } catch (error) {
          console.error(`Failed to send to device ${deviceToken}:`, error);
        }
      }

      return messageIds;
    } catch (error) {
      console.error("FCM send error:", error);
      throw error;
    }
  }

  /**
   * Send to multiple users (batch)
   */
  async sendToUsers(
    userIds: string[],
    payload: Omit<NotificationPayload, "userId">
  ): Promise<Record<string, string[]>> {
    const results: Record<string, string[]> = {};

    for (const userId of userIds) {
      try {
        results[userId] = await this.sendToUser({
          ...payload,
          userId,
        });
      } catch (error) {
        console.error(`Failed to send to user ${userId}:`, error);
        results[userId] = [];
      }
    }

    return results;
  }

  /**
   * Send notification by topic (broadcast)
   */
  async sendToTopic(
    topic: string,
    payload: NotificationPayload
  ): Promise<string> {
    try {
      const { type, language, variables, deeplink, image, badge } = payload;

      const template = getNotificationTemplate(type, language);

      const title = this.replaceVariables(template.title, variables);
      const body = this.replaceVariables(template.body, variables);

      const messageId = await fcm.send({
        notification: {
          title,
          body,
        },
        data: {
          type,
          language,
          ...(deeplink && { deeplink }),
          ...(image && { image }),
        },
        topic,
        android: {
          priority: "high",
          notification: {
            sound: "default",
            channelId: "mentor_notifications",
          },
        },
      });

      console.log(
        `Broadcast notification sent to topic '${topic}': ${messageId}`
      );
      return messageId;
    } catch (error) {
      console.error("FCM broadcast error:", error);
      throw error;
    }
  }

  /**
   * Subscribe user to topic
   */
  async subscribeToTopic(userId: string, topic: string): Promise<void> {
    try {
      const devices = await this.getUserDevices(userId);

      if (devices.length === 0) {
        console.log(`No devices for user ${userId}`);
        return;
      }

      await fcm.subscribeToTopic(devices, topic);
      console.log(`Subscribed user ${userId} to topic ${topic}`);
    } catch (error) {
      console.error("Topic subscription error:", error);
      throw error;
    }
  }

  /**
   * Unsubscribe user from topic
   */
  async unsubscribeFromTopic(userId: string, topic: string): Promise<void> {
    try {
      const devices = await this.getUserDevices(userId);

      if (devices.length === 0) {
        return;
      }

      await fcm.unsubscribeFromTopic(devices, topic);
      console.log(`Unsubscribed user ${userId} from topic ${topic}`);
    } catch (error) {
      console.error("Topic unsubscribe error:", error);
      throw error;
    }
  }

  // Helper methods
  private async getUserDevices(userId: string): Promise<string[]> {
    // Fetch from user profile or database
    // Implementation depends on your data model
    return [];
  }

  private replaceVariables(
    template: string,
    variables: Record<string, string>
  ): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
    }

    return result;
  }
}

export const fcmService = new FCMService();
```

### Mobile Setup (React Native Expo)

**apps/mobile/services/push-notifications.ts:**

```typescript
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@context/AuthContext";

export const setupPushNotifications = async () => {
  // Check if device supports push notifications
  if (!Device.isDevice) {
    console.log("Push notifications only work on physical devices");
    return null;
  }

  try {
    // Request notification permissions
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Failed to get push notification permissions");
      return null;
    }

    // Get Expo push token
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PROJECT_ID,
    });

    // Send token to backend for registration
    await registerPushToken(token.data);

    // Set notification handler
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        console.log("Notification received:", notification);

        // Determine if notification should be shown
        // Return object controls whether notification shows
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        };
      },
    });

    // Listen for notifications
    const subscription = Notifications.addNotificationResponseListener(
      (response) => {
        handleNotificationResponse(response);
      }
    );

    return () => subscription.remove();
  } catch (error) {
    console.error("Push notification setup error:", error);
  }
};

const registerPushToken = async (token: string) => {
  try {
    const response = await fetch("/api/users/me/devices/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: Platform.OS,
        token,
        expoToken: true,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to register push token");
    }

    // Cache token
    await AsyncStorage.setItem("push_token", token);
  } catch (error) {
    console.error("Token registration error:", error);
  }
};

const handleNotificationResponse = async (response: any) => {
  const { notification, actionIdentifier } = response;
  const { data } = notification.request.content;

  // Handle deeplink
  if (data.deeplink) {
    // Navigate to deeplink with correct language
    console.log(`Opening deeplink: ${data.deeplink}`);
  }

  // Track notification interaction
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", "notification_clicked", {
      type: data.type,
      userId: data.userId,
    });
  }
};
```

### API Endpoint for Sending Notifications

**pages/api/notifications/send.ts:**

```typescript
import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@lib/auth";
import { fcmService } from "@services/notifications";
import { UserModel } from "@models";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const user = await getAuth(req);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { userId, type, variables, deeplink } = req.body;

    if (!userId || !type) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Get user details
    const recipient = await UserModel.findById(userId);
    if (!recipient) {
      return res.status(404).json({ message: "User not found" });
    }

    // Send notification
    const messageIds = await fcmService.sendToUser({
      type,
      userId,
      language: recipient.language || "en",
      variables,
      deeplink,
    });

    return res.status(200).json({
      message: "Notification sent",
      messageIds,
      deliveredTo: messageIds.length,
    });
  } catch (error) {
    console.error("Notification send error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
```

## Implementation Order

1. Set up Firebase project and enable FCM
2. Create notification template registry
3. Implement FCM service with template support
4. Configure Expo push notifications for mobile
5. Set up service worker for web push
6. Create API endpoints for sending notifications
7. Store device tokens in user profile
8. Test notification delivery to Android
9. Test notification delivery to iOS
10. Test notification delivery to web
11. Implement deeplink handling
12. Set up notification preference system
13. Create analytics tracking for notifications
14. Test multi-device notifications
15. Create notification preference API
