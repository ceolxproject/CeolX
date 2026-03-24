# Apple App Store Submission (iOS)

## Description

Complete iOS app submission process for Mentor Learner mobile app (React Native Expo). Covers App Store Connect setup, privacy nutrition labels, app preview screenshots, store listing content, Apple Review Guidelines compliance (particularly §1.2 User-Generated Content, §5.1.1 account deletion, §3.1.1 In-App Purchase restrictions), FairPlay DRM verification, and TestFlight beta testing coordination. Ensures app passes review and launches successfully on iOS.

## Affected Apps/Packages

- **Learner Mobile** (React Native Expo)
- **Backend API** (Hono on Vercel)
- **Mux Video Streaming** (FairPlay DRM)
- **Stripe Payments** (In-App Purchase support)
- **Firebase** (push notifications, if applicable)

## Requirements

### App Store Connect Setup

- Apple Developer Program membership ($99/year)
- Bundle ID: `com.example.mentor` (or similar)
- Team ID and provisioning profiles
- Certificates for signing (Distribution certificate)
- App IDs configured with required capabilities

### App Metadata & Content

- App name: "Mentor - Learn Makeup"
- Subtitle: "Master cosmetics with expert instructors"
- Description (4,000 character limit)
- Keywords (up to 100 characters)
- Support/Privacy policy URLs
- App preview video (up to 30 seconds, optional)
- Screenshots: 6 maximum per language (iPhone and iPad)
- App icon (1024x1024 without rounded corners)
- Homepage URL

### Privacy & Legal

- Privacy Policy (required, accessible from app)
- Terms of Service (required in app)
- Data collection questionnaire completion
- Privacy Nutrition Label accurate and complete
- Compliance with GDPR/CCPA requirements

### Review Guidelines Compliance

- **§1.2 User-Generated Content**: Community features properly moderated
- **§5.1.1 Account Deletion**: Users can delete accounts within app
- **§3.1.1 In-App Purchase**: Proper IAP implementation for subscriptions
- **§4.3 Hardware Compatibility**: Device compatibility clearly stated
- **§2.1 App Accuracy**: Feature descriptions match actual functionality
- **§5.3 Subscriptions**: Clear pricing, cancellation options visible
- **§1.4 Physical Violence**: No graphic violence in content

### DRM & Content Protection

- FairPlay DRM configured for all video content
- Widevine DRM for Android compatibility (separate submission)
- License server properly configured
- Content not downloadable without proper licensing

### Performance & Stability

- No crashes on tested devices (iPhone 13, 14, 15 minimum)
- App starts within 20 seconds
- Responsive to user interactions
- Handles network failures gracefully

## Acceptance Criteria

- [ ] App Store Connect account created and configured
- [ ] Bundle ID registered and provisioning profiles set up
- [ ] All required metadata complete and accurate
- [ ] Privacy Nutrition Label accurately reflects data usage
- [ ] Account deletion functionality implemented and testable
- [ ] In-App Purchase properly configured for subscriptions
- [ ] FairPlay DRM configured and verified working
- [ ] All screenshots and app preview video uploaded
- [ ] TestFlight build passes internal QA
- [ ] Beta review completed with external testers
- [ ] No crashes reported in TestFlight
- [ ] All App Review Guidelines checklist items verified
- [ ] Expedited review request submitted (if needed)
- [ ] First submission successfully passes App Review

## Dependencies

### Tools & Services

- Apple Developer account
- Xcode 15+ (for building and signing)
- App Store Connect access
- TestFlight for beta testing
- Apple Certificates and Provisioning (managed via App Store Connect)

### External Services

- Mux for FairPlay-protected video
- Stripe for payment processing
- Firebase for notifications (if used)

### Development Environment

- React Native Expo
- EAS Build (Expo Application Services)
- CocoaPods for iOS dependencies
- iOS 14+ support

## Technical Notes

### 1. App Store Connect Setup

**Create App Store Connect Account:**

1. Go to appstoreconnect.apple.com
2. Sign in with Apple Developer account
3. Accept agreements and terms
4. Set up payment, tax, and banking information

**Register Bundle ID:**

```
Bundle ID: com.example.mentor
Team Identifier: ABC1234DEF
Capabilities:
  - Push Notifications
  - In-App Purchase
  - Network Extension
```

**Create App Record:**

1. App Store Connect → My Apps → Create App
2. Platform: iOS
3. App name: Mentor - Learn Makeup
4. Bundle ID: com.example.mentor
5. SKU: MENTOR_IOS_2026 (unique identifier)

### 2. Privacy Nutrition Label

**Complete Data Privacy Questionnaire:**

```
Data Collection: Does your app collect or request user data?
Answer: Yes

Link to Privacy Policy: https://app.mentor.example.com/privacy

Health & Fitness Data
 - Collected: No

Financial Information
 - Payment Information: Yes (Stripe payments)
 - Collected for: Subscription purchases
 - Shared with Third Parties: Yes (Stripe)
 - Tracked for Personalization: No

Location Data
 - Precise Location: No
 - Coarse Location: No

Sensitive Information
 - User ID: Yes (user account ID)
 - Collected for: Account management
 - Shared: No
 - Tracked: No

Contact Information
 - Email Address: Yes
 - Collected for: Account management, notifications
 - Shared: No

Identifiers & Other Data
 - User ID: Yes
 - Device ID: Yes
 - Cookie or Similar Technology: Yes
 - Other: Video playback analytics

Tracking Data
 - Tracking for Third-Party Advertising: No
 - Tracking for Third-Party Marketing: No

Data Security
 - Data Encrypted in Transit: Yes
 - Data Encrypted at Rest: Partial (sensitive data only)
 - Data Deletion: User can request deletion
 - Secure HTTPS: Yes

User Controls
 - Delete Account: Yes
 - Opt-out of Tracking: Yes (analytics)
 - Modify Personal Data: Yes
```

### 3. App Preview Screenshots

**Screenshot Specifications:**

- Format: PNG or JPEG
- Size: 1242x2208 pixels (iPhone display size)
- Orientation: Portrait
- Safe zones: Avoid top/bottom 10% (status bar, home indicator)
- Maximum 6 screenshots per language
- Optional: Add captions on screenshots

**Recommended Screenshots:**

1. **Sign In** - Authentication flow
2. **Course Discovery** - Browsing courses, search
3. **Video Playback** - Learning experience
4. **Progress & Certificates** - Achievements
5. **Mentor Profile** - Instructor details
6. **Community** - Engagement features

### 4. App Description & Metadata

**App Description (4,000 chars):**

```
Master the art of makeup with Mentor, the most comprehensive cosmetics learning platform.

Learn from industry experts and discover your favorite beauty techniques with thousands of detailed video courses covering:
• Foundation & Base Makeup
• Eye Shadow & Eyebrow Techniques
• Contouring & Sculpting
• Special Effects & Theatrical Makeup
• Product Reviews & Recommendations

Features:
✓ Learn at your own pace - start any course, watch in any order
✓ Personalized learning paths based on your interests and skill level
✓ Download courses for offline learning
✓ Get certified - complete courses to earn digital certificates
✓ Interactive community - ask questions, share tips, connect with mentors
✓ Lifetime access to purchased courses
✓ New courses added weekly

Whether you're a makeup enthusiast, professional artist, or aspiring educator, Mentor provides the tools and knowledge you need to master cosmetics.

Free courses included! Subscribe for unlimited access to premium content.
```

**Keywords (100 chars max):**

```
makeup, beauty, cosmetics, learning, tutorial, course, education, makeup artist
```

**Promotional Text:**

```
New courses this week: Contouring Mastery, Special Effects Basics. Subscribe now!
```

### 5. App Store Listing

**Subtitle:**

```
Master cosmetics with expert instructors
```

**Support URL:**

```
https://help.mentor.example.com/
```

**Privacy Policy URL:**

```
https://app.mentor.example.com/privacy
```

**Marketing URL (optional):**

```
https://mentor.example.com
```

**Demo Account (for review team):**

```
Email: reviewer@example.com
Password: ReviewerDemoPass123!
(Account pre-populated with courses & enrollments for testing)
```

### 6. App Review Guidelines Checklist

#### §1.2 User-Generated Content (Community)

**Checklist:**

- [ ] Community content reviewed before display (or post-moderation plan)
- [ ] User can report inappropriate content
- [ ] Moderation tools available to mentors/admins
- [ ] Offensive content removal process documented
- [ ] Community Guidelines clearly stated in app

**Implementation:**

```typescript
// Report content flow
app.post("/api/community/posts/:id/report", async (c) => {
  const { reason, description } = await c.req.json();

  if (!["offensive", "spam", "harassment", "other"].includes(reason)) {
    return c.json({ error: "Invalid reason" }, 400);
  }

  // Create report
  await db.insert(reports).values({
    postId: c.req.param("id"),
    userId: c.get("user").id,
    reason,
    description,
    status: "pending",
  });

  return c.json({ success: true });
});

// Admin review
app.get("/api/admin/reports", requireRole("admin"), async (c) => {
  const reports = await db.query.reports.findMany({
    where: eq(reports.status, "pending"),
    orderBy: desc(reports.createdAt),
  });

  return c.json(reports);
});

// Moderation action
app.post("/api/admin/reports/:id/action", requireRole("admin"), async (c) => {
  const { action } = await c.req.json(); // 'approve', 'remove', 'suspend'

  const report = await db.query.reports.findFirst({
    where: eq(reports.id, c.req.param("id")),
  });

  if (action === "remove") {
    await db.delete(posts).where(eq(posts.id, report.postId));
  }

  if (action === "suspend") {
    // Suspend user account
  }

  await db
    .update(reports)
    .set({ status: action })
    .where(eq(reports.id, c.req.param("id")));
  return c.json({ success: true });
});
```

#### §5.1.1 Account Deletion

**Checklist:**

- [ ] Users can delete account within app
- [ ] Deletion is immediate, not deferred
- [ ] User data removed from database
- [ ] Confirmation screen shows what will be deleted
- [ ] No recovery of deleted data possible

**Implementation:**

```typescript
// Delete account endpoint
app.post("/api/auth/account/delete", requireAuth, async (c) => {
  const userId = c.get("user").id;

  // Show what will be deleted
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  return c.json({
    message: "Are you sure you want to delete your account?",
    warning:
      "This action cannot be undone. All your courses, certificates, and data will be permanently deleted.",
    data: {
      email: user.email,
      enrollments: user._count?.enrollments || 0,
      certificates: user._count?.certificates || 0,
    },
  });
});

// Confirm deletion
app.post("/api/auth/account/delete/confirm", requireAuth, async (c) => {
  const userId = c.get("user").id;
  const { confirmEmail } = await c.req.json();

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (confirmEmail !== user.email) {
    return c.json({ error: "Email does not match" }, 400);
  }

  // Delete all related data
  await db.delete(enrollments).where(eq(enrollments.userId, userId));
  await db.delete(certificates).where(eq(certificates.userId, userId));
  await db.delete(communityPosts).where(eq(communityPosts.userId, userId));
  await db.delete(userSessions).where(eq(userSessions.userId, userId));
  await db.delete(users).where(eq(users.id, userId));

  // Invalidate session
  c.header("Set-Cookie", "session=; Max-Age=0; Path=/;");

  return c.json({ success: true, message: "Account deleted permanently" });
});
```

**UI Implementation:**

```typescript
export default function DeleteAccountScreen() {
  const [step, setStep] = useState<'confirm' | 'enter-email'>('confirm');
  const [email, setEmail] = useState('');

  const handleDeleteClick = async () => {
    try {
      await api.post('/auth/account/delete');
      setStep('enter-email');
    } catch (error) {
      Alert.alert('Error', 'Failed to initiate account deletion');
    }
  };

  const handleConfirmDelete = async () => {
    try {
      await api.post('/auth/account/delete/confirm', { confirmEmail: email });
      // Clear app state
      await clearAppData();
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <Screen>
      <Text style={styles.warning}>Deleting your account is permanent</Text>
      {step === 'confirm' && (
        <Button onPress={handleDeleteClick} title="Delete Account" color="red" />
      )}
      {step === 'enter-email' && (
        <>
          <TextInput
            placeholder="Enter your email to confirm"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />
          <Button onPress={handleConfirmDelete} title="Permanently Delete" color="red" />
        </>
      )}
    </Screen>
  );
}
```

#### §3.1.1 In-App Purchase Implementation

**Checklist:**

- [ ] Use Apple StoreKit 2 for purchases
- [ ] Display prices including local currency
- [ ] Restore purchases available
- [ ] Subscription cancellation within app
- [ ] Show subscription expiry date

**Implementation:**

```typescript
// Using React Native IAP
import * as RNIap from "react-native-iap";

const skus = {
  ios: ["com.example.mentor.pro_monthly", "com.example.mentor.premium_monthly"],
};

export async function initializeStoreKit() {
  try {
    // Connect to app store
    const result = await RNIap.initConnection();
    console.log("StoreKit connected:", result);

    // Get available subscriptions
    const products = await RNIap.getProducts({
      skus: skus.ios,
    });

    return products;
  } catch (error) {
    console.error("Failed to initialize StoreKit:", error);
  }
}

export async function purchaseSubscription(productId: string) {
  try {
    const purchase = await RNIap.requestSubscription({
      sku: productId,
      andDangerouslyFinishTransactionAutomaticallyIOS: false,
    });

    // Validate receipt with backend
    const validated = await validateReceiptWithBackend(
      purchase.transactionReceipt,
    );

    if (validated) {
      // Acknowledge purchase
      await RNIap.finishTransaction({
        purchase,
        isConsumable: false,
      });

      return true;
    }
  } catch (error) {
    console.error("Purchase failed:", error);
  }
}

// Restore purchases
export async function restorePurchases() {
  try {
    const purchases = await RNIap.getPurchaseHistory();

    for (const purchase of purchases) {
      // Sync with backend
      await validateReceiptWithBackend(purchase.transactionReceipt);
    }

    return purchases;
  } catch (error) {
    console.error("Restore failed:", error);
  }
}

// Show subscription status
export async function getSubscriptionStatus() {
  const purchases = await RNIap.getAvailablePurchases();

  for (const purchase of purchases) {
    const expiryDate = new Date(
      parseInt(purchase.transactionDate) + purchase.originalTransactionDateIOS,
    );

    return {
      productId: purchase.productId,
      expiryDate: expiryDate.toISOString(),
      isActive: expiryDate > new Date(),
    };
  }
}
```

### 7. FairPlay DRM Configuration

**Verify FairPlay is Working:**

```typescript
// Test FairPlay playback
test("video playback uses FairPlay DRM", async () => {
  const testPlaybackId = "YOUR_MUX_PLAYBACK_ID";

  // Get master playlist
  const response = await fetch(
    `https://image.mux.com/v1/${testPlaybackId}/master.m3u8`,
  );
  const m3u8 = await response.text();

  // Verify FairPlay key format
  const hasFairPlayKey = m3u8.includes(
    'KEYFORMAT="urn:uuid:ebd08221-62f7-4c4f-95f1-7e6434fb0bb9"',
  );
  const hasEncryption = m3u8.includes("#EXT-X-KEY");

  expect(hasFairPlayKey).toBe(true);
  expect(hasEncryption).toBe(true);
});
```

**Mux FairPlay Configuration (in dashboard):**

1. Create Playback ID with FairPlay DRM policy
2. Whitelist app's bundle ID (`com.example.mentor`)
3. Set expiration policy
4. Test with iOS device

### 8. TestFlight Beta Testing

**Prepare TestFlight Build:**

```bash
# Build with EAS
eas build --platform ios

# Or build locally
xcodebuild -scheme Mentor -archivePath build/Mentor.xcarchive archive
xcodebuild -exportArchive -archivePath build/Mentor.xcarchive -exportPath build/Export -exportOptionsPlist ExportOptions.plist
```

**Upload to TestFlight:**

1. App Store Connect → My Apps → Mentor
2. TestFlight tab
3. Click "Build" section
4. Upload built IPA file

**Add Test Testers:**

```
Internal Testers: (Mentor team members)
- First_Name Last_Name (email@example.com)

External Beta Testers: (Up to 10,000)
- Send public link to select users
```

**TestFlight Checklist:**

- [ ] Build uploads successfully
- [ ] App installs without errors
- [ ] All features testable
- [ ] No crashes during 24-hour beta period
- [ ] At least 24 hours processing before sending to App Review

### 9. Build & Signing Configuration

**EAS Build Configuration (eas.json):**

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "production": {
      "ios": {
        "image": "latest",
        "resourceClass": "default",
        "buildType": "app-store"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "1234567890",
        "appleId": "developer@example.com",
        "appleIdPassword": "@keychain:APPLE_ID_PASSWORD",
        "teamId": "ABC1234DEF"
      }
    }
  }
}
```

**app.json Configuration:**

```json
{
  "expo": {
    "name": "Mentor",
    "slug": "mentor",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png"
    },
    "ios": {
      "supportsTabletMode": true,
      "bundleIdentifier": "com.example.mentor",
      "buildNumber": "1",
      "infoPlist": {
        "NSCameraUsageDescription": "We need camera access for profile pictures (optional)",
        "NSMicrophoneUsageDescription": "We need microphone access for support videos (optional)",
        "NSLocationWhenInUseUsageDescription": "We don't use your location"
      }
    }
  }
}
```

### 10. Common Rejection Reasons & Prevention

| Reason                                | Prevention                                 |
| ------------------------------------- | ------------------------------------------ |
| Crash on startup                      | Test on real devices, TestFlight 24h       |
| Incomplete features                   | Remove from description if not implemented |
| Misleading icon                       | Icon must clearly represent app            |
| Hard to understand                    | Clear onboarding, intuitive UX             |
| No account deletion                   | Implement account deletion endpoint        |
| Excessive ads                         | No ads in learning content                 |
| Sensitive content not declared        | Accurate content rating                    |
| Performance issues                    | Load time < 5s, responsive UI              |
| Requires authentication without value | Free content or trial first                |

## Submission Checklist

- [ ] All metadata complete and accurate
- [ ] App icon (1024x1024)
- [ ] 6 screenshots per language
- [ ] App preview video (optional but recommended)
- [ ] Privacy policy live and accessible
- [ ] Terms of service in app or linked
- [ ] Age rating completed
- [ ] Content restrictions verified
- [ ] Bundle ID matches provisioning
- [ ] Distribution certificate current
- [ ] TestFlight build passes 24 hours without crash
- [ ] Demo account created for reviewers
- [ ] All Review Guidelines checklist items completed
- [ ] FairPlay DRM verified working
- [ ] Account deletion tested and working
- [ ] In-App Purchase tested with sandbox account
- [ ] Sign-off from legal/compliance

## Implementation Timeline

- **Week 1**: Create App Store Connect account, bundle ID registration
- **Week 2**: Complete app metadata and screenshots
- **Week 3**: FairPlay DRM verification, IAP testing
- **Week 4**: TestFlight build, internal QA
- **Week 5**: Beta review with external testers
- **Week 6**: Account deletion & compliance verification
- **Week 7**: Submit to App Review

## Success Criteria

- **First submission passes App Review** without rejections
- **App available on App Store** within 24-48 hours of approval
- **TestFlight beta** has zero crashes
- **All Review Guidelines** sections compliant
- **Demo account** provides full feature access for reviewers
