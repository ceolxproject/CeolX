# Mobile Firebase Analytics Setup

## Description

Setup Firebase Analytics SDK in the React Native/Expo mobile app (iOS and Android). Initialize Firebase project with iOS and Android configuration files. Track screen views, user properties, and custom events that align with the shared analytics event taxonomy defined in milestone 13, task 13 to ensure consistent analytics across platforms. Enable Firebase Crashlytics for comprehensive crash reporting and error tracking alongside existing Sentry integration. Configure Firebase Analytics to work seamlessly with the analytics adapter package for consistent event tracking. Include Firebase Remote Config setup for feature flags and A/B testing if applicable. Ensure app store compliance with analytics data disclosure requirements for both Apple App Store and Google Play Store.

## Affected Apps/Packages

- mobile-app (React Native/Expo)
- analytics-adapter (shared package)
- Sentry integration (existing error tracking)
- Firebase project

## API Endpoints

- Firebase Realtime Database: `https://{project-id}.firebaseio.com/`
- Firebase Firestore: `https://firestore.googleapis.com/v1/projects/{project-id}/databases/`
- Firebase Analytics REST API: `https://www.googleapis.com/analytics/v3/`
- Firebase Crashlytics API: `https://firebase.googleapis.com/v1beta1/projects/{project-id}/crashlytics/`

## Requirements

### Firebase Project Setup

- Create Firebase project in Google Cloud Console (if not existing)
- Register iOS app variant in Firebase console with:
  - iOS Bundle ID: `com.example.lms.ios` (or appropriate)
  - Download GoogleService-Info.plist file
  - Add to Xcode project
- Register Android app variant in Firebase console with:
  - Android package name: `com.example.lms.android` (or appropriate)
  - Download google-services.json file
  - Add to Android project directory (android/app/)
- Enable required Firebase services in console:
  - Cloud Messaging (for notifications)
  - Crashlytics (error tracking)
  - Remote Config (feature flags)
  - Performance Monitoring (optional)
  - Analytics (core)
- Configure Firebase app settings (timezone UTC, supported regions, etc.)
- Setup Firebase data retention policy (minimum 2 months for analytics)

### Firebase Analytics Initialization

- Install Firebase SDK via expo: `expo install firebase`
- Create Firebase config module in app:
  ```
  firebaseConfig: {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
  }
  ```
- Initialize Firebase in app root (App.tsx) before navigation stack
- Set Firebase Analytics collection enabled flag based on user consent:
  - Disable by default: `analytics().setAnalyticsCollectionEnabled(false)`
  - Enable only after user grants analytics consent via consent banner
  - Respect OS-level privacy settings (iOS ATT, Android permissions)
- Use `getAnalytics()` method to access analytics instance

### Screen View Tracking

- Implement automatic screen tracking via React Navigation listener:
  - Use `onReady` and `navigation.addListener('state', ...)` to track screen changes
  - Log screen names to Firebase Analytics: `logScreenView(screenName, screenClass)`
  - Include screen properties: `{ screen_name: 'CourseDetail', screen_class: 'CourseDetailScreen' }`
- Create screen taxonomy mapping (route name → Firebase screen name)
  - Learner app screens: HomeScreen, CourseListScreen, CourseDetailScreen, LessonPlayerScreen, ProfileScreen, SearchScreen, WishlistScreen
  - Instructor app screens: DashboardScreen, CourseListScreen, CourseEditorScreen, StudentListScreen, RevenueScreen
  - Admin app screens: DashboardScreen, UserManagementScreen, CourseManagementScreen, ReportsScreen
- Log screen view with timestamp and navigation context

### Custom Event Tracking - Event Taxonomy Alignment

Implement Firebase Analytics events matching the shared analytics taxonomy:

1. **user_signed_up** - Firebase event: `sign_up`
   - Parameters: signup_method, referral_code, country, language
2. **user_logged_in** - Firebase event: `login`
   - Parameters: login_method, is_returning_user
3. **user_logged_out** - Firebase event: `logout`
   - Parameters: session_duration_seconds
4. **course_viewed** - Firebase event: `view_item`
   - Parameters: item_id, item_name, item_category, price, instructor_id
5. **course_enrolled** - Firebase event: `purchase` or `subscribe` (if subscription)
   - Parameters: item_id, item_name, price, payment_method, promotion_code, value (in cents), currency
6. **lesson_started** - Firebase event: `video_start`
   - Parameters: item_id, item_name, content_type: 'lesson', duration (seconds)
7. **lesson_completed** - Firebase event: `video_complete`
   - Parameters: item_id, item_name, watch_time_seconds, total_duration_seconds, percentage
8. **course_completed** - Firebase event: `level_up` or custom `course_completion`
   - Parameters: item_id, item_name, level (completion status)
9. **search_performed** - Firebase event: `search`
   - Parameters: search_term, filters_applied, result_count
10. **search_result_clicked** - Firebase event: `view_item_list`
    - Parameters: item_id, item_name, result_position
11. **payment_initiated** - Firebase event: `begin_checkout`
    - Parameters: item_id, value, currency, items_count
12. **payment_completed** - Firebase event: `purchase`
    - Parameters: transaction_id, item_id, value, currency, payment_method
13. **payment_failed** - Custom event: `payment_failed`
    - Parameters: item_id, payment_method, error_code, error_reason
14. **quiz_started** - Custom event: `quiz_start`
    - Parameters: course_id, quiz_id, question_count, time_limit
15. **quiz_completed** - Custom event: `quiz_complete`
    - Parameters: course_id, quiz_id, score, passing_score, time_taken_seconds
16. **certificate_generated** - Custom event: `certificate_earned`
    - Parameters: course_id, certificate_id, course_name
17. **profile_updated** - Custom event: `profile_update`
    - Parameters: fields_updated (comma-separated list)
18. **subscription_upgraded** - Custom event: `subscription_upgrade`
    - Parameters: old_plan, new_plan, upgrade_price, billing_cycle
19. **subscription_cancelled** - Custom event: `subscription_cancel`
    - Parameters: plan_name, cancellation_reason, refund_issued
20. **wishlist_added** - Firebase event: `add_to_wishlist`
    - Parameters: item_id, item_name, item_category, price
21. **wishlist_removed** - Custom event: `remove_from_wishlist`
    - Parameters: item_id, item_name
22. **tutorial_complete** - Firebase event: `tutorial_complete`
    - Parameters: tutorial_name, steps_completed

### User Property Tracking

- Set user properties upon user identification/login:
  ```
  analytics().setUserId(userId);
  analytics().setUserProperties({
    user_type: 'learner' | 'instructor' | 'admin',
    subscription_status: 'free' | 'active' | 'expired',
    subscription_plan: 'basic' | 'pro' | 'all-access',
    language_preference: 'en' | 'es' | 'fr' | ...,
    country: user.country,
    is_instructor: false,
    is_admin: false,
    total_courses_enrolled: courseCount,
    signup_date: timestamp
  })
  ```
- Update user properties when they change (profile update, subscription change)
- Clear user properties on logout: `analytics().setUserId(null)`

### Firebase Crashlytics Integration

- Install Crashlytics: `expo install @react-native-firebase/crashlytics`
- Initialize Crashlytics in app root:
  ```
  crashlytics().setJSExceptionHandler((error, isFatal) => {
    // Log to Crashlytics and Sentry
  })
  ```
- Configure Crashlytics to work alongside Sentry:
  - Crashlytics for native crashes (iOS/Android)
  - Sentry for JavaScript errors and breadcrumbs
  - Both services can report same error without duplicates (use error ID)
- Set custom key-value data for crashes:
  ```
  crashlytics().setAttributes({
    current_screen: screenName,
    user_id: userId,
    app_version: appVersion,
    user_type: userType
  })
  ```
- Enable Google Play Services crash reporting (Android only)
- Configure crash reporting dashboard in Firebase console:
  - Set alert thresholds (notify team if crash rate > 1%)
  - Create issue tickets for critical crashes

### Firebase Remote Config Setup

- Enable Remote Config service in Firebase console
- Create feature flag parameters:
  - `feature_dark_mode_enabled` (boolean) - Desktop PWA dark mode
  - `feature_ai_tutor_enabled` (boolean) - AI tutor feature for courses
  - `video_autoplay_enabled` (boolean) - Auto-play videos on app open
  - `enable_all_access_tier` (boolean) - Feature rollout for All-Access
  - `max_retry_attempts` (number) - Max API retry count
  - `session_timeout_minutes` (number) - Session timeout duration
  - `promo_banner_text` (string) - Marketing banner text
- Fetch and activate remote config on app startup:
  ```
  remoteConfig().fetch().then(() => {
    remoteConfig().activate();
  })
  ```
- Use feature flags in feature logic:
  ```
  if (remoteConfig().getBoolean('feature_dark_mode_enabled')) {
    // Enable dark mode
  }
  ```
- Create A/B test via Remote Config:
  - Control: feature_X_enabled = false
  - Variant A: feature_X_enabled = true with variant A config
  - Variant B: feature_X_enabled = true with variant B config
  - Track engagement metrics (session duration, course completion rate)

### Analytics Adapter Integration

- Update analytics adapter to support Firebase in addition to existing providers
- Adapter should:
  - Accept environment config specifying which providers are active (Firebase, GTM)
  - Map unified event taxonomy to provider-specific event formats
  - Send events to both providers simultaneously
  - Handle provider-specific property mappings (e.g., Firebase uses 'item_id' vs internal event schema fields)
  - Provide fallback if one provider fails (don't block other providers)
- Adapter configuration:
  ```
  {
    firebase: { enabled: true },
    gtm: { enabled: false } // GTM only for web
  }
  ```

### User Consent & Privacy

- Respect user's analytics consent from banner (milestone 13):
  - Don't enable analytics collection until user opts in
  - Use: `analytics().setAnalyticsCollectionEnabled(userConsent.analytics)`
- Respect iOS ATT (App Tracking Transparency):
  - Check `userTrackingPermission` before sending user properties
  - Show ATT prompt only for analytics/marketing (not functional)
  - Use IDFA sparingly (only for attribution)
- Respect Android privacy dashboard:
  - Declare analytics permissions in AndroidManifest.xml
  - Comply with Google Play's user data policies
- Implement data deletion:
  - User can request account deletion → delete all analytics data
  - Use Firebase Admin SDK to delete associated user data
  - Verify deletion via Firebase console (Data Deletion tab)

### Performance Monitoring (Optional)

- Enable Firebase Performance Monitoring for app startup time, screen load times
- Monitor critical user flows:
  - Course enrollment time (from browse → payment completion)
  - Lesson loading time (first frame to video playable)
  - Search response time
- Set performance thresholds and alerts

### App Store Compliance

- **Apple App Store Privacy Label**:
  - Declare Firebase Analytics in App Store privacy questionnaire
  - Indicate data categories collected:
    - User ID: Linked to identity
    - Device ID: Linked to identity (if IDFA used)
    - Product interaction: User interactions
    - Other data: App functionality
  - Specify privacy policy includes analytics disclosure
  - Select "Analytics" and "App Functionality" as primary purposes

- **Google Play Store Data Safety Section**:
  - Fill out Google Play's Data Safety form:
    - Declare Firebase Analytics data collection
    - Confirm data is not sold to third parties
    - Confirm data is not used for other purposes
    - Ensure GDPR/CCPA compliance statements

### Testing & Validation

- Test in development with Firebase emulator (optional):
  - Use `firebase emulators:start` for local testing
  - Connect app to emulator via env config
- Test analytics collection in staging:
  - Generate test events: user signup, course enrollment, payment
  - Verify events appear in Firebase console within 1-2 minutes
  - Check user properties are set correctly
- Test crash reporting:
  - Force app crash: `throw new Error('Test crash')`
  - Verify crash appears in Crashlytics dashboard within 1-2 minutes
- Test remote config:
  - Create test config in Firebase console
  - Fetch and verify flag values in app
  - Change config and verify app reflects changes
- Test consent flow:
  - Reject analytics consent → verify analytics disabled in code
  - Grant analytics consent → verify analytics enabled
  - Use iOS Settings → Privacy → Analytics to disable → verify respected
- Performance test:
  - Measure app startup time before/after analytics
  - Target: < 500ms additional startup time
  - Monitor battery and network usage impact

## Acceptance Criteria

- [ ] Firebase project created and configured for iOS and Android
- [ ] GoogleService-Info.plist added to iOS project
- [ ] google-services.json added to Android project
- [ ] Firebase SDK initialized in app root before navigation stack
- [ ] Automatic screen view tracking implemented via React Navigation
- [ ] Screen taxonomy created mapping all routes to Firebase screen names
- [ ] All 20+ custom events implemented matching shared analytics taxonomy
- [ ] Event parameters validated and tested (correct data types, required fields)
- [ ] User identification implemented: `setUserId()` on login, cleared on logout
- [ ] User properties configured and update on profile/subscription changes
- [ ] Firebase Crashlytics initialized and working alongside Sentry
- [ ] Custom crash attributes set (screen, user_id, app_version, user_type)
- [ ] Firebase Remote Config initialized with feature flag parameters
- [ ] A/B test configuration tested (feature flags fetch and activate)
- [ ] Analytics adapter updated to support Firebase (unified event mapping)
- [ ] User consent respected: analytics disabled by default, enabled on opt-in
- [ ] iOS ATT privacy respected: no IDFA without explicit permission
- [ ] Android privacy dashboard compliance verified
- [ ] Firebase console shows events in real-time dashboard
- [ ] App Store privacy label completed and submitted
- [ ] Google Play Data Safety form filled and submitted
- [ ] Testing checklist completed: signup, enrollment, payment, crash, remote config
- [ ] Documentation created: Firebase setup guide, event taxonomy, troubleshooting
- [ ] No sensitive data (passwords, credit cards) in analytics events
- [ ] Staging environment tested with production build before release

## Dependencies

- `firebase` (Expo-compatible Firebase SDK)
- `@react-native-firebase/analytics` (React Native-specific analytics)
- `@react-native-firebase/crashlytics` (Crash reporting)
- `@react-native-firebase/remote-config` (Feature flags)
- React Navigation (for screen tracking)
- Analytics adapter package (milestone 13, task 13)
- Cookie/consent banner (milestone 13)
- Sentry (existing error tracking, integration tested)
- iOS: Xcode project setup
- Android: Gradle and Android Studio setup

## Technical Notes

- Firebase Analytics for mobile is free tier with unlimited events (different from web GA4)
- Screen view tracking is automatic in Firebase but should still be logged for consistency
- Firebase Events API has parameter limits: max 25 parameters per event, string values max 100 chars
- User property limits: max 25 user properties, each max 100 chars
- Remote Config fetch can be throttled: limit to once per app launch or ~12 hours
- Crashlytics data retention: 90 days by default, can be extended in Firebase settings
- Test Crashlytics with `crashlytics().crash()` to generate test crash
- Firebase Analytics userId is optional but recommended for user-level cohort analysis
- Avoid PII in custom event parameters (use hashed/anonymized IDs only)
- Remote Config changes take ~15 minutes to propagate to all clients
- Firebase console shows analytics data with ~24-48 hour reporting delay for insights
- Performance Monitoring may add ~10MB to app size; consider impact on app download size
- Use ProGuard rules in Android to ensure Crashlytics properly deobfuscates stack traces
- Monitor Firebase billing: analytics is free, but other services (Firestore, Storage) may incur costs
