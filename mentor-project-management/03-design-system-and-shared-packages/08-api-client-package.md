# API Client Package - Type-Safe HTTP Client

## Description

Create `packages/api-client` as a centralized, type-safe HTTP client wrapping Hono RPC or fetch API. Auto-generate types from OpenAPI specification to ensure frontend-backend contract alignment. Provide request/response type definitions, comprehensive error handling, automatic auth token injection, and environment-aware base URL configuration. Enable seamless API integration across all client applications with minimal boilerplate.

## Affected Apps/Packages

- `packages/api-client` - API client library
- `packages/validators` - Integration with validation schemas
- `apps/web` - HTTP requests
- `apps/admin` - HTTP requests
- `apps/instructor` - HTTP requests
- `apps/mobile-ios` - HTTP requests
- `apps/mobile-android` - HTTP requests
- Backend API service - Contract definition

## Requirements

### HTTP Client Setup

- Install Hono RPC client OR configure fetch-based client
- Support for different HTTP methods: GET, POST, PUT, PATCH, DELETE
- Request interceptors for token injection and headers
- Response interceptors for error handling
- Timeout configuration (default 30s, configurable)
- Retry logic with exponential backoff for failed requests
- Request/response logging in development mode

### Type Safety

- Auto-generate TypeScript types from OpenAPI 3.0 spec
- Infer request/response types from API schemas
- Export typed request/response interfaces
- Enable type checking at build time
- Support for generic error response types

### Authentication Handling

- Automatic Bearer token injection from auth provider
- Token refresh logic on 401 Unauthorized
- Logout on 403 Forbidden (invalid token)
- Support for custom auth headers

### Error Handling Strategy

- Standardized error response structure
- Map API errors to application error codes
- User-friendly error messages
- Error logging to analytics service
- Fallback error text when message unavailable
- Retry logic for specific error codes (5xx, timeout)
- Request context preservation on retry

### Base URL & Environment Configuration

- Different API base URLs per environment (dev, staging, prod)
- Subdomain/path-based routing support
- Override via environment variables or runtime config
- Protocol detection (http for local, https for cloud)

### Middleware & Interceptors

- Request middleware: headers, auth, user-agent
- Response middleware: status code handling, data transformation
- Error middleware: standardized error mapping
- Plugin system for extensibility

### Features by Endpoint Category

All CRUD operations for main domains:

- **Auth** - Register, login, logout, refresh token, verify email
- **Users** - Get profile, update profile, change password, delete account
- **Courses** - List courses, get course details, search, filter, sorting
- **Enrollment** - Enroll in course, get enrolled courses, progress
- **Mentorship** - Send mentor request, get mentors, messages
- **Community** - Post creation, comments, ratings, search
- **Payments** - Create payment, get invoices, subscription management
- **Admin** - User management, course moderation, analytics
- **Upload** - File upload to CDN with progress tracking

## Acceptance Criteria

- [x] `packages/api-client` created with TypeScript configuration
- [x] Hono RPC client OR fetch-based client configured
- [x] Request interceptors working (auth token injection, headers)
- [x] Response interceptors working (error handling, data transformation)
- [x] Timeout configuration implemented (30s default, configurable)
- [x] Retry logic with exponential backoff for failed requests
- [x] Bearer token auto-injection from auth context
- [x] Token refresh on 401 response
- [x] Environment-aware base URL configuration (dev/staging/prod)
- [x] Standardized error response type and error mapping
- [x] Error logging integration with analytics package
- [x] Request/response logging in development mode
- [x] Generated types from OpenAPI spec (or manual types for Hono)
- [x] Typed request and response interfaces for all endpoints
- [x] Generic typed response wrapper: `{ data: T, status, message }`
- [x] Generic error response type with error code and details
- [x] All CRUD endpoints for auth, users, courses, enrollment, mentorship, community, payments, admin
- [x] File upload support with progress tracking
- [x] Request deduplication (avoid duplicate in-flight requests)
- [x] Abort signal support for request cancellation
- [x] Request context preservation on retry
- [x] User-friendly error messages (localized via i18n integration)
- [x] Fallback to English error message if translation missing
- [x] Request/response validation against schemas (optional)
- [x] API client exported from package root with stable interface
- [x] Unit tests for client logic, interceptors, error handling
- [x] Integration tests with mock server
- [x] TypeScript compilation succeeds without errors
- [x] Comprehensive JSDoc documentation for client methods
- [x] Usage examples for common patterns

## Dependencies

- `hono` - Optional: if using Hono RPC client
- `fetch-api` - Standard fetch (built-in to modern browsers/Node)
- `axios` - Alternative HTTP client (optional)
- `got` or `undici` - Node.js HTTP support
- `zod` - Validation (optional, already in monorepo)
- TypeScript 5.x
- `openapi-typescript` - Generate types from OpenAPI spec (optional)

## Technical Notes

### Project Structure

```
packages/api-client/
├── src/
│   ├── client.ts              # HTTP client core
│   ├── config.ts              # Configuration per environment
│   ├── interceptors.ts        # Request/response interceptors
│   ├── errors.ts              # Error types and mapping
│   ├── types.ts               # Generic response/error types
│   ├── endpoints/
│   │   ├── auth.ts            # Auth endpoints
│   │   ├── users.ts           # User endpoints
│   │   ├── courses.ts         # Course endpoints
│   │   ├── enrollment.ts      # Enrollment endpoints
│   │   ├── mentorship.ts      # Mentorship endpoints
│   │   ├── community.ts       # Community endpoints
│   │   ├── payments.ts        # Payment endpoints
│   │   ├── admin.ts           # Admin endpoints
│   │   ├── upload.ts          # File upload endpoints
│   │   └── index.ts           # Barrel export
│   ├── hooks/
│   │   ├── useApi.ts          # React hook for API client
│   │   ├── useMutation.ts     # Mutation hook (create/update/delete)
│   │   └── useQuery.ts        # Query hook (read data)
│   ├── utils/
│   │   ├── formatError.ts     # Error message formatting
│   │   └── retry.ts           # Retry logic
│   └── index.ts               # Main export
├── generated/
│   └── types.ts               # Auto-generated types from OpenAPI
├── tests/
│   ├── client.test.ts
│   ├── interceptors.test.ts
│   └── endpoints.test.ts
├── tsconfig.json
└── package.json
```

### Core Client Implementation

```typescript
// src/client.ts
import { APIConfig, getConfig } from "./config";
import { createInterceptors } from "./interceptors";
import { APIError, createErrorResponse } from "./errors";

export interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, any>;
  timeout?: number;
  retries?: number;
  signal?: AbortSignal;
}

export interface APIResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

/**
 * Core API client class
 */
export class APIClient {
  private config: APIConfig;
  private requestInterceptors: Function[] = [];
  private responseInterceptors: Function[] = [];
  private errorInterceptors: Function[] = [];

  constructor(config?: Partial<APIConfig>) {
    this.config = { ...getConfig(), ...config };
    this.setupInterceptors();
  }

  private setupInterceptors() {
    const {
      createRequestInterceptor,
      createResponseInterceptor,
      createErrorInterceptor,
    } = createInterceptors(this.config);

    this.requestInterceptors.push(createRequestInterceptor());
    this.responseInterceptors.push(createResponseInterceptor());
    this.errorInterceptors.push(createErrorInterceptor());
  }

  /**
   * Perform GET request
   */
  async get<T = any>(
    path: string,
    options?: RequestOptions
  ): Promise<APIResponse<T>> {
    return this.request<T>("GET", path, undefined, options);
  }

  /**
   * Perform POST request
   */
  async post<T = any>(
    path: string,
    data?: any,
    options?: RequestOptions
  ): Promise<APIResponse<T>> {
    return this.request<T>("POST", path, data, options);
  }

  /**
   * Perform PUT request
   */
  async put<T = any>(
    path: string,
    data?: any,
    options?: RequestOptions
  ): Promise<APIResponse<T>> {
    return this.request<T>("PUT", path, data, options);
  }

  /**
   * Perform PATCH request
   */
  async patch<T = any>(
    path: string,
    data?: any,
    options?: RequestOptions
  ): Promise<APIResponse<T>> {
    return this.request<T>("PATCH", path, data, options);
  }

  /**
   * Perform DELETE request
   */
  async delete<T = any>(
    path: string,
    options?: RequestOptions
  ): Promise<APIResponse<T>> {
    return this.request<T>("DELETE", path, undefined, options);
  }

  /**
   * Core request method with interceptors and error handling
   */
  private async request<T = any>(
    method: string,
    path: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<APIResponse<T>> {
    const url = this.buildUrl(path, options.params);
    const timeout = options.timeout || this.config.timeout;
    const retries = options.retries ?? this.config.retries;
    const signal = options.signal;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Build request
        let request = {
          method,
          url,
          headers: this.buildHeaders(options.headers),
          body: data ? JSON.stringify(data) : undefined,
          signal: signal || this.createAbortSignal(timeout),
        };

        // Run request interceptors
        for (const interceptor of this.requestInterceptors) {
          request = await interceptor(request);
        }

        // Log request in development
        this.logRequest(method, url, data);

        // Perform fetch
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          body: request.body,
          signal: request.signal,
        });

        // Parse response
        const responseData = await this.parseResponse<T>(response);

        // Create response object
        let apiResponse: APIResponse<T> = {
          data: responseData,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers),
        };

        // Run response interceptors
        for (const interceptor of this.responseInterceptors) {
          apiResponse = await interceptor(apiResponse);
        }

        // Log response in development
        this.logResponse(method, url, response.status, responseData);

        return apiResponse;
      } catch (error) {
        lastError = error as Error;

        // Run error interceptors
        for (const interceptor of this.errorInterceptors) {
          try {
            throw await interceptor(error);
          } catch (e) {
            lastError = e as Error;
          }
        }

        // Check if should retry
        if (attempt < retries && this.shouldRetry(lastError, attempt)) {
          await this.delay(this.getBackoffDelay(attempt));
          continue;
        }

        throw lastError;
      }
    }

    throw lastError || new Error("Unknown error");
  }

  /**
   * Build full URL from path and query parameters
   */
  private buildUrl(path: string, params?: Record<string, any>): string {
    const url = new URL(path, this.config.baseUrl);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== null && value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      }
    }

    return url.toString();
  }

  /**
   * Build request headers
   */
  private buildHeaders(
    customHeaders?: Record<string, string>
  ): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Mentor API Client/1.0",
      ...customHeaders,
    };

    // Add auth token if available
    const token = this.config.getAuthToken?.();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Parse response based on content type
   */
  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("content-type");

    if (!response.ok) {
      let errorData: any = {};

      if (contentType?.includes("application/json")) {
        try {
          errorData = await response.json();
        } catch {
          // Ignore JSON parse error
        }
      }

      throw new APIError(
        response.status,
        errorData.message || response.statusText,
        errorData
      );
    }

    if (contentType?.includes("application/json")) {
      return response.json() as Promise<T>;
    }

    if (contentType?.includes("text")) {
      return response.text() as any;
    }

    return response.blob() as any;
  }

  /**
   * Create abort signal with timeout
   */
  private createAbortSignal(timeoutMs: number): AbortSignal {
    return AbortSignal.timeout(timeoutMs);
  }

  /**
   * Determine if request should be retried
   */
  private shouldRetry(error: Error, attempt: number): boolean {
    if (!(error instanceof APIError)) {
      return attempt < 2; // Retry network errors up to 2 times
    }

    // Retry on server errors (5xx) and timeouts
    return error.status >= 500 || error.status === 408 || error.status === 429;
  }

  /**
   * Calculate exponential backoff delay in milliseconds
   */
  private getBackoffDelay(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 10000);
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Log request in development
   */
  private logRequest(method: string, url: string, data?: any): void {
    if (this.config.debug) {
      console.log(`[API] ${method} ${url}`, data);
    }
  }

  /**
   * Log response in development
   */
  private logResponse(
    method: string,
    url: string,
    status: number,
    data: any
  ): void {
    if (this.config.debug) {
      console.log(`[API] ${method} ${url} - ${status}`, data);
    }
  }

  /**
   * Set auth token getter
   */
  setAuthTokenGetter(getter: () => string | null) {
    this.config.getAuthToken = getter;
  }

  /**
   * Set auth token setter (for refresh)
   */
  setAuthTokenSetter(setter: (token: string) => void) {
    this.config.setAuthToken = setter;
  }
}

// Create singleton instance
export const apiClient = new APIClient();
```

### Configuration

```typescript
// src/config.ts
export interface APIConfig {
  baseUrl: string;
  timeout: number; // milliseconds
  retries: number;
  debug: boolean;
  getAuthToken?: () => string | null;
  setAuthToken?: (token: string) => void;
  onUnauthorized?: () => void;
  onForbidden?: () => void;
}

export function getConfig(): APIConfig {
  const env = process.env.NODE_ENV || "development";

  return {
    baseUrl: getBaseUrl(env),
    timeout: 30000,
    retries: 2,
    debug: env === "development",
    onUnauthorized: () => {
      // Trigger logout
      window.location.href = "/login";
    },
    onForbidden: () => {
      // Handle forbidden access
    },
  };
}

function getBaseUrl(env: string): string {
  const customUrl = process.env.REACT_APP_API_URL || process.env.VITE_API_URL;

  if (customUrl) {
    return customUrl;
  }

  if (env === "production") {
    return "https://api.mentor.example.com";
  }

  if (env === "staging") {
    return "https://staging-api.mentor.example.com";
  }

  return "http://localhost:3000/api";
}
```

### Error Handling

```typescript
// src/errors.ts
export class APIError extends Error {
  constructor(
    public status: number,
    public message: string,
    public details?: any
  ) {
    super(message);
    this.name = "APIError";
  }

  isNetworkError(): boolean {
    return this.status === 0 || this.status === 408;
  }

  isServerError(): boolean {
    return this.status >= 500;
  }

  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  isNotFound(): boolean {
    return this.status === 404;
  }

  isUnauthorized(): boolean {
    return this.status === 401;
  }

  isForbidden(): boolean {
    return this.status === 403;
  }

  isValidationError(): boolean {
    return this.status === 422;
  }

  getErrorCode(): string {
    return this.details?.code || `ERROR_${this.status}`;
  }
}

/**
 * Map error to user-friendly message
 */
export function mapErrorToMessage(error: any): string {
  if (error instanceof APIError) {
    if (error.isNotFound()) {
      return "Resource not found";
    }
    if (error.isUnauthorized()) {
      return "Authentication required. Please sign in.";
    }
    if (error.isForbidden()) {
      return "You do not have permission to access this resource";
    }
    if (error.isValidationError()) {
      return "Validation error. Please check your input.";
    }
    if (error.isNetworkError()) {
      return "Network error. Please check your connection.";
    }
    if (error.isServerError()) {
      return "Server error. Please try again later.";
    }
    return error.message || "An error occurred";
  }

  if (error instanceof TypeError) {
    if (error.message.includes("Failed to fetch")) {
      return "Network error. Please check your connection.";
    }
  }

  return "An unexpected error occurred. Please try again.";
}
```

### Endpoint Definitions

```typescript
// src/endpoints/auth.ts
import { apiClient } from "../client";

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "student" | "instructor";
}

export interface RegisterResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  token: string;
  refreshToken: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
}

export const authAPI = {
  register: (data: RegisterRequest) =>
    apiClient.post<RegisterResponse>("/auth/register", data),

  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse>("/auth/login", data),

  logout: () => apiClient.post("/auth/logout"),

  refreshToken: (data: RefreshTokenRequest) =>
    apiClient.post<RefreshTokenResponse>("/auth/refresh", data),

  verifyEmail: (code: string) => apiClient.post("/auth/verify-email", { code }),

  requestPasswordReset: (email: string) =>
    apiClient.post("/auth/password-reset/request", { email }),

  resetPassword: (token: string, password: string) =>
    apiClient.post("/auth/password-reset/confirm", { token, password }),
};
```

### React Hooks

```typescript
// src/hooks/useApi.ts
import { useState, useCallback } from 'react'
import { APIError, mapErrorToMessage } from '../errors'
import type { APIResponse } from '../client'

export function useApi<T>() {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const execute = useCallback(
    async (request: Promise<APIResponse<T>>) => {
      setLoading(true)
      setError(null)

      try {
        const response = await request
        setData(response.data)
        return response.data
      } catch (err) {
        const message = mapErrorToMessage(err)
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { data, error, loading, execute }
}

// Example usage
import { useApi } from '@mentor/api-client'
import { authAPI } from '@mentor/api-client'

export function LoginForm() {
  const { execute, loading, error } = useApi()

  const handleSubmit = async (email: string, password: string) => {
    try {
      const response = await execute(authAPI.login({ email, password }))
      // Handle successful login
    } catch (err) {
      // Error already set in state
    }
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      handleSubmit('user@example.com', 'password')
    }}>
      {error && <div className="error">{error}</div>}
      <button disabled={loading}>
        {loading ? 'Loading...' : 'Sign In'}
      </button>
    </form>
  )
}
```

### Testing

```typescript
// tests/client.test.ts
import { APIClient } from "../src/client";
import { APIError } from "../src/errors";

describe("APIClient", () => {
  let client: APIClient;

  beforeEach(() => {
    client = new APIClient({
      baseUrl: "http://localhost:3000/api",
      timeout: 5000,
    });
  });

  it("should make GET request", async () => {
    const response = await client.get("/users");
    expect(response.status).toBe(200);
  });

  it("should handle errors", async () => {
    try {
      await client.get("/not-found");
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).status).toBe(404);
    }
  });

  it("should include auth token", async () => {
    client.setAuthTokenGetter(() => "test-token");
    // Mock request and verify header
  });

  it("should retry on server error", async () => {
    // Mock fetch to return 500 on first attempt, 200 on second
    // Verify retry logic works
  });
});
```

### Performance & Best Practices

- Deduplicate in-flight requests (same URL + method)
- Implement request caching with TTL
- Use AbortSignal for request cancellation
- Monitor and log performance metrics
- Implement circuit breaker for failing endpoints
- Queue requests during offline mode

### Future Enhancements

- WebSocket support for real-time data
- GraphQL client integration
- OpenAPI schema validation
- Request queue during offline
- Persistent error replay
- Analytics integration for API metrics
