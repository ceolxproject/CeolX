# Validators Package - Zod Schema Library

## Description

Create `packages/validators` with Zod schemas for all API request/response types across the Mentor platform. Define comprehensive validation schemas for user registration, login, course creation, module/lesson management, payment processing, community posts, and search queries. Schemas serve dual purposes: frontend form validation and backend API validation, ensuring data consistency throughout the application.

## Affected Apps/Packages

- `packages/validators` - Validation schema library
- `packages/api-client` - Type inference from schemas
- `apps/web` - Form validation
- `apps/admin` - Admin operations validation
- `apps/instructor` - Course creation validation
- `apps/mobile-ios` - Mobile form validation
- `apps/mobile-android` - Mobile form validation
- Backend API routes - Request validation

## Requirements

### Core Validation Setup

- Install Zod v3.x for schema definition
- Create modular schema files organized by domain
- Use TypeScript for schema type inference (`z.infer<typeof schema>`)
- Support custom validators for business logic
- Provide error message customization (EN/ES/FR/RU per i18n)
- Export types and validators for use in forms and APIs

### User & Authentication Schemas

1. **User Registration** - Email, password, first name, last name, role, consent checkbox, optional avatar
2. **User Login** - Email, password, remember-me checkbox
3. **User Profile Update** - First name, last name, bio, avatar, social links
4. **Password Reset** - Email, new password, confirm password
5. **Email Verification** - Email, verification code
6. **Two-Factor Authentication** - Phone number, backup codes

### Course & Learning Schemas

1. **Course Creation/Update** - Title, description, category, level, language, thumbnail, price, currency (EUR)
2. **Module Creation/Update** - Course ID, title, description, display order
3. **Lesson Creation/Update** - Module ID, title, content, video URL, duration, display order
4. **Quiz/Assessment** - Questions, answers, scoring rules, passing score
5. **User Course Enrollment** - User ID, course ID, payment method
6. **Progress Tracking** - User ID, lesson ID, completion status, watch time

### Payment Schemas

1. **Payment Method** - Card details, billing address, payment provider token
2. **Invoice** - User ID, course ID, amount, currency, status, due date
3. **Subscription** - Plan type, billing cycle, auto-renewal, cancellation reason
4. **Refund Request** - Transaction ID, reason, refund amount

### Community & Engagement Schemas

1. **Community Post** - Course ID, title, content, media attachments, visibility (public/private)
2. **Post Comment** - Post ID, author ID, content, media
3. **Mentor Request** - Requester ID, mentor ID, message, availability
4. **User Rating/Review** - Course ID, user ID, rating (1-5), text review, helpful votes

### Search & Filtering Schemas

1. **Course Search Query** - Keyword, category, level, price range, rating, language, sort by
2. **User Search Query** - Name, role, expertise, availability
3. **Community Search Query** - Keyword, course, post type, date range

### API Response Schemas

1. **Pagination Response** - Data array, total count, page, page size, total pages
2. **Error Response** - Error code, message, details, timestamp
3. **Success Response** - Data, message, timestamp

## Acceptance Criteria

- [x] `packages/validators` created with proper TypeScript configuration
- [x] User registration schema with email, password strength, name validation
- [x] User login schema with email and password
- [x] User profile schema for updates with optional fields
- [x] Course creation schema with title, description, category, level
- [x] Module schema with title, description, display order
- [x] Lesson schema with title, content, video URL, duration
- [x] Payment schema with card details and billing address validation
- [x] Subscription schema with plan type and billing cycle
- [x] Community post schema with title, content, media
- [x] Comment schema with content and media support
- [x] Search query schemas with keyword, filters, sorting
- [x] Pagination schema for list responses
- [x] Error response schema with error codes and details
- [x] Password strength validation (min 8 chars, uppercase, number, special)
- [x] Email format validation using RFC 5322 standard
- [x] Currency validation (EUR) with decimal places (2)
- [x] URL validation for video sources, image uploads
- [x] File size validation for uploads (images: 5MB max, videos: 500MB max)
- [x] Enum validation for categories, roles, statuses, levels
- [x] Custom validators for business logic (username availability, course ID exists)
- [x] Localized error messages (EN as default, placeholders for ES/FR/RU)
- [x] Type inference working with TypeScript `z.infer<typeof schema>`
- [x] Re-export all schemas and types from package root
- [x] Unit tests for all validators with valid/invalid inputs
- [x] Integration with frontend form handling
- [x] Integration with backend API route handlers
- [x] Zero build warnings or type errors
- [x] Comprehensive JSDoc documentation for each schema

## Dependencies

- `zod@^3.x` - Schema validation library
- `typescript@^5.x` - TypeScript compiler
- `@hookform/resolvers` - Integration with react-hook-form (optional)

## Technical Notes

### Project Structure

```
packages/validators/
├── src/
│   ├── schemas/
│   │   ├── auth.ts              # Registration, login, password reset
│   │   ├── user.ts              # User profile, preferences
│   │   ├── course.ts            # Course, module, lesson
│   │   ├── payment.ts           # Payment, subscription, invoice
│   │   ├── community.ts         # Posts, comments, ratings
│   │   ├── search.ts            # Search queries and filters
│   │   ├── common.ts            # Pagination, errors, responses
│   │   └── index.ts             # Barrel export
│   ├── validators/
│   │   ├── custom.ts            # Custom validator functions
│   │   └── index.ts
│   ├── types/
│   │   └── index.ts             # Exported inferred types
│   ├── errors/
│   │   └── index.ts             # Error message definitions
│   └── index.ts                 # Main entry point
├── tests/
│   ├── auth.test.ts
│   ├── course.test.ts
│   ├── payment.test.ts
│   └── ...
├── tsconfig.json
└── package.json
```

### Authentication Schemas Example

```typescript
// src/schemas/auth.ts
import { z } from "zod";

/**
 * Email validation schema with RFC 5322 compliance
 * Regex patterns from popular email validation libraries
 */
const emailSchema = z
  .string()
  .email("Invalid email address")
  .toLowerCase()
  .trim();

/**
 * Strong password validation
 * Requirements: min 8 chars, 1 uppercase, 1 number, 1 special char
 */
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/^(?=.*[A-Z])/, "Password must contain at least one uppercase letter")
  .regex(/^(?=.*\d)/, "Password must contain at least one number")
  .regex(
    /^(?=.*[!@#$%^&*])/,
    "Password must contain at least one special character (!@#$%^&*)",
  );

/**
 * User registration request schema
 */
export const registrationSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    firstName: z.string().min(1, "First name is required").max(50),
    lastName: z.string().min(1, "Last name is required").max(50),
    role: z.enum(["student", "instructor"]).default("student"),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the terms and conditions" }),
    }),
    acceptNewsletter: z.boolean().default(false),
    avatar: z.string().url().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;

/**
 * User login schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Password reset schema
 */
export const passwordResetSchema = z
  .object({
    email: emailSchema,
    newPassword: passwordSchema,
    confirmPassword: z.string(),
    token: z.string().min(1, "Reset token is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type PasswordResetInput = z.infer<typeof passwordResetSchema>;

/**
 * Email verification schema
 */
export const emailVerificationSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .length(6, "Verification code must be 6 digits")
    .regex(/^\d+$/),
});

export type EmailVerificationInput = z.infer<typeof emailVerificationSchema>;
```

### Course Schemas Example

```typescript
// src/schemas/course.ts
import { z } from "zod";

export const courseLevel = z.enum([
  "beginner",
  "intermediate",
  "advanced",
  "expert",
]);
export const courseCategory = z.enum([
  "skincare",
  "makeup",
  "haircare",
  "nails",
  "wellness",
  "business",
]);

/**
 * Course creation/update schema
 */
export const courseSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z
      .string()
      .min(10, "Title must be at least 10 characters")
      .max(100, "Title must be no more than 100 characters"),
    description: z
      .string()
      .min(50, "Description must be at least 50 characters")
      .max(5000, "Description must be no more than 5000 characters"),
    category: courseCategory,
    level: courseLevel,
    language: z.string().length(2).default("en"), // ISO 639-1
    thumbnail: z.string().url("Thumbnail must be a valid URL"),
    price: z.number().nonnegative("Price cannot be negative"),
    currency: z.literal("EUR").default("EUR"),
    duration: z.number().positive("Duration must be positive"),
    instructorId: z.string().uuid(),
    isPublished: z.boolean().default(false),
    tags: z.array(z.string()).max(10, "Maximum 10 tags allowed"),
    prerequisites: z.array(z.string().uuid()).default([]),
    learningOutcomes: z.array(z.string()).min(1).max(20),
  })
  .strict();

export type Course = z.infer<typeof courseSchema>;

/**
 * Module schema
 */
export const moduleSchema = z
  .object({
    id: z.string().uuid().optional(),
    courseId: z.string().uuid(),
    title: z.string().min(5).max(100),
    description: z.string().max(500).optional(),
    displayOrder: z.number().nonnegative(),
    duration: z.number().positive().optional(),
  })
  .strict();

export type Module = z.infer<typeof moduleSchema>;

/**
 * Lesson schema
 */
export const lessonSchema = z
  .object({
    id: z.string().uuid().optional(),
    moduleId: z.string().uuid(),
    title: z.string().min(5).max(100),
    content: z.string().min(10).max(10000),
    videoUrl: z.string().url("Video URL must be valid"),
    duration: z.number().positive("Duration must be positive"),
    displayOrder: z.number().nonnegative(),
    transcription: z.string().optional(),
    resources: z
      .array(
        z.object({
          title: z.string(),
          url: z.string().url(),
          type: z.enum(["pdf", "image", "document", "link"]),
        }),
      )
      .default([]),
  })
  .strict();

export type Lesson = z.infer<typeof lessonSchema>;

/**
 * User course enrollment schema
 */
export const enrollmentSchema = z.object({
  userId: z.string().uuid(),
  courseId: z.string().uuid(),
  enrollmentDate: z.date().default(() => new Date()),
  completionStatus: z
    .enum(["not-started", "in-progress", "completed"])
    .default("not-started"),
});

export type Enrollment = z.infer<typeof enrollmentSchema>;
```

### Payment Schemas Example

```typescript
// src/schemas/payment.ts
import { z } from "zod";

/**
 * Credit card schema with Luhn algorithm validation
 */
export const creditCardSchema = z.object({
  cardNumber: z
    .string()
    .regex(/^[0-9]{13,19}$/, "Invalid card number")
    .refine((val) => luhnCheck(val), "Invalid credit card number"),
  expiryMonth: z.number().min(1).max(12),
  expiryYear: z.number().min(new Date().getFullYear()),
  cvc: z.string().regex(/^[0-9]{3,4}$/, "Invalid CVC"),
  cardholderName: z.string().min(1).max(100),
});

export type CreditCard = z.infer<typeof creditCardSchema>;

/**
 * Billing address schema
 */
export const billingAddressSchema = z.object({
  street: z.string().min(5).max(100),
  city: z.string().min(2).max(50),
  postalCode: z.string().regex(/^[0-9A-Z\s-]{3,10}$/),
  country: z.string().length(2), // ISO 3166-1 alpha-2
  state: z.string().optional(),
});

export type BillingAddress = z.infer<typeof billingAddressSchema>;

/**
 * Payment method schema
 */
export const paymentMethodSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid(),
  type: z.enum(["card", "paypal", "bank_transfer"]),
  card: creditCardSchema.optional(),
  billingAddress: billingAddressSchema,
  isDefault: z.boolean().default(false),
});

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

/**
 * Payment processing schema
 */
export const paymentSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid(),
  courseId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.literal("EUR").default("EUR"),
  paymentMethodId: z.string().uuid(),
  status: z
    .enum(["pending", "completed", "failed", "cancelled"])
    .default("pending"),
  transactionId: z.string().optional(),
  createdAt: z.date().default(() => new Date()),
  completedAt: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type Payment = z.infer<typeof paymentSchema>;

/**
 * Subscription schema
 */
export const subscriptionSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid(),
  planType: z.enum(["monthly", "quarterly", "annual"]),
  status: z.enum(["active", "cancelled", "expired"]).default("active"),
  price: z.number().positive(),
  billingCycle: z.enum(["monthly", "quarterly", "annual"]),
  autoRenew: z.boolean().default(true),
  startDate: z.date(),
  endDate: z.date(),
  renewalDate: z.date().optional(),
});

export type Subscription = z.infer<typeof subscriptionSchema>;

/**
 * Refund request schema
 */
export const refundRequestSchema = z.object({
  id: z.string().uuid().optional(),
  paymentId: z.string().uuid(),
  reason: z.string().min(10).max(500),
  amount: z.number().positive().optional(),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
  createdAt: z.date().default(() => new Date()),
});

export type RefundRequest = z.infer<typeof refundRequestSchema>;

// Helper function for credit card validation
function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}
```

### Community Schemas Example

```typescript
// src/schemas/community.ts
import { z } from "zod";

/**
 * Community post schema
 */
export const communityPostSchema = z.object({
  id: z.string().uuid().optional(),
  courseId: z.string().uuid(),
  authorId: z.string().uuid(),
  title: z.string().min(5).max(200),
  content: z.string().min(10).max(5000),
  attachments: z
    .array(
      z.object({
        url: z.string().url(),
        type: z.enum(["image", "video", "document"]),
        size: z.number().max(50 * 1024 * 1024), // 50MB max
      }),
    )
    .max(5),
  visibility: z.enum(["public", "private", "instructoronly"]).default("public"),
  tags: z.array(z.string()).max(10),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().optional(),
  pinned: z.boolean().default(false),
});

export type CommunityPost = z.infer<typeof communityPostSchema>;

/**
 * Post comment schema
 */
export const postCommentSchema = z.object({
  id: z.string().uuid().optional(),
  postId: z.string().uuid(),
  authorId: z.string().uuid(),
  content: z.string().min(1).max(2000),
  parentCommentId: z.string().uuid().optional(), // For nested replies
  attachments: z
    .array(
      z.object({
        url: z.string().url(),
        type: z.enum(["image", "document"]),
      }),
    )
    .max(2),
  createdAt: z.date().default(() => new Date()),
});

export type PostComment = z.infer<typeof postCommentSchema>;

/**
 * Mentor request schema
 */
export const mentorRequestSchema = z.object({
  id: z.string().uuid().optional(),
  requesterId: z.string().uuid(),
  mentorId: z.string().uuid(),
  message: z.string().min(10).max(1000),
  availability: z.enum(["flexible", "weekends", "evenings"]),
  status: z.enum(["pending", "accepted", "declined"]).default("pending"),
  createdAt: z.date().default(() => new Date()),
});

export type MentorRequest = z.infer<typeof mentorRequestSchema>;

/**
 * Course rating/review schema
 */
export const courseReviewSchema = z.object({
  id: z.string().uuid().optional(),
  courseId: z.string().uuid(),
  userId: z.string().uuid(),
  rating: z.number().min(1).max(5),
  title: z.string().min(5).max(100),
  content: z.string().min(10).max(2000),
  helpful: z.number().nonnegative().default(0),
  notHelpful: z.number().nonnegative().default(0),
  createdAt: z.date().default(() => new Date()),
});

export type CourseReview = z.infer<typeof courseReviewSchema>;
```

### Search Schemas Example

```typescript
// src/schemas/search.ts
import { z } from "zod";

/**
 * Course search query schema
 */
export const courseSearchSchema = z.object({
  keyword: z.string().max(100).optional(),
  category: z.array(z.string()).optional(),
  level: z
    .array(z.enum(["beginner", "intermediate", "advanced", "expert"]))
    .optional(),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().nonnegative().optional(),
  minRating: z.number().min(0).max(5).optional(),
  language: z.array(z.string().length(2)).optional(),
  sortBy: z
    .enum(["relevance", "rating", "price", "newest", "popular"])
    .default("relevance"),
  order: z.enum(["asc", "desc"]).default("asc"),
  page: z.number().positive().default(1),
  pageSize: z.number().positive().max(100).default(20),
});

export type CourseSearchQuery = z.infer<typeof courseSearchSchema>;

/**
 * Pagination response schema
 */
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({
    data: z.array(schema),
    pagination: z.object({
      total: z.number(),
      page: z.number(),
      pageSize: z.number(),
      totalPages: z.number(),
    }),
  });

export type PaginatedResponse<T> = z.infer<
  ReturnType<typeof paginatedResponseSchema<z.ZodTypeAny>>
>;
```

### Common Schemas Example

```typescript
// src/schemas/common.ts
import { z } from "zod";

/**
 * API error response schema
 */
export const errorResponseSchema = z.object({
  status: z.number(),
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  timestamp: z.date().default(() => new Date()),
  requestId: z.string().optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/**
 * API success response schema
 */
export const successResponseSchema = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({
    data: schema,
    message: z.string().optional(),
    timestamp: z.date().default(() => new Date()),
  });

/**
 * Pagination query schema (reusable)
 */
export const paginationSchema = z.object({
  page: z.number().positive().default(1),
  pageSize: z.number().positive().max(100).default(20),
  sortBy: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

export type Pagination = z.infer<typeof paginationSchema>;
```

### Custom Validators Example

```typescript
// src/validators/custom.ts
import { z } from "zod";

/**
 * Custom validator for checking username availability
 * This would call the backend API
 */
export const usernameAvailableValidator = async (
  username: string,
): Promise<boolean> => {
  const response = await fetch(
    `/api/users/check-username?username=${username}`,
  );
  const { available } = await response.json();
  return available;
};

/**
 * Reusable password match validator
 */
export const passwordMatchValidator = (
  password: string,
  confirmPassword: string,
): boolean => {
  return password === confirmPassword;
};

/**
 * Video URL validator (supports YouTube, Vimeo, custom)
 */
export const isValidVideoUrl = (url: string): boolean => {
  const videoUrlRegex =
    /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be|vimeo\.com|wistia\.com|mux\.com)\/.+$/i;
  return videoUrlRegex.test(url);
};

/**
 * File size validator in bytes
 */
export const isValidFileSize = (
  sizeInBytes: number,
  maxSizeInMB: number,
): boolean => {
  return sizeInBytes <= maxSizeInMB * 1024 * 1024;
};
```

### Integration with Forms (react-hook-form)

```typescript
// Example usage in a form component
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registrationSchema } from '@mentor/validators'

export function RegistrationForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registrationSchema),
  })

  const onSubmit = (data) => {
    // Data is now typed and validated
    console.log(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}
      {/* ... */}
    </form>
  )
}
```

### Testing Examples

```typescript
// src/__tests__/auth.test.ts
import { registrationSchema } from "../schemas/auth";

describe("Registration Schema", () => {
  it("should validate a correct registration", () => {
    const validData = {
      email: "user@example.com",
      password: "SecurePass123!",
      confirmPassword: "SecurePass123!",
      firstName: "John",
      lastName: "Doe",
      role: "student",
      acceptTerms: true,
    };

    const result = registrationSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should reject weak password", () => {
    const invalidData = {
      email: "user@example.com",
      password: "weak",
      confirmPassword: "weak",
      firstName: "John",
      lastName: "Doe",
      acceptTerms: true,
    };

    const result = registrationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject mismatched passwords", () => {
    const invalidData = {
      email: "user@example.com",
      password: "SecurePass123!",
      confirmPassword: "DifferentPass123!",
      firstName: "John",
      lastName: "Doe",
      acceptTerms: true,
    };

    const result = registrationSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
```

### Export Strategy

```typescript
// src/index.ts
// Auth schemas
export * from "./schemas/auth";
export type {
  RegistrationInput,
  LoginInput,
  PasswordResetInput,
} from "./schemas/auth";

// User schemas
export * from "./schemas/user";

// Course schemas
export * from "./schemas/course";
export type { Course, Module, Lesson } from "./schemas/course";

// Payment schemas
export * from "./schemas/payment";
export type { Payment, Subscription } from "./schemas/payment";

// Community schemas
export * from "./schemas/community";
export type { CommunityPost, PostComment } from "./schemas/community";

// Search schemas
export * from "./schemas/search";
export type { CourseSearchQuery } from "./schemas/search";

// Common schemas
export * from "./schemas/common";
export type { ErrorResponse, Pagination } from "./schemas/common";

// Custom validators
export * from "./validators/custom";
```

### Documentation Best Practices

- Add JSDoc comments for every schema
- Include examples of valid data
- Document business rules (e.g., password requirements)
- Add links to related schemas
- Include version history for schema changes
- Document deprecated schemas with migration path

### Performance Considerations

- Use `safeParse()` instead of `parse()` in frontend (graceful errors)
- Cache compiled schemas when possible
- Lazy load large schema definitions
- Consider schema composition for reusable parts

### Future Enhancements

- Multi-language error messages with i18n integration
- Backend API route middleware for auto-validation
- OpenAPI schema generation from Zod schemas
- GraphQL type generation
- Form builder from schemas
