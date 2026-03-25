# Task 4: Configure TypeScript with Path Aliases and Strict Mode

## Description

Set up comprehensive TypeScript configuration across the monorepo with root-level configuration that all packages extend, path aliases for clean imports, strict type checking enabled, and module resolution optimized for a monorepo environment. This establishes a strong foundation for type safety and developer experience throughout the project.

## Affected Apps/Packages

- Root tsconfig.json (configuration baseline)
- All 5 apps: api, web-learner, web-mentor, web-admin, mobile
- All 10 shared packages: db, auth, api-client, validators, i18n, analytics, ui, ui-mobile, cache, utils

## Requirements

### Root TypeScript Configuration (/tsconfig.json)

```json
{
  "compilerOptions": {
    // Language and Environment
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "useDefineForClassFields": true,
    "emitDecoratorMetadata": false,
    "experimentalDecorators": false,

    // Module Resolution
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowJs": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,

    // Strict Type-Checking
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true,

    // Emit
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "removeComments": false,
    "newLine": "lf",
    "preserveConstEnums": true,

    // Completeness
    "skipLibCheck": false,
    "forceConsistentCasingInFileNames": true,
    "noEmitOnError": false,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "allowUnusedLabels": false,
    "allowUnreachableCode": false,

    // Advanced
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo",
    "baseUrl": ".",
    "paths": {
      "@mentor/*": ["packages/*/src"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", "**/dist", "**/.next", "**/.turbo"]
}
```

### Root tsconfig Explanation

#### Language & Environment

- `target: ES2020` - Modern JavaScript target for all platforms
- `lib` includes DOM types for web apps, ES2020 features
- `jsx: react-jsx` - New JSX transform (no React import needed)
- `useDefineForClassFields: true` - Aligns with ECMAScript standard

#### Module Resolution

- `moduleResolution: bundler` - Modern resolver for bundlers (Turbopack, Webpack, Vite)
- `allowJs: true` - Allows mixing TS and JS files
- `allowSyntheticDefaultImports: true` - Enables cleaner imports
- `esModuleInterop: true` - Compatibility with CommonJS modules

#### Strict Type Checking

- `strict: true` - Enables all strict type-checking options
- Individual strict options documented for clarity
- `noImplicitThis` prevents `this` without type annotation
- `useUnknownInCatchVariables` - Safer catch error handling

#### Emit

- `declaration: true` - Generate `.d.ts` files for type definitions
- `sourceMap: true` - Enable debugging in browser/IDEs
- `outDir: ./dist` - Consistent build output location

#### Advanced

- `incremental: true` - Faster rebuilds by caching compiler state
- `baseUrl` and `paths` define monorepo path aliases
- `noPropertyAccessFromIndexSignature` - Stricter object property access

---

### App-Level TypeScript Configurations

#### apps/server/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@/middleware/*": ["middleware/*"],
      "@/routes/*": ["routes/*"],
      "@/services/*": ["services/*"],
      "@/lib/*": ["lib/*"]
    },
    "outDir": "./dist",
    "module": "ESNext",
    "target": "ES2020"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

#### apps/web-learner/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@/components/*": ["components/*"],
      "@/app/*": ["app/*"],
      "@/lib/*": ["lib/*"],
      "@/types/*": ["types/*"]
    },
    "jsx": "preserve",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "incremental": true
  },
  "include": ["src", "next-env.d.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "dist", "build"]
}
```

#### apps/web-mentor/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@/components/*": ["components/*"],
      "@/app/*": ["app/*"],
      "@/lib/*": ["lib/*"],
      "@/types/*": ["types/*"]
    },
    "jsx": "preserve",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "incremental": true
  },
  "include": ["src", "next-env.d.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "dist", "build"]
}
```

#### apps/web-admin/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@/components/*": ["components/*"],
      "@/app/*": ["app/*"],
      "@/lib/*": ["lib/*"],
      "@/types/*": ["types/*"]
    },
    "jsx": "preserve",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "incremental": true
  },
  "include": ["src", "next-env.d.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "dist", "build"]
}
```

#### apps/mobile/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@/components/*": ["components/*"],
      "@/hooks/*": ["hooks/*"],
      "@/lib/*": ["lib/*"],
      "@/types/*": ["types/*"]
    },
    "jsx": "react-jsx",
    "lib": ["ES2020"]
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts"],
  "exclude": ["node_modules", "dist", "build", ".expo"]
}
```

---

### Shared Packages TypeScript Configurations

#### packages/db/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "./src",
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

#### packages/auth/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "./src",
    "outDir": "./dist",
    "declaration": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

#### packages/api-client/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "./src",
    "outDir": "./dist",
    "declaration": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

#### packages/validators/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "./src",
    "outDir": "./dist",
    "declaration": true"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

#### packages/i18n/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "./src",
    "outDir": "./dist",
    "declaration": true",
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts", "src/**/*.json"],
  "exclude": ["node_modules", "dist"]
}
```

#### packages/analytics/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "./src",
    "outDir": "./dist",
    "declaration": true"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

#### packages/ui/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "./src",
    "outDir": "./dist",
    "declaration": true",
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist", "node_modules"]
}
```

#### packages/ui-mobile/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "./src",
    "outDir": "./dist",
    "declaration": true",
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

#### packages/cache/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "./src",
    "outDir": "./dist",
    "declaration": true"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

#### packages/utils/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": "./src",
    "outDir": "./dist",
    "declaration": true"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Acceptance Criteria

- [ ] Root `tsconfig.json` exists with all strict type-checking options enabled
- [ ] All app-level `tsconfig.json` files extend root config
- [ ] All package-level `tsconfig.json` files extend root config
- [ ] `tsc --noEmit` runs successfully with no errors from root directory
- [ ] `tsc --listFiles` shows correct file resolution order
- [ ] Path aliases resolve correctly (e.g., `@/components/Button` resolves to correct file)
- [ ] IDE (VSCode) recognizes all path aliases with autocomplete
- [ ] Build process correctly generates `.d.ts` declaration files
- [ ] Source maps are generated for debugging
- [ ] No TypeScript errors in any app or package
- [ ] `turbo run type-check` passes across all packages
- [ ] Strict null checks catch potential undefined errors
- [ ] Property initialization checks catch incomplete type definitions

## Dependencies

- Task 1: Turborepo monorepo init completed
- Task 2: App scaffolding completed
- Task 3: Package scaffolding completed
- TypeScript >= 5.4.0 installed at root
- Node.js >= 20.0.0

## Technical Notes

### Path Aliases Strategy

The monorepo uses two levels of path aliases:

1. **Root-level aliases** (`tsconfig.json`):
   - Map `@mentor/*` to `packages/*/src` for shared packages
   - Used across all apps for importing from packages
   - Example: `import { Button } from '@mentor/ui'`

2. **App-level aliases** (app-specific `tsconfig.json`):
   - Map local paths for internal imports within that app
   - Example: `import { Layout } from '@/components/Layout'`
   - Do NOT include `@mentor/*` aliases in app config (extends from root)

### TypeScript Module Resolution Order

```
For import `import { Button } from '@/components/Button'` in apps/web-learner:
1. Check apps/web-learner/src/components/Button
2. Check node_modules/@/components/Button (not found)
3. Error if not found

For import `import { Button } from '@mentor/ui'`:
1. Check packages/ui/src for export
2. Follow package.json exports field
3. Find packages/ui/src/components/Button.tsx
```

### Strict Mode Implications

- **No implicit `any`**: Must declare types explicitly
- **Null safety**: Variables can't be null unless declared as nullable
- **This binding**: Must annotate `this` type in methods
- **Return types**: Function return types must be explicit (or inferable)
- **Unused variables**: Local variables and parameters unused trigger errors

### Debugging with Source Maps

- Source maps enable debugging TypeScript directly in browser DevTools
- Set `sourceMap: true` in tsconfig for all packages
- In production, upload source maps to Sentry for error tracking (see Task 12)

### Monorepo-Specific Considerations

- `incremental: true` caches compiler state for faster builds
- `tsBuildInfoFile: .tsbuildinfo` stores cache file
- Turborepo respects tsconfig changes (auto-rebuilds dependents)
- Each app/package can have own `tsBuildInfoFile` location

### Common Configuration Patterns

**Strict null checks:**

```typescript
// Error: Object is possibly 'null'
function getValue(obj: { value: string | null }) {
  return obj.value.toUpperCase();
}

// Correct:
function getValue(obj: { value: string | null }) {
  return obj.value?.toUpperCase() ?? "";
}
```

**NoImplicitAny:**

```typescript
// Error: Parameter 'x' implicitly has an 'any' type
const add = (x, y) => x + y;

// Correct:
const add = (x: number, y: number): number => x + y;
```

**NoImplicitThis:**

```typescript
// Error: 'this' implicitly has type 'any'
const obj = {
  value: 42,
  getValue: function () {
    return this.value;
  },
};

// Correct:
const obj = {
  value: 42,
  getValue: function (this: typeof obj) {
    return this.value;
  },
};
```

### IDE Configuration for VSCode

Create `.vscode/settings.json` in root:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "typescript.useModuleResolution": true,
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll.eslint": true
    }
  }
}
```

### Incremental Builds

- First build is slower but creates `.tsbuildinfo` cache
- Subsequent builds use cache and only recompile changed files
- Cache must be cleared if: tsconfig changes, TypeScript version updates, or cache corruption
- Clear cache: `rm -rf **/.tsbuildinfo` or `rm -rf **/dist`
