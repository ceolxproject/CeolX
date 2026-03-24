# Mobile Navigation Structure

## Description

Implement the core navigation architecture using React Navigation with a bottom tab navigator for main app tabs and stack navigators for each feature area. This defines the routing structure, tab definitions, auth flow separation, and deep link configuration to enable seamless navigation between screens and external link handling.

## Affected Apps/Packages

- `apps/mobile/src/navigation/` (new)
- `apps/mobile/src/App.tsx`
- `packages/shared/src/hooks/useDeepLink` (new)

## Requirements

### 1. Navigation Library Setup

- Install dependencies:
  ```bash
  npm install @react-navigation/native @react-navigation/bottom-tabs \
              @react-navigation/stack @react-navigation/native-stack \
              react-native-screens react-native-safe-area-context \
              react-native-gesture-handler
  ```
- Configure gesture handler in `App.tsx` entry:
  ```typescript
  import "react-native-gesture-handler";
  ```

### 2. Bottom Tab Navigator Structure

Primary navigation with 5 tabs visible when authenticated:

```
┌─────────────────────────────────┐
│      [Screen Content]           │
├─────────────────────────────────┤
│ [Home] [Search] [Courses] [Community] [Profile] │
└─────────────────────────────────┘
```

Tab configuration in `src/navigation/BottomTabs.tsx`:

```typescript
export const TAB_ROUTES = {
  HOME: "home",
  SEARCH: "search",
  MY_COURSES: "my-courses",
  COMMUNITY: "community",
  PROFILE: "profile",
} as const;

export const TAB_SCREENS = [
  {
    name: TAB_ROUTES.HOME,
    label: "Home",
    icon: "home",
    component: HomeStackNavigator,
  },
  {
    name: TAB_ROUTES.SEARCH,
    label: "Search",
    icon: "search",
    component: SearchStackNavigator,
  },
  {
    name: TAB_ROUTES.MY_COURSES,
    label: "My Courses",
    icon: "bookmark",
    component: MyCoursesStackNavigator,
  },
  {
    name: TAB_ROUTES.COMMUNITY,
    label: "Community",
    icon: "users",
    component: CommunityStackNavigator,
  },
  {
    name: TAB_ROUTES.PROFILE,
    label: "Profile",
    icon: "user",
    component: ProfileStackNavigator,
  },
];
```

### 3. Stack Navigators for Each Tab

Each tab has its own stack for nested screens:

**HomeStackNavigator** (apps/mobile/src/navigation/stacks/HomeStack.tsx):

- Home (main feed/dashboard)
- Course Detail
- Lesson Video Player
- Lesson Transcripts (modal)
- Bookmarks (modal)

**SearchStackNavigator**:

- Search Results
- Course Detail
- Filters Bottom Sheet (modal)
- Sorting Bottom Sheet (modal)

**MyCoursesStackNavigator**:

- My Courses (tabs: In Progress, Completed, Bookmarked)
- Course Detail
- Lesson Video Player
- Assignments

**CommunityStackNavigator**:

- Community Feed
- Post Detail
- Compose Post (modal)
- Community Guidelines (modal)

**ProfileStackNavigator**:

- Profile Screen
- Edit Profile (modal)
- Settings (modal)
- Account Deletion Flow
- Notification Preferences

### 4. Navigation Types

File: `src/navigation/types.ts`

```typescript
import { NavigatorScreenParams } from "@react-navigation/native";

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  Modal: NavigatorScreenParams<ModalStackParamList>;
};

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  EmailVerification: { email: string };
  SocialLogin: undefined;
  AccountLockout: { email: string; reasonCode: string };
};

export type MainTabParamList = {
  home: NavigatorScreenParams<HomeStackParamList>;
  search: NavigatorScreenParams<SearchStackParamList>;
  "my-courses": NavigatorScreenParams<MyCoursesStackParamList>;
  community: NavigatorScreenParams<CommunityStackParamList>;
  profile: NavigatorScreenParams<ProfileStackParamList>;
};

export type HomeStackParamList = {
  Home: undefined;
  CourseDetail: { courseId: string };
  LessonPlayer: { lessonId: string; courseId: string; resumePosition?: number };
  LessonTranscript: { lessonId: string };
  BookmarkedCourses: undefined;
};

export type SearchStackParamList = {
  SearchResults: { query?: string; filters?: CourseFilters };
  CourseDetail: { courseId: string };
  Filters: undefined;
  Sorting: undefined;
};

export type MyCoursesStackParamList = {
  MyCourses: { tab?: "in-progress" | "completed" | "bookmarked" };
  CourseDetail: { courseId: string };
  LessonPlayer: { lessonId: string; courseId: string; resumePosition?: number };
  Assignments: { lessonId: string };
};

export type CommunityStackParamList = {
  Feed: undefined;
  PostDetail: { postId: string };
  ComposeFeed: undefined;
  Guidelines: undefined;
};

export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  Settings: undefined;
  NotificationPreferences: undefined;
  DataExport: undefined;
  DeleteAccount: undefined;
};

export type ModalStackParamList = {
  Transcripts: { lessonId: string };
  Bookmarks: undefined;
  Filters: undefined;
  ComposePost: undefined;
  Guidelines: undefined;
};
```

### 5. Root Navigation Component

File: `src/navigation/RootNavigator.tsx`

```typescript
import React from 'react';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@hooks/useAuth';
import { useDeepLink } from '@hooks/useDeepLink';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import ModalNavigator from './ModalNavigator';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['mentor://', 'https://example.com', 'https://mentor.example.com'],
  config: {
    screens: {
      // Deep link config (see section 6)
    },
  },
};

export function RootNavigator() {
  const { isLoading, userToken } = useAuth();
  const { handleDeepLink } = useDeepLink();

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer
      linking={linking}
      fallback={<SplashScreen />}
      onReady={() => {
        // Handle deep link on app launch
        handleDeepLink();
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {userToken == null ? (
          <Stack.Group>
            <Stack.Screen name="Auth" component={AuthNavigator} />
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

### 6. Deep Link Configuration

File: `src/navigation/linking.ts`

```typescript
import { LinkingOptions } from "@react-navigation/native";
import { RootStackParamList } from "./types";

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    "mentor://",
    "mentor://",
    "https://example.com",
    "https://mentor.example.com",
  ],
  config: {
    screens: {
      // Auth screens
      Auth: {
        screens: {
          SignIn: "auth/signin",
          SignUp: "auth/signup",
          ForgotPassword: "auth/forgot-password",
          EmailVerification: "auth/verify/:email",
          SocialLogin: "auth/social",
        },
      },

      // Main tabs
      Main: {
        screens: {
          home: {
            screens: {
              Home: "",
              CourseDetail: "courses/:courseId",
              LessonPlayer: "lessons/:lessonId",
              BookmarkedCourses: "bookmarks",
            },
          },
          search: {
            screens: {
              SearchResults: "search",
            },
          },
          "my-courses": {
            screens: {
              MyCourses: "my-courses",
              CourseDetail: "courses/:courseId",
              Assignments: "assignments/:assignmentId",
            },
          },
          community: {
            screens: {
              Feed: "community",
              PostDetail: "posts/:postId",
            },
          },
          profile: {
            screens: {
              Profile: "profile",
              Settings: "settings",
            },
          },
        },
      },

      // Modal screens
      Modal: {
        screens: {
          Transcripts: "transcripts/:lessonId",
          Bookmarks: "bookmarks",
          Filters: "filters",
          ComposePost: "compose",
          Guidelines: "guidelines",
        },
      },

      // Special deep links
      PaymentSuccess: "payments/success",
      PaymentCancel: "payments/cancel",
      NotFound: "*",
    },
  },
};

export default linking;
```

### 7. Auth Navigator

File: `src/navigation/AuthNavigator.tsx`

```typescript
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SignInScreen from '@screens/auth/SignInScreen';
import SignUpScreen from '@screens/auth/SignUpScreen';
import ForgotPasswordScreen from '@screens/auth/ForgotPasswordScreen';
import EmailVerificationScreen from '@screens/auth/EmailVerificationScreen';
import SocialLoginScreen from '@screens/auth/SocialLoginScreen';
import AccountLockoutScreen from '@screens/auth/AccountLockoutScreen';
import { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
      }}
    >
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen
        name="EmailVerification"
        component={EmailVerificationScreen}
        options={{
          animationEnabled: false,
        }}
      />
      <Stack.Screen name="SocialLogin" component={SocialLoginScreen} />
      <Stack.Screen
        name="AccountLockout"
        component={AccountLockoutScreen}
        options={{
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
}

export default AuthNavigator;
```

### 8. Main Tab Navigator

File: `src/navigation/MainTabNavigator.tsx`

```typescript
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeStack from './stacks/HomeStack';
import SearchStack from './stacks/SearchStack';
import MyCoursesStack from './stacks/MyCoursesStack';
import CommunityStack from './stacks/CommunityStack';
import ProfileStack from './stacks/ProfileStack';
import TabBar from '@components/navigation/TabBar';
import { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="home"
        component={HomeStack}
        options={{
          title: 'Home',
          tabBarIcon: 'home',
        }}
      />
      <Tab.Screen
        name="search"
        component={SearchStack}
        options={{
          title: 'Search',
          tabBarIcon: 'search',
        }}
      />
      <Tab.Screen
        name="my-courses"
        component={MyCoursesStack}
        options={{
          title: 'My Courses',
          tabBarIcon: 'bookmark',
        }}
      />
      <Tab.Screen
        name="community"
        component={CommunityStack}
        options={{
          title: 'Community',
          tabBarIcon: 'users',
        }}
      />
      <Tab.Screen
        name="profile"
        component={ProfileStack}
        options={{
          title: 'Profile',
          tabBarIcon: 'user',
        }}
      />
    </Tab.Navigator>
  );
}

export default MainTabNavigator;
```

### 9. Stack Implementations (Example: HomeStack)

File: `src/navigation/stacks/HomeStack.tsx`

```typescript
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '@screens/home/HomeScreen';
import CourseDetailScreen from '@screens/course/CourseDetailScreen';
import LessonPlayerScreen from '@screens/lesson/LessonPlayerScreen';
import BookmarkedCoursesScreen from '@screens/home/BookmarkedCoursesScreen';
import { HomeStackParamList } from '../types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          animationEnabled: false,
        }}
      />
      <Stack.Screen
        name="CourseDetail"
        component={CourseDetailScreen}
        options={{
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="LessonPlayer"
        component={LessonPlayerScreen}
        options={{
          presentation: 'fullScreenModal',
          animationEnabled: true,
        }}
      />
      <Stack.Screen
        name="BookmarkedCourses"
        component={BookmarkedCoursesScreen}
        options={{
          presentation: 'modal',
        }}
      />
    </Stack.Navigator>
  );
}

export default HomeStackNavigator;
```

### 10. Deep Link Handling Hook

File: `src/hooks/useDeepLink.ts`

```typescript
import { useEffect } from "react";
import { Linking } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { RootStackScreenProps } from "@navigation/types";

type NavigationProp = RootStackScreenProps<"Main">["navigation"];

export function useDeepLink() {
  const navigation = useNavigation<NavigationProp>();

  const handleDeepLink = (url: string) => {
    // Parse deep link and navigate appropriately
    const route = url.split("://")[1];

    if (route.startsWith("courses/")) {
      const courseId = route.split("courses/")[1];
      navigation.navigate("Main", {
        screen: "home",
        params: {
          screen: "CourseDetail",
          params: { courseId },
        },
      });
    } else if (route.startsWith("lessons/")) {
      const lessonId = route.split("lessons/")[1];
      navigation.navigate("Main", {
        screen: "my-courses",
        params: {
          screen: "LessonPlayer",
          params: { lessonId },
        },
      });
    } else if (route === "payments/success") {
      // Handle payment success redirect
      navigation.navigate("Main", {
        screen: "profile",
      });
    } else if (route === "payments/cancel") {
      // Handle payment cancel
      navigation.navigate("Main", {
        screen: "home",
      });
    }
  };

  useEffect(() => {
    // Handle deep link from app launch
    Linking.getInitialURL().then((url) => {
      if (url != null) {
        handleDeepLink(url);
      }
    });
  }, []);

  useFocusEffect(() => {
    // Handle deep link when app is running
    const subscription = Linking.addEventListener("url", (event) => {
      handleDeepLink(event.url);
    });

    return () => subscription.remove();
  });

  return { handleDeepLink };
}

export default useDeepLink;
```

### 11. Custom TabBar Component

File: `src/components/navigation/TabBar.tsx`

```typescript
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing } from '@theme';

type IconName = 'home' | 'search' | 'bookmark' | 'users' | 'user';

const ICON_MAP: Record<string, IconName> = {
  home: 'home',
  search: 'search',
  'my-courses': 'bookmark',
  community: 'people',
  profile: 'person',
};

export function TabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const iconName = ICON_MAP[route.name] || 'home';

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={[styles.tabButton, isFocused && styles.tabButtonActive]}
          >
            <Ionicons
              name={isFocused ? (iconName as any) : `${iconName}-outline`}
              size={24}
              color={isFocused ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.label,
                {
                  color: isFocused ? colors.primary : colors.textSecondary,
                },
              ]}
            >
              {options.title || route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  tabButtonActive: {
    backgroundColor: colors.primaryLight,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default TabBar;
```

## Acceptance Criteria

- [ ] React Navigation dependencies installed and configured
- [ ] RootNavigator with auth/main flow switching implemented
- [ ] Navigation types (TypeScript) fully defined for all screens
- [ ] Bottom tab navigator with 5 tabs (Home, Search, My Courses, Community, Profile)
- [ ] Stack navigators for each tab with proper screen nesting
- [ ] Deep linking configuration for:
  - Course detail screens (`courses/:courseId`)
  - Lesson player (`lessons/:lessonId`)
  - Payment success/cancel (`payments/success`, `payments/cancel`)
  - Community posts (`posts/:postId`)
  - Profile/settings screens
- [ ] useDeepLink hook integrated and tested
- [ ] Custom TabBar component matches design system
- [ ] Navigation tested with navigation simulator
- [ ] No console warnings about unregistered screen types
- [ ] Auth navigator properly gates main navigator
- [ ] Modal presentations configured for appropriate screens

## Dependencies

- @react-navigation/native
- @react-navigation/bottom-tabs
- @react-navigation/native-stack
- react-native-screens
- react-native-safe-area-context
- react-native-gesture-handler
- @expo/vector-icons (icons)

## Technical Notes

### Navigation Stack Structure

The app uses a nested navigator pattern:

1. **Root**: Conditional Auth/Main based on user token
2. **Main**: Bottom Tab Navigator with 5 tabs
3. **Per-Tab**: Stack Navigator for screen hierarchy
4. **Modals**: Separate modal group for sheet/modal presentations

### Deep Linking Strategy

- **Prefixes**: Support multiple schemes (mentor://, mentor://, https://)
- **Web to App**: Payment redirects use deep links from Stripe checkout
- **App to App**: Community shares use deep links
- **Scheme Testing**: Use `expo://` prefix for testing in Expo Go

### Performance

- Lazy screen loading via Stack.Group prevents bundle bloat
- useFocusEffect for resuming listeners when screen focuses
- Conditional rendering in Root prevents unnecessary navigation state

### Testing Deep Links

```bash
# Test via Expo CLI
npx expo send --url "mentor://courses/123"

# Test via adb (Android)
adb shell am start -W -a android.intent.action.VIEW -d "mentor://courses/123" com.example.mentor

# Test via simctl (iOS)
xcrun simctl openurl booted "mentor://courses/123"
```

### Preventing Navigation Loops

- Use `navigation.navigate()` for bottom tab transitions
- Use separate stack screens for modal overlays
- Test gesture-driven navigation transitions

### Linking with Parameters

All deep link routes support query parameters:

```
mentor://search?query=makeup&filter=beginner
mentor://courses/abc123?scrollToLesson=lesson-1
```

Parse via route.params in navigation listener
