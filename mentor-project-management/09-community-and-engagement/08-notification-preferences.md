# Task 8: Notification Preferences & GDPR Compliance

## Description

Implement user notification preferences with GDPR compliance. Users can opt-in/opt-out of marketing push notifications while transactional notifications are always sent. Provide per-category toggles, preferences API endpoints, persistent storage, and ability to deep link to OS-level notification settings if push is denied at system level.

## Affected Apps/Packages

- `apps/api` - Hono.js backend API
- `packages/db` - Prisma schema for preferences
- `packages/ui` - React components for settings
- `packages/ui-mobile` - React Native preference screens
- `packages/api-client` - API client for preferences
- `apps/web-learner` - Learner web app
- `apps/web-mentor` - Mentor web app
- `apps/mobile` - React Native mobile app

## Database Schema (Prisma)

```prisma
model NotificationPreference {
  id String @id @default(cuid())

  userId String @unique
  user User @relation("NotificationPreference", fields: [userId], references: [id], onDelete: Cascade)

  // GDPR: Marketing notifications
  marketingPushOptIn Boolean @default(false) // Learner opt-in required
  marketingEmailOptIn Boolean @default(false)
  marketingInAppOptIn Boolean @default(true) // In-app always on

  // Transactional (always sent, GDPR requirement)
  transactionalPushEnabled Boolean @default(true) // Cannot opt out
  transactionalEmailEnabled Boolean @default(true)
  transactionalInAppEnabled Boolean @default(true)

  // Per-category toggles (for subscribed users)
  pushEnabled Boolean @default(true)
  emailEnabled Boolean @default(true)
  inAppEnabled Boolean @default(true)

  // Per-category preferences (only applies if main toggle enabled)
  // Marketing categories
  newCoursePush Boolean @default(false) // Under marketingPushOptIn
  newCoursesEmail Boolean @default(false)
  newCoursesInApp Boolean @default(true)

  courseMentorNewPostPush Boolean @default(false)
  courseMentorNewPostEmail Boolean @default(false)
  courseMentorNewPostInApp Boolean @default(true)

  communityActivityPush Boolean @default(false)
  communityActivityEmail Boolean @default(false)
  communityActivityInApp Boolean @default(true)

  // Transactional categories (always sent if enabled)
  enrollmentPush Boolean @default(true)
  enrollmentEmail Boolean @default(true)
  enrollmentInApp Boolean @default(true)

  subscriptionReminderPush Boolean @default(true)
  subscriptionReminderEmail Boolean @default(true)
  subscriptionReminderInApp Boolean @default(true)

  commentReplyPush Boolean @default(true)
  commentReplyEmail Boolean @default(true)
  commentReplyInApp Boolean @default(true)

  qaAnswerPush Boolean @default(true)
  qaAnswerEmail Boolean @default(true)
  qaAnswerInApp Boolean @default(true)

  instructorNewQuestionPush Boolean @default(true)
  instructorNewQuestionEmail Boolean @default(true)
  instructorNewQuestionInApp Boolean @default(true)

  instructorNewEnrollmentPush Boolean @default(true)
  instructorNewEnrollmentEmail Boolean @default(true)
  instructorNewEnrollmentInApp Boolean @default(true)

  instructorPayoutPush Boolean @default(true)
  instructorPayoutEmail Boolean @default(true)
  instructorPayoutInApp Boolean @default(true)

  // Digest settings
  dailyDigestEmail Boolean @default(false)
  weeklyDigestEmail Boolean @default(false)

  // Quiet hours
  quietHoursEnabled Boolean @default(false)
  quietHoursStart String? // HH:mm format
  quietHoursEnd String? // HH:mm format
  quietHoursTimezone String @default("UTC")

  // System notification state (track if denied at OS level)
  systemNotificationsDenied Boolean @default(false)
  systemNotificationsDeniedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
}

// Log user consent for GDPR audit trail
model GDPRConsent {
  id String @id @default(cuid())

  userId String
  user User @relation("GDPRConsents", fields: [userId], references: [id], onDelete: Cascade)

  consentType String // "marketing_push", "marketing_email", "marketing_inapp"
  accepted Boolean
  source String // "settings_page", "onboarding", "prompt"
  ipAddress String?
  userAgent String?

  createdAt DateTime @default(now())

  @@index([userId])
  @@index([consentType])
  @@index([createdAt])
}
```

## API Endpoints

### GET /api/notifications/preferences

**Description:** Get current user's notification preferences

**Response (200 OK):**

```json
{
  "id": "pref_123",
  "userId": "user_456",
  "marketingPushOptIn": true,
  "marketingEmailOptIn": false,
  "marketingInAppOptIn": true,
  "transactionalPushEnabled": true,
  "transactionalEmailEnabled": true,
  "transactionalInAppEnabled": true,
  "pushEnabled": true,
  "emailEnabled": true,
  "inAppEnabled": true,
  "categories": {
    "newCourse": {
      "push": false,
      "email": false,
      "inApp": true
    },
    "courseMentorNewPost": {
      "push": false,
      "email": false,
      "inApp": true
    },
    "communityActivity": {
      "push": false,
      "email": false,
      "inApp": true
    },
    "enrollment": {
      "push": true,
      "email": true,
      "inApp": true
    },
    "subscriptionReminder": {
      "push": true,
      "email": true,
      "inApp": true
    },
    "commentReply": {
      "push": true,
      "email": true,
      "inApp": true
    },
    "qaAnswer": {
      "push": true,
      "email": true,
      "inApp": true
    },
    "instructorNewQuestion": {
      "push": true,
      "email": true,
      "inApp": true
    },
    "instructorNewEnrollment": {
      "push": true,
      "email": true,
      "inApp": true
    },
    "instructorPayout": {
      "push": true,
      "email": true,
      "inApp": true
    }
  },
  "digestSettings": {
    "dailyDigestEmail": false,
    "weeklyDigestEmail": false
  },
  "quietHours": {
    "enabled": false,
    "start": "22:00",
    "end": "08:00",
    "timezone": "UTC"
  },
  "systemNotifications": {
    "denied": false,
    "deniedAt": null
  }
}
```

### PUT /api/notifications/preferences

**Description:** Update notification preferences

**Request Body:**

```json
{
  "marketingPushOptIn": true,
  "marketingEmailOptIn": false,
  "marketingInAppOptIn": true,
  "pushEnabled": true,
  "emailEnabled": true,
  "inAppEnabled": true,
  "categories": {
    "newCourse": {
      "push": false,
      "email": false,
      "inApp": true
    },
    "commentReply": {
      "push": true,
      "email": true,
      "inApp": true
    }
  },
  "digestSettings": {
    "dailyDigestEmail": true,
    "weeklyDigestEmail": false
  },
  "quietHours": {
    "enabled": true,
    "start": "22:00",
    "end": "08:00",
    "timezone": "America/New_York"
  }
}
```

**Response (200 OK):**
Same as GET response with updated values

**Validation Rules:**

- Cannot disable transactional notifications (marketingPushOptIn can be toggled, but transactional cannot)
- Quiet hours format validation (HH:mm)
- Valid timezone required
- Quiet hours end must be after start

### POST /api/notifications/preferences/consent

**Description:** Record GDPR consent decision

**Request Body:**

```json
{
  "consentType": "marketing_push|marketing_email|marketing_inapp",
  "accepted": true,
  "source": "settings_page|onboarding|prompt"
}
```

**Response (201 Created):**

```json
{
  "id": "consent_123",
  "userId": "user_456",
  "consentType": "marketing_push",
  "accepted": true,
  "source": "settings_page",
  "createdAt": "2024-02-18T10:30:00Z"
}
```

**Purpose:**

- Audit trail for GDPR compliance
- Records IP and User-Agent for transparency
- Track consent changes over time

### POST /api/notifications/preferences/system-notification-denied

**Description:** Record that user denied system-level notification permission

**Response (200 OK):**

```json
{
  "systemNotificationsDenied": true,
  "deniedAt": "2024-02-18T10:30:00Z"
}
```

**Purpose:**

- Track when system permissions denied
- Used to prompt user to re-enable in OS settings
- Show helpful message with link to OS settings

## UI Components

### Web Components

#### 1. NotificationPreferencesPage

**Location:** `apps/web-learner/src/pages/settings/notifications.tsx`

**Layout:**

```
Settings → Notifications

[ ] Push Notifications
  This is a transactional setting that cannot be disabled for important updates.

Marketing Notifications (Optional)
════════════════════════════════════
  [✓] Receive marketing emails
  [✓] Receive push notifications for new courses and content
  [ ] Receive in-app notifications

Channel Preferences
════════════════════════════════════
[✓] Push Notifications
  [ ] New Courses
  [ ] Posts from instructors I follow
  [ ] Community Activity

[✓] Email Notifications
  [ ] New Courses
  [ ] Subscription Reminders
  [✓] Comments on My Posts
  [✓] Answers to My Questions

[✓] In-App Notifications
  [✓] All enabled

Transactional Notifications (Required for account)
════════════════════════════════════
These cannot be disabled (GDPR requirement):
  - Enrollments and confirmations
  - Subscription reminders (payment critical)
  - Questions answered (user-initiated)

Instructor Settings (if applicable)
════════════════════════════════════
[✓] New student enrollments
[✓] Questions on your lessons
[✓] Payout notifications

Quiet Hours
════════════════════════════════════
[ ] Enable quiet hours (no notifications)
  From: [22:00] To: [08:00] Timezone: [UTC ▼]

GDPR Compliance Notice
════════════════════════════════════
Last updated: 2024-02-18
Your notification preferences are saved with your consent.
[See full GDPR policy]

[Save Changes] [Cancel]
```

**Features:**

- Clear separation between marketing and transactional
- Disable/enable per channel (push, email, in-app)
- Category toggles nested under channel
- Transactional notification warning (cannot disable)
- Quiet hours setup with timezone picker
- GDPR compliance note
- Save/Cancel buttons
- Visual indicators (✓ icons, disabled text)

#### 2. NotificationCategoryToggle Component

**Location:** `packages/ui/src/components/NotificationCategoryToggle.tsx`

**Props:**

```typescript
interface NotificationCategoryToggleProps {
  category: string; // "newCourse", "commentReply", etc.
  channels: {
    push?: boolean;
    email?: boolean;
    inApp?: boolean;
  };
  onToggle: (channel: string, enabled: boolean) => void;
  isMarketing?: boolean;
  isTransactional?: boolean;
  disabled?: boolean;
}
```

**Features:**

- Category name display
- Toggles for each channel
- Disabled state with explanation
- Tooltip indicating transactional (cannot disable)

#### 3. QuietHoursSetup Component

**Location:** `packages/ui/src/components/QuietHoursSetup.tsx`

**Props:**

```typescript
interface QuietHoursSetupProps {
  enabled: boolean;
  startTime: string;
  endTime: string;
  timezone: string;
  onUpdate: (settings: QuietHourSettings) => void;
}
```

**Features:**

- Toggle to enable/disable
- Time picker for start time
- Time picker for end time
- Timezone selector
- Validation messages
- Preview: "Notifications paused 10 PM to 8 AM EST"

#### 4. SystemNotificationsDeniedPrompt Component

**Location:** `packages/ui/src/components/SystemNotificationsDeniedPrompt.tsx`

**Props:**

```typescript
interface SystemNotificationsDeniedPromptProps {
  isDenied: boolean;
  onGoToSettings?: () => void;
  onDismiss?: () => void;
}
```

**Features:**

- Alert banner explaining system permission denied
- "Enable in Settings" button (links to OS settings)
- "Dismiss" button
- Platform-specific instructions (Safari, Chrome, Firefox, Edge)

### Mobile Components

#### 1. NotificationPreferencesScreen

**Location:** `apps/mobile/src/screens/NotificationPreferencesScreen.tsx`

**Features:**

- ScrollView with all preferences
- Toggle switches for each setting
- Time picker for quiet hours (native)
- Timezone selector (autocomplete)
- Marketing consent checkbox with legal link
- Save button with loading state

**Layout (Mobile):**

```
← Notification Preferences

PUSH NOTIFICATIONS
├─ Notifications (transactional)
│  ✓ Required for your account
├─ New Courses
│  ☐ Marketing notifications
├─ Posts from Instructors
│  ☐ Marketing notifications
└─ Community Activity
   ☐ Marketing notifications

EMAIL NOTIFICATIONS
├─ Subscription Reminders
│  ✓ Transactional
├─ Comments on Posts
│  ✓ Transactional
├─ Daily Digest
│  ☐ Marketing
└─ Weekly Digest
   ☐ Marketing

QUIET HOURS
├─ ☐ Enable Quiet Hours
│  From [22:00] To [08:00]
│  Timezone [UTC▼]

SYSTEM PERMISSIONS
├─ Notifications: Allowed
│  [Open Settings]

[Save]
```

#### 2. MarketingConsentModal

**Location:** `packages/ui-mobile/src/components/MarketingConsentModal.tsx`

**Props:**

```typescript
interface MarketingConsentModalProps {
  isVisible: boolean;
  onAccept: () => void;
  onDecline: () => void;
  type: "push" | "email";
}
```

**Features:**

- Modal with clear explanation
- Accept/Decline buttons
- Link to full privacy policy
- Track consent in database

## Notification Filtering Logic

### Backend Filtering

```typescript
// Before sending any notification, check preferences
async function shouldSendNotification(
  userId: string,
  notificationType: string,
  channel: "push" | "email" | "inApp",
): Promise<boolean> {
  const prefs = await db.notificationPreference.findUnique({
    where: { userId },
  });

  if (!prefs) {
    // New user defaults
    return channel === "inApp"; // Only in-app by default
  }

  // Transactional notifications always sent (if channel enabled)
  const transactionalTypes = [
    "ENROLLMENT_CONFIRMATION",
    "SUBSCRIPTION_REMINDER",
    "QUESTION_ANSWERED",
    "INSTRUCTOR_NEW_QUESTION",
    "INSTRUCTOR_ENROLLMENT",
    "PAYOUT_PROCESSED",
  ];

  if (transactionalTypes.includes(notificationType)) {
    if (channel === "push") return prefs.transactionalPushEnabled;
    if (channel === "email") return prefs.transactionalEmailEnabled;
    if (channel === "inApp") return prefs.transactionalInAppEnabled;
  }

  // Marketing notifications require opt-in
  const marketingTypes = ["COURSE_NEW", "COURSE_MENTION", "COMMUNITY_POST"];

  if (marketingTypes.includes(notificationType)) {
    if (channel === "push" && !prefs.marketingPushOptIn) return false;
    if (channel === "email" && !prefs.marketingEmailOptIn) return false;
    if (channel === "inApp" && !prefs.marketingInAppOptIn) return false;
  }

  // Check channel-specific settings
  if (channel === "push" && !prefs.pushEnabled) return false;
  if (channel === "email" && !prefs.emailEnabled) return false;
  if (channel === "inApp" && !prefs.inAppEnabled) return false;

  // Check category-specific preferences
  const categoryMap = {
    NEW_COURSE: "newCourse",
    COURSE_MENTION: "courseMentorNewPost",
    COMMUNITY_ACTIVITY: "communityActivity",
    COMMENT_REPLY: "commentReply",
    ENROLLMENT: "enrollment",
    SUBSCRIPTION_REMINDER: "subscriptionReminder",
  };

  const category = categoryMap[notificationType];
  if (category) {
    const categoryKey = `${category}${channel.charAt(0).toUpperCase() + channel.slice(1)}`;
    return prefs[categoryKey] ?? true;
  }

  return true;
}
```

### Quiet Hours Check

```typescript
// Check if within quiet hours
function isQuietHours(prefs: NotificationPreference): boolean {
  if (!prefs.quietHoursEnabled) return false;

  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: prefs.quietHoursTimezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const [timeStr] = formatter.formatToParts(now).map((p) => p.value);
  const currentTime = timeStr; // "22:30"

  const start = prefs.quietHoursStart; // "22:00"
  const end = prefs.quietHoursEnd; // "08:00"

  if (start < end) {
    // Normal case (e.g., 9 AM to 5 PM)
    return currentTime >= start && currentTime <= end;
  } else {
    // Overnight case (e.g., 10 PM to 8 AM)
    return currentTime >= start || currentTime <= end;
  }
}
```

## GDPR Compliance

### Consent Management

- **Opt-in Required:** Marketing notifications require explicit consent
- **Consent Recording:** Every consent decision logged with timestamp, IP, user agent
- **Audit Trail:** Can retrieve consent history for any user
- **Easy Withdrawal:** Users can change preferences anytime
- **Transactional Always:** Cannot disable critical transactional notifications (GDPR requires this for service delivery)

### Data Handling

- Store preferences encrypted at rest
- Log all changes to audit table
- Provide export of notification settings
- Support data deletion (on account deletion)
- Respect "Do Not Track" headers (optional)

### Privacy Policy

Include in terms:

```
"Transactional Notifications
We send emails about your account, subscriptions, and service updates.
These are critical for service delivery and GDPR allows us to send
these regardless of your preferences. You cannot opt out of transactional
emails while maintaining an active account.

"Marketing Communications
We may send you emails, push notifications, and in-app messages about
new courses, community highlights, and special offers. You have full
control over these communications and can opt-in or opt-out at any time
in your Notification Preferences.

"Cookie and Tracking
We use your notification preferences to personalize your experience
and respect your choices. Your preferences are synced across all
devices where you use your account."
```

## Acceptance Criteria

- [ ] NotificationPreference schema created with all fields
- [ ] GET /api/notifications/preferences returns user preferences
- [ ] PUT /api/notifications/preferences updates all settings
- [ ] POST /api/notifications/preferences/consent records consent
- [ ] Marketing notifications filtered by opt-in status
- [ ] Transactional notifications cannot be disabled
- [ ] Quiet hours prevent notifications during set times
- [ ] NotificationPreferencesPage displays on web with proper layout
- [ ] All toggles update preferences when changed
- [ ] Category toggles show under correct channel
- [ ] Transactional notifications marked as "required"
- [ ] Timezone picker works with common timezones
- [ ] Quiet hours time validation works
- [ ] Mobile NotificationPreferencesScreen functional
- [ ] MarketingConsentModal shown on first login
- [ ] System notification denied state tracked
- [ ] SystemNotificationsDeniedPrompt shows correct platform instructions
- [ ] "Open Settings" button links to correct OS settings page
- [ ] shouldSendNotification function filters correctly
- [ ] isQuietHours function calculates correctly
- [ ] Consent log includes timestamp and IP address
- [ ] User can export notification preferences
- [ ] Preferences synced across devices
- [ ] GDPR compliance notice displayed
- [ ] All new users shown marketing consent prompt
- [ ] Privacy policy updated with notification terms

## Dependencies

- `apps/api` - Hono backend
- `packages/db` - Prisma ORM
- `packages/ui` - React components
- `packages/ui-mobile` - React Native components
- `packages/api-client` - API hooks
- `zod` - Schema validation
- `date-fns` or `day.js` - Timezone handling
- Firebase Cloud Messaging - Push notifications

## Technical Notes

### Timezone Handling

```typescript
// Use IANA timezone database
const timezones = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Tokyo",
  // ... full list from date-fns/timezone
];

// Check quiet hours with timezone awareness
const now = new Date();
const zonedDate = utcToZonedTime(now, timezone);
const hours = format(zonedDate, "HH:mm");
```

### Marketing vs Transactional

```
MARKETING:
- New courses available
- Posts from instructors
- Community highlights
- Special offers/promotions

TRANSACTIONAL (CANNOT DISABLE):
- Enrollment confirmations
- Payment/subscription reminders
- Course answers/comments
- Account security alerts
- Payout notifications
```

### Consent Flow

1. New user sees marketing consent prompt on signup or first login
2. User can accept/decline
3. Preference saved with consent log
4. User can change anytime in settings
5. Each change logged for audit trail

### System Notification Permissions

```typescript
// Detect if OS-level permissions denied
if (Notification.permission === "denied") {
  prefs.systemNotificationsDenied = true;
  prefs.systemNotificationsDeniedAt = new Date();

  // Show banner to user with link to OS settings
  showSystemNotificationsPrompt();
}

// Link to OS settings
const getSettingsLink = (platform: string) => {
  switch (platform) {
    case "macos":
      return "x-apple.systempreferences:com.apple.preference.notifications";
    case "ios":
      return "app-settings:Notifications";
    case "android":
      return "intent://settings/notification";
    case "windows":
      return "ms-settings:notifications";
    default:
      return ""; // Browser doesn't have central settings
  }
};
```

### Performance

- Cache preferences for 1 hour per user
- Invalidate cache on update
- Use batch queries for multiple users
- Index on userId for fast lookups

### Testing

- Unit tests for shouldSendNotification logic
- Unit tests for isQuietHours logic
- Integration tests for API endpoints
- E2E tests for preference UI
- Test with real timezones (UTC, EST, PST, etc.)
