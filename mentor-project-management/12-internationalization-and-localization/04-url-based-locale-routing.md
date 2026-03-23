# Task: Implement URL-Based Locale Routing for Next.js

## Description

Configure Next.js to support URL-based locale routing with /en/, /es/, /fr/, /ru/ prefixes for all web apps. Implement Next.js middleware for automatic locale detection and redirect, default locale handling, SEO hreflang tags, locale-specific sitemaps, and preserve locale across navigation. This enables language selection via URL for better SEO and deeplink sharing.

## Affected Apps/Packages

- `apps/web` (main platform)
- `apps/admin` (admin panel)
- `apps/instructor` (instructor dashboard)
- `packages/i18n` (shared locale utilities)

## Requirements

### Routing Structure

All routes must be prefixed with locale:

- `/en/courses` - English
- `/es/courses` - Spanish
- `/fr/courses` - French
- `/ru/courses` - Russian

Without locale prefix, user is redirected to default locale (EN) or their preference.

### Middleware Implementation

- Detect locale from URL pathname
- Redirect `/courses` → `/en/courses` (default)
- Redirect to user's preferred language if authenticated
- Respect Accept-Language header as fallback
- Extract locale and pass to app context

### Default Locale Handling

- First visit: Redirect to EN (or user pref if logged in)
- Subsequent visits: Preserve selected locale in localStorage
- Authenticated users: Use profile language setting

### SEO Requirements

- hreflang tags for all 4 language versions on every page
- Locale-specific sitemap: `/sitemap.xml`, `/sitemap-es.xml`, `/sitemap-fr.xml`, `/sitemap-ru.xml`
- Alternate links in HTML head
- Structured data with language meta tags
- No duplicate content penalties

### Navigation Preservation

- Language switch doesn't navigate away
- Back button preserves locale
- Deep links preserve language (e.g., `/es/courses/123` stays Spanish)
- Social sharing preserves locale in shared URLs

## Acceptance Criteria

- [ ] All routes support /en/, /es/, /fr/, /ru/ prefixes
- [ ] Middleware redirects non-prefixed URLs to default locale
- [ ] Authenticated users redirected to their preferred language
- [ ] Accept-Language header fallback working
- [ ] hreflang tags present on all pages for all 4 languages
- [ ] Locale-specific sitemaps generated and valid
- [ ] LocalizedLink component preserves locale on navigation
- [ ] Language switching via URL works without page reload (client-side)
- [ ] Deep links work correctly (preserve locale)
- [ ] Social shares include correct language in URL
- [ ] No hydration issues between server/client

## Dependencies

- React-i18next setup complete (Task: react-i18next-setup.md)
- Locale files created (Task: locale-files-scaffold.md)

## Technical Notes

### Next.js Configuration

**apps/web/next.config.js:**

```javascript
const { i18n } = require("./next-i18next.config");

module.exports = {
  i18n,
  reactStrictMode: true,
  swcMinify: true,
  // Ensure locale routes are handled correctly
  redirects: async () => {
    return [
      // Redirect root to default locale
      {
        source: "/",
        destination: "/en",
        permanent: false,
      },
      // Redirect old routes without locale
      {
        source: "/:slug*",
        destination: "/:locale/:slug*",
        permanent: false,
        locale: false,
      },
    ];
  },
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
  // Required for URL-based routing
  load: "languageOnly",
  // Use locale from URL, not path
  localeStructure: "{{lng}}/{{ns}}",
};
```

### Middleware Implementation

**apps/web/middleware.ts:**

```typescript
import { NextRequest, NextResponse } from "next/server";

const SUPPORTED_LOCALES = ["en", "es", "fr", "ru"];
const DEFAULT_LOCALE = "en";

function getLocaleFromRequest(request: NextRequest): string {
  // 1. Check URL path for locale
  const pathname = request.nextUrl.pathname;
  const pathnameLocale = SUPPORTED_LOCALES.find(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameLocale) {
    return pathnameLocale;
  }

  // 2. Check localStorage (client-side, won't be available here)
  // This will be handled client-side via cookie

  // 3. Check cookie (set by client)
  const localeCookie = request.cookies.get("NEXT_LOCALE")?.value;
  if (localeCookie && SUPPORTED_LOCALES.includes(localeCookie)) {
    return localeCookie;
  }

  // 4. Check Accept-Language header
  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) {
    const preferred = acceptLanguage.split(",")[0].split("-")[0].toLowerCase();
    if (SUPPORTED_LOCALES.includes(preferred)) {
      return preferred;
    }
  }

  // 5. Default to EN
  return DEFAULT_LOCALE;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip static files and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/static") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check if locale is in pathname
  const hasLocale = SUPPORTED_LOCALES.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (hasLocale) {
    // Locale already in URL, proceed
    const locale = SUPPORTED_LOCALES.find(
      (locale) =>
        pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    );

    const response = NextResponse.next();
    // Set cookie for client-side detection
    response.cookies.set("NEXT_LOCALE", locale!, {
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
    return response;
  }

  // No locale in URL, determine preferred locale and redirect
  const locale = getLocaleFromRequest(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;

  const response = NextResponse.redirect(url);
  response.cookies.set("NEXT_LOCALE", locale, {
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  return response;
}

export const config = {
  matcher: [
    // Match all request paths except those starting with the ones below
    "/((?!_next|api|static|favicon.ico|robots.txt|sitemap).*)",
  ],
};
```

### Dynamic Locale Routes

**apps/web/pages/[locale]/index.tsx:**

```typescript
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

export default function HomePage() {
  const router = useRouter();
  const { locale } = router.query;
  const { t } = useTranslation('common');

  return (
    <div>
      <h1>{t('appName')}</h1>
      <p>Current locale: {locale}</p>
    </div>
  );
}

export async function getStaticProps({ locale }: { locale: string }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, [
        'common',
        'auth',
        'course'
      ])),
    },
    revalidate: 3600, // ISR: revalidate every hour
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

### Localized Link Component

**components/LocalizedLink.tsx:**

```typescript
import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';

interface LocalizedLinkProps {
  href: string;
  children: React.ReactNode;
  locale?: string;
  [key: string]: any;
}

export const LocalizedLink: React.FC<LocalizedLinkProps> = ({
  href,
  children,
  locale,
  ...props
}) => {
  const router = useRouter();
  const currentLocale = locale || router.locale || 'en';

  // Ensure href starts with /
  let normalizedHref = href.startsWith('/') ? href : `/${href}`;

  // Remove existing locale prefix if present
  const localeMatch = normalizedHref.match(/^\/(en|es|fr|ru)(\/.*)?$/);
  if (localeMatch) {
    normalizedHref = localeMatch[2] || '/';
  }

  // Add locale prefix
  const localizedHref = `/${currentLocale}${normalizedHref === '/' ? '' : normalizedHref}`;

  return (
    <Link href={localizedHref} {...props}>
      {children}
    </Link>
  );
};
```

### SEO: hreflang Tags

**components/LocaleAlternates.tsx:**

```typescript
import Head from 'next/head';
import { useRouter } from 'next/router';

interface LocaleAlternatesProps {
  canonicalUrl?: string;
}

export const LocaleAlternates: React.FC<LocaleAlternatesProps> = ({
  canonicalUrl
}) => {
  const router = useRouter();
  const supportedLocales = ['en', 'es', 'fr', 'ru'];

  // Build base URL from current request
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://example.com';

  // Remove locale from pathname
  const pathname = router.asPath.replace(/^\/(en|es|fr|ru)/, '');
  const basePathname = pathname.split('?')[0]; // Remove query params

  return (
    <Head>
      {/* Canonical URL for current locale */}
      <link
        rel="canonical"
        href={`${baseUrl}/${router.locale}${basePathname}`}
        key="canonical"
      />

      {/* hreflang alternates for all locales */}
      {supportedLocales.map((locale) => (
        <link
          key={`hreflang-${locale}`}
          rel="alternate"
          hrefLang={locale}
          href={`${baseUrl}/${locale}${basePathname}`}
        />
      ))}

      {/* hreflang for x-default (fallback) */}
      <link
        rel="alternate"
        hrefLang="x-default"
        href={`${baseUrl}/en${basePathname}`}
      />
    </Head>
  );
};
```

**pages/[locale]/courses/index.tsx:**

```typescript
import { LocaleAlternates } from '@components/LocaleAlternates';

export default function CoursesPage() {
  return (
    <>
      <LocaleAlternates />
      {/* Page content */}
    </>
  );
}
```

### SEO: Locale Meta Tags

**utils/locale-meta.ts:**

```typescript
export const getLocaleMetaTags = (locale: string) => {
  const localeMap = {
    en: "en-US",
    es: "es-ES",
    fr: "fr-FR",
    ru: "ru-RU",
  };

  return {
    htmlLang: locale,
    contentLanguage: localeMap[locale as keyof typeof localeMap],
  };
};
```

### Sitemaps

**public/sitemap.xml** (English):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://mentor.example.com/en</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://mentor.example.com/en"/>
    <xhtml:link rel="alternate" hreflang="es" href="https://mentor.example.com/es"/>
    <xhtml:link rel="alternate" hreflang="fr" href="https://mentor.example.com/fr"/>
    <xhtml:link rel="alternate" hreflang="ru" href="https://mentor.example.com/ru"/>
  </url>
  <url>
    <loc>https://mentor.example.com/en/courses</loc>
    <xhtml:link rel="alternate" hreflang="en" href="https://mentor.example.com/en/courses"/>
    <xhtml:link rel="alternate" hreflang="es" href="https://mentor.example.com/es/courses"/>
    <xhtml:link rel="alternate" hreflang="fr" href="https://mentor.example.com/fr/courses"/>
    <xhtml:link rel="alternate" hreflang="ru" href="https://mentor.example.com/ru/courses"/>
  </url>
</urlset>
```

**Generate Sitemaps Dynamically (Next.js):**

**pages/sitemap-[locale].xml.ts:**

```typescript
import { GetServerSideProps } from "next";

const generateSiteMap = (locale: string) => {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://mentor.example.com";
  const routes = ["", "/courses", "/about", "/contact"];

  return `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
            xmlns:xhtml="http://www.w3.org/1999/xhtml">
      ${routes
        .map(({ route }) => {
          const path = route === "" ? "" : route;
          return `
            <url>
              <loc>${baseUrl}/${locale}${path}</loc>
              <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/en${path}"/>
              <xhtml:link rel="alternate" hreflang="es" href="${baseUrl}/es${path}"/>
              <xhtml:link rel="alternate" hreflang="fr" href="${baseUrl}/fr${path}"/>
              <xhtml:link rel="alternate" hreflang="ru" href="${baseUrl}/ru${path}"/>
            </url>
          `;
        })
        .join("")}
    </urlset>
  `;
};

export const getServerSideProps: GetServerSideProps = async ({
  res,
  params,
}) => {
  const locale = params?.locale as string;
  const sitemap = generateSiteMap(locale);

  res.setHeader("Content-Type", "text/xml");
  res.write(sitemap);
  res.end();

  return {
    props: {},
  };
};

const SiteMap = () => null;
export default SiteMap;
```

### Language Switcher Hook

**hooks/useLocaleRouter.ts:**

```typescript
import { useRouter } from "next/router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

export const useLocaleRouter = () => {
  const router = useRouter();
  const { i18n } = useTranslation();

  const changeLocale = useCallback(
    async (locale: string) => {
      // Update i18n
      await i18n.changeLanguage(locale);

      // Update URL
      const { pathname, query, asPath } = router;

      // Remove current locale from path
      const pathWithoutLocale = pathname.replace(/^\/(en|es|fr|ru)/, "");

      // Navigate to new locale
      router.push(
        {
          pathname: `/${locale}${pathWithoutLocale || "/"}`,
          query,
        },
        undefined,
        { shallow: false }
      );
    },
    [router, i18n]
  );

  return {
    currentLocale: router.locale,
    availableLocales: ["en", "es", "fr", "ru"],
    changeLocale,
  };
};
```

### Testing

\***\*tests**/locale-routing.test.ts:\*\*

```typescript
import { createMocks } from "node-mocks-http";
import middleware from "../../middleware";

describe("Locale Routing Middleware", () => {
  test("redirects root to default locale", async () => {
    const { req, res } = createMocks({
      method: "GET",
      url: "/",
    });

    await middleware(req, res);

    expect(res._getRedirectUrl()).toBe("/en");
  });

  test("preserves locale in path", async () => {
    const { req, res } = createMocks({
      method: "GET",
      url: "/es/courses",
    });

    await middleware(req, res);

    expect(res._getStatusCode()).toBe(200);
  });

  test("respects Accept-Language header", async () => {
    const { req, res } = createMocks({
      method: "GET",
      url: "/courses",
      headers: {
        "accept-language": "fr-FR,fr;q=0.9",
      },
    });

    await middleware(req, res);

    expect(res._getRedirectUrl()).toContain("/fr");
  });
});
```

### Environment Variables

**.env.local:**

```
NEXT_PUBLIC_BASE_URL=https://mentor.example.com
NEXT_PUBLIC_SUPPORTED_LOCALES=en,es,fr,ru
NEXT_PUBLIC_DEFAULT_LOCALE=en
```

## Implementation Order

1. Update next.config.js with i18n configuration
2. Create middleware.ts for locale detection and redirect
3. Convert existing routes to [locale] parameter routes
4. Create LocalizedLink component
5. Update navigation to use LocalizedLink
6. Add LocaleAlternates component for hreflang
7. Generate locale-specific sitemaps
8. Test all locale routes
9. Test deep linking and social sharing
10. Verify SEO setup with Search Console
11. Test hydration correctness
12. Update analytics to track locale
