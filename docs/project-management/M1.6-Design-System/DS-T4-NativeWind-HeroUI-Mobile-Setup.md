# DS-T4 · NativeWind v5 + HeroUI Native Setup (Mobile)

| Field          | Value                                  |
| -------------- | -------------------------------------- |
| **Milestone**  | M1.6 — Design System & Shared Packages |
| **Status**     | 🔲 To Do                               |
| **Depends on** | M1-T4 (React Native + Expo scaffold)   |
| **PRD Ref**    | Section 10.1 (Tech Stack — Mobile App) |

---

## Description

Configure NativeWind v5 (Tailwind CSS for React Native) and HeroUI Native in `apps/native` with CeolX brand tokens. NativeWind brings Tailwind utility classes to React Native components. HeroUI Native provides pre-built accessible mobile components (Button, Input, Card, etc.) built on top of NativeWind. This must be set up before any mobile screen is built — retrofitting styles later is very disruptive.

---

## Affected Apps / Packages

| App / Package     | Role                                                             |
| ----------------- | ---------------------------------------------------------------- |
| `apps/native`     | NativeWind config, HeroUI Native components, global style tokens |
| `packages/shared` | Brand token constants (reused from DS-T1 for consistency)        |

---

## Requirements

### NativeWind v5 Configuration

- Install `nativewind@5.x` and `tailwindcss@4.x`
- Configure `babel.config.js` with `nativewind/babel` preset
- Configure `metro.config.js` with NativeWind metro transformer
- Create `global.css` with `@tailwind` directives and CeolX brand tokens
- Import `global.css` in root `_layout.tsx`

### CeolX Brand Tokens (Mobile)

Map the same brand palette from DS-T1 into NativeWind. Token names match the Figma design system exactly:

| Figma Token          | Hex                    | NativeWind class                |
| -------------------- | ---------------------- | ------------------------------- |
| blue-10 (Primary)    | `#662FFF`              | `bg-blue-10` / `text-blue-10`   |
| blue-1               | `rgba(102,47,255,0.1)` | `bg-blue-1`                     |
| green-10 (Secondary) | `#C8FF2F`              | `bg-green-10` / `text-green-10` |
| green-1              | `rgba(200,255,47,0.1)` | `bg-green-1`                    |
| gray-1               | `#F4F4F4`              | `bg-gray-1`                     |
| gray-5               | `#C6C6C6`              | `text-gray-5`                   |
| gray-10              | `#8D8D8D`              | `text-gray-10`                  |
| Surface              | `#363636`              | `bg-surface`                    |
| Near-black           | `#080808`              | `bg-surface-dark`               |
| Error                | `#EF4444`              | `text-error`                    |
| Warning              | `#F59E0B`              | `text-warning`                  |
| Success              | `#C8FF2F`              | `text-success` (= green-10)     |

### HeroUI Native Setup

- Install `@heroui/native` and its peer dependencies
- Wrap root layout with `HeroUIProvider`
- Configure theme with CeolX brand colours
- Verify components render correctly on iOS and Android simulators

### Platform-Specific Variants

NativeWind v5 supports platform variants — configure:

- `ios:` prefix for iOS-specific styles (e.g. safe area, blur effects)
- `android:` prefix for Android-specific styles (e.g. elevation)
- `dark:` prefix defined but not activated in V1

---

## Acceptance Criteria

- [ ] NativeWind v5 installed and Babel/Metro configured
- [ ] `className="bg-blue-10"` renders `#662FFF` on a React Native `<View>`
- [ ] `className="text-green-10"` renders `#C8FF2F` on a `<Text>` component
- [ ] `className="bg-surface"` renders `#363636` dark background
- [ ] HeroUI Native `<Button>` renders with CeolX purple (`#662FFF`) primary colour
- [ ] HeroUI Native `<Input>` renders and accepts text on iOS + Android
- [ ] Platform variants work: `ios:pt-12` adds top padding on iOS only
- [ ] No TypeScript errors for `className` prop on React Native components
- [ ] App compiles and runs on iOS Simulator and Android Emulator
- [ ] Urbanist font renders correctly on both platforms

---

## Dependencies

### Upstream

- M1-T4 (Expo scaffold with Expo Router — NativeWind integrates with Expo Router)

### Downstream

- DS-T5 (Shared mobile components use NativeWind classes and HeroUI primitives)
- All M2+ mobile screens — every screen uses Tailwind classes

---

## Technical Notes

### Installation

```bash
pnpm add nativewind@^5 tailwindcss@^4 --filter @ceolx/native
pnpm add @heroui/native --filter @ceolx/native
pnpm add -D babel-plugin-module-resolver --filter @ceolx/native
```

### Babel Config

```javascript
// apps/native/babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
```

### Metro Config

```javascript
// apps/native/metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
```

### Global CSS with CeolX Tokens

```css
/* apps/native/global.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@theme {
  /* Primary — Blue */
  --color-blue-1: rgba(102, 47, 255, 0.1);
  --color-blue-2: rgba(102, 47, 255, 0.2);
  --color-blue-3: rgba(102, 47, 255, 0.3);
  --color-blue-4: rgba(102, 47, 255, 0.4);
  --color-blue-5: rgba(102, 47, 255, 0.5);
  --color-blue-6: rgba(102, 47, 255, 0.6);
  --color-blue-7: rgba(102, 47, 255, 0.7);
  --color-blue-8: rgba(102, 47, 255, 0.8);
  --color-blue-9: rgba(102, 47, 255, 0.9);
  --color-blue-10: #662fff;

  /* Secondary — Green */
  --color-green-1: rgba(200, 255, 47, 0.1);
  --color-green-2: rgba(200, 255, 47, 0.2);
  --color-green-3: rgba(200, 255, 47, 0.3);
  --color-green-4: rgba(200, 255, 47, 0.4);
  --color-green-5: rgba(200, 255, 47, 0.5);
  --color-green-6: rgba(200, 255, 47, 0.6);
  --color-green-7: rgba(200, 255, 47, 0.7);
  --color-green-8: rgba(200, 255, 47, 0.8);
  --color-green-9: rgba(200, 255, 47, 0.9);
  --color-green-10: #c8ff2f;

  /* Tertiary — Gray */
  --color-gray-1: #f4f4f4;
  --color-gray-2: #e8e8e8;
  --color-gray-3: #dddddd;
  --color-gray-4: #d1d1d1;
  --color-gray-5: #c6c6c6;
  --color-gray-6: #bbbbbb;
  --color-gray-7: #afafaf;
  --color-gray-8: #a4a4a4;
  --color-gray-9: #989898;
  --color-gray-10: #8d8d8d;

  /* Surface */
  --color-surface: #363636;
  --color-surface-dark: #080808;

  /* Semantic */
  --color-error: #ef4444;
  --color-warning: #f59e0b;
  --color-success: #c8ff2f;

  /* Typography */
  --font-sans: 'Urbanist_400Regular', ui-sans-serif, system-ui;
}
```

### Root Layout

```tsx
// apps/native/app/_layout.tsx
import '../global.css';
import { HeroUIProvider } from '@heroui/native';

export default function RootLayout() {
  return (
    <HeroUIProvider>
      <Stack />
    </HeroUIProvider>
  );
}
```

### TypeScript Declaration

```typescript
// apps/native/nativewind-env.d.ts
/// <reference types="nativewind/types" />
```

---

## Common Gotchas

- **NativeWind v5 is a major rewrite from v4** — do not follow v4 tutorials. Use the official v5 docs.
- **Expo Router compatibility**: NativeWind v5 is designed for Expo Router v3+. Ensure Expo SDK 51+ is used.
- **`className` on custom components**: Custom components must pass `className` through to a native element. Use `cssInterop` from NativeWind to enable className on third-party components that don't natively support it.
- **Metro cache**: After any NativeWind config change, clear Metro cache: `npx expo start --clear`.
- **HeroUI Native ≠ HeroUI (web)**: HeroUI Native is the React Native version. Do not install the web version (`@heroui/react`) in the mobile app.
- **Urbanist font in Expo**: Use `expo-font` with `useFonts` — load `Urbanist_400Regular`, `Urbanist_600SemiBold`, `Urbanist_700Bold`. Install via `npx expo install @expo-google-fonts/urbanist expo-font`.
- **Opacity-based tokens on React Native**: NativeWind v5 supports `rgba()` in `@theme` for native. Verify on both iOS and Android as rendering of semi-transparent colors can differ.

---
