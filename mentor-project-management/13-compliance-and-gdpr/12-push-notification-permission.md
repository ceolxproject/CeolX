# Push Notification Permission Flow

## Description

Implement a user-friendly push notification permission request flow that respects OS-level permissions and provides granular toggles for marketing vs. transactional notifications. Permission requests are shown at contextually appropriate moments (not on first app launch) with clear explanations of notification types. Users can manage preferences in Settings and access OS settings directly if permission was denied.

## Affected Apps/Packages

- **iOS App** (React Native/SwiftUI) - native push permission request
- **Android App** (React Native/Kotlin) - native push permission request
- **Web App** (Next.js) - web push notifications (future)
- **API Server** - notification preference management
- **Push Service** - Firebase Cloud Messaging, APNS
- **Database** - notification_preferences table

## API Endpoints

- `POST /api/notifications/request-permission` - Initiate permission request
- `POST /api/notifications/preferences` - Update notification preferences
- `GET /api/notifications/preferences` - Get user's preferences
- `POST /api/notifications/os-permission-status` - Check OS permission state
- `POST /api/notifications/reset-prompt` - Reset permission request prompt (admin)

## Requirements

- **Permission Request Timing**:
  - NOT on first app launch
  - NOT during onboarding
  - Optimal moments:
    - After first course enrollment (learner)
    - After first course published (instructor)
    - After first community post (user)
    - When user opens Notifications settings
    - After 3+ days of app usage
    - When visiting course with new content available
  - Use timer/counter to track meaningful interactions before prompting
  - Only show once per app session if dismissed
  - Respect OS prompt state (don't prompt if already rejected recently)

- **Permission Request Modal** (iOS & Android):
  - Title: "Stay Updated on Your Courses"
  - Description: "We'll send you notifications about new course content, discussions, and updates. You can manage these preferences anytime."
  - Two buttons:
    - "Enable Notifications" (primary, blue)
    - "Later" or "Not Now" (secondary)
  - Information boxes explaining:
    - **Transactional**: Course updates, comments on your posts, enrollment confirmations
    - **Marketing**: New courses from instructors you follow, promotions, tips
  - Toggle: "Receive Marketing Notifications" (default OFF initially, can be ON based on user segment)
  - Toggle: "Receive Transactional Notifications" (always ON, cannot be toggled off)

- **Notification Types**:
  1. **Transactional** (Essential):
     - Course content updates (new lessons)
     - New comments on user's posts
     - New replies to user's comments
     - Enrollment confirmations
     - Course completion notifications
     - Certificate issued
     - Cannot be disabled by user (for trust/experience)
     - Silent/banner style (no sound by default)

  2. **Marketing** (Optional):
     - New courses from followed instructors
     - Course recommendations based on interests
     - Promotional campaigns (limited)
     - Platform tips and tips
     - Can be disabled by user
     - Can have sound notifications
     - Frequency controlled (max 2-3 per week)

- **Database Schema**:

  ```
  notification_preferences table:
  - id: UUID (primary key)
  - user_id: UUID (foreign key)
  - transactional_enabled: boolean (always true, read-only)
  - marketing_enabled: boolean (default false)
  - do_not_disturb_start: time (nullable, e.g., "22:00")
  - do_not_disturb_end: time (nullable, e.g., "08:00")
  - notification_sound: boolean (default true)
  - notification_vibration: boolean (default true)
  - quiet_hours_enabled: boolean (default false)
  - os_permission_granted: boolean (reflects current OS state)
  - os_permission_status: enum (granted, denied, not_requested, unknown)
  - last_permission_prompt_at: timestamp with timezone (nullable)
  - permission_prompt_count: integer (default 0, count of times prompted)
  - created_at: timestamp with timezone
  - updated_at: timestamp with timezone

  device_tokens table (for push delivery):
  - id: UUID (primary key)
  - user_id: UUID (foreign key)
  - device_token: string (from FCM or APNS)
  - device_type: enum (ios, android, web)
  - device_model: string (nullable, e.g., "iPhone 14")
  - os_version: string (nullable, e.g., "17.2")
  - app_version: string (nullable)
  - is_active: boolean (default true)
  - created_at: timestamp with timezone
  - last_used_at: timestamp with timezone
  - invalidated_at: timestamp with timezone (nullable, for old tokens)
  ```

- **OS Permission Handling**:
  - **iOS**:
    - Use `requestUserNotificationPermissions()` from UserNotifications framework
    - Respect iOS permission state (granted, denied, not_requested)
    - If denied, show link to Settings: "Manage in Settings" button
    - Check current state before requesting: `UNUserNotificationCenter.current().getNotificationSettings()`
    - If already denied, don't re-prompt (show Settings link instead)

  - **Android**:
    - Use `NotificationManager.requestPermission()` (API 33+)
    - For API < 33, no explicit permission needed (system manages)
    - Check current state: `NotificationManagerCompat.areNotificationsEnabled()`
    - If denied, show link to Settings: "Manage in Settings" button
    - On Android 12+, show permission dialog as part of flow

- **Settings UI** (Settings > Notifications):
  - Toggle: "Transactional Notifications" (disabled/read-only, always on)
    - Description: "Course updates, comments, and replies"
  - Toggle: "Marketing Notifications" (user-togglable)
    - Description: "New courses, recommendations, and tips"
  - Toggle: "Notification Sound" (if permissions granted)
  - Toggle: "Notification Vibration" (if permissions granted)
  - Toggle: "Quiet Hours" (if permissions granted)
    - Time picker: Start time and end time
    - Description: "No notifications during these hours"
  - Button: "Manage Permissions" (if OS permission denied)
    - Text: "Notifications are not enabled in your device settings"
    - Button: "Open Settings" (deep link to OS settings)
  - Permission status indicator:
    - "Notifications enabled" (green check)
    - "Notifications disabled in device settings" (yellow warning)
    - "Permission never requested" (gray)

- **Deep Linking to OS Settings**:
  - **iOS**: `UIApplication.shared.open(URL(string: UIApplication.openSettingsURLString)!)`
  - **Android**: `Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply { putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName) }`
  - Button text: "Open Settings" or "Manage in Device Settings"
  - Clear explanation: "You can enable notifications in your device Settings app"

- **API Implementation**:
  - `POST /api/notifications/request-permission`:

    ```json
    {
      "trigger_point": "first_enrollment",
      "trigger_metadata": { "course_id": "course_123" }
    }
    ```

    Response:

    ```json
    {
      "should_prompt": true,
      "os_permission_status": "not_requested",
      "user_preferences": {
        "transactional_enabled": true,
        "marketing_enabled": false
      }
    }
    ```

  - `POST /api/notifications/preferences`:

    ```json
    {
      "transactional_enabled": true,
      "marketing_enabled": true,
      "notification_sound": true,
      "quiet_hours_enabled": true,
      "quiet_hours_start": "22:00",
      "quiet_hours_end": "08:00"
    }
    ```

  - `POST /api/notifications/os-permission-status`:
    ```json
    {
      "os_permission_status": "granted",
      "device_token": "fcm_token_xyz123",
      "device_type": "android"
    }
    ```

- **Notification Delivery Logic**:
  - Before sending notification, check:
    1. User preference enabled (transactional always, marketing if toggled)
    2. OS permission granted
    3. Device token is valid/active
    4. Not in quiet hours
    5. Notification frequency limits not exceeded
  - Include deep link in notification payload:
    - Course updates: link to course
    - Comments: link to post
    - Enrollments: link to course
  - Notification format:
    - Title: "Course Updated: Skincare 101"
    - Body: "New lesson available: Application Techniques"
    - Deep link: `app://course/course_123`

- **Edge Cases & Handling**:
  - User denies permission → show "Manage in Settings" button, don't re-prompt for 30 days
  - Device token expires → handle gracefully, refresh on app launch
  - User uninstalls/reinstalls → prompt again (new device)
  - User upgrades iOS/Android → check permission state
  - Multiple devices per user → track separate tokens
  - User disables notifications in OS → API should detect and update preference

- **Quiet Hours Implementation**:
  - Store user's timezone for correct time calculation
  - When sending notification, check current user time vs. quiet hours
  - If in quiet hours, queue notification for delivery after quiet hours end
  - If delivery time > 24 hours, deliver immediately with different style (silent)

- **Frequency Limiting**:
  - Max 1 notification per 30 minutes per category
  - Max 3 marketing notifications per week
  - Max 10 transactional notifications per day
  - Bundle multiple updates into single notification if within time window
  - Respect user's preference in settings for frequency

- **Deep Link Handling**:
  - When notification tapped, navigate to relevant content
  - Examples:
    - `app://course/[course_id]` → open course page
    - `app://post/[post_id]` → open forum post
    - `app://enrollments` → open enrollments list
  - Handle case where content was deleted (graceful error)
  - Track notification opens for analytics

- **Testing & Validation**:
  - Test with permission denied scenario
  - Test with permission granted scenario
  - Test with old devices without permission API (graceful fallback)
  - Test quiet hours timing (especially timezone edge cases)
  - Test device token refresh workflow
  - Test notification delivery with various content types

## Acceptance Criteria

- [ ] Permission request shown at contextually appropriate time
- [ ] Permission not shown on first app launch
- [ ] Permission request modal shows clear explanation of notification types
- [ ] Transactional toggle shown as always enabled (read-only)
- [ ] Marketing toggle toggleable and defaults to OFF
- [ ] "Enable Notifications" button triggers OS permission request
- [ ] iOS uses UNUserNotificationCenter for permission
- [ ] Android uses NotificationManager for permission (API 33+)
- [ ] Current OS permission state checked before prompting
- [ ] If permission denied, Settings link shows instead of re-prompt
- [ ] Settings UI in Notifications section accessible
- [ ] Toggle switches working and preferences saved
- [ ] "Manage Permissions" button visible if OS permission denied
- [ ] "Open Settings" button deep links to OS settings correctly
- [ ] Device tokens stored and active status tracked
- [ ] Transactional notifications delivered when enabled
- [ ] Marketing notifications respect user preference
- [ ] Notification frequency limits enforced
- [ ] Quiet hours respected (no notifications during hours)
- [ ] Notifications include deep links to relevant content
- [ ] Notification opens tracked for analytics
- [ ] Device token refresh on app launch working
- [ ] Multiple devices per user handled correctly
- [ ] Permission prompt count tracked (max 3 times then give up)
- [ ] 30-day cooldown after denial respected
- [ ] Notification sound/vibration toggles respected
- [ ] Timezone handling correct for quiet hours
- [ ] Uninstall/reinstall resets permission prompt
- [ ] Performance tested with high notification volume

## Dependencies

- **iOS App** - native notification implementation
- **Android App** - native notification implementation
- **Push Service** - Firebase Cloud Messaging or similar
- **Authentication** - user context for preferences
- **Database** - notification_preferences and device_tokens tables

## Technical Notes

- Device tokens can be invalidated by OS, implement refresh strategy
- Keep device_tokens table cleaned up (remove old tokens after 30 days of inactivity)
- Use exponential backoff for failed deliveries
- Track delivery status for metrics/debugging
- Consider batching notification sends (send once per hour if multiple)
- Implement circuit breaker for FCM/APNS failures
- Log all permission requests and changes for audit
- Notification payload should be < 4KB for iOS
- Test with various app states (foreground, background, killed)
- For web app, use Web Notifications API (future enhancement)
- Consider A/B testing on permission request copy/timing
- Monitor permission denial rate (if high, adjust timing/messaging)
- Implement analytics: % users with notifications enabled, opt-in rate
- Archive device tokens after 2 years
- Document quiet hours feature in user help
- Consider rich notifications with images (iOS/Android)
- Ensure GDPR compliance: don't track notification opens without consent
- Test timezone handling across different regions
- Consider notification templating system for consistency
- Implement admin console to test push notifications
- Monitor push delivery latency and success rates
