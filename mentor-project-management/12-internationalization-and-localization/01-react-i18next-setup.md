# Task: Configure React-i18next Across All Apps

## Description

Set up react-i18next library across all web and mobile applications to support EN, ES, FR, RU languages. This task establishes the core i18n infrastructure with proper language detection, initialization configuration, namespace loading, SSR support for Next.js, and React Native integration for mobile apps. This is the foundation for all subsequent i18n work.

## Affected Apps/Packages

- `packages/i18n` (shared locale configurations)
- `apps/web` (Next.js frontend)
- `apps/mobile` (React Native Expo app)
- `apps/admin` (Next.js super admin)
- `apps/instructor` (Next.js instructor dashboard)
- All supporting packages importing i18n

## Requirements

### Core Dependencies

- Install `i18next` (v23+), `react-i18next` (v13+), `i18next-browser-languagedetector` (v7+)
- Install `i18next-http-backend` for dynamic locale file loading
- Install `i18next-resources-to-backend` (for bundled locales)
- For mobile: `react-native-localize` for device locale detection
- For Next.js SSR: `next-i18next` (v14+)

### Initialization Strategy

1. **Web Apps (Next.js)**: Use `next-i18next` with shared locale backend
2. **Mobile App (React Native)**: Use native device locale detector with manual override
3. **Shared Configuration**: Centralized i18n config in `packages/i18n`

### Language Detection Hierarchy

**Web (Next.js):**

- Priority 1: URL pathname (/en/, /es/, /fr/, /ru/)
- Priority 2: User profile language preference (if authenticated)
- Priority 3: Accept-Language header
- Default: EN

**Mobile (React Native):**

- Priority 1: Stored user preference (AsyncStorage)
- Priority 2: Device locale
- Default: EN

### Namespace Structure

Namespaces to configure:

- `common` - General UI labels, buttons
- `auth` - Authentication-related strings
- `course` - Course content and browsing
- `mentor` - Mentor/content creation features
- `admin` - Super admin panel
- `notification` - Toast/notification messages

### SSR Considerations (Next.js)

- Locale detection before page render
- Locale available in `_app.tsx` getInitialProps
- Backend locale file loading for build-time compilation
- Hydration mismatch prevention (consistent locale on client/server)

### React Native Integration

- Async initialization on app launch
- Fallback locale handling
- Manual language selection persistence
- Hot reload support for development

## Acceptance Criteria

- [ ] `i18next` initialized with all 4 languages (EN, ES, FR, RU)
- [ ] Namespace configuration complete for 6 required namespaces
- [ ] Web: URL-based detection working (validate /en/, /es/, /fr/, /ru/ routing)
- [ ] Web: Fallback chain working (URL → user pref → header → EN)
- [ ] Mobile: Device locale detection working with manual override
- [ ] Mobile: Language preference persisted in AsyncStorage
- [ ] SSR: No hydration mismatches between server/client
- [ ] Locale files loadable dynamically via HTTP backend
- [ ] Language switching triggers i18n re-initialization without page reload
- [ ] Fallback to EN works when translation key missing

## Dependencies

- Locale JSON files created (Task: locale-files-scaffold.md)
- URL-based routing implemented (Task: url-based-locale-routing.md)
- Language switcher UI created (Task: language-switcher-ui.md)

## Technical Notes

### Web Setup (Next.js - next-i18next)

**packages/i18n/config.ts:**

```typescript
import { Config } from "next-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";

const config: Config = {
  i18n: {
    defaultLocale: "en",
    locales: ["en", "es", "fr", "ru"],
  },
  ns: ["common", "auth", "course", "mentor", "admin", "notification"],
  defaultNS: "common",
  detection: {
    order: ["path", "localStorage", "navigator"],
    caches: ["localStorage"],
  },
  backend: {
    loadPath: "/locales/{{lng}}/{{ns}}.json",
  },
  localePath: "./public/locales",
  returnNull: false, // Return key if translation missing
  returnEmptyString: false,
  fallbackLng: "en",
};

export default config;
```

**apps/web/next.config.js:**

```javascript
const { i18n } = require("./next-i18next.config");

module.exports = {
  i18n,
  // ... other config
};
```

**apps/web/next-i18next.config.js:**

```javascript
const path = require("path");

module.exports = {
  i18n: {
    defaultLocale: "en",
    locales: ["en", "es", "fr", "ru"],
  },
  localePath: path.resolve("./public/locales"),
  ns: ["common", "auth", "course", "mentor", "admin", "notification"],
  defaultNS: "common",
  backend: {
    loadPath: "/locales/{{lng}}/{{ns}}.json",
  },
};
```

**apps/web/pages/\_app.tsx:**

```typescript
import { appWithTranslation } from 'next-i18next';
import { AppProps } from 'next/app';

const MyApp = ({ Component, pageProps }: AppProps) => {
  return <Component {...pageProps} />;
};

export default appWithTranslation(MyApp);
```

### Mobile Setup (React Native - Expo)

**packages/i18n/mobile-config.ts:**

```typescript
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as RNLocalize from "react-native-localize";
import AsyncStorage from "@react-native-async-storage/async-storage";

const en = require("./locales/en.json");
const es = require("./locales/es.json");
const fr = require("./locales/fr.json");
const ru = require("./locales/ru.json");

const resources = { en, es, fr, ru };

const getInitialLanguage = async () => {
  const stored = await AsyncStorage.getItem("userLanguage");
  if (stored) return stored;

  const deviceLocale = RNLocalize.findBestAvailableLanguage([
    "en",
    "es",
    "fr",
    "ru",
  ]);
  return deviceLocale?.languageTag || "en";
};

export const initializeMobileI18n = async () => {
  const initialLang = await getInitialLanguage();

  await i18n.use(initReactI18next).init({
    resources,
    lng: initialLang,
    fallbackLng: "en",
    ns: ["common", "auth", "course", "mentor", "admin", "notification"],
    defaultNS: "common",
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

  return i18n;
};
```

**apps/mobile/App.tsx:**

```typescript
import { useEffect, useState } from 'react';
import { initializeMobileI18n } from '@packages/i18n';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initializeMobileI18n().then(() => setReady(true));
  }, []);

  if (!ready) return null;

  return <RootNavigator />;
}
```

### Namespace Loading Pattern

Structure in `packages/i18n/locales/`:

```
locales/
  en/
    common.json
    auth.json
    course.json
    mentor.json
    admin.json
    notification.json
  es/
    common.json
    auth.json
    ... (same structure)
  fr/
    ...
  ru/
    ...
```

### Language Switching Implementation

**hooks/useLanguage.ts:**

```typescript
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const useLanguage = () => {
  const { i18n } = useTranslation();
  const router = useRouter();
  const isWeb = typeof window !== "undefined";

  const changeLanguage = async (lang: "en" | "es" | "fr" | "ru") => {
    await i18n.changeLanguage(lang);

    if (isWeb) {
      // Web: Navigate to locale-prefixed URL
      const currentPath = router.asPath.replace(/^\/(en|es|fr|ru)/, "");
      router.push(`/${lang}${currentPath}`, undefined, { shallow: false });
    } else {
      // Mobile: Store preference
      await AsyncStorage.setItem("userLanguage", lang);
    }
  };

  return {
    currentLanguage: i18n.language,
    changeLanguage,
    availableLanguages: ["en", "es", "fr", "ru"],
  };
};
```

### Testing i18n Setup

****tests**/i18n.test.ts:**

```typescript
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

describe("i18n Configuration", () => {
  beforeAll(async () => {
    await i18n.use(initReactI18next).init({
      lng: "en",
      fallbackLng: "en",
      resources: {
        /* test resources */
      },
    });
  });

  test("initialized with all 4 languages", () => {
    expect(i18n.languages).toContain("en");
    expect(i18n.languages).toContain("es");
    expect(i18n.languages).toContain("fr");
    expect(i18n.languages).toContain("ru");
  });

  test("namespace loading works", async () => {
    const ns = i18n.loadNamespaces(["common", "auth", "course"]);
    await expect(ns).resolves.not.toThrow();
  });

  test("fallback to EN when translation missing", () => {
    const missing = i18n.t("nonexistent.key");
    expect(missing).toBe("nonexistent.key");
  });
});
```

### Hydration Safety for Next.js

Ensure consistent language on server and client:

**pages/\_document.tsx:**

```typescript
import { Html } from 'next/document';
import { useRouter } from 'next/router';

export default function Document() {
  const router = useRouter();
  const lang = router.locale || 'en';

  return (
    <Html lang={lang}>
      {/* ... */}
    </Html>
  );
}
```

### Environment Variables

**.env.local:**

```
NEXT_PUBLIC_I18N_FALLBACK_LANGUAGE=en
NEXT_PUBLIC_AVAILABLE_LANGUAGES=en,es,fr,ru
NEXT_PUBLIC_LOCALE_PATH=/locales
```

## Implementation Order

1. Install all dependencies across monorepo
2. Create shared i18n config in `packages/i18n`
3. Set up Next.js configuration with next-i18next
4. Set up React Native mobile initialization
5. Create locale file structure
6. Test language detection and switching
7. Verify SSR hydration correctness
8. Add language switching hooks
9. Update CI/CD to validate i18n config
10. Document i18n patterns for team
