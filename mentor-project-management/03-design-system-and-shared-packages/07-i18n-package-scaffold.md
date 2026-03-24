# Internationalization (i18n) Package Scaffold

## Description

Set up `packages/i18n` with react-i18next configuration for multi-language support across all web and mobile apps. Create JSON locale files for English (EN), Spanish (ES), French (FR), and Russian (RU) with comprehensive key structure organized by namespace (common, auth, course, mentor, admin, notification). Establish language detection and fallback chain. Provide developer-friendly tools for adding/managing translations throughout the monorepo.

## Affected Apps/Packages

- `packages/i18n` - Internationalization configuration
- `apps/web` - Multi-language support
- `apps/admin` - Multi-language support
- `apps/instructor` - Multi-language support
- `apps/mobile-ios` - Multi-language support
- `apps/mobile-android` - Multi-language support
- Backend API - Optional: language content delivery

## Requirements

### Language Support

- **English (EN)** - Default/primary language with complete translations
- **Spanish (ES)** - Placeholder keys for future translation
- **French (FR)** - Placeholder keys for future translation
- **Russian (RU)** - Placeholder keys for future translation
- Language detection: browser locale preference, URL parameter, manual selection
- Fallback chain: Selected language → English → Default language

### Configuration Setup

- react-i18next v12.x+ with React 18 support
- Backend plugin for lazy-loading namespaces
- Language detection plugin (automatic user preference detection)
- Load resources from JSON files (`locales/` directory)
- Support for pluralization rules per language
- Support for interpolation and nested keys

### Namespace Structure

All keys organized into namespaces for code splitting and maintainability:

1. **common** - Shared UI text
   - Buttons: OK, Cancel, Save, Delete, Submit, Back, Next
   - Validation messages
   - Error states, loading states, empty states
   - Date/time formats
   - Common labels (name, email, password, etc.)

2. **auth** - Authentication flows
   - Registration form labels and validation
   - Login form labels
   - Password reset flows
   - Email verification messages
   - 2FA instructions
   - Error messages specific to auth

3. **course** - Course and learning content
   - Course titles, descriptions, metadata
   - Module and lesson names
   - Progress tracking labels
   - Enrollment messages
   - Certificate text
   - Quiz/assessment labels

4. **mentor** - Mentorship features
   - Mentor request form labels
   - Availability options
   - Meeting scheduling labels
   - Message history
   - Recommendation text

5. **admin** - Admin panel specific
   - Dashboard labels
   - User management
   - Course moderation
   - Analytics labels
   - System settings

6. **notification** - Push notifications and alerts
   - Toast messages
   - Email templates
   - Alert titles and descriptions
   - Notification preferences

### Locale File Structure

```
locales/
├── en/
│   ├── common.json
│   ├── auth.json
│   ├── course.json
│   ├── mentor.json
│   ├── admin.json
│   └── notification.json
├── es/
│   ├── common.json (placeholders)
│   └── ...
├── fr/
│   ├── common.json (placeholders)
│   └── ...
└── ru/
    ├── common.json (placeholders)
    └── ...
```

### Features

- Namespace code splitting (lazy load on demand)
- Interpolation support for dynamic values: `Hello {{name}}`
- Pluralization support with rules per language
- Formatting support: dates, currency (EUR), numbers
- Context-specific translations
- HTML content support with caution (XSS prevention)
- Translation management helpers for development

## Acceptance Criteria

- [x] `packages/i18n` created with proper TypeScript configuration
- [x] react-i18next v12+ installed and configured
- [x] Language detection plugin configured (auto-detect from browser/URL)
- [x] EN locale files created with complete translations (all namespaces)
- [x] ES locale files created with structure and placeholder values
- [x] FR locale files created with structure and placeholder values
- [x] RU locale files created with structure and placeholder values
- [x] i18n instance initialized with fallback language chain (EN as base)
- [x] Namespace structure implemented: common, auth, course, mentor, admin, notification
- [x] Common namespace with 50+ shared UI strings
- [x] Auth namespace with registration, login, password reset flows (30+ strings)
- [x] Course namespace with course/module/lesson content (40+ strings)
- [x] Mentor namespace with mentorship features (20+ strings)
- [x] Admin namespace with dashboard and management (30+ strings)
- [x] Notification namespace with toast and alert messages (20+ strings)
- [x] Interpolation working for dynamic values (e.g., greeting with user name)
- [x] Pluralization rules implemented for all languages
- [x] Date formatting working with locale-specific formats
- [x] Currency formatting (EUR) with locale-specific separators
- [x] Lazy loading namespaces working (code splitting)
- [x] useTranslation() hook exported and typed
- [x] i18n provider component for app wrapping
- [x] Language switching mechanism (change language + persist to localStorage)
- [x] TypeScript types for all translation keys (type-safe t() function)
- [x] Missing translation warnings in development
- [x] Extraction script for collecting all translation keys
- [x] Testing translations with different languages
- [x] Documentation for adding new translation keys
- [x] RTL language support placeholder for future (Hebrew, Arabic)
- [x] Build passes with no warnings or errors
- [x] Performance: Language switching < 500ms

## Dependencies

- `react-i18next@^13.x` - React binding for i18next
- `i18next@^23.x` - Internationalization framework
- `i18next-browser-languagedetector` - Auto language detection
- `i18next-backend` - Backend resource loading
- `i18next-http-middleware` - Optional: backend support
- TypeScript 5.x
- `date-fns` - For locale-aware date formatting

## Technical Notes

### Project Structure

```
packages/i18n/
├── locales/
│   ├── en/
│   │   ├── common.json      # Shared UI text
│   │   ├── auth.json        # Auth flows
│   │   ├── course.json      # Course content
│   │   ├── mentor.json      # Mentorship
│   │   ├── admin.json       # Admin panel
│   │   └── notification.json # Notifications
│   ├── es/
│   │   ├── common.json      # Placeholders
│   │   └── ...
│   ├── fr/
│   │   ├── common.json      # Placeholders
│   │   └── ...
│   └── ru/
│       ├── common.json      # Placeholders
│       └── ...
├── src/
│   ├── config.ts            # i18next configuration
│   ├── i18n.ts              # i18n instance initialization
│   ├── hooks.ts             # useTranslation hook with types
│   ├── utils.ts             # Formatting helpers
│   ├── types.ts             # TypeScript type definitions
│   └── index.ts             # Main export
├── scripts/
│   ├── extract-keys.ts      # Extract all translation keys
│   └── validate-translations.ts # Verify all languages complete
├── tsconfig.json
├── package.json
└── README.md
```

### Configuration Example

```typescript
// src/config.ts
import type { InitOptions } from "i18next";
import enCommon from "../locales/en/common.json";
import enAuth from "../locales/en/auth.json";
import enCourse from "../locales/en/course.json";
import enMentor from "../locales/en/mentor.json";
import enAdmin from "../locales/en/admin.json";
import enNotification from "../locales/en/notification.json";

export const i18nConfig: InitOptions = {
  // Fallback language
  fallbackLng: "en",

  // Languages to load
  supportedLngs: ["en", "es", "fr", "ru"],

  // Default namespace
  defaultNS: "common",

  // Namespaces to load by default
  ns: ["common"],

  // Resources for preloading
  resources: {
    en: {
      common: enCommon,
      auth: enAuth,
      course: enCourse,
      mentor: enMentor,
      admin: enAdmin,
      notification: enNotification,
    },
  },

  // Interpolation settings
  interpolation: {
    escapeValue: false, // React already escapes values
    formatSeparator: ",",
    format: (value, format) => {
      if (format === "uppercase") {
        return String(value).toUpperCase();
      }
      if (format === "lowercase") {
        return String(value).toLowerCase();
      }
      return value;
    },
  },

  // Pluralization
  pluralSeparator: "_",
  pluralRules: {
    en: (n) => (n === 1 ? "one" : "other"),
    es: (n) => (n === 1 ? "one" : "other"),
    fr: (n) => (n === 0 || n === 1 ? "one" : "other"),
    ru: (n) => {
      if (n % 10 === 1 && n % 100 !== 11) return "one";
      if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20))
        return "few";
      return "other";
    },
  },

  // Development
  debug: false,
  saveMissing: true,
  missingInterpolationHandler: (text, value) => {
    console.warn(`Missing interpolation value for: ${text}`, value);
    return text;
  },
  missingKeyHandler: (lng, ns, key) => {
    console.warn(`Missing translation key: ${ns}:${key}`);
    return key;
  },

  // Backend configuration (for lazy loading)
  backend: {
    loadPath: "/locales/{{lng}}/{{ns}}.json",
  },

  // Load namespaces on demand
  load: "all",
  ns: ["common"],
  defaultNS: "common",
};
```

### i18n Instance Initialization

```typescript
// src/i18n.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { i18nConfig } from "./config";

// Initialize i18next
i18n
  .use(LanguageDetector) // Detect language from browser
  .use(initReactI18next) // Pass i18n instance to react-i18next
  .init(i18nConfig);

export default i18n;
```

### Hooks with TypeScript Support

```typescript
// src/hooks.ts
import {
  useTranslation as useTranslationBase,
  UseTranslationResponse,
} from "react-i18next";
import type { Namespace } from "i18next";

/**
 * Type-safe useTranslation hook with proper namespace typing
 */
export function useTranslation(ns?: Namespace) {
  return useTranslationBase(ns);
}

/**
 * Hook for specific namespace with default fallback to common
 */
export function useCommonTranslation() {
  return useTranslationBase("common");
}

export function useAuthTranslation() {
  return useTranslationBase("auth");
}

export function useCourseTranslation() {
  return useTranslationBase("course");
}

export function useMentorTranslation() {
  return useTranslationBase("mentor");
}

export function useAdminTranslation() {
  return useTranslationBase("admin");
}

export function useNotificationTranslation() {
  return useTranslationBase("notification");
}
```

### English Common Namespace Example

```json
{
  "buttons": {
    "ok": "OK",
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete",
    "submit": "Submit",
    "back": "Back",
    "next": "Next",
    "search": "Search",
    "filter": "Filter",
    "sort": "Sort",
    "edit": "Edit",
    "view": "View",
    "download": "Download",
    "upload": "Upload",
    "close": "Close",
    "clear": "Clear",
    "reset": "Reset",
    "apply": "Apply",
    "confirm": "Confirm",
    "tryAgain": "Try Again"
  },
  "validation": {
    "required": "This field is required",
    "email": "Please enter a valid email address",
    "password": "Password must be at least 8 characters",
    "passwordMatch": "Passwords do not match",
    "minLength": "Minimum length is {{min}} characters",
    "maxLength": "Maximum length is {{max}} characters",
    "invalidFormat": "Invalid format",
    "fileSize": "File size must be less than {{max}}MB",
    "invalidFileType": "Invalid file type"
  },
  "states": {
    "loading": "Loading...",
    "empty": "No data available",
    "error": "An error occurred",
    "success": "Success",
    "warning": "Warning",
    "info": "Information"
  },
  "pagination": {
    "previous": "Previous",
    "next": "Next",
    "page": "Page {{current}} of {{total}}",
    "showing": "Showing {{from}} to {{to}} of {{total}} results"
  },
  "labels": {
    "name": "Name",
    "email": "Email",
    "password": "Password",
    "confirmPassword": "Confirm Password",
    "firstName": "First Name",
    "lastName": "Last Name",
    "phone": "Phone",
    "address": "Address",
    "city": "City",
    "country": "Country",
    "language": "Language",
    "timezone": "Timezone",
    "avatar": "Avatar",
    "bio": "Bio",
    "website": "Website"
  },
  "months": {
    "january": "January",
    "february": "February",
    "march": "March",
    "april": "April",
    "may": "May",
    "june": "June",
    "july": "July",
    "august": "August",
    "september": "September",
    "october": "October",
    "november": "November",
    "december": "December"
  },
  "days": {
    "monday": "Monday",
    "tuesday": "Tuesday",
    "wednesday": "Wednesday",
    "thursday": "Thursday",
    "friday": "Friday",
    "saturday": "Saturday",
    "sunday": "Sunday"
  },
  "time": {
    "justNow": "Just now",
    "minutesAgo": "{{count}} minute ago",
    "minutesAgo_plural": "{{count}} minutes ago",
    "hoursAgo": "{{count}} hour ago",
    "hoursAgo_plural": "{{count}} hours ago",
    "daysAgo": "{{count}} day ago",
    "daysAgo_plural": "{{count}} days ago",
    "monthsAgo": "{{count}} month ago",
    "monthsAgo_plural": "{{count}} months ago"
  }
}
```

### English Auth Namespace Example

```json
{
  "registration": {
    "title": "Create Account",
    "subtitle": "Join Mentor to start learning",
    "firstName": "First Name",
    "lastName": "Last Name",
    "email": "Email Address",
    "password": "Password",
    "confirmPassword": "Confirm Password",
    "selectRole": "I want to",
    "student": "Learn new skills",
    "instructor": "Teach courses",
    "termsCheckbox": "I accept the Terms and Conditions",
    "privacyCheckbox": "I agree to the Privacy Policy",
    "newsletter": "Send me updates about new courses",
    "button": "Create Account",
    "link": "Already have an account? Sign in",
    "emailSent": "Verification email sent to {{email}}",
    "checkEmail": "Please check your email to verify your account"
  },
  "login": {
    "title": "Sign In",
    "subtitle": "Welcome back to Mentor",
    "email": "Email Address",
    "password": "Password",
    "rememberMe": "Remember me",
    "forgotPassword": "Forgot password?",
    "button": "Sign In",
    "link": "Don't have an account? Sign up",
    "invalidCredentials": "Invalid email or password",
    "accountLocked": "Your account has been locked",
    "verifyEmail": "Please verify your email first"
  },
  "passwordReset": {
    "title": "Reset Password",
    "subtitle": "Enter your email to receive reset instructions",
    "email": "Email Address",
    "button": "Send Reset Link",
    "sent": "Check your email for password reset instructions",
    "newPassword": "New Password",
    "confirmPassword": "Confirm Password",
    "resetButton": "Reset Password",
    "success": "Password has been reset successfully"
  },
  "emailVerification": {
    "title": "Verify Email",
    "subtitle": "Enter the code sent to {{email}}",
    "code": "Verification Code",
    "button": "Verify",
    "resend": "Resend code",
    "expiredCode": "Verification code has expired",
    "invalidCode": "Invalid verification code",
    "success": "Email verified successfully"
  },
  "errors": {
    "emailRequired": "Email is required",
    "invalidEmail": "Please enter a valid email",
    "passwordRequired": "Password is required",
    "passwordTooShort": "Password must be at least 8 characters",
    "passwordNoUppercase": "Password must contain uppercase letter",
    "passwordNoNumber": "Password must contain number",
    "passwordNoSpecial": "Password must contain special character",
    "passwordsMismatch": "Passwords do not match",
    "emailExists": "Email already registered",
    "nameRequired": "Name is required"
  }
}
```

### Formatting Utilities

```typescript
// src/utils.ts
import { format, parseISO } from "date-fns";
import { enUS, es, fr, ru } from "date-fns/locale";

type DateLocale = typeof enUS;

const localeMap: Record<string, DateLocale> = {
  en: enUS,
  es: es,
  fr: fr,
  ru: ru,
};

/**
 * Format date with locale-aware formatting
 */
export function formatDate(
  date: Date | string,
  formatStr: string = "PPP",
  locale: string = "en",
): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  const dateLocale = localeMap[locale] || enUS;
  return format(dateObj, formatStr, { locale: dateLocale });
}

/**
 * Format currency (EUR)
 */
export function formatEUR(amount: number, locale: string = "en"): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : locale, {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

/**
 * Format number with locale-specific separators
 */
export function formatNumber(
  num: number,
  locale: string = "en",
  decimals: number = 0,
): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(
  date: Date | string,
  locale: string = "en",
): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat(locale === "en" ? "en-US" : locale, {
    numeric: "auto",
  });

  if (diffSecs < 60) return rtf.format(-diffSecs, "second");
  if (diffMins < 60) return rtf.format(-diffMins, "minute");
  if (diffHours < 24) return rtf.format(-diffHours, "hour");
  return rtf.format(-diffDays, "day");
}
```

### Provider Component

```typescript
// src/Provider.tsx
import React, { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n from './i18n'

interface I18nProviderProps {
  children: React.ReactNode
}

export function I18nProvider({ children }: I18nProviderProps) {
  return (
    <Suspense fallback={<div>Loading translations...</div>}>
      <I18nextProvider i18n={i18n}>
        {children}
      </I18nextProvider>
    </Suspense>
  )
}
```

### Language Switcher Hook

```typescript
// src/useLanguage.ts
import { useEffect } from "react";
import { useTranslation } from "./hooks";

export function useLanguage() {
  const { i18n } = useTranslation();

  useEffect(() => {
    // Store language preference in localStorage
    localStorage.setItem("language", i18n.language);
    // Update HTML lang attribute
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return {
    currentLanguage: i18n.language,
    availableLanguages: i18n.languages,
    changeLanguage: (lang: string) => i18n.changeLanguage(lang),
  };
}
```

### Key Extraction Script

```typescript
// scripts/extract-keys.ts
import fs from "fs";
import path from "path";

const localesDir = path.join(__dirname, "../locales");

function extractKeys(obj: any, prefix = ""): string[] {
  const keys: string[] = [];

  for (const key in obj) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === "object" && !Array.isArray(obj[key])) {
      keys.push(...extractKeys(obj[key], newKey));
    } else {
      keys.push(newKey);
    }
  }

  return keys;
}

// Extract all keys from EN locale
const enCommon = JSON.parse(
  fs.readFileSync(path.join(localesDir, "en", "common.json"), "utf-8"),
);

const allKeys = extractKeys(enCommon);
console.log(`Total translation keys: ${allKeys.length}`);
console.log("Sample keys:", allKeys.slice(0, 10));
```

### Testing Translations

```typescript
// src/__tests__/i18n.test.ts
import i18n from "../i18n";

describe("i18n Configuration", () => {
  it("should have all supported languages", () => {
    expect(i18n.options.supportedLngs).toContain("en");
    expect(i18n.options.supportedLngs).toContain("es");
    expect(i18n.options.supportedLngs).toContain("fr");
    expect(i18n.options.supportedLngs).toContain("ru");
  });

  it("should have English as fallback", () => {
    expect(i18n.options.fallbackLng).toBe("en");
  });

  it("should load all namespaces", async () => {
    const namespaces = [
      "common",
      "auth",
      "course",
      "mentor",
      "admin",
      "notification",
    ];
    for (const ns of namespaces) {
      const loaded = i18n.hasResourceBundle("en", ns);
      expect(loaded).toBe(true);
    }
  });

  it("should translate keys", async () => {
    const translated = i18n.t("buttons.ok");
    expect(translated).toBe("OK");
  });
});
```

### Usage in Components

```typescript
// Example component
import { useCommonTranslation, useCourseTranslation } from '@mentor/i18n'

export function CourseCard() {
  const { t } = useCourseTranslation()
  const { t: tCommon } = useCommonTranslation()

  return (
    <div>
      <h2>{t('courseTitle')}</h2>
      <button>{tCommon('buttons.save')}</button>
    </div>
  )
}
```

### Performance Optimization

- Lazy load namespaces on demand (load only when used)
- Cache compiled translations
- Minimize bundle size with tree-shaking
- Use code splitting for each locale file

### Future Enhancements

- RTL language support (Hebrew, Arabic)
- Content Management System (CMS) for translation management
- Translation collaboration tools
- Automatic extraction of untranslated keys
- Build warnings for missing translations
- Context-specific translations for different user roles
