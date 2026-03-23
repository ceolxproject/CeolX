# Google Play Store Submission (Android)

## Description

Complete Android app submission process for Mentor Learner mobile app (React
Native Expo). Covers Google Play Console setup, data safety form completion, app
store listing with screenshots and descriptions, content rating classification,
Widevine DRM verification for protected video content, internal/closed/open
testing tracks, and publishing workflow. Ensures app meets Google Play policies
and launches successfully on Android.

## Affected Apps/Packages

- **Learner Mobile** (React Native Expo)
- **Backend API** (Hono on Vercel)
- **Mux Video Streaming** (Widevine DRM)
- **Stripe Payments** (In-App Purchase support)
- **Firebase** (Cloud Messaging, analytics)

## Requirements

### Google Play Console Setup

- Google Play Developer account ($25 one-time fee)
- App package name: `com.example.mentor`
- Signing key (upload to Google Play)
- Release tracks: internal, closed, open

### App Metadata & Content

- App name: "Mentor - Learn Makeup"
- Short description (80 characters max)
- Full description (4,000 characters max)
- Screenshots: Minimum 2, maximum 8 per language type (phone, tablet, wear)
- Feature graphic (1024x500)
- App icon (512x512)
- Hero image (1024x500, optional)
- Video preview URL (YouTube, optional)
- Phone/Tablet screenshots (1080x1920 minimum recommended)

### Data Safety & Privacy

- Complete Data Safety form (required for all apps)
- Privacy Policy (required, accessible from app)
- Collect data about: Email, User ID, Video playback analytics
- Declare all permissions used
- Third-party services disclosed (Stripe, Mux, Firebase)
- User consent for data collection

### Review Guidelines Compliance

- No deceptive practices
- Content rating appropriate
- Age restrictions clear
- In-App Purchase properly implemented
- Acceptable content policy
- Device/feature compatibility accurate

### DRM & Content Protection

- Widevine DRM configured for all protected videos
- DRM license server properly configured
- Content encryption verified
- License persistence working

### Performance & Stability

- Minimum API level: 24 (Android 7.0)
- Target API level: 34+ (Android 14+)
- App size < 100MB (or use Play App Signing)
- No crashes on tested devices
- Responds to user input within 5 seconds

## Acceptance Criteria

- [ ] Google Play Console account created and configured
- [ ] App package name registered (`com.example.mentor`)
- [ ] Signing key created and uploaded
- [ ] All required metadata complete
- [ ] Data Safety form completed accurately
- [ ] Privacy Policy accessible and compliant
- [ ] Age/content rating selected appropriately
- [ ] Widevine DRM configured and verified
- [ ] Screenshots and graphics uploaded for all required languages
- [ ] Internal testing build passes QA
- [ ] Closed testing build with beta testers shows stability
- [ ] No critical crashes or ANRs (Application Not Responding)
- [ ] All permissions justified and used correctly
- [ ] In-App Purchase tested with sandbox
- [ ] Submit to Play Store review
- [ ] App approved and published

## Dependencies

### Tools & Services

- Google Play Console account
- Android SDK and build tools
- Gradle for building APK/AAB
- Keystore for signing
- Bundletool for testing AAB locally

### External Services

- Mux for Widevine-protected video
- Stripe for payment processing
- Firebase for analytics and notifications
- Google Analytics integration

### Development Environment

- React Native Expo
- EAS Build (Expo Application Services)
- Android Studio (for testing)
- API level 24+ emulators or devices

## Technical Notes

### 1. Google Play Console Setup

**Create Developer Account:**

1. Go to play.google.com/console
2. Sign in with Google account
3. Accept Developer Program Policies
4. Pay $25 registration fee
5. Verify payment method

**Create Application:**

1. Play Console → Create App
2. App name: "Mentor - Learn Makeup"
3. Default language: English (US)
4. App category: Education
5. App type: Mobile app
6. Free: Yes

**Set Up App Package:**

```
Package Name: com.example.mentor
Application ID: com.example.mentor
```

### 2. Generate & Upload Signing Key

**Option A: Google Play App Signing (Recommended)**

```bash
# Generate upload key (local signing)
keytool -genkeypair -name upload \
  -validity 10950 \
  -keyalg RSA \
  -keysize 2048 \
  -storetype PKCS12 \
  -keystore upload-keystore.p12

# Export for use
keytool -export -rfc -alias upload \
  -keystore upload-keystore.p12 \
  -storepass <password> \
  -file upload-cert.pem
```

**Option B: Self-signed (Legacy)**

```bash
# Generate key
keytool -genkey -v -keystore mentor-keystore.jks \
  -alias mentor \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10950
```

**Upload to Play Console:**

1. Go to Setup → App signing
2. "Let Google Play handle signing" (recommended)
3. Upload your upload key
4. Note: Google Play will use their own app signing key for distribution

### 3. Data Safety Form

**Complete all sections:**

```
Does your app collect or request any of the following from users?

EMAIL_ADDRESS: Yes
  - Collection purpose: Account management
  - Shared with third parties: No
  - Used for tracking: No
  - Data is encrypted: Yes
  - Users can request deletion: Yes

USER_ID: Yes
  - Collection purpose: Account management, video analytics
  - Shared with third parties: Yes (Mux, Stripe)
  - Used for tracking: Yes (analytics only, no advertising)
  - Data is encrypted: Yes
  - Users can request deletion: Yes

PAYMENT_INFORMATION: Yes (Stripe)
  - Collection purpose: Subscription payments
  - Shared with third parties: Yes (Stripe only)
  - Used for tracking: No
  - Data is encrypted: Yes
  - Users can request deletion: Yes

VIDEO_PLAYBACK_ANALYTICS: Yes
  - Collection purpose: Video performance monitoring
  - Shared with third parties: Yes (Mux)
  - Used for tracking: No
  - Data is encrypted: Yes
  - Users can request deletion: Yes

DEVICE_IDENTIFIERS: Yes
  - Collection purpose: Crash reporting
  - Shared with third parties: No
  - Used for tracking: No
  - Data is encrypted: Yes
  - Users can request deletion: N/A

Does your app contain any of the following content types?

- Ads: No
- Alcohol/Tobacco: No
- Violence: No (makeup learning, no violence)
- Gambling: No
- High Risk Financial Services: No
- Sexual Content: No
- Dating: No
- Family: Yes
- Health/Fitness: Yes (makeup is beauty/wellness)
- Cryptocurrency: No

Does your app request any sensitive permissions?

- Camera: No (or Yes if profile picture upload)
- Microphone: No
- Location: No
- Contacts: No
- SMS: No
- Phone: No
- Calendar: No
- Files: Yes (download course materials)
```

### 4. App Store Listing

**App Name (50 char max):**

```
Mentor - Learn Makeup
```

**Short Description (80 char max):**

```
Master cosmetics with expert instructors worldwide
```

**Full Description (4,000 char max):**

```
Learn makeup from award-winning professionals with Mentor, the leading cosmetics education platform.

Master the art of beauty:
• Comprehensive courses from beginner to advanced
• Learn foundation, contouring, eyeshadow, special effects, and more
• Watch expert instructors demonstrate techniques in detail
• Practice at your own pace with lifetime access

Features:
✓ Structured learning paths for all skill levels
✓ Practice exercises and community feedback
✓ Earn certificates upon course completion
✓ Download courses for offline learning
✓ Personalized recommendations
✓ Ask questions in community forums
✓ Connect with instructors and other learners

Content updates weekly with new courses and tutorials from professional makeup artists.

Whether you're starting your beauty journey or perfecting advanced techniques, Mentor has the courses you need.

Free courses available! Subscribe for unlimited access.

Visit https://mentor.example.com for more information.
```

**Keywords (5 keywords, separated by commas):**

```
makeup, beauty, cosmetics, learning, education
```

**Feature Graphic (1024x500):**

- Text overlay: "Master Makeup Techniques"
- Shows course/learning focus
- No dynamic content (text/counts)

### 5. Screenshots

**Phone Screenshots (1080x1920 minimum):**

**Screenshot 1 - Sign In / Get Started**

- Shows: Welcome screen, sign-in interface
- Text: "Join Mentor Today"

**Screenshot 2 - Course Discovery**

- Shows: Course list, search functionality
- Text: "Browse 100+ Courses"

**Screenshot 3 - Video Learning**

- Shows: Video player, lesson in progress
- Text: "Learn at Your Pace"

**Screenshot 4 - Progress Tracking**

- Shows: Course progress, completion percentage
- Text: "Track Your Progress"

**Screenshot 5 - Certificates**

- Shows: Certificate of completion
- Text: "Earn Certificates"

**Screenshot 6 - Community**

- Shows: Community posts, instructor interaction
- Text: "Connect with Mentors"

**Tablet Screenshots (if app optimized):**

- Same 6 scenes but in landscape (2560x1440)
- Show tablet-optimized layout

### 6. Content Rating

**IARC Rating System:**

```
Category: EDUCATION
Content Rating: 3+ (Everyone)

Assessment Questions:
- Does your app contain violence? No
- Does your app contain sexual content? No
- Does your app contain profanity? No
- Does your app use alcohol/tobacco? No
- Does your app use scary/horrifying content? No
- Does your app contain other mature content? No

Compliance Certifications:
✓ COPPA (Children's Online Privacy Protection)
✓ GDPR (General Data Protection Regulation)
✓ CCPA (California Consumer Privacy Act)
```

### 7. In-App Purchase Configuration

**Set Up Subscriptions:**

```
Subscription ID: mentor_pro_monthly
Title: Mentor Pro Monthly
Description: Unlimited access to all courses
Price: $9.99/month (varies by region)
Free trial: 7 days (optional)
Billing period: Monthly
Auto-renewal: Yes
Grace period: 3 days

Subscription ID: mentor_premium_monthly
Title: Mentor Premium Monthly
Description: Premium courses + priority support
Price: $19.99/month
Free trial: 7 days
Billing period: Monthly
Auto-renewal: Yes
Grace period: 3 days
```

**React Native Implementation:**

```typescript
import RNIap from "react-native-iap";

// Initialize
const skus = {
  android: ["mentor_pro_monthly", "mentor_premium_monthly"],
};

export async function initializeInAppPurchase() {
  try {
    await RNIap.initConnection();
    const products = await RNIap.getSubscriptions({
      skus: skus.android,
    });
    return products;
  } catch (error) {
    console.error("IAP init failed:", error);
  }
}

// Purchase subscription
export async function purchaseSubscription(sku: string) {
  try {
    const purchase = await RNIap.requestSubscription({
      sku: sku,
      obfuscatedAccountId: userId,
      obfuscatedProfileId: profileId,
    });

    // Validate with backend
    const validated = await validatePurchaseWithBackend(purchase);

    if (validated) {
      await RNIap.acknowledgePurchase(purchase.purchaseToken);
    }

    return purchase;
  } catch (error) {
    console.error("Purchase failed:", error);
  }
}

// Restore purchases
export async function restorePurchases() {
  try {
    const purchases = await RNIap.getPurchaseHistory();

    for (const purchase of purchases) {
      if (!purchase.isAcknowledgedAndroid) {
        await RNIap.acknowledgePurchase(purchase.purchaseToken);
      }
    }

    return purchases;
  } catch (error) {
    console.error("Restore failed:", error);
  }
}
```

### 8. Widevine DRM Configuration

**Verify Widevine on Android:**

```typescript
// Test Widevine DRM capabilities
import { DRM_WIDEVINE } from "react-native-video";

export async function checkWidevineDRM() {
  // In actual app, use Video component to test
  // Mux will serve Widevine-protected content

  const testUrl = "https://image.mux.com/v1/PLAYBACK_ID/dash.mpd";

  // The video player will handle Widevine license requests
  return {
    widevineSupported: true,
    drmType: "widevine",
  };
}
```

**Mux Configuration (in Mux Dashboard):**

1. Create Playback ID with DRM policy
2. Select Widevine as DRM provider
3. Configure allowed domain/package names
4. Set license expiration policy
5. Generate signing credential for license server

**App Package Whitelist:**

```
com.example.mentor
```

### 9. Testing Tracks

**Internal Testing Track:**

- For internal team only
- Build v1.0.0 (build 1)
- All features testable
- Updated daily during development

**Closed Testing Track:**

- Up to 1,000 testers
- Selected beta testers invited
- Run for 1-2 weeks
- Collect feedback on stability

**Open Testing Track (Optional):**

- Any user can join (up to 2,000 during beta)
- Public access via Play Store link
- Get feedback from larger audience
- Before moving to production

**Configuration:**

1. Play Console → Release → Testing Tracks
2. Internal Testing:

- Upload APK/AAB
- Select testers (internal team)
- Release notes

3. Closed Testing:

- Move build from internal to closed
- Add tester email addresses
- Create testing feedback form

4. Production:

- Only after closed testing approval
- Gradual rollout (10% → 50% → 100%)

### 10. Release Management

**Build & Upload Process:**

```bash
# Build with EAS
eas build --platform android --release

# Or build locally
cd android && ./gradlew bundleRelease

# Upload APK/AAB to Play Console
# Via: Play Console → Release → Production → New release
```

**Staged Rollout:**

```
Phase 1: 10% rollout (2 days)
  - Monitor crashes, ratings
  - If stable, proceed

Phase 2: 50% rollout (2 days)
  - Monitor performance metrics
  - If stable, proceed

Phase 3: 100% rollout
  - Full release to all users
```

**Monitoring During Rollout:**

- Android Vitals dashboard
- Crash rate should be < 0.1%
- ANR rate should be < 0.05%
- Battery drain acceptable
- Memory usage reasonable

### 11. Build Configuration

**build.gradle (App level):**

```gradle
android {
  compileSdk 34

  defaultConfig {
    applicationId "com.example.mentor"
    minSdk 24
    targetSdk 34
    versionCode 1
    versionName "1.0.0"

    resValue "string", "app_name", "Mentor"
  }

  signingConfigs {
    release {
      storeFile file("upload-keystore.p12")
      storePassword System.getenv("KEYSTORE_PASSWORD")
      keyAlias System.getenv("KEY_ALIAS")
      keyPassword System.getenv("KEY_PASSWORD")
    }
  }

  buildTypes {
    release {
      signingConfig signingConfigs.release
      minifyEnabled true
      proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
  }
}

dependencies {
  // Stripe for in-app purchases
  implementation 'com.google.android.gms:play-services-wallet:19.2.0'

  // Firebase
  implementation 'com.google.firebase:firebase-messaging:23.3.1'
  implementation 'com.google.firebase:firebase-analytics:21.5.0'

  // Video playback (supports Widevine)
  implementation 'com.google.android.exoplayer:exoplayer:2.20.1'
  implementation 'com.google.android.exoplayer:extension-mediasession:2.20.1'
}
```

**AndroidManifest.xml:**

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
          xmlns:tools="http://schemas.android.com/tools"
          package="com.example.mentor">

  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
  <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
                   android:maxSdkVersion="32"/>
  <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
                   android:maxSdkVersion="32"/>

  <application
    android:allowBackup="true"
    android:usesCleartextTraffic="false"
    android:theme="light"@style/AppTheme">

  <activity
    android:name=".MainActivity"
    android:exported="true"
    android:launchMode="singleTask"
    android:screenOrientation="portrait">
    <intent-filter>
      <action android:name="android.intent.action.MAIN"/>
      <category android:name="android.intent.category.LAUNCHER"/>
    </intent-filter>
  </activity>

  <!-- Firebase Messaging -->
  <service
    android:name=".services.FirebaseMessagingService"
    android:exported="false">
    <intent-filter>
      <action android:name="com.google.firebase.MESSAGING_EVENT"/>
    </intent-filter>
  </service>

</application>

  </manifest>
```

### 12. Common Rejection Reasons & Prevention

| Reason                       | Prevention                                                  |
| ---------------------------- | ----------------------------------------------------------- |
| App crashes                  | Test on API 24+ devices, run Play Console pre-launch report |
| Battery/memory heavy         | Profile with Android Profiler, optimize                     |
| Violates content policy      | Review policies, declare all content correctly              |
| Missing privacy policy       | Add link to privacy policy in app                           |
| Misleading features          | Only advertise implemented features                         |
| Inappropriate permissions    | Only request needed permissions                             |
| Poor UX/usability            | Test on multiple devices, sizes                             |
| Unacceptable content         | Remove or appropriately rate                                |
| Login required without value | Provide free content access first                           |

## Submission Checklist

- [ ] Google Play Console account created
- [ ] App package name unique and registered
- [ ] Signing key generated and uploaded
- [ ] All metadata complete (title, description, screenshots)
- [ ] Data Safety form completed accurately
- [ ] Privacy Policy live and accessible
- [ ] Age/content rating selected
- [ ] Feature graphics uploaded
- [ ] 2-8 screenshots per required language
- [ ] Internal testing build uploaded and QA passed
- [ ] Closed testing build with beta testers approved
- [ ] No crashes on target API levels (24+)
- [ ] In-App Purchase sandbox tested
- [ ] Widevine DRM verified working
- [ ] All permissions justified
- [ ] Target API level ≥ 34
- [ ] Min API level 24+
- [ ] Pre-launch report reviewed
- [ ] Staged rollout plan prepared
- [ ] Sign-off from legal/compliance

## Implementation Timeline

- **Week 1**: Create Google Play account, package name registration
- **Week 2**: Complete metadata, screenshots, data safety form
- **Week 3**: Signing key setup, internal testing build
- **Week 4**: Closed testing with beta group
- **Week 5**: Widevine DRM verification
- **Week 6**: Final QA, pre-launch report
- **Week 7**: Submit to review, prepare staged rollout

## Success Criteria

- **App approved within 24-48 hours** of submission
- **Zero crashes** reported in internal/closed testing
- **All Review Guidelines** compliant
- **Staged rollout succeeds** with no critical issues
- **Crash rate < 0.1%** and ANR rate < 0.05%
- **Available on Google Play** within 1 week of approval
