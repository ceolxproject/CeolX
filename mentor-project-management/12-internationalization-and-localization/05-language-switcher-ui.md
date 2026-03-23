# Task: Build Language Switcher UI Component

## Description

Create a reusable language switcher component visible in settings and onboarding screens. Component must display all 4 supported languages with flag icons, allow language selection, persist preference to user profile via API, and handle different behaviors for web (URL-based) and mobile (preference-based) platforms.

## Affected Apps/Packages

- `packages/ui-components` (Language switcher component)
- `apps/web` (Settings, Onboarding)
- `apps/mobile` (Settings, Onboarding)
- `apps/admin` (Admin settings)
- `apps/instructor` (Instructor settings)

## Requirements

### Component Features

- Display all 4 languages: English, Español, Français, Русский
- Show flag icons for visual identification
- Dropdown/select component for space efficiency
- Clear indication of currently selected language
- Smooth language switch without page reload (web) or screen flicker (mobile)
- Loading state while preference is being saved
- Error handling with retry option

### Language Flags

- EN: 🇬🇧 (UK flag)
- ES: 🇪🇸 (Spain flag)
- FR: 🇫🇷 (France flag)
- RU: 🇷🇺 (Russia flag)

### Web Implementation

- Located in Settings > Language preference
- Located in Onboarding flow > Step 1
- On selection: Change URL locale prefix (/en/ → /es/)
- Update react-i18next language
- Save preference to user profile

### Mobile Implementation

- Located in Settings > Language preference
- Located in Onboarding flow > Step 1
- On selection: Update AsyncStorage preference
- Update react-i18next language
- Save preference to user profile via API
- No URL change (native app)

### API Integration

- PATCH `/api/users/me/preferences/language` to save selection
- Include locale code: `{ language: "es" }`
- Handle API errors gracefully
- Show toast notification on success/failure

### User Experience

- Instant visual feedback when selection changes
- No navigation interruption
- No page reload on web (use client-side routing)
- Accessibility: Proper labels and keyboard navigation
- Mobile-friendly: Touch-optimized, clear tap targets

## Acceptance Criteria

- [ ] Language switcher component created and reusable
- [ ] All 4 languages displayed with correct flag icons
- [ ] Dropdown shows current language selected
- [ ] Web: Language selection changes URL locale prefix
- [ ] Web: Language selection updates i18n without reload
- [ ] Mobile: Language selection updates preference in AsyncStorage
- [ ] Both platforms: API call saves preference to user profile
- [ ] Loading state visible while saving preference
- [ ] Error handling with retry option
- [ ] Success/error toast notifications displayed
- [ ] Keyboard navigation accessible on web
- [ ] Mobile touch targets meet accessibility guidelines
- [ ] Component works in Settings and Onboarding
- [ ] Analytics event fired on language change

## Dependencies

- React-i18next setup complete (Task: react-i18next-setup.md)
- URL-based locale routing implemented (Task: url-based-locale-routing.md)
- API user preferences endpoint available

## Technical Notes

### Language Switcher Component

**packages/ui-components/src/LanguageSwitcher/LanguageSwitcher.tsx:**

```typescript
import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocaleRouter } from '@hooks/useLocaleRouter';
import { useUpdateUserPreference } from '@hooks/useUpdateUserPreference';
import { Toast } from '../Toast';
import styles from './LanguageSwitcher.module.css';

interface Language {
  code: 'en' | 'es' | 'fr' | 'ru';
  label: string;
  flag: string;
  nativeName: string;
}

const LANGUAGES: Language[] = [
  { code: 'en', label: 'English', flag: '🇬🇧', nativeName: 'English' },
  { code: 'es', label: 'Español', flag: '🇪🇸', nativeName: 'Español' },
  { code: 'fr', label: 'Français', flag: '🇫🇷', nativeName: 'Français' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺', nativeName: 'Русский' },
];

interface LanguageSwitcherProps {
  onLanguageChange?: (locale: string) => void;
  className?: string;
  variant?: 'dropdown' | 'button-group' | 'radio';
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  onLanguageChange,
  className = '',
  variant = 'dropdown',
}) => {
  const { i18n } = useTranslation();
  const { changeLocale } = useLocaleRouter();
  const { updatePreference } = useUpdateUserPreference();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const currentLanguage = (i18n.language || 'en') as 'en' | 'es' | 'fr' | 'ru';

  const handleLanguageChange = useCallback(
    async (locale: string) => {
      const newLocale = locale as 'en' | 'es' | 'fr' | 'ru';

      if (newLocale === currentLanguage) return;

      setIsLoading(true);
      setError(null);

      try {
        // Update language in i18n
        await i18n.changeLanguage(newLocale);

        // Update URL/navigation (web) or AsyncStorage (mobile)
        await changeLocale(newLocale);

        // Save preference to API
        try {
          await updatePreference('language', newLocale);
        } catch (apiError) {
          console.warn('Failed to save language preference to API', apiError);
          // Don't fail the UX, just warn
        }

        // Call callback if provided
        if (onLanguageChange) {
          onLanguageChange(newLocale);
        }

        // Show success toast
        const selectedLanguage = LANGUAGES.find(l => l.code === newLocale);
        setToastMessage(`Language changed to ${selectedLanguage?.label}`);
        setToastType('success');
        setShowToast(true);

        // Track analytics
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'language_changed', {
            language: newLocale,
          });
        }
      } catch (err) {
        console.error('Error changing language:', err);
        setError(`Failed to change language. Please try again.`);
        setToastMessage('Failed to change language');
        setToastType('error');
        setShowToast(true);
      } finally {
        setIsLoading(false);
      }
    },
    [currentLanguage, i18n, changeLocale, updatePreference, onLanguageChange]
  );

  const handleRetry = useCallback(() => {
    if (error) {
      setError(null);
      handleLanguageChange(currentLanguage);
    }
  }, [error, currentLanguage, handleLanguageChange]);

  if (variant === 'dropdown') {
    return (
      <>
        <div className={`${styles.container} ${className}`}>
          <label htmlFor="language-select" className={styles.label}>
            Language / Idioma / Langue / Язык
          </label>
          <div className={styles.selectWrapper}>
            <select
              id="language-select"
              value={currentLanguage}
              onChange={(e) => handleLanguageChange(e.target.value)}
              disabled={isLoading}
              className={styles.select}
              aria-label="Select language"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.label}
                </option>
              ))}
            </select>
            {isLoading && <span className={styles.loadingSpinner} />}
          </div>
          {error && (
            <div className={styles.error}>
              {error}
              <button onClick={handleRetry} className={styles.retryButton}>
                Retry
              </button>
            </div>
          )}
        </div>

        {showToast && (
          <Toast
            message={toastMessage}
            type={toastType}
            onClose={() => setShowToast(false)}
            autoClose={3000}
          />
        )}
      </>
    );
  }

  if (variant === 'button-group') {
    return (
      <>
        <div className={`${styles.buttonGroup} ${className}`}>
          <label className={styles.label}>Language</label>
          <div className={styles.buttons}>
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                disabled={isLoading}
                className={`${styles.button} ${
                  currentLanguage === lang.code ? styles.active : ''
                }`}
                aria-label={`Select ${lang.label}`}
                aria-pressed={currentLanguage === lang.code}
              >
                <span className={styles.flag}>{lang.flag}</span>
                <span className={styles.buttonLabel}>{lang.nativeName}</span>
              </button>
            ))}
          </div>
          {isLoading && <span className={styles.loadingText}>Updating...</span>}
          {error && (
            <div className={styles.error}>
              {error}
              <button onClick={handleRetry} className={styles.retryButton}>
                Retry
              </button>
            </div>
          )}
        </div>

        {showToast && (
          <Toast
            message={toastMessage}
            type={toastType}
            onClose={() => setShowToast(false)}
            autoClose={3000}
          />
        )}
      </>
    );
  }

  if (variant === 'radio') {
    return (
      <>
        <fieldset className={`${styles.radioGroup} ${className}`}>
          <legend className={styles.label}>Language</legend>
          <div className={styles.radioOptions}>
            {LANGUAGES.map((lang) => (
              <div key={lang.code} className={styles.radioOption}>
                <input
                  type="radio"
                  id={`language-${lang.code}`}
                  name="language"
                  value={lang.code}
                  checked={currentLanguage === lang.code}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  disabled={isLoading}
                  aria-label={lang.label}
                />
                <label htmlFor={`language-${lang.code}`} className={styles.radioLabel}>
                  <span className={styles.flag}>{lang.flag}</span>
                  <span>{lang.label}</span>
                </label>
              </div>
            ))}
          </div>
          {isLoading && <span className={styles.loadingText}>Updating...</span>}
          {error && (
            <div className={styles.error}>
              {error}
              <button onClick={handleRetry} className={styles.retryButton}>
                Retry
              </button>
            </div>
          )}
        </fieldset>

        {showToast && (
          <Toast
            message={toastMessage}
            type={toastType}
            onClose={() => setShowToast(false)}
            autoClose={3000}
          />
        )}
      </>
    );
  }

  return null;
};

export default LanguageSwitcher;
```

### Styling

**packages/ui-components/src/LanguageSwitcher/LanguageSwitcher.module.css:**

```css
.container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #333;
}

.selectWrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.select {
  appearance: none;
  width: 100%;
  padding: 0.75rem 2.5rem 0.75rem 1rem;
  font-size: 1rem;
  border: 1px solid #ddd;
  border-radius: 0.375rem;
  background-color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.select:hover:not(:disabled) {
  border-color: #999;
}

.select:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loadingSpinner {
  position: absolute;
  right: 0.75rem;
  width: 1rem;
  height: 1rem;
  border: 2px solid #f3f4f6;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error {
  padding: 0.75rem;
  background-color: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #7f1d1d;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.retryButton {
  background: none;
  border: none;
  color: #7f1d1d;
  text-decoration: underline;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0;
}

.retryButton:hover {
  text-decoration: none;
}

/* Button Group Variant */
.buttonGroup {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 0.5rem;
}

.button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 2px solid #ddd;
  border-radius: 0.375rem;
  background-color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.button:hover:not(:disabled) {
  border-color: #999;
  background-color: #f9fafb;
}

.button.active {
  border-color: #6366f1;
  background-color: #eef2ff;
}

.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.flag {
  font-size: 1.5rem;
}

.buttonLabel {
  font-size: 0.75rem;
  font-weight: 500;
  text-align: center;
}

.loadingText {
  font-size: 0.875rem;
  color: #6366f1;
}

/* Radio Group Variant */
.radioGroup {
  border: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.radioOptions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.radioOption {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.radioOption input[type="radio"] {
  cursor: pointer;
}

.radioLabel {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

/* Mobile Responsive */
@media (max-width: 640px) {
  .buttons {
    grid-template-columns: repeat(2, 1fr);
  }

  .button {
    padding: 0.5rem;
  }

  .buttonLabel {
    font-size: 0.7rem;
  }
}
```

### Hook: useUpdateUserPreference

**hooks/useUpdateUserPreference.ts:**

```typescript
import { useCallback } from "react";
import { useAuth } from "@context/AuthContext";

interface PreferenceData {
  language?: string;
  theme?: "light" | "dark";
  timezone?: string;
  [key: string]: any;
}

export const useUpdateUserPreference = () => {
  const { user, token } = useAuth();

  const updatePreference = useCallback(
    async (key: string, value: any) => {
      if (!user || !token) {
        throw new Error("User not authenticated");
      }

      const response = await fetch("/api/users/me/preferences", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update preference");
      }

      return response.json();
    },
    [user, token]
  );

  return { updatePreference };
};
```

### Integration in Settings Page

**apps/web/pages/[locale]/settings/index.tsx:**

```typescript
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@packages/ui-components';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export default function SettingsPage() {
  const { t } = useTranslation('common');

  return (
    <div>
      <h1>{t('nav.settings')}</h1>

      <section>
        <h2>Language Preferences</h2>
        <LanguageSwitcher variant="button-group" />
      </section>
    </div>
  );
}

export async function getStaticProps({ locale }: { locale: string }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common'])),
    },
  };
}

export async function getStaticPaths() {
  return {
    paths: [
      { params: { locale: 'en' } },
      { params: { locale: 'es' } },
      { params: { locale: 'fr' } },
      { params: { locale: 'ru' } },
    ],
    fallback: 'blocking',
  };
}
```

### Integration in Onboarding Flow

**apps/web/components/Onboarding/Step1.tsx:**

```typescript
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@packages/ui-components';

interface Step1Props {
  onNext: () => void;
}

export const OnboardingStep1: React.FC<Step1Props> = ({ onNext }) => {
  const { t } = useTranslation('common');

  return (
    <div className="onboarding-step">
      <h1>{t('onboarding.welcome')}</h1>
      <p>{t('onboarding.selectLanguage')}</p>

      <LanguageSwitcher
        variant="button-group"
        onLanguageChange={() => {
          // Auto-advance to next step after language selection
          setTimeout(onNext, 500);
        }}
      />
    </div>
  );
};
```

### Mobile Implementation

**apps/mobile/screens/SettingsScreen.tsx:**

```typescript
import { useTranslation } from 'react-i18next';
import { View, ScrollView } from 'react-native';
import { LanguageSwitcher } from '@packages/ui-components';

export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation('common');

  return (
    <ScrollView>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 16 }}>
          {t('nav.settings')}
        </Text>

        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
            Language Preferences
          </Text>
          <LanguageSwitcher variant="button-group" />
        </View>
      </View>
    </ScrollView>
  );
};
```

### API Endpoint

**pages/api/users/me/preferences.ts:**

```typescript
import { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@lib/auth";
import { db } from "@lib/database";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "PATCH") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const user = await getAuth(req);
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { language, theme, timezone } = req.body;
    const updates: any = {};

    if (language) {
      if (!["en", "es", "fr", "ru"].includes(language)) {
        return res.status(400).json({ message: "Invalid language" });
      }
      updates.language = language;
    }

    if (theme) {
      updates.theme = theme;
    }

    if (timezone) {
      updates.timezone = timezone;
    }

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: { preferences: updates },
    });

    return res.status(200).json({
      message: "Preferences updated",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Preferences update error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
```

## Implementation Order

1. Create LanguageSwitcher component in packages/ui-components
2. Create useUpdateUserPreference hook
3. Create useLocaleRouter hook
4. Create CSS module for component styling
5. Integrate into Settings page for web
6. Integrate into Onboarding flow for web
7. Test web language switching (URL change, i18n update)
8. Adapt component for mobile (React Native)
9. Integrate into mobile Settings screen
10. Integrate into mobile Onboarding flow
11. Create API endpoint for preference storage
12. Test API integration and error handling
13. Add analytics event tracking
14. Test accessibility (keyboard nav, screen readers)
15. Add unit and integration tests
