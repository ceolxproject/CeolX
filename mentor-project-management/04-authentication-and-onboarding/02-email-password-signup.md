# Email/Password Signup

## Description

Implement learner signup flow using email and password authentication. This is the primary signup method for new learners and will be the baseline auth method supporting the platform. Signup includes form validation, password strength enforcement, duplicate email detection, and user creation in the database.

## Affected Apps/Packages

- `packages/auth`
- Frontend: Learner Web App (Next.js)
- Mobile: React Native Expo app
- Backend: Hono API

## API Endpoints

### POST /auth/signup

Create new user account with email and password.

**Request Body**:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!"
}
```

**Response** (201 Created):

```json
{
  "success": true,
  "user": {
    "id": "user_abc123",
    "email": "john@example.com",
    "name": "John Doe",
    "emailVerified": false,
    "createdAt": "2024-02-18T10:30:00Z"
  },
  "message": "Account created. Please verify your email to continue."
}
```

**Error Responses**:

- `400 Bad Request`: Missing required fields
  ```json
  {
    "error": "VALIDATION_ERROR",
    "details": ["email is required", "password must be at least 8 characters"]
  }
  ```
- `409 Conflict`: Email already registered
  ```json
  {
    "error": "EMAIL_ALREADY_EXISTS",
    "message": "An account with this email already exists"
  }
  ```
- `400 Bad Request`: Passwords don't match
  ```json
  {
    "error": "PASSWORD_MISMATCH",
    "message": "Password and confirm password do not match"
  }
  ```

## Requirements

### Form Validation

- **Name**: Required, 2-100 characters, alphanumeric + spaces allowed
- **Email**: Required, valid email format (RFC 5322), normalized to lowercase
- **Password**:
  - Minimum 8 characters
  - At least one uppercase letter (A-Z)
  - At least one lowercase letter (a-z)
  - At least one number (0-9)
  - At least one special character (!@#$%^&\*)
  - Cannot contain email or common patterns (123456, password, etc.)
- **Confirm Password**: Must match password field exactly

### Duplicate Email Detection

- Case-insensitive email uniqueness check
- Query `user` table before creation
- Return 409 Conflict if email exists
- Support future federated identity (merge accounts on OAuth)

### User Creation

- Generate cryptographically secure user ID (UUID or similar)
- Hash password using bcrypt (cost factor 12)
- Store user record with:
  - `id`, `name`, `email` (lowercase)
  - `passwordHash`
  - `emailVerified: false`
  - `role: 'learner'` (default)
  - `createdAt`, `updatedAt` timestamps
- Do not store plain password
- Set `emailVerified` to false initially

### Post-Signup Actions

- Trigger email verification (see task 03-email-verification.md)
- Create default user profile (empty)
- Initialize onboarding state (not yet started)
- Send verification email via Postmark within 5 seconds

### Frontend Implementation (All 3 Web Apps + Mobile)

- Form component with real-time validation feedback
- Password strength indicator (visual feedback)
- Show/hide password toggle
- Submit button disabled until form valid
- Loading state during submission
- Error message display
- Success redirect to email verification screen
- Accessibility: proper labels, ARIA attributes

## Acceptance Criteria

- [ ] Form validation works for all fields with clear error messages
- [ ] Password strength validation enforces all requirements
- [ ] Duplicate email detection prevents registration
- [ ] User record created successfully in database
- [ ] Password hashed with bcrypt (cost 12) before storage
- [ ] User ID is UUID v4 or equivalent
- [ ] Email normalized to lowercase before storage
- [ ] POST /auth/signup endpoint returns 201 on success
- [ ] POST /auth/signup returns appropriate error codes (400, 409)
- [ ] Verification email triggered automatically after signup
- [ ] Frontend form has password visibility toggle
- [ ] Frontend has password strength indicator
- [ ] Learner Web App signup works end-to-end
- [ ] Mentor Web App signup uses same flow (role selected later)
- [ ] Mobile app signup works with form validation
- [ ] Signup data validated on both client and server

## Dependencies

- BetterAuth (from task 01)
- bcryptjs or @hono/utils for password hashing
- email-validator or similar for email validation
- Postmark API client (for verification email)
- Drizzle ORM for database queries

## Technical Notes

### Password Security

- Never log passwords or password hashes
- Use bcrypt with cost factor 12 (security vs performance tradeoff)
- Consider rate limiting signup requests (5 per IP per hour)
- Implement signup CAPTCHA if bot attacks occur

### Email Normalization

- Convert to lowercase: `john.doe@Example.COM` → `john.doe@example.com`
- Remove leading/trailing whitespace
- This prevents duplicate accounts with same email in different cases

### Database Schema (Drizzle)

```typescript
export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  role: text("role").notNull().default("learner"),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### Hono Handler Pattern

```typescript
// POST /auth/signup
export async function handleSignup(c: Context) {
  const body = await c.req.json();

  // Validate input
  const validation = validateSignupForm(body);
  if (!validation.valid) {
    return c.json(
      { error: "VALIDATION_ERROR", details: validation.errors },
      400
    );
  }

  // Check duplicate email
  const existing = await db.query.users.findFirst({
    where: eq(users.email, body.email.toLowerCase()),
  });
  if (existing) {
    return c.json({ error: "EMAIL_ALREADY_EXISTS" }, 409);
  }

  // Create user
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(body.password);

  const user = await db
    .insert(users)
    .values({
      id: userId,
      name: body.name,
      email: body.email.toLowerCase(),
      passwordHash,
    })
    .returning();

  // Trigger email verification
  await triggerEmailVerification(user[0].email);

  return c.json({ success: true, user: sanitizeUser(user[0]) }, 201);
}
```

### Password Strength Calculation

Implement on frontend for UX and server for security:

- Weak: < 8 chars or missing character types
- Fair: 8-12 chars with 3+ character types
- Good: 13+ chars with all types and no common patterns
- Strong: 16+ chars with all types and no common patterns

### Rate Limiting

- Implement per-IP signup limit: 5 accounts per hour
- Track via Redis or in-memory store
- Return 429 Too Many Requests if exceeded
- Log to security monitoring system

### Mobile Implementation (Expo)

- Use `expo-crypto` for client-side password validation
- Store signup form state in local context
- Show validation errors below each field
- Use `expo-haptics` for feedback on password strength
