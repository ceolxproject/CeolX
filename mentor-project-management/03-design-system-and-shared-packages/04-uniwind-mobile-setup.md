# UniWind CSS Setup for React Native Mobile Apps

## Description

Configure UniWind CSS (Tailwind CSS for React Native) in `packages/ui-mobile` to provide mobile-first styling consistent with the web design system. Map Mentor brand tokens (#FF3B6B, #1A1A2E, #FFFFFF) to React Native style objects. Establish responsive breakpoints adapted for mobile devices. Create a unified theming system supporting iOS and Android platform-specific styling.

## Affected Apps/Packages

- `packages/ui-mobile` - Mobile UI component library
- `apps/mobile-ios` - Native iOS application
- `apps/mobile-android` - Native Android application
- Monorepo shared design tokens

## Requirements

### UniWind Configuration

- Install UniWind v2.x with React Native compatibility
- Create centralized theme configuration
- Map Tailwind utilities to React Native `StyleSheet` API
- Support both web and native builds from same component base
- Configure platform-specific variants (iOS, Android, web)

### Brand Token Mapping

- Primary: #FF3B6B (Hot Pink) - CTAs, highlights, primary actions
- Secondary: #1A1A2E (Dark Navy) - Text, backgrounds, navigation
- Accent: #FFFFFF (White) - High contrast, borders
- Full color spectrum (50-950 shades) for semantic UI
- Semantic colors: Success (#10B981), Warning (#F59E0B), Error (#EF4444), Info (#3B82F6)

### Responsive Design for Mobile

- Breakpoints tailored for device sizes:
  - Mobile: 320px - 479px (phones)
  - Tablet: 480px - 1023px (tablets, landscape phones)
  - Desktop: 1024px+ (iPads, external displays)
- Viewport-based scaling using `Dimensions` API
- Orientation detection (portrait, landscape)
- Safe area handling (notch, home indicator)

### Typography System

- Font families: SF Pro Display (iOS), Roboto (Android) with system fallbacks
- Font sizes: 12, 14, 16, 18, 20, 24, 32px aligned with web system
- Font weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- Line heights: 1.2, 1.5, 1.75, 2
- Platform-specific scaling and weight rendering

### Spacing & Layout

- Base unit: 4px consistent with web
- Scale: 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96
- FlexBox layout system as primary (React Native native)
- Padding/margin consistency across platforms
- Safe area considerations for notched devices

### Platform-Specific Styling

- iOS: Cupertino design language hints
- Android: Material Design 3 compatibility
- Platform detection with `Platform.OS`
- Separate style sets when necessary
- Consistent visual appearance across platforms

### Theme Provider Architecture

- Context API for theme distribution
- Support for future light/dark mode (V2)
- Runtime theme switching capability
- Type-safe theme access with TypeScript

## Acceptance Criteria

- [x] UniWind installed and configured in packages/ui-mobile
- [x] Brand color tokens mapped to React Native StyleSheet values
- [x] All 50-950 color shades available in theme object
- [x] Responsive breakpoints implemented for mobile/tablet/desktop
- [x] Typography system with iOS/Android font families configured
- [x] Spacing scale from 0 to 96 (4px increment) functional
- [x] Safe area insets detected and applied automatically
- [x] Platform-specific style variants working (iOS, Android, web)
- [x] Theme provider component created and integrated
- [x] CSS-in-JS utilities generating correct React Native styles
- [x] Example component demonstrating responsive and themed styling
- [x] TypeScript types for theme colors and utilities exported
- [x] Orientation detection working (portrait/landscape)
- [x] No build warnings or errors
- [x] Tested on iOS and Android emulators/devices
- [x] Performance: Theme switching < 100ms
- [x] Design tokens match web system (color precision ±5 in RGB)

## Dependencies

- `nativewind@^4.x` or `uniwind@^2.x` - Tailwind for React Native
- `react-native@^0.73+` - Native development framework
- `@react-native-community/hooks` - Dimension and orientation hooks
- TypeScript 5.x
- `react-native-safe-area-context` - Safe area management

## Technical Notes

### Project Structure

```
packages/ui-mobile/
├── theme/
│   ├── colors.ts              # Brand color definitions
│   ├── typography.ts          # Font configurations
│   ├── spacing.ts             # Spacing scale
│   ├── theme.ts               # Complete theme object
│   └── index.ts               # Barrel export
├── providers/
│   ├── ThemeProvider.tsx       # Theme context provider
│   └── SafeAreaProvider.tsx    # Safe area wrapper
├── hooks/
│   ├── useTheme.ts            # Access theme from anywhere
│   ├── useDimensions.ts       # Responsive dimension tracking
│   ├── useOrientation.ts      # Portrait/landscape detection
│   └── useSafeArea.ts         # Safe area insets access
├── styles/
│   ├── globals.ts             # Global style presets
│   └── colors.ts              # Color utility classes
├── components/                # UI components (from task 05)
├── utils/
│   ├── cn.ts                  # Class merging utility
│   └── colors.ts              # Color helpers
├── types/
│   ├── theme.ts               # TypeScript theme types
│   └── styles.ts              # Style prop types
├── tailwind.config.js         # UniWind/NativeWind config
└── package.json
```

### Theme Definition Example

```typescript
// theme/colors.ts
export const colors = {
  primary: {
    50: "#fff5f9",
    100: "#ffe0ec",
    200: "#ffc0d9",
    300: "#ff9fc6",
    400: "#ff7eb3",
    500: "#ff5da0",
    600: "#FF3B6B", // Brand primary
    700: "#f02a5c",
    800: "#c71e48",
    900: "#9f1738",
    950: "#7d0f2d",
  },
  secondary: {
    50: "#f5f5f7",
    100: "#ebebf1",
    200: "#d9d9e3",
    300: "#bdbdcb",
    400: "#9696a7",
    500: "#6f7483",
    600: "#3d3d5c",
    700: "#262634",
    800: "#1A1A2E", // Brand secondary
    900: "#0f0f1a",
    950: "#080812",
  },
  accent: {
    white: "#FFFFFF",
    black: "#000000",
  },
  semantic: {
    success: "#10B981",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",
  },
  neutral: {
    50: "#fafafa",
    100: "#f5f5f5",
    200: "#eeeeee",
    300: "#e0e0e0",
    400: "#bdbdbd",
    500: "#9e9e9e",
    600: "#757575",
    700: "#616161",
    800: "#424242",
    900: "#212121",
  },
};

// theme/typography.ts
import { Platform } from "react-native";

export const typography = {
  fontFamily: {
    sans: Platform.select({
      ios: "SF Pro Display",
      android: "Roboto",
      default: "System",
    }),
    mono: Platform.select({
      ios: "Menlo",
      android: "Roboto Mono",
      default: "Courier New",
    }),
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    "2xl": 24,
    "4xl": 32,
    "6xl": 48,
  },
  fontWeight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
    loose: 2,
  },
};

// theme/spacing.ts
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  28: 112,
  32: 128,
};

// theme/theme.ts
import { colors } from "./colors";
import { typography } from "./typography";
import { spacing } from "./spacing";

export const theme = {
  colors,
  typography,
  spacing,
  breakpoints: {
    sm: 480,
    md: 768,
    lg: 1024,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 999,
  },
  shadows: {
    sm: {
      shadowColor: colors.neutral[900],
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.18,
      shadowRadius: 1.0,
      elevation: 1,
    },
    md: {
      shadowColor: colors.neutral[900],
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 3.84,
      elevation: 5,
    },
    lg: {
      shadowColor: colors.neutral[900],
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.24,
      shadowRadius: 2.62,
      elevation: 10,
    },
  },
};

export type Theme = typeof theme;
```

### Theme Provider Implementation

```typescript
// providers/ThemeProvider.tsx
import React, { createContext, useContext, useMemo, PropsWithChildren } from 'react'
import { theme, Theme } from '../theme'

interface ThemeContextValue {
  theme: Theme
  isDark: boolean
  setIsDark: (isDark: boolean) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: PropsWithChildren) {
  const [isDark, setIsDark] = React.useState(false)

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isDark,
      setIsDark,
    }),
    [isDark]
  )

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
```

### Responsive Hooks

```typescript
// hooks/useDimensions.ts
import { useEffect, useState } from "react";
import { Dimensions, ScaledSize } from "react-native";

export function useDimensions() {
  const [dimensions, setDimensions] = useState<ScaledSize>(
    Dimensions.get("window"),
  );

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  return {
    width: dimensions.width,
    height: dimensions.height,
    isMobile: dimensions.width < 480,
    isTablet: dimensions.width >= 480 && dimensions.width < 1024,
    isLargeScreen: dimensions.width >= 1024,
  };
}

// hooks/useOrientation.ts
import { useEffect, useState } from "react";
import { Dimensions } from "react-native";

type Orientation = "portrait" | "landscape";

export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>(
    Dimensions.get("window").height >= Dimensions.get("window").width
      ? "portrait"
      : "landscape",
  );

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setOrientation(window.height >= window.width ? "portrait" : "landscape");
    });

    return () => subscription?.remove();
  }, []);

  return orientation;
}
```

### Safe Area Configuration

```typescript
// providers/SafeAreaProvider.tsx
import React, { PropsWithChildren } from 'react'
import { SafeAreaProvider as RNSafeAreaProvider } from 'react-native-safe-area-context'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export function SafeAreaProvider({ children }: PropsWithChildren) {
  return (
    <RNSafeAreaProvider>
      {children}
    </RNSafeAreaProvider>
  )
}

export function useSafeArea() {
  return useSafeAreaInsets()
}
```

### UniWind Configuration

```javascript
// tailwind.config.js (for nativewind/uniwind)
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#fff5f9",
          600: "#FF3B6B",
          700: "#f02a5c",
        },
        secondary: {
          900: "#1A1A2E",
        },
        success: "#10B981",
        warning: "#F59E0B",
        error: "#EF4444",
        info: "#3B82F6",
      },
      fontFamily: {
        sans: ["SF Pro Display", "Roboto", "System"],
        mono: ["Menlo", "Roboto Mono"],
      },
      fontSize: {
        xs: "12px",
        sm: "14px",
        base: "16px",
        lg: "18px",
        xl: "20px",
        "2xl": "24px",
        "4xl": "32px",
      },
      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        8: "32px",
        10: "40px",
        12: "48px",
      },
    },
  },
  plugins: [],
};
```

### Platform-Specific Component Example

```typescript
// components/Button.tsx
import { View, Text, TouchableOpacity, Platform } from 'react-native'
import { useTheme } from '../hooks/useTheme'

interface ButtonProps {
  title: string
  variant?: 'primary' | 'secondary' | 'ghost'
  onPress: () => void
  disabled?: boolean
}

export function Button({
  title,
  variant = 'primary',
  onPress,
  disabled = false,
}: ButtonProps) {
  const { theme } = useTheme()

  const baseStyles = {
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  }

  const variants = {
    primary: {
      backgroundColor: theme.colors.primary[600],
      ...Platform.select({
        ios: { ...theme.shadows.md },
        android: { elevation: 5 },
      }),
    },
    secondary: {
      backgroundColor: theme.colors.secondary[900],
    },
    ghost: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.primary[600],
    },
  }

  const textColor =
    variant === 'ghost'
      ? theme.colors.primary[600]
      : theme.colors.accent.white

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        baseStyles,
        variants[variant],
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text
        style={{
          color: textColor,
          fontSize: theme.typography.fontSize.base,
          fontWeight: theme.typography.fontWeight.semibold,
        }}
      >
        {title}
      </Text>
    </TouchableOpacity>
  )
}
```

### Type Safety

```typescript
// types/theme.ts
import { theme } from "../theme";

export type Theme = typeof theme;
export type Colors = typeof theme.colors;
export type Typography = typeof theme.typography;
export type Spacing = typeof theme.spacing;

export type ColorKey = keyof Colors;
export type TypographyKey = keyof Typography;
export type SpacingKey = keyof Spacing;

export type PrimaryShades = keyof Colors["primary"];
export type SecondaryShades = keyof Colors["secondary"];
export type NeutralShades = keyof Colors["neutral"];
```

### Installation Steps

```bash
# From monorepo root
cd packages/ui-mobile

# Install nativewind (recommended for React Native 0.73+)
npm install nativewind@latest
npm install --save-dev tailwindcss

# Or use uniwind as alternative
npm install uniwind

# Install safe area context
npm install react-native-safe-area-context
```

### Testing Considerations

1. Test on iOS emulator with various safe areas (notch, Dynamic Island)
2. Test on Android emulator with various API levels (API 28+)
3. Test responsiveness across device sizes (iPhone SE, iPhone 14 Pro Max, iPad)
4. Verify platform-specific styling (iOS shadows vs Android elevation)
5. Test orientation changes (portrait to landscape)
6. Verify color accuracy across iOS and Android renderers
7. Performance test with large lists and theme switching
8. Memory profiling with theme re-renders

### Performance Optimization

- Memoize theme context to prevent unnecessary re-renders
- Use `React.memo()` for style-dependent components
- Batch theme updates
- Lazy load platform-specific modules
- Minimize shadow re-calculations

### Future Enhancements

- Dark mode support with theme switching
- Font loading optimization
- Dynamic type scaling (iOS accessibility)
- Theme customization API for multi-tenant
- Component library on top of foundation
