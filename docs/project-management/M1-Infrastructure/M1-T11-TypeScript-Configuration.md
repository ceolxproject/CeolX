# M1-T11 · TypeScript Configuration (Root + App-Level)

| Field          | Value                                                       |
| -------------- | ----------------------------------------------------------- |
| **Milestone**  | M1 — Project Setup & Infrastructure                         |
| **Status**     | 🔲 To Do                                                    |
| **Depends on** | M1-T1 (Turborepo init), M1-T10 (Shared package scaffolding) |
| **PRD Ref**    | Section 10.1 (Tech Stack — TypeScript-first throughout)     |

---

## Description

Establish the TypeScript configuration hierarchy across the entire monorepo: one root `tsconfig.json` that defines all strict settings and path aliases, with per-app configs that extend it and add only app-specific overrides (JSX mode, lib targets, path aliases). This task ensures consistent type safety from day one and enables IDE autocomplete for `@ceolx/shared` imports across all three apps.

---

## Affected Apps / Packages

| App / Package     | Role                                                        |
| ----------------- | ----------------------------------------------------------- |
| `/tsconfig.json`  | Root — defines strict settings, shared package path aliases |
| `apps/api`        | Extends root — Node.js target, no DOM libs                  |
| `apps/admin`      | Extends root — React JSX, DOM libs, Vite-compatible         |
| `apps/mobile`     | Extends root — React Native JSX, no DOM libs                |
| `packages/shared` | Extends root — library mode, generates `.d.ts` declarations |

---

## API Endpoints

None — this is a configuration task.

---

## Requirements

### Root TypeScript Configuration (`/tsconfig.json`)

```json
{
  "compilerOptions": {
    // Language and Environment
    "target": "ES2020",
    "lib": ["ES2020"],
    "useDefineForClassFields": true,

    // Module Resolution
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,

    // Strict Type-Checking (all on)
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true,

    // Completeness
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "allowUnusedLabels": false,
    "allowUnreachableCode": false,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,

    // Emit
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "noEmit": false,

    // Incremental
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo",

    // Monorepo path aliases — @ceolx/shared resolves to packages/shared/src
    "baseUrl": ".",
    "paths": {
      "@ceolx/shared": ["packages/shared/src"],
      "@ceolx/shared/*": ["packages/shared/src/*"]
    }
  },
  "exclude": ["node_modules", "**/dist", "**/.next", "**/.turbo", "**/.expo"]
}
```

### apps/api/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2020"],
    "module": "ESNext",
    "target": "ES2020",
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@/routes/*": ["routes/*"],
      "@/middleware/*": ["middleware/*"],
      "@/services/*": ["services/*"],
      "@/schemas/*": ["schemas/*"],
      "@/lib/*": ["lib/*"]
    },
    "outDir": "./dist",
    "noEmit": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### apps/admin/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@/components/*": ["components/*"],
      "@/routes/*": ["routes/*"],
      "@/lib/*": ["lib/*"],
      "@/hooks/*": ["hooks/*"]
    },
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

### apps/mobile/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2020"],
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "baseUrl": "./src",
    "paths": {
      "@/*": ["*"],
      "@/components/*": ["components/*"],
      "@/screens/*": ["screens/*"],
      "@/navigation/*": ["navigation/*"],
      "@/hooks/*": ["hooks/*"],
      "@/context/*": ["context/*"],
      "@/lib/*": ["lib/*"]
    },
    "noEmit": true
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts"],
  "exclude": ["node_modules", "dist", ".expo"]
}
```

### packages/shared/tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2020"],
    "baseUrl": "./src",
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "noEmit": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### VSCode Settings (`.vscode/settings.json` at repo root)

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll.eslint": "explicit",
      "source.organizeImports": "never"
    }
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true
  },
  "editor.rulers": [100],
  "files.exclude": {
    "**/node_modules": true,
    "**/.turbo": true,
    "**/dist": true,
    "**/.tsbuildinfo": true
  }
}
```

---

## Acceptance Criteria

- [ ] Root `tsconfig.json` exists at repo root with all strict flags enabled
- [ ] `apps/api/tsconfig.json` extends root; no DOM lib entries
- [ ] `apps/admin/tsconfig.json` extends root; includes DOM lib and JSX support
- [ ] `apps/mobile/tsconfig.json` extends root; includes React JSX support
- [ ] `packages/shared/tsconfig.json` extends root; generates `.d.ts` files
- [ ] `import { UserRole } from "@ceolx/shared"` resolves with IDE autocomplete in all three apps
- [ ] `import { BoundingBox } from "@ceolx/shared/types"` resolves correctly
- [ ] `tsc --noEmit` from root completes with zero errors across all workspaces
- [ ] `turbo run type-check` passes across all packages
- [ ] `noImplicitAny` catches missing type annotations in API service files
- [ ] `strictNullChecks` forces null-safe access on database query results
- [ ] Source maps generated for `apps/api` (needed for Sentry in M1-T9)
- [ ] `.vscode/settings.json` committed so IDE uses workspace TypeScript version

---

## Technical Notes

### Two-Level Path Alias Strategy

The monorepo uses two levels of path aliases:

**Level 1 — Root aliases** (packages across the monorepo):

```typescript
// tsconfig.json root — resolves @ceolx/shared to packages/shared/src
"@ceolx/shared": ["packages/shared/src"]
```

**Level 2 — App-level aliases** (internal to each app):

```typescript
// apps/api/tsconfig.json — resolves @/routes/* within apps/api/src
"@/routes/*": ["routes/*"]
```

Never define `@ceolx/*` aliases in app-level configs — they inherit from root.

### `moduleResolution: "bundler"` Explained

`bundler` resolution is the correct choice when your code is processed by a bundler (esbuild for the API, Vite for admin, Metro for mobile) rather than Node.js directly. It allows:

- Importing `"@ceolx/shared"` without the full file path
- Imports without file extensions
- The `exports` field in `package.json` is respected

Do **not** use `"node16"` or `"nodenext"` — those require `.js` extensions on all imports, which conflicts with how Hono and Vite projects are structured.

### Strict Mode Implications

| Setting                      | What it catches                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `noImplicitAny`              | Parameters without type annotations                                                             |
| `strictNullChecks`           | Accessing properties on values that might be `undefined` (e.g., DB query results)               |
| `noImplicitReturns`          | Missing `return` in a branch of a function                                                      |
| `useUnknownInCatchVariables` | `catch (err)` where `err` is typed as `unknown`, forcing you to narrow the type before using it |
| `noImplicitOverride`         | Class methods that override a base class method must be annotated with `override`               |

### Incremental Builds

`incremental: true` writes a `.tsbuildinfo` cache file on first compile. Subsequent `tsc` invocations only recompile changed files. Add `.tsbuildinfo` to `.gitignore`:

```
# .gitignore
*.tsbuildinfo
```

### `skipLibCheck: true`

Set to `true` to skip type-checking of `.d.ts` files in `node_modules`. This prevents false type errors from third-party libraries that ship incorrect types and is standard practice in production TypeScript monorepos.

---

## Common Gotchas

- **`paths` in tsconfig ≠ runtime module resolution** — TypeScript path aliases only apply at compile time. At runtime, the bundler (esbuild, Vite, Metro) also needs to know the alias. Vite uses `resolve.alias`, Metro uses `moduleNameMapper`; check each app's bundler config matches the tsconfig paths.
- **`noEmit: true` on app tsconfigs** — Admin and mobile apps let their bundler (Vite, Metro) handle compilation output; setting `noEmit: true` prevents `tsc` from writing redundant build output while still catching type errors.
- **`"type": "module"` in package.json** — All packages use ESM. If a package is missing `"type": "module"`, TypeScript may resolve imports incorrectly in monorepo context.
- **Order of `include` in mobile tsconfig** — `**/*.ts` and `**/*.tsx` must come before `.expo/types/**/*.ts` or Expo-generated types won't override correctly.

---
