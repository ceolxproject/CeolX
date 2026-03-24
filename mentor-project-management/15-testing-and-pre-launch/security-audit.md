# Security Audit & Compliance

## Description

Comprehensive security review covering OWASP Top 10 vulnerabilities, authentication and authorization testing, API security validation, DRM verification for protected content, data encryption audit, dependency vulnerability scanning, and penetration testing plan. Ensures platform protects user data, payment information, and video content before public launch.

## Affected Apps/Packages

- **API** (Hono on Vercel)
- **Learner Web** (Next.js)
- **Mentor Web** (Next.js)
- **Admin Web** (Next.js)
- **Learner Mobile** (React Native Expo)
- **Database** (Neon PostgreSQL)
- **Authentication** (@mentor/auth)
- **Payment Processing** (Stripe integration)

## Requirements

### OWASP Top 10 Coverage

1. **Broken Access Control** - Authorization testing
2. **Cryptographic Failures** - Encryption validation
3. **Injection** - SQL injection, NoSQL injection testing
4. **Insecure Design** - Security architecture review
5. **Security Misconfiguration** - Configuration hardening
6. **Vulnerable Components** - Dependency scanning
7. **Authentication Failures** - Auth testing
8. **Data Integrity Failures** - Data validation
9. **Logging & Monitoring Failures** - Audit trail testing
10. **SSRF** - Server-Side Request Forgery prevention

### Security Testing Scope

- **Authentication**: Login/logout, session management, password reset, MFA
- **Authorization**: Role-based access control (RBAC), API endpoint permissions
- **API Security**: Rate limiting, input validation, CORS configuration, SQL injection
- **Data Protection**: Encryption at rest, encryption in transit (TLS), secrets management
- **Video DRM**: FairPlay (iOS), Widevine (Android/Web) verification
- **Dependency Security**: npm audit, Snyk, OWASP Dependency-Check
- **Infrastructure**: SSL/TLS configuration, security headers, firewall rules

### Compliance Standards

- **OWASP Testing Guide** (v4.2)
- **OWASP API Security Top 10**
- **PCI DSS** (Payment Card Industry Data Security Standard)
- **GDPR** (if EU users)
- **CCPA** (if California users)

## Acceptance Criteria

- [ ] Zero critical vulnerabilities found in security audit
- [ ] All OWASP Top 10 checklist items addressed and documented
- [ ] Authentication flow properly implemented (password hashing, session management)
- [ ] Authorization properly enforced on all API endpoints
- [ ] Input validation implemented on all user inputs
- [ ] SQL injection testing shows no vulnerabilities
- [ ] CORS configured correctly (whitelist specific origins)
- [ ] Rate limiting implemented (prevent abuse, DDoS)
- [ ] All dependencies scanned with no critical vulnerabilities
- [ ] Encryption in transit (TLS 1.2+) configured
- [ ] Secrets management secure (no hardcoded credentials)
- [ ] DRM properly configured for video content
- [ ] Penetration testing completed with remediation plan
- [ ] Security headers configured (CSP, X-Frame-Options, etc.)
- [ ] Logging and monitoring detecting security events
- [ ] PCI DSS compliance verified for payment processing

## Dependencies

### Security Tools

- **OWASP ZAP** (automated security testing)
- **Burp Suite Community** (manual penetration testing)
- **npm audit** / **Snyk** (dependency vulnerability scanning)
- **TruffleHog** (secret scanning)
- **SQLMap** (SQL injection testing)
- **Postman** (API security testing)

### External Services

- Stripe test account for payment testing
- Mux API for video DRM testing
- Firebase for authentication testing (if social auth used)

### Infrastructure

- HTTPS/TLS certificates (Vercel provides)
- VPN/proxy for penetration testing
- Isolated test environment

## Technical Notes

### OWASP Top 10 Checklist

#### 1. Broken Access Control

**Testing:**

```typescript
// Test: Learner cannot access other learner's private data
test("should not access other user enrollments", async () => {
  const user1Token = await loginUser("user1@example.com");
  const user2Id = "user-2-id";

  const response = await fetch("/api/users/" + user2Id + "/enrollments", {
    headers: { Authorization: `Bearer ${user1Token}` },
  });

  expect(response.status).toBe(403);
  expect(response.json().error).toContain("Unauthorized");
});

// Test: Admin-only endpoints
test("admin endpoints require admin role", async () => {
  const learnerToken = await loginUser("learner@example.com");

  const response = await fetch("/api/admin/users", {
    headers: { Authorization: `Bearer ${learnerToken}` },
  });

  expect(response.status).toBe(403);
});

// Test: Mentor cannot modify other mentor's course
test("mentor cannot edit other mentor course", async () => {
  const mentor1Token = await loginUser("mentor1@example.com");
  const mentor2CourseId = "course-by-mentor2";

  const response = await fetch(`/api/courses/${mentor2CourseId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${mentor1Token}` },
    body: JSON.stringify({ title: "Hacked!" }),
  });

  expect(response.status).toBe(403);
});
```

**Implementation:**

```typescript
// Middleware for RBAC
export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get("user");

    if (!user || !roles.includes(user.role)) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    await next();
  };
}

// Route protection
app.get("/admin/users", requireRole("admin"), async (c) => {
  const users = await db.query.users.findMany();
  return c.json(users);
});
```

#### 2. Cryptographic Failures

**Encryption in Transit:**

```typescript
// Verify HTTPS only
test("should redirect HTTP to HTTPS", async () => {
  const response = await fetch("http://app.mentor.example.com", {
    redirect: "manual",
  });

  expect(response.status).toBe(301);
  expect(response.headers.get("Location")).toMatch(/^https:\/\//);
});

// Test TLS configuration
test("TLS 1.2+ enforced", async () => {
  const response = await fetch("https://api.mentor.example.com", {
    // Use only TLS 1.2+
  });

  expect(response.ok).toBe(true);
});
```

**Encryption at Rest:**

```typescript
// Password hashing with bcrypt
import bcrypt from "bcrypt";

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// Sensitive data encryption
import crypto from "crypto";

export function encryptField(value: string, key: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(key, "hex"),
    iv,
  );

  let encrypted = cipher.update(value, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${encrypted}:${authTag.toString("hex")}`;
}

export function decryptField(encrypted: string, key: string): string {
  const [ivHex, encHex, tagHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "hex"),
    iv,
  );

  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  let decrypted = decipher.update(encHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
```

#### 3. Injection

**SQL Injection Testing:**

```typescript
test("should prevent SQL injection in search", async () => {
  const maliciousInput = "'; DROP TABLE users; --";

  const response = await fetch(
    "/api/search?q=" + encodeURIComponent(maliciousInput),
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  expect(response.status).toBe(200);

  // Verify table still exists
  const users = await db.query.users.findMany();
  expect(users).toBeDefined();
});
```

**Input Validation:**

```typescript
// Zod validation for all inputs
import { z } from "zod";

const createCourseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  categoryId: z.string().uuid(),
  price: z.number().min(0).max(9999.99),
});

app.post("/courses", async (c) => {
  const body = await c.req.json();

  try {
    const validated = createCourseSchema.parse(body);
    // Process validated data
  } catch (error) {
    return c.json({ error: "Invalid input" }, 400);
  }
});
```

**XSS Prevention:**

```typescript
// Sanitize user input
import DOMPurify from 'isomorphic-dompurify';

const cleanHtml = DOMPurify.sanitize(userInput);

// Use in templates
export default function CourseContent({ course }) {
  return (
    <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(course.description) }} />
  );
}
```

#### 4. Insecure Design

**Security Architecture:**

- Authentication: JWT tokens with secure storage
- Authorization: Role-based access control
- Data validation: Input sanitization and type validation
- Error handling: Generic error messages (no system details)
- Logging: Security events logged and monitored

#### 5. Security Misconfiguration

**Environment Configuration:**

```bash
# .env.production (secured in Vercel)
DATABASE_URL=postgresql://user:pass@db.host/dbname
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
JWT_SECRET=xxxxx
API_RATE_LIMIT=1000 # Requests per minute

# Security Headers
NEXT_PUBLIC_CSP_HEADER="default-src 'self'; script-src 'self' 'unsafe-inline' cdn.mux.com; style-src 'self' 'unsafe-inline';"
```

**Security Headers Middleware:**

```typescript
export function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  };
}
```

#### 6. Vulnerable Components

**Dependency Scanning:**

```bash
# npm audit - built-in
npm audit

# Snyk - advanced scanning
npx snyk test

# OWASP Dependency-Check
dependency-check --project "Mentor" --scan ./node_modules
```

**Automated CI Check:**

```yaml
# .github/workflows/security.yml
name: Security Audit

on:
  pull_request:
  push:
    branches: [main]

jobs:
  dependencies:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm audit --audit-level=moderate
      - run: npx snyk test --severity-threshold=high
```

#### 7. Authentication Failures

**Session Management:**

```typescript
// Secure session cookies
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    name: "mentor_session",
    cookie: {
      secure: true, // HTTPS only
      httpOnly: true, // No JS access
      sameSite: "strict", // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }),
);

// JWT token expiration
const token = jwt.sign(
  { userId: user.id, email: user.email },
  process.env.JWT_SECRET,
  { expiresIn: "24h" }, // Token expires in 24 hours
);

// Token refresh mechanism
app.post("/auth/refresh", async (c) => {
  const refreshToken = c.req.cookie("refresh_token");

  if (!refreshToken || !verifyRefreshToken(refreshToken)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const newToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "24h",
  });
  return c.json({ token: newToken });
});
```

**Password Reset Security:**

```typescript
// Time-limited reset tokens
app.post("/auth/password-reset-request", async (c) => {
  const { email } = await c.req.json();
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) return c.json({ success: true }); // Don't reveal if email exists

  const resetToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minute expiry

  await db
    .update(users)
    .set({ passwordResetToken: tokenHash, passwordResetExpiresAt: expiresAt })
    .where(eq(users.id, user.id));

  // Send reset link via email
  await sendResetEmail(user.email, resetToken);

  return c.json({ success: true });
});

// Verify and reset
app.post("/auth/password-reset", async (c) => {
  const { token, newPassword } = await c.req.json();

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await db.query.users.findFirst({
    where: and(
      eq(users.passwordResetToken, tokenHash),
      gt(users.passwordResetExpiresAt, new Date()),
    ),
  });

  if (!user) return c.json({ error: "Invalid or expired token" }, 400);

  const hashedPassword = await hashPassword(newPassword);
  await db
    .update(users)
    .set({
      passwordHash: hashedPassword,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    })
    .where(eq(users.id, user.id));

  return c.json({ success: true });
});
```

#### 8. Data Integrity Failures

**Rate Limiting:**

```typescript
import { rateLimit } from "hono-rate-limiter";

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  keyGenerator: (c) => c.req.header("x-forwarded-for") || "unknown",
});

app.post("/auth/login", limiter, async (c) => {
  // Login logic
});

// Stricter limit for sensitive operations
const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5, // 5 requests per minute
});

app.post("/auth/password-reset-request", strictLimiter, async (c) => {
  // Reset logic
});
```

#### 9. Logging & Monitoring Failures

**Security Event Logging:**

```typescript
import { createLogger } from "@mentor/logger";

const securityLogger = createLogger("security");

// Log authentication events
app.post("/auth/login", async (c) => {
  const { email } = await c.req.json();

  try {
    // Login logic
    securityLogger.info("User login successful", {
      email,
      ip: c.req.header("x-forwarded-for"),
    });
  } catch (error) {
    securityLogger.warn("Login attempt failed", {
      email,
      error: error.message,
    });
  }
});

// Log authorization failures
if (!hasPermission(user, resource)) {
  securityLogger.warn("Unauthorized access attempt", {
    userId: user.id,
    resource: resource.id,
    action: "read",
  });
}

// Log data access
securityLogger.info("User data accessed", {
  dataType: "payment_history",
  userId: user.id,
  accessedBy: currentUser.id,
});
```

#### 10. SSRF Prevention

**URL Validation:**

```typescript
function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow same-origin redirects
    return parsed.origin === process.env.APP_URL;
  } catch {
    return false;
  }
}

app.get("/redirect", async (c) => {
  const { url } = c.req.query();

  if (!isValidRedirectUrl(url)) {
    return c.json({ error: "Invalid redirect URL" }, 400);
  }

  return c.redirect(url);
});

// Webhook signature validation
app.post("/webhooks/stripe", async (c) => {
  const signature = c.req.header("stripe-signature");
  const body = await c.req.text();

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
    // Process event
  } catch (error) {
    return c.json({ error: "Invalid signature" }, 400);
  }
});
```

### DRM Verification

**FairPlay (iOS):**

```typescript
// Verify FairPlay is configured
test("iOS video uses FairPlay DRM", async () => {
  // Test with real Mux playback ID
  const response = await fetch(
    "https://image.mux.com/v1/playback_id/master.m3u8",
  );

  const content = await response.text();

  // Check for FairPlay key URI
  expect(content).toContain(
    'KEYFORMAT="urn:uuid:ebd08221-62f7-4c4f-95f1-7e6434fb0bb9"',
  );
  // Check for encrypted content
  expect(content).toContain("#EXT-X-KEY");
});
```

**Widevine (Android):**

```typescript
// Verify Widevine is configured
test("Android video uses Widevine DRM", async () => {
  const response = await fetch(
    "https://image.mux.com/v1/playback_id/dash.mpd",
    {
      headers: { Accept: "application/dash+xml" },
    },
  );

  const content = await response.text();

  // Check for Widevine ContentProtection
  expect(content).toContain("urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed");
});
```

### Penetration Testing Plan

**Phase 1: Reconnaissance**

- Document all endpoints and functionality
- Identify technologies used (tech stack)
- Map data flows

**Phase 2: Vulnerability Scanning**

- Automated scanning with OWASP ZAP
- Manual testing of critical flows
- Authentication/authorization testing

**Phase 3: Exploitation & Validation**

- Attempt to exploit found vulnerabilities
- Document impact and severity
- Create proof-of-concept if applicable

**Phase 4: Reporting**

- Document all findings
- Assign severity ratings (critical, high, medium, low)
- Provide remediation recommendations

**Phase 5: Remediation & Retesting**

- Fix identified vulnerabilities
- Retest to confirm fixes
- Document changes

### Dependency Vulnerability Reporting

```bash
# Generate SBOM (Software Bill of Materials)
npx @cyclonedx/npm-plugin --output-version 1.4

# Monitor for new vulnerabilities
npm audit fix --audit-level=moderate
```

### Secrets Management

**Avoid Hardcoding Secrets:**

```typescript
// ❌ WRONG - Hardcoded secret
const stripeKey = "sk_live_xxxxx";

// ✅ RIGHT - Environment variable
const stripeKey = process.env.STRIPE_SECRET_KEY;
```

**Scan for Secrets:**

```bash
# TruffleHog scans for exposed secrets
trufflehog filesystem . --json > secrets-report.json
```

### Security Testing Checklist

- [ ] Password hashing: bcrypt with 12+ salt rounds
- [ ] Sessions: Secure, httpOnly, sameSite cookies
- [ ] HTTPS: Enforced with HSTS header
- [ ] CORS: Whitelist specific origins, no wildcard
- [ ] Rate limiting: Implemented on all auth endpoints
- [ ] Input validation: Zod/TypeScript validation
- [ ] SQL injection: Parameterized queries (Drizzle ORM)
- [ ] XSS: DOMPurify for user content
- [ ] CSRF: SameSite cookies + CSRF tokens
- [ ] Headers: CSP, X-Frame-Options, X-Content-Type-Options
- [ ] Secrets: No hardcoded credentials
- [ ] Logging: Security events logged
- [ ] DRM: FairPlay/Widevine configured
- [ ] Penetration test: Completed with findings addressed

## Implementation Timeline

- **Week 1**: OWASP ZAP scanning, dependency audit
- **Week 2**: Manual security testing, authentication/authorization
- **Week 3**: API security, injection testing
- **Week 4**: Data encryption audit, secrets scanning
- **Week 5**: DRM verification, penetration testing
- **Week 6**: Remediation and retesting
- **Week 7**: Final security sign-off

## Success Metrics

- **Zero critical vulnerabilities** in final audit
- **All OWASP Top 10** addressed and documented
- **100% code coverage** for security-critical paths
- **All dependencies** have no known high-severity CVEs
- **Penetration testing report** completed with all findings remediated
- **Security headers** configured correctly
- **DRM properly implemented** for all protected content
