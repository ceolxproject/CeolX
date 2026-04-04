# M1-T11 · TypeScript Configuration (Root + App-Level)

| Field          | Value                                                       |
| -------------- | ----------------------------------------------------------- |
| **Milestone**  | M1 — Project Setup & Infrastructure                         |
| **Status**     | ✅ Done                                                     |
| **Depends on** | M1-T1 (Turborepo init), M1-T10 (Shared package scaffolding) |
| **PRD Ref**    | Section 10.1 (Tech Stack — TypeScript-first throughout)     |

---

## Description

Establish the TypeScript configuration hierarchy across the entire monorepo using a **two-level architecture**:

- **Level 1 — Shared base** (`packages/config/tsconfig.base.json`): all compiler options, strict flags, and shared settings. Every app and package extends this.
- **Level 2 — App / package overrides**: per-app configs that extend the base and add only what is specific to that app (JSX mode, lib targets, path aliases, `noEmit`).

The root `/tsconfig.json` is a thin delegator that extends the base and adds the monorepo-level `@ceolx/shared` path alias (which requires `baseUrl: "."` at the repo root). This task ensures consistent type safety from day one and enables IDE autocomplete for `@ceolx/shared` imports across all three apps.

---

## Affected Apps / Packages

| App / Package                        | Role                                                              |
| ------------------------------------ | ----------------------------------------------------------------- |
| `packages/config/tsconfig.base.json` | Shared base — all strict flags, module resolution, common options |
| `/tsconfig.json`                     | Root — extends base, adds `@ceolx/shared` path alias              |
| `apps/server`                        | Extends base — Node.js/Hono target, no DOM libs                   |
| `apps/admin`                         | Extends base — React JSX, DOM libs, Vite-compatible               |
| `apps/native`                        | Extends `expo/tsconfig.base` — React Native, Expo types           |
| `packages/shared`                    | Extends base — library mode, generates `.d.ts` declarations       |

---

## API Endpoints

None — this is a configuration task.

---

## Requirements

### packages/config/tsconfig.base.json

The real shared base. All apps and packages (except `apps/native`) extend this.

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    // Language and Environment
    "target": "ESNext",
    "lib": ["ESNext"],
    "useDefineForClassFields": true,

    // Module Resolution
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,

    // Strict Type-Checking
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,

    // Completeness
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "allowUnusedLabels": false,
    "allowUnreachableCode": false,
    "useUnknownInCatchVariables": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,

    // Runtime types
    "types": ["node"]
  }
}
```

### Root `/tsconfig.json`

Thin delegator — extends base and adds the monorepo-wide `@ceolx/shared` path alias (requires `baseUrl: "."` at repo root).

```json
{
  "extends": "@CeolX/config/tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@ceolx/shared": ["packages/shared/src"],
      "@ceolx/shared/*": ["packages/shared/src/*"]
    }
  },
  "exclude": ["node_modules", "**/dist", "**/.turbo", "**/.expo"]
}
```

### apps/server/tsconfig.json

```json
{
  "extends": "@CeolX/config/tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "composite": true,
    "outDir": "dist",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/routes/*": ["./src/routes/*"],
      "@/middleware/*": ["./src/middleware/*"],
      "@/services/*": ["./src/services/*"],
      "@/schemas/*": ["./src/schemas/*"],
      "@/lib/*": ["./src/lib/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

> **Note:** `jsx: "react-jsx"` + `jsxImportSource: "hono/jsx"` enables Hono's JSX HTML rendering. `composite: true` enables TypeScript project references for incremental builds.

### apps/admin/tsconfig.json

```json
{
  "extends": "../../packages/config/tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "types": ["vite/client"],
    "rootDirs": ["."],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/routes/*": ["./src/routes/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/hooks/*": ["./src/hooks/*"],
      "@CeolX/ui/*": ["../../packages/ui/src/*"]
    },
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

> **Note:** `types: ["vite/client"]` provides Vite's `import.meta.env` types. `noEmit: true` — Vite handles compilation output; tsc runs for type-checking only.

### apps/native/tsconfig.json

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@/components/*": ["./components/*"],
      "@/screens/*": ["./screens/*"],
      "@/navigation/*": ["./navigation/*"],
      "@/hooks/*": ["./hooks/*"],
      "@/context/*": ["./context/*"],
      "@/lib/*": ["./lib/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"],
  "exclude": ["node_modules", "dist", ".expo"]
}
```

> **Note:** `apps/native` extends `expo/tsconfig.base` (not the CeolX base) because Expo ships its own compiler options and React Native type overrides that must come first. Strict mode is re-declared explicitly since Expo's base does not enable it.

### packages/shared/tsconfig.json

```json
{
  "extends": "@CeolX/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
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

## Gaps — What Still Needs to Be Done

The following items have been identified as missing or incorrect in the current codebase. These must be completed before the acceptance criteria can be signed off.

| #   | File                                 | Gap                                                                                                                       | Fix                                                         |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | `.vscode/settings.json`              | File does not exist (only `.vscode/mcp.json` present)                                                                     | Create per spec above                                       |
| 2   | `/tsconfig.json`                     | No `baseUrl` or `@ceolx/shared` paths — alias not resolvable                                                              | Add `baseUrl: "."` and `@ceolx/shared` paths                |
| 3   | `packages/config/tsconfig.base.json` | Missing `noImplicitReturns`, `noImplicitOverride`, `allowUnreachableCode`, `allowUnusedLabels`, `useDefineForClassFields` | Add flags per spec above                                    |
| 4   | `packages/shared/tsconfig.json`      | Missing `declaration: true`, `declarationMap: true`, `sourceMap: true`                                                    | Add flags; other library packages already have them         |
| 5   | `packages/shared/package.json`       | No `check-types` script — turbo skips it                                                                                  | Add `"check-types": "tsc --noEmit"`                         |
| 6   | `apps/admin/tsconfig.json`           | Standalone config — does not extend CeolX base                                                                            | Refactor to extend base, keep admin-specific overrides only |
| 7   | `apps/admin/tsconfig.json`           | Missing specific path aliases (`@/components/*`, `@/routes/*`, `@/lib/*`, `@/hooks/*`)                                    | Add per spec above                                          |
| 8   | `apps/server/tsconfig.json`          | Missing specific path aliases (`@/routes/*`, `@/middleware/*`, `@/services/*`, `@/schemas/*`, `@/lib/*`)                  | Add per spec above                                          |
| 9   | `apps/native/tsconfig.json`          | Missing specific path aliases for all internal directories                                                                | Add per spec above                                          |
| 10  | `apps/native/package.json`           | Script named `type-check` — turbo's `check-types` task skips native app                                                   | Rename to `check-types`                                     |
| 11  | `apps/native/package.json`           | Missing `"type": "module"`                                                                                                | Add field                                                   |

---

## Acceptance Criteria

- [ ] `packages/config/tsconfig.base.json` contains all completeness flags (`noImplicitReturns`, `noImplicitOverride`, `allowUnreachableCode: false`, `allowUnusedLabels: false`, `useDefineForClassFields: true`)
- [ ] Root `tsconfig.json` extends base and adds `@ceolx/shared` / `@ceolx/shared/*` path aliases with `baseUrl: "."`
- [ ] `apps/server/tsconfig.json` extends base; has Hono JSX settings and specific `@/` path aliases
- [ ] `apps/admin/tsconfig.json` extends base; includes DOM lib, JSX support, and specific `@/` path aliases
- [ ] `apps/native/tsconfig.json` extends `expo/tsconfig.base`; has specific `@/` path aliases
- [ ] `packages/shared/tsconfig.json` extends base; generates `.d.ts` files (`declaration: true`, `declarationMap: true`)
- [ ] `import { UserRole } from "@ceolx/shared"` resolves with IDE autocomplete in all three apps
- [ ] `import { BoundingBox } from "@ceolx/shared/types"` resolves correctly
- [ ] `tsc --noEmit` from root completes with zero errors across all workspaces
- [ ] `turbo run check-types` passes across all packages (including `apps/native` and `packages/shared`)
- [ ] `noImplicitAny` catches missing type annotations in API service files
- [ ] `strictNullChecks` forces null-safe access on database query results
- [ ] Source maps generated for `apps/server` (needed for Sentry in M1-T9)
- [ ] `.vscode/settings.json` committed so IDE uses workspace TypeScript version
- [ ] `apps/native/package.json` has `"type": "module"` and `check-types` script
- [ ] `packages/shared/package.json` has `check-types` script

---

## Technical Notes

### Three-Level Configuration Hierarchy

```
packages/config/tsconfig.base.json     ← all shared compiler options
        ↑
/tsconfig.json                          ← extends base + @ceolx/shared alias
        ↑
apps/server/tsconfig.json              ← extends base directly (server-specific)
apps/admin/tsconfig.json               ← extends base directly (DOM + JSX)
packages/shared/tsconfig.json          ← extends base directly (library emit)

expo/tsconfig.base                      ← Expo-managed (separate tree)
        ↑
apps/native/tsconfig.json              ← extends Expo base (RN-specific)
```

`apps/native` sits outside the CeolX base hierarchy because Expo's base must own the React Native compiler settings. Strict mode is re-enabled explicitly in `apps/native/tsconfig.json`.

### Two-Level Path Alias Strategy

**Level 1 — Monorepo aliases** (in root `tsconfig.json`, resolves across packages):

```typescript
// /tsconfig.json — resolves @ceolx/shared to packages/shared/src
"@ceolx/shared": ["packages/shared/src"]
```

**Level 2 — App-internal aliases** (in each app's tsconfig, resolves within that app's src):

```typescript
// apps/server/tsconfig.json — resolves @/routes/* within apps/server/src
"@/routes/*": ["./src/routes/*"]
```

Never define `@ceolx/*` aliases in app-level configs — they inherit from root.

### Turbo Task Name

The turbo task is named **`check-types`** (not `type-check`). Run with:

```bash
pnpm turbo run check-types
```

All `package.json` scripts must use `check-types` to be picked up by turborepo.

### `moduleResolution: "bundler"` Explained

`bundler` resolution is the correct choice when code is processed by a bundler (esbuild for the API, Vite for admin, Metro for mobile) rather than Node.js directly. It allows:

- Importing `"@ceolx/shared"` without the full file path
- Imports without file extensions
- The `exports` field in `package.json` is respected

Do **not** use `"node16"` or `"nodenext"` — those require `.js` extensions on all imports, which conflicts with how Hono and Vite projects are structured.

### Strict Mode Implications

| Setting                      | What it catches                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `noImplicitAny`              | Parameters without type annotations                                                             |
| `strictNullChecks`           | Accessing properties on values that might be `undefined` (e.g., DB query results)               |
| `noImplicitReturns`          | Missing `return` in a branch of a function                                                      |
| `useUnknownInCatchVariables` | `catch (err)` where `err` is typed as `unknown`, forcing you to narrow the type before using it |
| `noImplicitOverride`         | Class methods that override a base class method must be annotated with `override`               |
| `noUncheckedIndexedAccess`   | Array/object index access returns `T                                                            | undefined`, preventing silent out-of-bounds bugs |

### Incremental Builds

`*.tsbuildinfo` is already in `.gitignore`. For packages using `composite: true` (e.g., `apps/server`), tsc uses project references and caches build info automatically.

### `skipLibCheck: true`

Set to `true` to skip type-checking of `.d.ts` files in `node_modules`. This prevents false type errors from third-party libraries that ship incorrect types and is standard practice in production TypeScript monorepos.

---

## Common Gotchas

- **`paths` in tsconfig ≠ runtime module resolution** — TypeScript path aliases only apply at compile time. At runtime, the bundler (esbuild, Vite, Metro) also needs to know the alias. Vite uses `resolve.alias`, Metro uses `moduleNameMapper`; check each app's bundler config matches the tsconfig paths.
- **`noEmit: true` on app tsconfigs** — Admin and mobile apps let their bundler (Vite, Metro) handle compilation output; setting `noEmit: true` prevents `tsc` from writing redundant build output while still catching type errors.
- **`"type": "module"` in package.json** — All packages and apps use ESM. `apps/native` currently missing this field — must be added.
- **Order of `include` in native tsconfig** — `**/*.ts` and `**/*.tsx` must come before `.expo/types/**/*.ts` so Expo-generated types can override correctly.
- **`verbatimModuleSyntax`** — Inherited from base. Requires `import type` for type-only imports. All new code must follow this pattern.
- **`apps/admin` extends path** — Use `../../packages/config/tsconfig.base.json` (relative path) rather than the package name, since admin's `tsconfig.json` resolves differently than bundled code.

---
