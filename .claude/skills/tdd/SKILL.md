---
name: tdd
description: Use when implementing any feature or bugfix, before writing implementation code. Enforces test-first development methodology.
---

# Test-Driven Development (TDD)

## Overview

TDD is non-negotiable: **tests come before implementation**. This skill enforces the Red-Green-Refactor cycle and ensures 80% minimum coverage.

## When to Use

- **Before** writing any new feature
- **Before** fixing any bug
- When adding new functions, classes, or modules
- When modifying existing logic

**Always** - unless you're just reading/exploring code.

## The TDD Cycle

### 1. Red: Write a Failing Test

Before writing any production code, write a test that fails.

```typescript
// ❌ First, write the test that fails
describe('UserService', () => {
  it('should create a new user with hashed password', async () => {
    const service = new UserService();
    const user = await service.createUser({
      email: 'test@example.com',
      password: 'SecureP@ss123',
    });

    expect(user.email).toBe('test@example.com');
    expect(user.password).not.toBe('SecureP@ss123'); // Should be hashed
    expect(user.password).toMatch(/^\$2[aby]\$/); // bcrypt format
    expect(user.id).toBeDefined();
  });
});
```

**Run the test**: It should fail because `createUser` doesn't exist yet.

### 2. Green: Write Minimal Code to Pass

Write **only enough code** to make the test pass. Don't over-engineer.

```typescript
// ✅ Minimal implementation
class UserService {
  async createUser(data: { email: string; password: string }) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    return {
      id: crypto.randomUUID(),
      email: data.email,
      password: hashedPassword,
    };
  }
}
```

**Run the test**: It should now pass.

### 3. Refactor: Improve While Tests Stay Green

Now improve the code without changing behavior. Tests protect you.

```typescript
// ✅ Refactored with better structure
class UserService {
  async createUser(data: CreateUserDTO): Promise<User> {
    const hashedPassword = await this.hashPassword(data.password);
    return this.buildUser(data.email, hashedPassword);
  }

  private async hashPassword(password: string): Promise<string> {
    const SALT_ROUNDS = 10;
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  private buildUser(email: string, hashedPassword: string): User {
    return {
      id: crypto.randomUUID(),
      email,
      password: hashedPassword,
      createdAt: new Date(),
    };
  }
}
```

**Run tests**: They should still pass after refactoring.

## Test File Organization

### Co-located Tests (Recommended for Single Packages)

```
src/
  services/
    user.service.ts
    user.service.test.ts  ← Test next to source
  utils/
    crypto.ts
    crypto.test.ts
```

### `__tests__` Directory (Recommended for Complex Modules)

```
src/
  auth/
    __tests__/
      login.test.ts
      register.test.ts
      oauth.test.ts
    login.ts
    register.ts
    oauth.ts
```

## Test Categories by Layer

### Unit Tests: Functions, Hooks, Utilities

Test individual functions in isolation. Mock dependencies.

```typescript
// ✅ Unit test: Pure function
describe('calculateDiscount', () => {
  it('should apply 10% discount for orders over $100', () => {
    expect(calculateDiscount(150)).toBe(15);
  });

  it('should return 0 for orders under threshold', () => {
    expect(calculateDiscount(50)).toBe(0);
  });
});

// ✅ Unit test: React hook (mocked dependencies)
describe('useAuth', () => {
  it('should return user data when authenticated', () => {
    vi.spyOn(authApi, 'getCurrentUser').mockResolvedValue({
      id: '1',
      email: 'test@example.com',
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.user).toEqual({
        id: '1',
        email: 'test@example.com',
      });
    });
  });
});
```

### Integration Tests: API Routes, Database Queries

Test multiple components working together. Use real dependencies or test doubles.

```typescript
// ✅ Integration test: API route with database
describe('POST /api/users', () => {
  it('should create user and return 201', async () => {
    const response = await request(app).post('/api/users').send({
      email: 'new@example.com',
      password: 'SecureP@ss123',
    });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');

    // Verify database was updated
    const user = await db.users.findByEmail('new@example.com');
    expect(user).toBeDefined();
    expect(user.password).not.toBe('SecureP@ss123');
  });
});
```

### E2E Tests: User Flows (Optional)

Test complete user journeys from UI to database. Use for critical paths only.

```typescript
// ✅ E2E test: User registration flow
test('user can sign up and access dashboard', async ({ page }) => {
  await page.goto('/signup');
  await page.fill('[name="email"]', 'user@example.com');
  await page.fill('[name="password"]', 'SecureP@ss123');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('h1')).toContainText('Welcome');
});
```

## Coverage Requirements

### Minimum: 80%

The pre-push hook enforces 80% coverage for:

- Lines
- Functions
- Branches
- Statements

```bash
# Check coverage
npm run test:coverage

# View detailed report
open coverage/index.html
```

### Critical Paths: 100%

Aim for 100% coverage on:

- Authentication/authorization logic
- Payment processing
- Data validation
- Security-sensitive code

### What NOT to Test

Don't write tests for:

- Third-party libraries (trust their tests)
- Generated code (e.g., Prisma client)
- Simple getters/setters with no logic
- Configuration files

## Testing Patterns

### Use Test Fixtures

Create reusable test data:

```typescript
// fixtures/user.fixture.ts
export const mockUser = (overrides = {}) => ({
  id: '1',
  email: 'test@example.com',
  role: 'user',
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

// Usage
it('should update user profile', async () => {
  const user = mockUser({ email: 'original@example.com' });
  const updated = await service.updateEmail(user, 'new@example.com');
  expect(updated.email).toBe('new@example.com');
});
```

### Use Test Helpers

Extract common setup:

```typescript
// test-helpers/setup.ts
export function createTestContext() {
  const db = createTestDatabase();
  const cache = createTestCache();

  return {
    db,
    cache,
    cleanup: async () => {
      await db.cleanup();
      await cache.cleanup();
    },
  };
}

// Usage
describe('OrderService', () => {
  let context: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await context.cleanup();
  });

  it('should create order', async () => {
    const service = new OrderService(context.db);
    // ...
  });
});
```

### Parameterized Tests

Test multiple cases efficiently:

```typescript
// ✅ Parameterized test
describe('validateEmail', () => {
  it.each([
    ['valid@example.com', true],
    ['user+tag@domain.co.uk', true],
    ['invalid@', false],
    ['@domain.com', false],
    ['no-at-sign.com', false],
  ])('should validate "%s" as %s', (email, expected) => {
    expect(validateEmail(email)).toBe(expected);
  });
});
```

## Mocking Guidelines

### When to Mock

Mock external dependencies:

- HTTP requests (use `msw` or `nock`)
- Database calls (in unit tests)
- File system operations
- Date/time (for deterministic tests)
- Random values

```typescript
// ✅ Mock external API
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('https://api.example.com/users/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'Test User',
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### What NOT to Mock

Don't mock your own domain logic:

```typescript
// ❌ BAD: Mocking the thing you're testing
it('should calculate total price', () => {
  vi.spyOn(calculator, 'calculateTotal').mockReturnValue(100);
  expect(calculator.calculateTotal(items)).toBe(100);
  // This test is meaningless!
});

// ✅ GOOD: Test actual implementation
it('should calculate total price', () => {
  const items = [
    { price: 10, quantity: 2 },
    { price: 15, quantity: 1 },
  ];
  expect(calculator.calculateTotal(items)).toBe(35); // 10*2 + 15*1
});
```

### Type-Safe Mocking (No `any`)

**Never use `as any`** for mocks - it disables type checking and can hide bugs:

```typescript
// ❌ BAD: as any bypasses type checking
const mockService = {} as any;
const mockRepo = { save: vi.fn() } as any;

// ✅ GOOD: Implement the full interface
const mockUserRepo: UserRepository = {
  save: vi.fn(),
  findById: vi.fn().mockResolvedValue(null),
  findByEmail: vi.fn().mockResolvedValue(null),
  delete: vi.fn(),
};

// ✅ GOOD: Partial<T> when you only need some methods
const partialRepo: Partial<UserRepository> = {
  findByEmail: vi.fn().mockResolvedValue({ id: '1', email: 'test@example.com' }),
};
// Cast to full type when passing to functions that require it
const service = createUserService(partialRepo as UserRepository);

// ✅ ACCEPTABLE: as unknown as Type for complex external types
// Use sparingly for types that are impractical to fully construct
const mockEvent = { body: '{}' } as unknown as APIGatewayProxyEvent;
const mockRequest = { headers: {} } as unknown as Request;
```

**Pattern by scenario:**

| Scenario              | Pattern             | Example                                 |
| --------------------- | ------------------- | --------------------------------------- |
| Full mock             | Implement interface | `const mock: UserService = { ... }`     |
| Partial mock          | `Partial<T>` + cast | `const mock: Partial<T> = { ... } as T` |
| Complex external type | `as unknown as T`   | `{} as unknown as APIGatewayEvent`      |
| Spy on real object    | `vi.spyOn()`        | `vi.spyOn(repo, 'save')`                |

**The `as unknown as Type` pattern is acceptable in tests** when:

- The real type has many required properties you don't need
- It's an external type (AWS, Express, etc.) not your domain
- Constructing the full type would obscure the test's intent

## Git Hooks Integration

### Pre-commit Hook

Runs **related tests** for changed files:

```bash
# Triggered automatically on commit
# Uses: vitest related --run --passWithNoTests
# or:   jest --bail --findRelatedTests --passWithNoTests
```

**Fast**: Only tests affected by your changes.

### Pre-push Hook

Runs **full test suite with coverage**:

```bash
# Triggered automatically on push
# Uses: npm run test:coverage
# Blocks push if tests fail or coverage < 80%
```

**Bypass** (not recommended):

```bash
git push --no-verify
```

## Test Naming Conventions

### Use "should" statements

```typescript
// ✅ GOOD: Clear intent
it('should return 404 when user not found', async () => {});
it('should hash password before saving to database', async () => {});
it('should throw error for invalid email format', async () => {});

// ❌ BAD: Vague
it('user not found', async () => {});
it('password', async () => {});
it('works', async () => {});
```

### Group with `describe`

```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with hashed password', async () => {});
    it('should throw error for duplicate email', async () => {});
    it('should validate email format', async () => {});
  });

  describe('deleteUser', () => {
    it('should soft delete user by default', async () => {});
    it('should hard delete when force=true', async () => {});
    it('should return 404 for non-existent user', async () => {});
  });
});
```

## Framework-Specific Setup

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // or 'jsdom' for React
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
```

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  coverageThresholds: {
    global: {
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
  },
};
```

## Common Mistakes

### ❌ Writing Tests After Implementation

```typescript
// ❌ BAD: Implementation-first approach
// 1. Write createUser function
// 2. Manually test in browser
// 3. Write tests later (or never)
```

```typescript
// ✅ GOOD: Test-first approach
// 1. Write failing test for createUser
// 2. Implement createUser to make test pass
// 3. Refactor with confidence
```

### ❌ Testing Implementation Details

```typescript
// ❌ BAD: Testing internal state
it('should set loading to true', () => {
  component.fetchData();
  expect(component.isLoading).toBe(true);
});

// ✅ GOOD: Testing behavior
it('should display loading spinner while fetching', async () => {
  render(<UserList />);
  expect(screen.getByRole('status')).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
```

### ❌ Not Following Arrange-Act-Assert

```typescript
// ❌ BAD: Mixed setup and assertions
it('should calculate discount', () => {
  expect(calculateDiscount(100)).toBe(10);
  const items = [{ price: 100 }];
  expect(calculateTotal(items)).toBe(90);
});

// ✅ GOOD: Clear AAA pattern
it('should apply 10% discount to total', () => {
  // Arrange
  const items = [{ price: 100, quantity: 1 }];
  const EXPECTED_DISCOUNT = 10;

  // Act
  const discount = calculateDiscount(items);
  const total = calculateTotal(items, discount);

  // Assert
  expect(discount).toBe(EXPECTED_DISCOUNT);
  expect(total).toBe(90);
});
```

## Tools & Libraries

### Testing Frameworks

- **Vitest** - Fast, ESM-native, Vite-compatible
- **Jest** - Mature ecosystem, widely adopted

### Assertion Libraries

- Built-in assertions (Vitest/Jest)
- `@testing-library/jest-dom` - DOM matchers

### Mocking

- `msw` - Mock HTTP requests (recommended)
- `vi.mock()` / `jest.mock()` - Module mocking
- `vi.fn()` / `jest.fn()` - Function spies

### React Testing

- `@testing-library/react` - Component testing
- `@testing-library/user-event` - User interactions
- `@testing-library/react-hooks` - Hook testing

## Checklist

Before committing:

- [ ] Tests written **before** implementation
- [ ] All tests pass (`npm run test`)
- [ ] Coverage ≥ 80% (`npm run test:coverage`)
- [ ] Tests follow AAA pattern
- [ ] Test names use "should" statements
- [ ] No implementation details tested
- [ ] Mocks used only for external dependencies

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [MSW Documentation](https://mswjs.io/)
