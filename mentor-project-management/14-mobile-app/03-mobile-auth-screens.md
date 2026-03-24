# Mobile Auth Screens

## Description

Implement comprehensive authentication screens for sign in, sign up, password recovery, email verification, social login (Google and Apple), and account lockout handling. These screens provide the entry point to the app and handle all authentication flows while maintaining security and accessibility best practices.

## Affected Apps/Packages

- `apps/mobile/src/screens/auth/` (new)
- `apps/mobile/src/components/auth/` (new)
- `apps/mobile/src/hooks/useAuth.ts` (updated)
- `packages/shared/src/services/authService.ts`
- `packages/types/src/auth.ts`

## Requirements

### 1. Sign In Screen

File: `src/screens/auth/SignInScreen.tsx`

**UI Elements:**

- Mentor logo/branding at top
- Email/phone input field (with validation)
- Password input field (with visibility toggle)
- "Remember me" checkbox (optional for mobile)
- "Forgot Password?" link
- Sign In button (loading state)
- OR divider
- Google Sign In button
- Apple Sign In button (iOS only)
- Sign Up link at bottom

**Validation:**

- Email: valid format
- Password: min 8 chars
- Show inline error messages
- Prevent submission if invalid

**State Management:**

```typescript
interface SignInState {
  email: string;
  password: string;
  isLoading: boolean;
  error: string | null;
  rememberMe: boolean;
}
```

**Functionality:**

```typescript
export function SignInScreen({ navigation }: SignInScreenProps) {
  const [state, dispatch] = useReducer(signInReducer, initialState);
  const { signIn } = useAuth();

  const handleSignIn = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const response = await authService.signIn({
        email: state.email,
        password: state.password,
      });

      if (state.rememberMe) {
        await secureStore.setItem('rememberEmail', state.email);
      }

      await signIn(response.token);
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  useEffect(() => {
    // Load remembered email on mount
    secureStore.getItem('rememberEmail').then((email) => {
      if (email) dispatch({ type: 'SET_EMAIL', payload: email });
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <MentorLogo style={styles.logo} />
        <Text style={styles.title}>Sign In</Text>

        <TextInput
          placeholder="Email or Phone"
          value={state.email}
          onChangeText={(email) => dispatch({ type: 'SET_EMAIL', payload: email })}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
        />

        <PasswordInput
          placeholder="Password"
          value={state.password}
          onChangeText={(password) => dispatch({ type: 'SET_PASSWORD', payload: password })}
          style={styles.input}
        />

        <View style={styles.options}>
          <Checkbox
            value={state.rememberMe}
            onValueChange={(rememberMe) =>
              dispatch({ type: 'SET_REMEMBER_ME', payload: rememberMe })
            }
            label="Remember me"
          />
          <Pressable onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.link}>Forgot Password?</Text>
          </Pressable>
        </View>

        {state.error && <ErrorBanner message={state.error} />}

        <Button
          title="Sign In"
          onPress={handleSignIn}
          loading={state.isLoading}
          style={styles.button}
        />

        <Divider text="OR" />

        <SocialAuthButtons onGooglePress={handleGoogleSignIn} onApplePress={handleAppleSignIn} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Pressable onPress={() => navigation.navigate('SignUp')}>
            <Text style={styles.footerLink}>Sign Up</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

**Error Handling:**

- Invalid credentials → "Incorrect email or password"
- Account not found → "No account found with this email"
- Account locked → Navigate to AccountLockout screen
- Network error → Retry button
- Rate limited → "Too many attempts. Try again later"

### 2. Sign Up Screen

File: `src/screens/auth/SignUpScreen.tsx`

**UI Elements:**

- Mentor branding
- Full name input
- Email input
- Password input with strength indicator
- Confirm password input
- Terms of Service checkbox (required)
- Privacy Policy link
- Sign Up button
- Already have account? Sign In link

**Password Strength Indicator:**

```typescript
interface PasswordStrength {
  score: 0 | 1 | 2 | 3; // weak, fair, good, strong
  label: string;
  color: string;
}

function getPasswordStrength(password: string): PasswordStrength {
  if (password.length < 8)
    return { score: 0, label: "Too weak", color: colors.error };
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password))
    return { score: 1, label: "Weak", color: colors.warning };
  if (!/[^a-zA-Z0-9]/.test(password))
    return { score: 2, label: "Fair", color: colors.info };
  return { score: 3, label: "Strong", color: colors.success };
}
```

**Validation Rules:**

- Full name: min 2 chars, max 100 chars
- Email: valid format, unique check (async)
- Password: min 8 chars, must have uppercase, number, special char
- Confirm password: exact match
- Terms accepted: required
- Show validation errors inline

**Unique Email Check:**

```typescript
const checkEmailAvailable = async (email: string) => {
  const isAvailable = await authService.checkEmail(email);
  if (!isAvailable) {
    dispatch({ type: "SET_EMAIL_ERROR", payload: "Email already in use" });
  }
};

// Debounced call on email change (500ms)
```

**Functionality:**

```typescript
const handleSignUp = async () => {
  if (!state.termsAccepted) {
    showAlert("Please accept Terms of Service");
    return;
  }

  dispatch({ type: "SET_LOADING", payload: true });
  try {
    const response = await authService.signUp({
      fullName: state.fullName,
      email: state.email,
      password: state.password,
    });

    // Navigate to email verification
    navigation.navigate("EmailVerification", { email: state.email });
  } catch (error) {
    dispatch({ type: "SET_ERROR", payload: error.message });
  }
};
```

### 3. Email Verification Screen

File: `src/screens/auth/EmailVerificationScreen.tsx`

**UI Elements:**

- Illustration (envelope/checkmark)
- "Verify Your Email" heading
- "We sent a code to [email]" message
- 6-digit OTP input (auto-focus)
- Resend code link (with countdown timer)
- Verify button
- Change email link

**OTP Input Component:**

```typescript
interface OTPInputProps {
  length?: number;
  onComplete: (code: string) => void;
}

function OTPInput({ length = 6, onComplete }: OTPInputProps) {
  const [codes, setCodes] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<TextInput[]>([]);

  const handleChange = (index: number, value: string) => {
    const newCodes = [...codes];
    newCodes[index] = value;
    setCodes(newCodes);

    if (value && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newCodes.every((code) => code)) {
      onComplete(newCodes.join(''));
    }
  };

  return (
    <View style={styles.container}>
      {Array.from({ length }).map((_, i) => (
        <TextInput
          key={i}
          ref={(ref) => (inputRefs.current[i] = ref!)}
          style={styles.input}
          maxLength={1}
          keyboardType="number-pad"
          value={codes[i]}
          onChangeText={(value) => handleChange(i, value)}
        />
      ))}
    </View>
  );
}
```

**Resend Logic:**

```typescript
const [resendCountdown, setResendCountdown] = useState(0);

useEffect(() => {
  if (resendCountdown > 0) {
    const timer = setTimeout(
      () => setResendCountdown(resendCountdown - 1),
      1000,
    );
    return () => clearTimeout(timer);
  }
}, [resendCountdown]);

const handleResendCode = async () => {
  try {
    await authService.resendOTP(email);
    setResendCountdown(60);
  } catch (error) {
    showError("Failed to resend code");
  }
};
```

**Verification Flow:**

```typescript
const handleVerifyCode = async (code: string) => {
  setIsLoading(true);
  try {
    const response = await authService.verifyOTP({
      email,
      code,
    });

    await signIn(response.token);
    // Navigate to onboarding or main app
  } catch (error) {
    setError("Invalid code. Try again.");
  }
};
```

### 4. Forgot Password Screen

File: `src/screens/auth/ForgotPasswordScreen.tsx`

**Step 1: Email Input**

- Email input
- "Next" button
- "Back to Sign In" link

**Step 2: OTP Verification**

- 6-digit OTP input (same as EmailVerificationScreen)
- Resend option with countdown
- "Next" button

**Step 3: Password Reset**

- New password input
- Confirm password input
- Password strength indicator
- "Reset Password" button
- Success message with auto-redirect to Sign In

**State Machine:**

```typescript
type ForgotPasswordStep = "email" | "otp" | "reset" | "success";

const [step, setStep] = useState<ForgotPasswordStep>("email");
const [email, setEmail] = useState("");
const [otp, setOtp] = useState("");
const [newPassword, setNewPassword] = useState("");
```

**Complete Flow:**

```typescript
const handleEmailSubmit = async () => {
  setIsLoading(true);
  try {
    await authService.sendPasswordResetOTP(email);
    setStep("otp");
  } catch (error) {
    showError(error.message);
  }
};

const handleOTPSubmit = async (otpCode: string) => {
  setOtp(otpCode);
  setStep("reset");
};

const handlePasswordReset = async () => {
  setIsLoading(true);
  try {
    await authService.resetPassword({
      email,
      otp,
      newPassword,
    });
    setStep("success");
    setTimeout(() => navigation.navigate("SignIn"), 2000);
  } catch (error) {
    showError(error.message);
  }
};
```

### 5. Social Login Implementation

File: `src/components/auth/SocialAuthButtons.tsx`

**Google Sign In** (expo-auth-session):

```typescript
import { useAuthRequest, promptAsync } from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";

const [request, response, promptAsync] = useAuthRequest(
  {
    clientId: process.env.EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
    redirectUrl: AuthSession.getRedirectUrl(),
    scopes: ["profile", "email"],
  },
  Google.discovery,
);

const handleGoogleSignIn = async () => {
  const result = await promptAsync();

  if (result?.type === "success") {
    const { access_token } = result.params;

    // Exchange for backend token
    const response = await authService.signInWithGoogle(access_token);
    await signIn(response.token);
  }
};
```

**Apple Sign In** (expo-apple-authentication - iOS only):

```typescript
import * as AppleAuthentication from "expo-apple-authentication";

const handleAppleSignIn = async () => {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    // credential.identityToken contains JWT for backend verification
    const response = await authService.signInWithApple(
      credential.identityToken,
    );
    await signIn(response.token);
  } catch (error) {
    if (error.code === "ERR_CANCELED") {
      // User cancelled
    } else {
      showError("Apple Sign In failed");
    }
  }
};
```

**SocialAuthButtons Component:**

```typescript
interface SocialAuthButtonsProps {
  onGooglePress: () => void;
  onApplePress: () => void;
  loading?: boolean;
}

export function SocialAuthButtons({
  onGooglePress,
  onApplePress,
  loading,
}: SocialAuthButtonsProps) {
  const { isAvailable: isAppleAvailable } = useAppleAuthentication();

  return (
    <View style={styles.container}>
      <SocialButton
        icon="logo-google"
        label="Google"
        onPress={onGooglePress}
        loading={loading}
      />
      {isAppleAvailable && (
        <SocialButton
          icon="logo-apple"
          label="Apple"
          onPress={onApplePress}
          loading={loading}
        />
      )}
    </View>
  );
}
```

### 6. Account Lockout Screen

File: `src/screens/auth/AccountLockoutScreen.tsx`

Displayed when:

- Too many failed sign-in attempts (>5)
- Account disabled by admin
- Account flagged for suspicious activity

**UI Elements:**

- Lock icon
- "Account Locked" heading
- Reason message (varies by lockout type)
- Lockout duration timer (if applicable)
- "Contact Support" button
- "Try Again" button (if time-based lockout)

**Lockout Reasons:**

```typescript
enum LockoutReason {
  TOO_MANY_ATTEMPTS = "too_many_attempts",
  ADMIN_DISABLED = "admin_disabled",
  SUSPICIOUS_ACTIVITY = "suspicious_activity",
  PAYMENT_FAILED = "payment_failed", // If using subscriptions
}

const LOCKOUT_MESSAGES = {
  [LockoutReason.TOO_MANY_ATTEMPTS]:
    "Too many failed login attempts. Please try again after 15 minutes.",
  [LockoutReason.ADMIN_DISABLED]:
    "Your account has been disabled. Please contact support.",
  [LockoutReason.SUSPICIOUS_ACTIVITY]:
    "Your account is temporarily locked for security. Please verify your identity.",
};
```

**Timer Logic:**

```typescript
const [remainingTime, setRemainingTime] = useState<number | null>(null);

useEffect(() => {
  const timer = setInterval(() => {
    // Calculate remaining lockout time from backend response
    const now = new Date();
    const lockoutEnd = new Date(lockoutEndTime);
    const remaining = Math.max(
      0,
      Math.floor((lockoutEnd.getTime() - now.getTime()) / 1000),
    );

    setRemainingTime(remaining);

    if (remaining === 0) {
      // Show retry button
      navigation.navigate("SignIn");
    }
  }, 1000);

  return () => clearInterval(timer);
}, []);
```

**Support Contact:**

```typescript
const handleContactSupport = () => {
  Linking.openURL("mailto:support@example.com");
};
```

### 7. Auth Service Integration

File: `packages/shared/src/services/authService.ts`

```typescript
interface AuthService {
  signIn(credentials: SignInRequest): Promise<AuthResponse>;
  signUp(data: SignUpRequest): Promise<void>;
  signInWithGoogle(accessToken: string): Promise<AuthResponse>;
  signInWithApple(identityToken: string): Promise<AuthResponse>;

  sendPasswordResetOTP(email: string): Promise<void>;
  verifyOTP(email: string, code: string): Promise<void>;
  resetPassword(email: string, otp: string, newPassword: string): Promise<void>;

  checkEmail(email: string): Promise<boolean>; // Returns true if available
  resendOTP(email: string): Promise<void>;

  logout(): Promise<void>;
  refreshToken(refreshToken: string): Promise<AuthResponse>;
}

export class AuthService implements AuthService {
  private api = axios.create({
    baseURL: process.env.EXPO_PUBLIC_API_URL,
  });

  async signIn(credentials: SignInRequest): Promise<AuthResponse> {
    const { data } = await this.api.post<AuthResponse>(
      "/auth/signin",
      credentials,
    );
    return data;
  }

  async signInWithGoogle(accessToken: string): Promise<AuthResponse> {
    const { data } = await this.api.post<AuthResponse>("/auth/signin/google", {
      accessToken,
    });
    return data;
  }

  // ... additional methods
}
```

### 8. Secure Token Storage

File: `src/services/secureStore.ts`

```typescript
import * as SecureStore from "expo-secure-store";

export const secureStore = {
  async setToken(token: string) {
    await SecureStore.setItemAsync("authToken", token);
  },

  async getToken(): Promise<string | null> {
    return await SecureStore.getItemAsync("authToken");
  },

  async setRefreshToken(token: string) {
    await SecureStore.setItemAsync("refreshToken", token);
  },

  async getRefreshToken(): Promise<string | null> {
    return await SecureStore.getItemAsync("refreshToken");
  },

  async clearTokens() {
    await SecureStore.deleteItemAsync("authToken");
    await SecureStore.deleteItemAsync("refreshToken");
  },
};
```

### 9. useAuth Hook

File: `src/hooks/useAuth.ts`

```typescript
interface AuthContextType {
  userToken: string | null;
  isLoading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  isSignedIn: boolean;
}

export function useAuth(): AuthContextType {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const token = await secureStore.getToken();
        setUserToken(token);
      } catch (error) {
        console.error("Failed to restore token", error);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAsync();
  }, []);

  const signIn = async (token: string) => {
    await secureStore.setToken(token);
    setUserToken(token);
  };

  const signOut = async () => {
    await secureStore.clearTokens();
    setUserToken(null);
  };

  return {
    userToken,
    isLoading,
    signIn,
    signOut,
    isSignedIn: userToken != null,
  };
}
```

## Acceptance Criteria

- [ ] Sign In screen implemented with email/password validation
- [ ] Sign Up screen with password strength indicator and unique email check
- [ ] Email verification with 6-digit OTP input
- [ ] Forgot password flow (3 steps: email → OTP → reset)
- [ ] Google Sign In working (Android & iOS)
- [ ] Apple Sign In working (iOS only)
- [ ] Social auth buttons styled and integrated
- [ ] Account lockout screen shows appropriate messages and timers
- [ ] All error messages user-friendly and actionable
- [ ] Secure token storage via expo-secure-store
- [ ] useAuth hook properly initialized and tested
- [ ] All screens accessible via keyboard (Tab key navigation)
- [ ] Form validation happens in real-time with inline error display
- [ ] Loading states visible during API calls
- [ ] Deep links to auth screens working (e.g., password reset from email)
- [ ] No passwords stored or logged

## Dependencies

- expo-auth-session
- expo-apple-authentication
- expo-secure-store
- axios (HTTP client)
- react-native-keyboard-aware-scroll-view (optional, for better input handling)

## Technical Notes

### Security Best Practices

- Never store passwords; use secure token storage only
- Use HTTPS for all auth API calls
- Implement certificate pinning for sensitive endpoints
- Add rate limiting to prevent brute force attacks
- Clear tokens on logout completely
- Validate tokens on app startup (refresh if needed)

### Token Refresh

Implement automatic token refresh:

```typescript
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = await secureStore.getRefreshToken();
      const { token } = await authService.refreshToken(refreshToken);
      await secureStore.setToken(token);
      return api.request(error.config);
    }
    return Promise.reject(error);
  },
);
```

### OTP Delivery

- SMS for phone numbers
- Email for email addresses
- Backend should support both
- OTP valid for 10 minutes
- Max 3 resend attempts per session

### Social Auth Fallback

If Google/Apple sign in fails:

- Show retry button
- Fallback to email/password
- Don't block sign up entirely

### Accessibility

- Form inputs labeled via accessibilityLabel
- Error messages announced via accessibilityRole="alert"
- Color not sole indicator of strength (use icons + text)
- Minimum touch target 44x44pt (iOS) / 48x48dp (Android)

### Testing

- Test OTP expiry handling
- Test invalid credentials response
- Test lockout countdown
- Test social auth token refresh
- Test network error handling with retry
