# Mobile Payments and Deep Linking

## Description

Implement payment flow that redirects to web-based Stripe checkout (web Mentor URL) using InAppBrowser or external browser, handles success/cancel/return deep links back to the app, and updates enrollment state after successful payment. Ensure proper deep link handling across different scenarios.

## Affected Apps/Packages

- `apps/mobile/src/screens/payments/PaymentCheckoutScreen.tsx` (new)
- `apps/mobile/src/services/paymentService.ts` (new)
- Navigation deep link configuration (updated)

## Requirements

### 1. Payment Checkout Screen

File: `src/screens/payments/PaymentCheckoutScreen.tsx`

Initiates payment flow via web checkout:

```typescript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';

interface PaymentState {
  courseId: string;
  price: number;
  courseName: string;
  userEmail?: string;
}

export function PaymentCheckoutScreen({
  route,
  navigation,
}: PaymentCheckoutScreenProps) {
  const { courseId, price, courseName } = route.params as PaymentState;

  const [isLoading, setIsLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(() => {
    // Check if returning from payment
    return () => {
      // Cleanup
    };
  });

  useEffect(() => {
    generateCheckoutUrl();
  }, [courseId]);

  const generateCheckoutUrl = async () => {
    setIsLoading(true);
    try {
      const url = await paymentService.generateCheckoutUrl({
        courseId,
        returnUrl: `${process.env.EXPO_PUBLIC_API_URL}/mobile/payment-return`,
        cancelUrl: `${process.env.EXPO_PUBLIC_API_URL}/mobile/payment-cancel`,
      });

      setCheckoutUrl(url);
    } catch (err) {
      setError('Failed to prepare checkout. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedToCheckout = async () => {
    if (!checkoutUrl) return;

    setIsLoading(true);
    try {
      // Open checkout in web browser (InAppBrowser on mobile)
      const result = await WebBrowser.openBrowserAsync(checkoutUrl, {
        dismissButtonStyle: 'cancel',
        readerMode: false,
        enableBarCollapsing: true,
        // iOS settings
        controlsColor: colors.primary,
        // Android settings
        toolbarColor: colors.primary,
        secondaryToolbarColor: colors.background,
      });

      if (result.type === 'opened') {
        // Browser opened successfully
        // Wait for deep link callback to handle result
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        // User cancelled payment
        navigation.goBack();
      }
    } catch (err) {
      setError('Failed to open checkout');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Secure Checkout</Text>
        <View style={{ width: 24 }} /> {/* Spacing */}
      </View>

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Preparing checkout...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={40} color={colors.error} />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorDescription}>{error}</Text>
          <Button
            title="Try Again"
            onPress={generateCheckoutUrl}
            style={styles.errorButton}
          />
          <Button
            title="Cancel"
            variant="outline"
            onPress={() => navigation.goBack()}
          />
        </View>
      )}

      {!isLoading && !error && checkoutUrl && (
        <View style={styles.content}>
          {/* Course summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Order Summary</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Course</Text>
              <Text style={styles.summaryValue} numberOfLines={2}>
                {courseName}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Price</Text>
              <Text style={styles.summaryValue}>${price.toFixed(2)}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotal}>Total</Text>
              <Text style={styles.summaryTotalValue}>${price.toFixed(2)}</Text>
            </View>
          </View>

          {/* Payment info */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="lock-closed" size={18} color={colors.primary} />
              <Text style={styles.infoText}>
                Your payment is secure and encrypted
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="card" size={18} color={colors.primary} />
              <Text style={styles.infoText}>
                Powered by Stripe
              </Text>
            </View>
          </View>

          {/* CTA */}
          <Button
            title="Proceed to Payment"
            onPress={handleProceedToCheckout}
            size="lg"
          />

          {/* Trust badges */}
          <View style={styles.trustBadges}>
            <View style={styles.trustBadge}>
              <Ionicons name="shield-checkmark" size={20} color={colors.success} />
              <Text style={styles.trustBadgeText}>Secure</Text>
            </View>
            <View style={styles.trustBadge}>
              <Ionicons name="shield-checkmark" size={20} color={colors.success} />
              <Text style={styles.trustBadgeText}>SSL Encrypted</Text>
            </View>
            <View style={styles.trustBadge}>
              <Ionicons name="shield-checkmark" size={20} color={colors.success} />
              <Text style={styles.trustBadgeText}>PCI Compliant</Text>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  errorDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorButton: {
    width: '100%',
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
  summaryTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  summaryTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  infoCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoText: {
    fontSize: 13,
    color: colors.primary,
    flex: 1,
  },
  trustBadges: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.lg,
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  trustBadge: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  trustBadgeText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
});

export default PaymentCheckoutScreen;
```

### 2. Deep Link Handling for Payment Return

File: `src/services/paymentDeepLinkHandler.ts`

Handle payment success/cancel deep links:

```typescript
interface PaymentReturnParams {
  status: "success" | "cancel";
  sessionId: string;
  courseId: string;
}

export const usePaymentDeepLink = () => {
  const navigation = useNavigation();

  const handlePaymentReturn = async (params: PaymentReturnParams) => {
    const { status, sessionId, courseId } = params;

    if (status === "success") {
      try {
        // Verify payment with backend
        const result = await paymentService.verifyPayment(sessionId);

        if (result.success) {
          // Show success confirmation
          Alert.alert(
            "Payment Successful",
            "Your enrollment is now active. You can start learning!",
            [
              {
                text: "Start Learning",
                onPress: () => {
                  // Navigate to course
                  navigation.navigate("home", {
                    screen: "CourseDetail",
                    params: { courseId },
                  });
                },
              },
            ]
          );
        } else {
          // Payment verified but enrollment failed
          Alert.alert(
            "Payment Received",
            "Your payment was received but enrollment is still processing. Check My Courses shortly."
          );
        }
      } catch (error) {
        // Payment verification failed - may still be processing
        Alert.alert(
          "Processing",
          "Your payment is being processed. Check back shortly."
        );
      }
    } else if (status === "cancel") {
      // User cancelled payment
      navigation.goBack();
    }
  };

  return { handlePaymentReturn };
};
```

### 3. Deep Link Configuration

File: `src/navigation/linking.ts` (updated)

```typescript
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    "mentor://",
    "mentor://",
    "https://example.com",
    "https://mentor.example.com",
  ],
  config: {
    screens: {
      // ... existing screens ...

      // Payment deep links
      PaymentSuccess: "payments/success/:sessionId",
      PaymentCancel: "payments/cancel/:sessionId",

      // Email verification
      EmailVerify: "auth/verify/:email/:code",

      // Course deep links
      CourseDetail: "courses/:courseId",
      LessonPlayer: "lessons/:lessonId",

      // Community deep links
      PostDetail: "community/posts/:postId",
      UserProfile: "users/:userId",

      NotFound: "*",
    },
  },
};
```

### 4. Payment Service

File: `packages/shared/src/services/paymentService.ts`

```typescript
export class PaymentService {
  private api = axios.create({
    baseURL: process.env.EXPO_PUBLIC_API_URL,
  });

  async generateCheckoutUrl(data: {
    courseId: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<string> {
    const { data: result } = await this.api.post("/payments/checkout-url", {
      courseId: data.courseId,
      returnUrl: data.returnUrl,
      cancelUrl: data.cancelUrl,
    });
    return result.checkoutUrl;
  }

  async verifyPayment(sessionId: string): Promise<{
    success: boolean;
    enrollmentId?: string;
  }> {
    const { data } = await this.api.post("/payments/verify", { sessionId });
    return data;
  }

  async getPaymentHistory(): Promise<
    Array<{
      id: string;
      courseId: string;
      amount: number;
      status: string;
      date: string;
    }>
  > {
    const { data } = await this.api.get("/payments/history");
    return data.payments;
  }

  async downloadInvoice(paymentId: string): Promise<string> {
    const { data } = await this.api.get(`/payments/${paymentId}/invoice`, {
      responseType: "blob",
    });
    return URL.createObjectURL(data);
  }
}

export const paymentService = new PaymentService();
```

### 5. Root Navigator Deep Link Handling

File: `src/navigation/RootNavigator.tsx` (updated)

```typescript
import { useDeepLinkHandler } from '@hooks/useDeepLinkHandler';

export function RootNavigator() {
  const { isLoading, userToken } = useAuth();
  const { handleDeepLink } = useDeepLinkHandler();

  return (
    <NavigationContainer
      linking={linking}
      fallback={<SplashScreen />}
      onReady={() => {
        // Handle deep link on app launch
        handleDeepLink();
      }}
    >
      {/* Navigation structure */}
    </NavigationContainer>
  );
}
```

### 6. Deep Link Handler Hook

File: `src/hooks/useDeepLinkHandler.ts`

```typescript
export const useDeepLinkHandler = () => {
  const navigation = useNavigation();

  const handleDeepLink = useCallback(async () => {
    try {
      // Get initial URL on app launch
      const url = await Linking.getInitialURL();

      if (url != null) {
        parseAndNavigate(url);
      }
    } catch (error) {
      console.error("Deep link error", error);
    }
  }, [navigation]);

  useEffect(() => {
    // Handle deep link when app is running
    const subscription = Linking.addEventListener("url", (event) => {
      parseAndNavigate(event.url);
    });

    return () => subscription.remove();
  }, []);

  const parseAndNavigate = (url: string) => {
    const route = url.split("://")[1];

    if (route.startsWith("payments/success/")) {
      const sessionId = route.split("/").pop();
      const courseId = new URL(url).searchParams.get("courseId");

      navigation.navigate("PaymentSuccess", {
        sessionId,
        courseId,
      });
    } else if (route.startsWith("payments/cancel/")) {
      const sessionId = route.split("/").pop();
      navigation.navigate("PaymentCancel", {
        sessionId,
      });
    }
    // ... handle other routes
  };

  return { handleDeepLink };
};
```

## Acceptance Criteria

- [ ] Payment checkout screen displays course summary
- [ ] Price calculated correctly
- [ ] Opens web browser for Stripe checkout
- [ ] Success deep link returns to app and shows confirmation
- [ ] Cancel deep link returns to app
- [ ] Enrollment created after successful payment
- [ ] User redirected to course after payment
- [ ] Payment history accessible in profile
- [ ] Invoice download available
- [ ] Error handling shows user-friendly messages
- [ ] Retry mechanism for failed payments
- [ ] Deep link works from email/notifications
- [ ] Deep link works on both iOS and Android
- [ ] No sensitive data in URLs
- [ ] SSL certificate pinning (security)
- [ ] No console errors

## Dependencies

- expo-web-browser (InAppBrowser)
- axios (HTTP client)
- @react-navigation/native
- react-native (Linking)

## Technical Notes

### Stripe Integration

- Use Stripe Checkout (hosted solution)
- Return URLs: `https://api.example.com/mobile/payment-return`
- Session-based tracking
- Backend verifies payment before enrollment

### Deep Link Structure

```
mentor://payments/success/[SESSION_ID]?courseId=[COURSE_ID]
mentor://payments/cancel/[SESSION_ID]
```

### Security

- HTTPS-only URLs
- Certificate pinning for API
- No payment data stored locally
- Server-side payment verification only

### Error Handling

- Network errors: show retry button
- Invalid session: show error message
- Timeout: wait 30s then poll

### Testing

```bash
# iOS
xcrun simctl openurl booted "mentor://payments/success/sess_123?courseId=abc"

# Android
adb shell am start -W -a android.intent.action.VIEW -d "mentor://payments/success/sess_123?courseId=abc" com.example.mentor
```
