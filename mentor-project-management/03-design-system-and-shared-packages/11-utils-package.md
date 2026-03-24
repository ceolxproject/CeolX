# Utilities Package - Shared Helper Functions

## Description

Create `packages/utils` containing reusable utility functions for date formatting, currency formatting (EUR), slug generation, file size formatting, pagination helpers, URL builders, type guards, and domain constants (roles, user statuses, course categories, payment statuses). Provide a centralized location for business logic helpers that eliminate duplication across all applications and ensure consistency in data processing.

## Affected Apps/Packages

- `packages/utils` - Utility library
- `apps/web` - Shared helpers
- `apps/admin` - Shared helpers
- `apps/instructor` - Shared helpers
- `apps/mobile-ios` - Shared helpers
- `apps/mobile-android` - Shared helpers
- Backend API - Optional: shared helpers

## Requirements

### Date & Time Utilities

- Format dates with locale awareness (EN, ES, FR, RU)
- Parse ISO 8601 strings to Date objects
- Relative time formatting (e.g., "2 hours ago")
- Date range calculations
- Timezone conversions
- Business day calculations
- Duration formatting (hours, minutes, seconds)
- Week/month/year utilities

### Currency & Number Utilities

- Format EUR currency with locale-specific separators
- Round to 2 decimal places
- Currency conversion helpers (optional, post-V1)
- Percentage formatting
- Thousand separators
- Byte/MB/GB size formatting

### String & Slug Utilities

- Slug generation from text (lowercase, dashes, no special chars)
- Kebab-case conversion
- Camel-case conversion
- Title-case formatting
- Truncate text with ellipsis
- Word wrapping
- HTML escape/unescape
- URL encoding/decoding

### File & Upload Utilities

- Format file sizes (B, KB, MB, GB)
- Get file extension from path
- Get MIME type from extension
- Validate file types
- File size validation (min/max)
- Generate file names with timestamps
- Path manipulation

### Pagination Utilities

- Calculate page offset from page number
- Generate page numbers array for UI
- Calculate total pages
- Validate page number bounds
- Generate pagination query strings

### URL & Query Utilities

- Build query strings from objects
- Parse query strings to objects
- Append/update query parameters
- Build full URLs with base
- Generate filter/search query strings
- Encode/decode URI components

### Type Guards & Assertions

- Type guards for user roles (student, instructor, admin)
- Type guards for user statuses (active, inactive, banned)
- Type guards for payment statuses (pending, completed, failed)
- Type guards for course levels (beginner, intermediate, advanced, expert)
- Type guards for course categories
- Type guards for subscription plans
- Enum type checking

### Constants

- User roles: STUDENT, INSTRUCTOR, ADMIN, SUPER_ADMIN
- User statuses: ACTIVE, INACTIVE, BANNED, SUSPENDED
- Payment statuses: PENDING, COMPLETED, FAILED, CANCELLED, REFUNDED
- Course categories: SKINCARE, MAKEUP, HAIRCARE, NAILS, WELLNESS, BUSINESS
- Course levels: BEGINNER, INTERMEDIATE, ADVANCED, EXPERT
- Subscription plans: MONTHLY, QUARTERLY, ANNUAL
- Invoice statuses: DRAFT, SENT, PAID, OVERDUE, CANCELLED
- Community post visibility: PUBLIC, PRIVATE, INSTRUCTOR_ONLY

### Error Handling

- Safe JSON parse with fallback
- Safe property access with defaults
- Null/undefined coalescing
- Try-catch wrappers for async operations

### Validation Helpers

- Email validation helper
- URL validation helper
- Strong password checker
- Username validator

### Performance Utilities

- Memoization decorator
- Debounce function
- Throttle function
- Retry helper for async operations
- Timeout promise wrapper

## Acceptance Criteria

- [x] `packages/utils` created with TypeScript configuration
- [x] Date formatting with locale support (EN, ES, FR, RU)
- [x] ISO 8601 date parsing
- [x] Relative time formatting ("2 hours ago", etc.)
- [x] Date range calculations and comparisons
- [x] Business day calculation
- [x] Duration formatting (hh:mm:ss)
- [x] EUR currency formatting with locale separators
- [x] Number rounding to 2 decimal places for currency
- [x] Percentage formatting
- [x] File size formatting (B, KB, MB, GB)
- [x] Slug generation (lowercase, dashes, no special chars)
- [x] Kebab-case, camel-case, title-case conversions
- [x] Text truncation with ellipsis
- [x] HTML escaping/unescaping
- [x] URL encoding/decoding
- [x] File extension extraction
- [x] MIME type detection
- [x] File type validation
- [x] File size validation
- [x] File name generation with timestamp
- [x] Page offset calculation
- [x] Total pages calculation
- [x] Pagination page numbers array generation
- [x] Query string building from objects
- [x] Query string parsing to objects
- [x] URL parameter append/update
- [x] Full URL building with base URL
- [x] Type guards for all enums (roles, statuses, categories)
- [x] Constants exported for all domain values
- [x] Email validation helper
- [x] URL validation helper
- [x] Password strength checker
- [x] Username validation
- [x] Safe JSON parse with error handling
- [x] Safe property access with defaults
- [x] Memoization decorator
- [x] Debounce function
- [x] Throttle function
- [x] Retry helper for async operations
- [x] Comprehensive JSDoc documentation for all functions
- [x] Unit tests with 100% code coverage
- [x] TypeScript definitions for all exports
- [x] Zero build warnings or errors
- [x] Bundle size < 20KB

## Dependencies

- TypeScript 5.x
- `date-fns` - Date formatting (optional, can implement manually)

## Technical Notes

### Project Structure

```
packages/utils/
├── src/
│   ├── date.ts                # Date/time utilities
│   ├── currency.ts            # Currency and number formatting
│   ├── string.ts              # String manipulation
│   ├── file.ts                # File and size utilities
│   ├── pagination.ts          # Pagination helpers
│   ├── url.ts                 # URL and query utilities
│   ├── types.ts               # Type guards and assertions
│   ├── constants.ts           # Domain constants
│   ├── validation.ts          # Validation helpers
│   ├── performance.ts         # Performance utilities
│   ├── errors.ts              # Error handling
│   └── index.ts               # Barrel export
├── tests/
│   ├── date.test.ts
│   ├── currency.test.ts
│   ├── string.test.ts
│   ├── file.test.ts
│   ├── pagination.test.ts
│   ├── url.test.ts
│   └── ...
├── tsconfig.json
└── package.json
```

### Date Utilities Example

```typescript
// src/date.ts
import { format, parseISO, formatDistance, isValid } from "date-fns";
import { enUS, es, fr, ru } from "date-fns/locale";

type DateLocale = "en" | "es" | "fr" | "ru";

const localeMap = {
  en: enUS,
  es,
  fr,
  ru,
};

/**
 * Format date with locale awareness
 * @param date - Date object or ISO string
 * @param formatStr - date-fns format string
 * @param locale - Locale code
 */
export function formatDate(
  date: Date | string,
  formatStr: string = "PPP",
  locale: DateLocale = "en",
): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(dateObj)) return "";

  return format(dateObj, formatStr, { locale: localeMap[locale] });
}

/**
 * Format date as short format (MM/DD/YYYY)
 */
export function formatDateShort(date: Date | string): string {
  return formatDate(date, "MM/dd/yyyy");
}

/**
 * Format date as long format (Monday, January 1, 2024)
 */
export function formatDateLong(date: Date | string): string {
  return formatDate(date, "PPPP");
}

/**
 * Format date and time (Jan 1, 2024 12:00 PM)
 */
export function formatDateTime(date: Date | string): string {
  return formatDate(date, "PPP p");
}

/**
 * Format time only (HH:mm:ss)
 */
export function formatTime(date: Date | string): string {
  return formatDate(date, "HH:mm:ss");
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function getRelativeTime(
  date: Date | string,
  locale: DateLocale = "en",
): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(dateObj)) return "";

  return formatDistance(dateObj, new Date(), {
    addSuffix: true,
    locale: localeMap[locale],
  });
}

/**
 * Format duration in seconds to HH:MM:SS format
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return [
    hours > 0 ? hours.toString().padStart(2, "0") : null,
    minutes.toString().padStart(2, "0"),
    secs.toString().padStart(2, "0"),
  ]
    .filter(Boolean)
    .join(":");
}

/**
 * Check if date is today
 */
export function isToday(date: Date | string): boolean {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  const today = new Date();
  return (
    dateObj.getDate() === today.getDate() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if date is in the past
 */
export function isPast(date: Date | string): boolean {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  return dateObj < new Date();
}

/**
 * Check if date is in the future
 */
export function isFuture(date: Date | string): boolean {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  return dateObj > new Date();
}

/**
 * Get start of day
 */
export function getStartOfDay(date: Date | string): Date {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  const copy = new Date(dateObj);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Get end of day
 */
export function getEndOfDay(date: Date | string): Date {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  const copy = new Date(dateObj);
  copy.setHours(23, 59, 59, 999);
  return copy;
}
```

### Currency Utilities Example

```typescript
// src/currency.ts
/**
 * Format number as EUR currency
 * @param amount - Amount in euros
 * @param locale - Locale code (en, es, fr, ru)
 */
export function formatEUR(amount: number, locale: string = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format number as price (no currency symbol)
 */
export function formatPrice(amount: number, decimals: number = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Parse currency string to number
 * e.g., "€12.50" -> 12.5
 */
export function parseCurrency(value: string): number {
  // Remove currency symbols and non-numeric characters except decimal point
  const cleaned = value.replace(/[^\d.,]/g, "").replace(/,/g, ".");
  return parseFloat(cleaned) || 0;
}

/**
 * Round to 2 decimal places for currency
 */
export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}
```

### String Utilities Example

```typescript
// src/string.ts
/**
 * Generate slug from text (lowercase, dashes, no special chars)
 * "Hello World!" -> "hello-world"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-") // Replace spaces with dashes
    .replace(/-+/g, "-") // Replace multiple dashes with single
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing dashes
}

/**
 * Convert to kebab-case
 */
export function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Convert to camelCase
 */
export function toCamelCase(str: string): string {
  return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) => {
    if (+match === 0) return "";
    return index === 0 ? match.toLowerCase() : match.toUpperCase();
  });
}

/**
 * Convert to Title Case
 */
export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Truncate text with ellipsis
 */
export function truncate(
  text: string,
  maxLength: number,
  suffix: string = "...",
): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char as keyof typeof map]);
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Repeat string
 */
export function repeat(str: string, times: number): string {
  return Array(times + 1).join(str);
}
```

### File Utilities Example

```typescript
// src/file.ts
/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Get file extension from path
 */
export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

/**
 * Get MIME type from file extension
 */
export function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    mp4: "video/mp4",
    webm: "video/webm",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };

  return mimeTypes[extension.toLowerCase()] || "application/octet-stream";
}

/**
 * Validate file size
 */
export function isValidFileSize(
  sizeInBytes: number,
  minMB?: number,
  maxMB?: number,
): boolean {
  if (minMB && sizeInBytes < minMB * 1024 * 1024) return false;
  if (maxMB && sizeInBytes > maxMB * 1024 * 1024) return false;
  return true;
}

/**
 * Validate file type
 */
export function isValidFileType(
  filename: string,
  allowedTypes: string[],
): boolean {
  const ext = getFileExtension(filename).toLowerCase();
  return allowedTypes.includes(ext);
}
```

### Pagination Utilities Example

```typescript
// src/pagination.ts
export interface PaginationParams {
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Calculate offset for database queries
 */
export function calculateOffset(page: number, pageSize: number): number {
  if (page < 1) page = 1;
  return (page - 1) * pageSize;
}

/**
 * Calculate total pages
 */
export function calculateTotalPages(total: number, pageSize: number): number {
  return Math.ceil(total / pageSize);
}

/**
 * Validate and normalize page number
 */
export function validatePageNumber(page: number, totalPages: number): number {
  if (page < 1) return 1;
  if (page > totalPages) return totalPages;
  return page;
}

/**
 * Generate array of page numbers for pagination UI
 */
export function generatePageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisible: number = 5,
): (number | string)[] {
  const pages: (number | string)[] = [];

  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    const half = Math.floor(maxVisible / 2);

    if (currentPage <= half) {
      // Show first maxVisible pages
      for (let i = 1; i <= maxVisible - 1; i++) {
        pages.push(i);
      }
      pages.push("...");
      pages.push(totalPages);
    } else if (currentPage > totalPages - half) {
      // Show last maxVisible pages
      pages.push(1);
      pages.push("...");
      for (let i = totalPages - (maxVisible - 2); i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show pages around current
      pages.push(1);
      pages.push("...");
      for (let i = currentPage - half + 1; i < currentPage + half; i++) {
        pages.push(i);
      }
      pages.push("...");
      pages.push(totalPages);
    }
  }

  return pages;
}
```

### Type Guards Example

```typescript
// src/types.ts
export const USER_ROLES = {
  STUDENT: "student",
  INSTRUCTOR: "instructor",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export function isValidRole(role: any): role is UserRole {
  return Object.values(USER_ROLES).includes(role);
}

export const USER_STATUSES = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  BANNED: "banned",
  SUSPENDED: "suspended",
} as const;

export type UserStatus = (typeof USER_STATUSES)[keyof typeof USER_STATUSES];

export function isValidStatus(status: any): status is UserStatus {
  return Object.values(USER_STATUSES).includes(status);
}

export const COURSE_LEVELS = {
  BEGINNER: "beginner",
  INTERMEDIATE: "intermediate",
  ADVANCED: "advanced",
  EXPERT: "expert",
} as const;

export type CourseLevel = (typeof COURSE_LEVELS)[keyof typeof COURSE_LEVELS];

export function isValidLevel(level: any): level is CourseLevel {
  return Object.values(COURSE_LEVELS).includes(level);
}

export const PAYMENT_STATUSES = {
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
} as const;

export type PaymentStatus =
  (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];

export function isValidPaymentStatus(status: any): status is PaymentStatus {
  return Object.values(PAYMENT_STATUSES).includes(status);
}
```

### URL Utilities Example

```typescript
// src/url.ts
/**
 * Build query string from object
 */
export function buildQueryString(params: Record<string, any>): string {
  const entries = Object.entries(params)
    .filter(([_, value]) => value !== null && value !== undefined)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    );

  return entries.length ? "?" + entries.join("&") : "";
}

/**
 * Parse query string to object
 */
export function parseQueryString(queryString: string): Record<string, string> {
  const params = new URLSearchParams(queryString);
  const result: Record<string, string> = {};

  for (const [key, value] of params.entries()) {
    result[key] = value;
  }

  return result;
}

/**
 * Append/update query parameter
 */
export function updateQueryParam(
  url: string,
  key: string,
  value: string,
): string {
  const urlObj = new URL(url, window.location.origin);
  urlObj.searchParams.set(key, value);
  return urlObj.toString();
}

/**
 * Build full URL with base
 */
export function buildUrl(
  base: string,
  path: string,
  params?: Record<string, any>,
): string {
  const url = new URL(path, base);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    }
  }
  return url.toString();
}
```

### Validation Helpers Example

```typescript
// src/validation.ts
/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Validate password strength
 */
export function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!@#$%^&*]/.test(password)
  );
}

/**
 * Check password strength level
 */
export function getPasswordStrength(
  password: string,
): "weak" | "medium" | "strong" {
  let strength = 0;

  if (password.length >= 8) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[!@#$%^&*]/.test(password)) strength++;

  if (strength <= 1) return "weak";
  if (strength <= 2) return "medium";
  return "strong";
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate username (alphanumeric and underscores, 3-20 chars)
 */
export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}
```

### Performance Utilities Example

```typescript
// src/performance.ts
/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return function (...args: Parameters<T>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Memoize function results
 */
export function memoize<T extends (...args: any[]) => any>(func: T): T {
  const cache = new Map();

  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = func(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Retry async operation
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  throw lastError;
}
```

### Testing Examples

```typescript
// tests/date.test.ts
import { formatDate, getRelativeTime, formatDuration } from "../src/date";

describe("Date Utilities", () => {
  it("should format date", () => {
    const date = new Date("2024-01-15");
    const result = formatDate(date);
    expect(result).toContain("January");
  });

  it("should get relative time", () => {
    const date = new Date();
    const result = getRelativeTime(date);
    expect(result).toContain("just now");
  });

  it("should format duration", () => {
    expect(formatDuration(3661)).toBe("01:01:01");
    expect(formatDuration(60)).toBe("01:00");
    expect(formatDuration(5)).toBe("00:05");
  });
});
```

### Export Strategy

```typescript
// src/index.ts
// Date utilities
export * from "./date";

// Currency utilities
export * from "./currency";

// String utilities
export * from "./string";

// File utilities
export * from "./file";

// Pagination utilities
export * from "./pagination";

// URL utilities
export * from "./url";

// Type utilities and constants
export * from "./types";

// Validation utilities
export * from "./validation";

// Performance utilities
export * from "./performance";
```

### Constants Collection

```typescript
// src/constants.ts
export const ROLES = {
  STUDENT: "student",
  INSTRUCTOR: "instructor",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
};

export const USER_STATUSES = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  BANNED: "banned",
  SUSPENDED: "suspended",
};

export const COURSE_CATEGORIES = {
  SKINCARE: "skincare",
  MAKEUP: "makeup",
  HAIRCARE: "haircare",
  NAILS: "nails",
  WELLNESS: "wellness",
  BUSINESS: "business",
};

export const COURSE_LEVELS = {
  BEGINNER: "beginner",
  INTERMEDIATE: "intermediate",
  ADVANCED: "advanced",
  EXPERT: "expert",
};

export const PAYMENT_STATUSES = {
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
};

export const SUBSCRIPTION_PLANS = {
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  ANNUAL: "annual",
};

export const LANGUAGE_CODES = {
  EN: "en",
  ES: "es",
  FR: "fr",
  RU: "ru",
} as const;

export const CURRENCIES = {
  EUR: "EUR",
};

// Regular expressions
export const REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  STRONG_PASSWORD: /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/,
  URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  USERNAME: /^[a-zA-Z0-9_]{3,20}$/,
};
```

### Performance & Best Practices

- Tree-shake unused functions
- Memoize expensive computations
- Use native browser APIs when possible
- Provide both simple and advanced versions
- Document all edge cases

### Future Enhancements

- Deep object utilities
- Array utilities (flatten, chunk, uniq)
- Promise utilities (race, timeout)
- Crypto utilities (hash, random)
- Math utilities (min, max, clamp)
