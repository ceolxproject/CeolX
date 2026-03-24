# Mobile Onboarding Flow

## Description

Create a first-launch onboarding experience with 3-4 swipeable screens that guide new users through role selection (learner/instructor), interest category selection, personalization preferences, and app tour highlights. The onboarding is shown only on first login and saved to the user profile to prevent re-display.

## Affected Apps/Packages

- `apps/mobile/src/screens/onboarding/` (new)
- `apps/mobile/src/components/onboarding/` (new)
- `apps/mobile/src/hooks/useFirstLaunch.ts` (new)
- `packages/shared/src/services/userService.ts` (updated)

## Requirements

### 1. Onboarding Flow State

File: `src/hooks/useFirstLaunch.ts`

```typescript
interface OnboardingState {
  isFirstLaunch: boolean;
  hasCompletedOnboarding: boolean;
  currentStep: 0 | 1 | 2 | 3;
}

interface OnboardingData {
  role: "learner" | "instructor";
  interests: string[];
  preferences: {
    autoplay: boolean;
    subtitles: boolean;
    pushNotifications: boolean;
    downloadOnWifi: boolean;
  };
}

export function useFirstLaunch() {
  const [isFirstLaunch, setIsFirstLaunch] = useState(true);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    role: "learner",
    interests: [],
    preferences: {
      autoplay: true,
      subtitles: false,
      pushNotifications: true,
      downloadOnWifi: true,
    },
  });

  useEffect(() => {
    checkFirstLaunch();
  }, []);

  const checkFirstLaunch = async () => {
    const hasSeenOnboarding = await AsyncStorage.getItem(
      "onboarding_completed",
    );
    setIsFirstLaunch(!hasSeenOnboarding);
  };

  const completeOnboarding = async () => {
    // Save to backend
    await userService.updateProfile({
      role: onboardingData.role,
      interests: onboardingData.interests,
      preferences: onboardingData.preferences,
    });

    // Save locally
    await AsyncStorage.setItem("onboarding_completed", "true");
    setIsFirstLaunch(false);
  };

  return {
    isFirstLaunch,
    onboardingData,
    setOnboardingData,
    completeOnboarding,
  };
}
```

### 2. Onboarding Screen Container

File: `src/screens/onboarding/OnboardingScreen.tsx`

Main container with gesture-driven navigation between steps:

```typescript
import React, { useRef, useEffect } from 'react';
import { View, Animated, Dimensions } from 'react-native';
import { useFirstLaunch } from '@hooks/useFirstLaunch';
import RoleSelectionScreen from './steps/RoleSelectionScreen';
import InterestSelectionScreen from './steps/InterestSelectionScreen';
import PreferencesScreen from './steps/PreferencesScreen';
import AppTourScreen from './steps/AppTourScreen';
import OnboardingProgressBar from '@components/onboarding/OnboardingProgressBar';

const SCREEN_WIDTH = Dimensions.get('window').width;

const ONBOARDING_STEPS = [
  {
    id: 'role',
    title: 'Choose Your Role',
    component: RoleSelectionScreen,
  },
  {
    id: 'interests',
    title: 'Select Your Interests',
    component: InterestSelectionScreen,
  },
  {
    id: 'preferences',
    title: 'Set Your Preferences',
    component: PreferencesScreen,
  },
  {
    id: 'tour',
    title: 'Welcome to Mentor',
    component: AppTourScreen,
  },
];

export function OnboardingScreen({ navigation }: OnboardingScreenProps) {
  const { onboardingData, setOnboardingData, completeOnboarding } = useFirstLaunch();
  const [currentStep, setCurrentStep] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      scrollViewRef.current?.scrollTo({
        x: (currentStep + 1) * SCREEN_WIDTH,
        animated: true,
      });
    } else {
      completeOnboarding();
      navigation.replace('Main');
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      scrollViewRef.current?.scrollTo({
        x: (currentStep - 1) * SCREEN_WIDTH,
        animated: true,
      });
    }
  };

  const handleSkip = () => {
    completeOnboarding();
    navigation.replace('Main');
  };

  return (
    <View style={styles.container}>
      <OnboardingProgressBar progress={(currentStep + 1) / ONBOARDING_STEPS.length} />

      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollOffset } } }],
          { useNativeDriver: false }
        )}
      >
        {ONBOARDING_STEPS.map((step, index) => {
          const StepComponent = step.component;
          return (
            <View key={step.id} style={{ width: SCREEN_WIDTH, flex: 1 }}>
              <StepComponent
                data={onboardingData}
                onChange={setOnboardingData}
                onNext={handleNext}
                onPrevious={handlePrevious}
                onSkip={handleSkip}
                isLastStep={index === ONBOARDING_STEPS.length - 1}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
```

### 3. Step 1: Role Selection

File: `src/screens/onboarding/steps/RoleSelectionScreen.tsx`

```typescript
interface RoleOption {
  id: 'learner' | 'instructor';
  title: string;
  description: string;
  icon: string;
  color: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    id: 'learner',
    title: 'I'm Learning',
    description: 'Take courses and develop new skills',
    icon: 'school',
    color: colors.primary,
  },
  {
    id: 'instructor',
    title: 'I'm Teaching',
    description: 'Create and sell courses',
    icon: 'award',
    color: colors.secondary,
  },
];

export function RoleSelectionScreen({
  data,
  onChange,
  onNext,
  onSkip,
}: RoleSelectionScreenProps) {
  const [selectedRole, setSelectedRole] = useState<'learner' | 'instructor'>(data.role);

  const handleRoleSelect = (role: 'learner' | 'instructor') => {
    setSelectedRole(role);
    onChange({
      ...data,
      role,
    });
  };

  const handleNext = () => {
    if (selectedRole) {
      onNext();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>What brings you to Mentor?</Text>
      <Text style={styles.subtitle}>Choose how you'll use the platform</Text>

      <View style={styles.rolesContainer}>
        {ROLE_OPTIONS.map((role) => (
          <Pressable
            key={role.id}
            style={[
              styles.roleCard,
              selectedRole === role.id && styles.roleCardSelected,
              { borderColor: selectedRole === role.id ? role.color : colors.border },
            ]}
            onPress={() => handleRoleSelect(role.id)}
          >
            <Ionicons
              name={role.icon}
              size={40}
              color={role.color}
              style={styles.roleIcon}
            />
            <Text style={styles.roleTitle}>{role.title}</Text>
            <Text style={styles.roleDescription}>{role.description}</Text>
            {selectedRole === role.id && (
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={role.color}
                style={styles.checkmark}
              />
            )}
          </Pressable>
        ))}
      </View>

      <View style={styles.buttonContainer}>
        <Button title="Skip" variant="outline" onPress={onSkip} />
        <Button
          title="Next"
          onPress={handleNext}
          disabled={!selectedRole}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    justifyContent: 'space-between',
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  rolesContainer: {
    gap: spacing.md,
  },
  roleCard: {
    borderWidth: 2,
    borderRadius: 12,
    padding: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  roleCardSelected: {
    backgroundColor: colors.primaryLight,
  },
  roleIcon: {
    marginBottom: spacing.md,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  roleDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  checkmark: {
    marginTop: spacing.md,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
```

### 4. Step 2: Interest Selection

File: `src/screens/onboarding/steps/InterestSelectionScreen.tsx`

```typescript
const INTEREST_CATEGORIES = [
  'Makeup',
  'Skincare',
  'Haircare',
  'Nail Art',
  'Color Theory',
  'Product Knowledge',
  'Business',
  'Wellness',
  'Fashion',
  'Fragrance',
  'Tutorial Creation',
  'Social Media',
];

export function InterestSelectionScreen({
  data,
  onChange,
  onNext,
  onPrevious,
}: InterestSelectionScreenProps) {
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(
    new Set(data.interests)
  );

  const toggleInterest = (interest: string) => {
    const newInterests = new Set(selectedInterests);
    if (newInterests.has(interest)) {
      newInterests.delete(interest);
    } else {
      newInterests.add(interest);
    }
    setSelectedInterests(newInterests);
  };

  const handleNext = () => {
    onChange({
      ...data,
      interests: Array.from(selectedInterests),
    });
    onNext();
  };

  const isValid = selectedInterests.size >= 1 && selectedInterests.size <= 5;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>What are you interested in?</Text>
      <Text style={styles.subtitle}>Select up to 5 categories</Text>

      <ScrollView
        style={styles.tagsContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.tagsContent}
      >
        {INTEREST_CATEGORIES.map((interest) => (
          <Pressable
            key={interest}
            style={[
              styles.tag,
              selectedInterests.has(interest) && styles.tagSelected,
            ]}
            onPress={() => toggleInterest(interest)}
            disabled={selectedInterests.size === 5 && !selectedInterests.has(interest)}
          >
            <Text
              style={[
                styles.tagText,
                selectedInterests.has(interest) && styles.tagTextSelected,
              ]}
            >
              {interest}
            </Text>
            {selectedInterests.has(interest) && (
              <Ionicons name="checkmark" size={16} color={colors.white} />
            )}
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.selectionCount}>
        {selectedInterests.size} / 5 selected
      </Text>

      <View style={styles.buttonContainer}>
        <Button title="Back" variant="outline" onPress={onPrevious} />
        <Button
          title="Next"
          onPress={handleNext}
          disabled={!isValid}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    justifyContent: 'space-between',
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  tagsContainer: {
    flex: 1,
  },
  tagsContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tagSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tagText: {
    fontSize: 14,
    color: colors.text,
  },
  tagTextSelected: {
    color: colors.white,
    fontWeight: '600',
  },
  selectionCount: {
    fontSize: 12,
    color: colors.textSecondary,
    marginVertical: spacing.md,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
```

### 5. Step 3: Preferences

File: `src/screens/onboarding/steps/PreferencesScreen.tsx`

```typescript
interface PreferenceItem {
  id: keyof typeof PreferenceDefaults;
  title: string;
  description: string;
  icon: string;
}

const PREFERENCE_ITEMS: PreferenceItem[] = [
  {
    id: 'autoplay',
    title: 'Autoplay Videos',
    description: 'Videos automatically continue when moving to next lesson',
    icon: 'play-circle',
  },
  {
    id: 'subtitles',
    title: 'Show Subtitles',
    description: 'Display subtitles by default during videos',
    icon: 'closed-captioning',
  },
  {
    id: 'pushNotifications',
    title: 'Push Notifications',
    description: 'Get updates on courses and community activity',
    icon: 'notifications',
  },
  {
    id: 'downloadOnWifi',
    title: 'Download on WiFi Only',
    description: 'Only download videos when connected to WiFi',
    icon: 'wifi',
  },
];

export function PreferencesScreen({
  data,
  onChange,
  onNext,
  onPrevious,
}: PreferencesScreenProps) {
  const [preferences, setPreferences] = useState(data.preferences);

  const togglePreference = (key: keyof typeof preferences) => {
    const updated = {
      ...preferences,
      [key]: !preferences[key],
    };
    setPreferences(updated);
  };

  const handleNext = () => {
    onChange({
      ...data,
      preferences,
    });
    onNext();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Customize Your Experience</Text>
      <Text style={styles.subtitle}>Adjust your settings anytime in preferences</Text>

      <ScrollView style={styles.preferencesContainer}>
        {PREFERENCE_ITEMS.map((item) => (
          <View key={item.id} style={styles.preferenceItem}>
            <View style={styles.preferenceContent}>
              <Ionicons
                name={item.icon}
                size={24}
                color={colors.primary}
                style={styles.preferenceIcon}
              />
              <View style={styles.preferenceText}>
                <Text style={styles.preferenceTitle}>{item.title}</Text>
                <Text style={styles.preferenceDescription}>{item.description}</Text>
              </View>
            </View>
            <Switch
              value={preferences[item.id]}
              onValueChange={() => togglePreference(item.id)}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={preferences[item.id] ? colors.primary : colors.textTertiary}
            />
          </View>
        ))}
      </ScrollView>

      <View style={styles.buttonContainer}>
        <Button title="Back" variant="outline" onPress={onPrevious} />
        <Button title="Next" onPress={handleNext} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    justifyContent: 'space-between',
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  preferencesContainer: {
    flex: 1,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  preferenceContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  preferenceIcon: {
    marginTop: spacing.xs,
  },
  preferenceText: {
    flex: 1,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  preferenceDescription: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
```

### 6. Step 4: App Tour

File: `src/screens/onboarding/steps/AppTourScreen.tsx`

Final screen highlighting key features:

```typescript
const TOUR_FEATURES = [
  {
    id: 'discover',
    icon: 'compass',
    title: 'Discover Courses',
    description: 'Browse and search through hundreds of beauty and cosmetics courses',
  },
  {
    id: 'learn',
    icon: 'play-circle',
    title: 'Learn at Your Pace',
    description: 'Watch HD videos with subtitles and take notes along the way',
  },
  {
    id: 'community',
    icon: 'people',
    title: 'Connect with Others',
    description: 'Join discussions and share knowledge with the Mentor community',
  },
  {
    id: 'progress',
    icon: 'trending-up',
    title: 'Track Progress',
    description: 'Monitor your learning journey with detailed course completion stats',
  },
];

export function AppTourScreen({
  onNext,
  onSkip,
  isLastStep,
}: AppTourScreenProps) {
  const [currentFeature, setCurrentFeature] = useState(0);

  const handlePrevious = () => {
    if (currentFeature > 0) {
      setCurrentFeature(currentFeature - 1);
    }
  };

  const handleNext = () => {
    if (currentFeature < TOUR_FEATURES.length - 1) {
      setCurrentFeature(currentFeature + 1);
    } else {
      onNext();
    }
  };

  const feature = TOUR_FEATURES[currentFeature];

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Welcome to Mentor</Text>

      <View style={styles.featureContainer}>
        <View style={styles.iconCircle}>
          <Ionicons
            name={feature.icon}
            size={60}
            color={colors.primary}
          />
        </View>
        <Text style={styles.featureTitle}>{feature.title}</Text>
        <Text style={styles.featureDescription}>{feature.description}</Text>
      </View>

      {/* Dot indicators */}
      <View style={styles.dotsContainer}>
        {TOUR_FEATURES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentFeature && styles.dotActive,
            ]}
          />
        ))}
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="Back"
          variant="outline"
          onPress={handlePrevious}
          disabled={currentFeature === 0}
        />
        <Button
          title={currentFeature === TOUR_FEATURES.length - 1 ? 'Get Started' : 'Next'}
          onPress={handleNext}
          style={{ flex: 1 }}
        />
      </View>

      <Pressable onPress={onSkip} style={styles.skipButton}>
        <Text style={styles.skipText}>Skip tour</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    justifyContent: 'space-between',
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  featureContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  featureDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  skipText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
```

### 7. Progress Bar Component

File: `src/components/onboarding/OnboardingProgressBar.tsx`

```typescript
interface OnboardingProgressBarProps {
  progress: number; // 0 to 1
}

export function OnboardingProgressBar({ progress }: OnboardingProgressBarProps) {
  const animatedWidth = useSharedValue(0);

  useEffect(() => {
    animatedWidth.value = withTiming(progress, {
      duration: 300,
    });
  }, [progress, animatedWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${animatedWidth.value * 100}%`,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.progress, animatedStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 4,
    backgroundColor: colors.border,
    width: '100%',
  },
  progress: {
    height: '100%',
    backgroundColor: colors.primary,
  },
});
```

### 8. Integration with RootNavigator

File: `src/navigation/RootNavigator.tsx` (updated)

```typescript
export function RootNavigator() {
  const { isLoading, userToken } = useAuth();
  const { isFirstLaunch } = useFirstLaunch();

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer linking={linking} fallback={<SplashScreen />}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {userToken == null ? (
          <Stack.Group>
            <Stack.Screen name="Auth" component={AuthNavigator} />
          </Stack.Group>
        ) : isFirstLaunch ? (
          <Stack.Group screenOptions={{ animationEnabled: false }}>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          </Stack.Group>
        ) : (
          <>
            <Stack.Group screenOptions={{ animationEnabled: false }}>
              <Stack.Screen name="Main" component={MainTabNavigator} />
            </Stack.Group>
            <Stack.Group screenOptions={{ presentation: 'modal' }}>
              <Stack.Screen name="Modal" component={ModalNavigator} />
            </Stack.Group>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

## Acceptance Criteria

- [ ] Onboarding screen shows only on first launch after sign up
- [ ] 4-step onboarding flow implemented (role → interests → preferences → tour)
- [ ] Each step has animated transitions and clear progress indicator
- [ ] Role selection allows choosing learner (default) or instructor
- [ ] Interest selection supports 1-5 category selection
- [ ] Preferences screen toggles autoplay, subtitles, notifications, download settings
- [ ] App tour displays 4 key features with dot indicators
- [ ] Back/Next buttons allow navigation between steps
- [ ] Skip button available on all steps (except last)
- [ ] On completion, data saved to backend and localStorage
- [ ] User cannot re-trigger onboarding after completion
- [ ] All preferences can be changed later in Settings
- [ ] Smooth horizontal swiping transitions between steps (optional animation)
- [ ] Progress bar updates as user advances
- [ ] No console errors or TypeScript warnings

## Dependencies

- react-native-gesture-handler (for smooth animations)
- react-native-reanimated (optional, for advanced animations)
- @react-navigation/native

## Technical Notes

### First Launch Detection

Use AsyncStorage to persist onboarding completion:

```typescript
const hasSeenOnboarding = await AsyncStorage.getItem("onboarding_completed");
```

Alternative: Track on backend via user profile flag `onboarding_completed_at`

### Skip Behavior

Skipping onboarding:

- Still saves defaults to profile (all interests, all preferences enabled)
- User can edit everything later in Settings
- Never prevents access to main app

### Preventing Re-Display

Check `onboarding_completed` flag:

```typescript
if (userToken && !isFirstLaunch) {
  // Show main app
} else if (userToken && isFirstLaunch) {
  // Show onboarding
}
```

### Animation Performance

- Use native driver for smooth 60fps transitions
- Minimize re-renders with useCallback on handlers
- Profile with React DevTools during scroll

### Accessibility

- Each screen step should have clear heading
- Form labels accessible via accessibilityLabel
- Color + icon used for role selection (not just color)
- Button text clear about action (Next, Skip, Get Started)

### Testing Strategies

- Reset onboarding via: `AsyncStorage.removeItem('onboarding_completed')`
- Test skip from each step
- Verify data persists to backend on completion
- Test with different role/interest/preference combinations
