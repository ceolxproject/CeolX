# DS-T7 · Hono RPC API Client Package

| Field          | Value                                                                   |
| -------------- | ----------------------------------------------------------------------- |
| **Milestone**  | M1.6 — Design System & Shared Packages                                  |
| **Status**     | 🔲 To Do                                                                |
| **Depends on** | M1-T3 (Hono API scaffold), M1-T10 (packages/shared), DS-T6 (validators) |
| **PRD Ref**    | Section 10.1 (Tech Stack — Hono backend)                                |

---

## Description

Create a type-safe API client in `packages/shared/src/api-client/` using Hono's built-in RPC client. The Hono RPC client reads the router type definition from the server and generates a fully typed client — no OpenAPI spec or code generation needed. The mobile app and admin dashboard import this client to make API calls with full TypeScript autocomplete on routes, request bodies, and response shapes.

---

## Affected Apps / Packages

| App / Package     | Role                                                 |
| ----------------- | ---------------------------------------------------- |
| `packages/shared` | API client instance exported for all consumers       |
| `apps/server`     | Exports its Hono `AppType` for the client to consume |
| `apps/native`     | Imports API client for all data fetching             |
| `apps/admin`      | Imports API client for all data fetching             |

---

## Requirements

### Hono RPC Client Setup

- Export the Hono `AppType` from `apps/server/src/app.ts`
- Create `apiClient` instance using `hc<AppType>` in `packages/shared`
- Base URL configured from environment variable
- Auth token automatically injected in request headers
- Error responses typed — never returns `unknown`

### Request Interceptors

- Attach `Authorization: Bearer <token>` header on every request
- Token source: `expo-secure-store` on mobile, `localStorage`/cookie on admin
- If token is missing: throw `AuthError` before making request

### Response Handling

- All 4xx/5xx responses throw typed errors with `{ error, message, statusCode }`
- Network errors (offline/timeout) throw `NetworkError`
- Helper: `isApiError(error)` type guard to narrow error type in catch blocks

### Environment Config

- `EXPO_PUBLIC_API_URL` for mobile
- `VITE_API_URL` for admin
- Both resolve to the same Hono backend URL

---

## Acceptance Criteria

- [ ] `AppType` exported from `apps/server/src/app.ts`
- [ ] `apiClient.api.v1.users.me.$get()` returns fully typed response — no `any`
- [ ] Auth token automatically attached to every request
- [ ] `401` response throws `AuthError` with correct message
- [ ] `400` response includes typed validation errors from Zod
- [ ] `NetworkError` thrown on timeout or offline
- [ ] `isApiError(error)` correctly narrows to `ApiError` type in catch blocks
- [ ] Client works in both Expo (mobile) and Vite (admin) environments

---

## Dependencies

### Upstream

- M1-T3 (Hono API scaffold — `AppType` comes from here)
- M1-T10 (packages/shared — client lives here)
- DS-T6 (Validators — response types inferred from Zod schemas)

### Downstream

- All M2+ data fetching in mobile and admin

---

## Technical Notes

### Export AppType from API

```typescript
// apps/server/src/app.ts

import { Hono } from 'hono';
import { userRoutes } from './routes/users';
import { authRoutes } from './routes/auth';
import { eventRoutes } from './routes/events';

const app = new Hono()
  .route('/api/v1/users', userRoutes)
  .route('/api/v1/auth', authRoutes)
  .route('/api/v1/events', eventRoutes);

export type AppType = typeof app;
export default app;
```

### API Client

```typescript
// packages/shared/src/api-client/index.ts

import { hc } from 'hono/client';
import type { AppType } from '@ceolx/api'; // workspace dependency

export class AuthError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

// Token getter — injected at app initialisation
let getToken: (() => Promise<string | null>) | null = null;

export const configureApiClient = (tokenGetter: () => Promise<string | null>) => {
  getToken = tokenGetter;
};

export const createApiClient = (baseUrl: string) =>
  hc<AppType>(baseUrl, {
    fetch: async (input, init) => {
      const token = getToken ? await getToken() : null;

      const headers = new Headers(init?.headers);
      if (token) headers.set('Authorization', `Bearer ${token}`);

      let response: Response;
      try {
        response = await fetch(input, { ...init, headers });
      } catch {
        throw new NetworkError();
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) throw new AuthError(401, body.message ?? 'Unauthorized');
        throw new ApiError(
          response.status,
          body.error ?? 'UNKNOWN',
          body.message ?? 'Request failed'
        );
      }

      return response;
    },
  });
```

### Mobile Initialisation

```typescript
// apps/native/src/lib/api.ts

import * as SecureStore from 'expo-secure-store';
import { createApiClient, configureApiClient } from '@ceolx/shared/api-client';

configureApiClient(() => SecureStore.getItemAsync('ceolx_session_token'));

export const api = createApiClient(process.env.EXPO_PUBLIC_API_URL!);
```

### Admin Initialisation

```typescript
// apps/admin/src/lib/api.ts

import { createApiClient, configureApiClient } from '@ceolx/shared/api-client';

configureApiClient(async () => localStorage.getItem('ceolx_session_token'));

export const api = createApiClient(import.meta.env.VITE_API_URL);
```

### Usage in Components

```typescript
// Type-safe — full autocomplete on routes and response
const { user } = await api.api.v1.users.me.$get().then((r) => r.json());

// Error handling
try {
  await api.api.v1.events.$post({ json: eventData });
} catch (error) {
  if (isApiError(error) && error.statusCode === 409) {
    // handle duplicate
  }
}
```

---

## Common Gotchas

- **`@ceolx/api` workspace dep**: `packages/shared` needs `apps/server` as a dev dependency for type-only imports. Use `import type { AppType }` — never import runtime code from `apps/server` into the shared package.
- **Hono RPC only works with `hono/client`**: Do not use `fetch` directly for typed routes. The RPC client infers types from the router — bypassing it loses all type safety.
- **Token timing**: The token getter is async (`SecureStore` on mobile is async). Always `await` it — never read tokens synchronously.
- **Environment variable prefixes**: Expo requires `EXPO_PUBLIC_` prefix for client-side env vars; Vite requires `VITE_`. Same variable, different prefixes in different apps.

---
