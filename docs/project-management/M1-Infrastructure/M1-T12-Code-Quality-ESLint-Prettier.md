# M1-T12 · Code Quality — ESLint, Prettier, EditorConfig

| Field          | Value                                                 |
| -------------- | ----------------------------------------------------- |
| **Milestone**  | M1 — Project Setup & Infrastructure                   |
| **Status**     | 🔲 To Do                                              |
| **Depends on** | M1-T11 (TypeScript configuration)                     |
| **PRD Ref**    | Section 10.1 (Monorepo — Turborepo, code consistency) |

---

## Description

Configure ESLint and Prettier at the monorepo root so all three apps and `packages/shared` share the same formatting rules and lint checks from the start. Add an `.editorconfig` for IDE-level consistency (indent size, line endings, trailing newlines). These tools run automatically in CI (M1-T14) and as a pre-commit hook (M1-T13) — this task installs and verifies them manually first.

---

## Affected Apps / Packages

| Scope             | Role                                                  |
| ----------------- | ----------------------------------------------------- |
| Root              | Shared ESLint config, Prettier config, EditorConfig   |
| `apps/api`        | Inherits root lint rules; no special overrides needed |
| `apps/admin`      | Inherits root; React/JSX rules enabled                |
| `apps/mobile`     | Inherits root; React Native rules, React hooks rules  |
| `packages/shared` | Inherits root; strictest subset (no JSX)              |

---

## API Endpoints

None — this is a tooling configuration task.

---

## Requirements

### Root `.eslintrc.json`

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": ["./tsconfig.json"],
    "ecmaVersion": 2020,
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint", "import"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:import/recommended",
    "plugin:import/typescript"
  ],
  "rules": {
    // TypeScript
    "@typescript-eslint/no-unused-vars": [
      "error",
      { "argsIgnorePattern": "^_" }
    ],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
    "@typescript-eslint/consistent-type-imports": [
      "error",
      { "prefer": "type-imports" }
    ],
    "@typescript-eslint/no-non-null-assertion": "warn",

    // Imports
    "import/order": [
      "error",
      {
        "groups": [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index"
        ],
        "newlines-between": "always",
        "alphabetize": { "order": "asc", "caseInsensitive": true }
      }
    ],
    "import/no-duplicates": "error",
    "import/no-cycle": "error",

    // General
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "eqeqeq": ["error", "always"],
    "no-var": "error",
    "prefer-const": "error"
  },
  "overrides": [
    {
      // React/JSX rules for admin and mobile apps
      "files": ["apps/admin/**/*.tsx", "apps/mobile/**/*.tsx"],
      "plugins": ["react", "react-hooks"],
      "extends": ["plugin:react/recommended", "plugin:react-hooks/recommended"],
      "rules": {
        "react/react-in-jsx-scope": "off",
        "react/prop-types": "off",
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn"
      },
      "settings": {
        "react": { "version": "detect" }
      }
    },
    {
      // Relax some rules in test files when added later
      "files": ["**/*.test.ts", "**/*.spec.ts"],
      "rules": {
        "@typescript-eslint/no-explicit-any": "off",
        "no-console": "off"
      }
    }
  ],
  "ignorePatterns": [
    "node_modules",
    "dist",
    ".turbo",
    ".expo",
    "*.gen.ts",
    "routeTree.gen.ts"
  ]
}
```

### Root `.prettierrc.json`

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "quoteProps": "as-needed",
  "jsxSingleQuote": false,
  "trailingComma": "es5",
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### Root `.prettierignore`

```
node_modules
dist
.turbo
.expo
*.gen.ts
routeTree.gen.ts
pnpm-lock.yaml
*.docx
*.png
*.jpg
```

### Root `.editorconfig`

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false

[*.json]
indent_size = 2

[Makefile]
indent_style = tab
```

### Root `package.json` — lint scripts

Add the following scripts to the root `package.json`:

```json
{
  "scripts": {
    "lint": "turbo run lint",
    "lint:fix": "turbo run lint:fix",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,json,md}\""
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.57.0",
    "eslint-plugin-import": "^2.29.0",
    "eslint-plugin-react": "^7.34.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "prettier": "^3.2.0"
  }
}
```

### Per-App `lint` and `lint:fix` Scripts

Add to each app's `package.json`:

```json
{
  "scripts": {
    "lint": "eslint src/ --ext .ts,.tsx",
    "lint:fix": "eslint src/ --ext .ts,.tsx --fix"
  }
}
```

And for `packages/shared`:

```json
{
  "scripts": {
    "lint": "eslint src/ --ext .ts",
    "lint:fix": "eslint src/ --ext .ts --fix"
  }
}
```

### `turbo.json` — add lint tasks

```json
{
  "tasks": {
    "lint": {
      "dependsOn": [],
      "outputs": []
    },
    "lint:fix": {
      "dependsOn": [],
      "outputs": [],
      "cache": false
    },
    "format:check": {
      "dependsOn": [],
      "outputs": []
    }
  }
}
```

---

## Acceptance Criteria

- [ ] `pnpm lint` from repo root runs ESLint across all apps and packages with zero errors on the scaffolded code
- [ ] `pnpm format:check` from root finds no formatting violations
- [ ] `pnpm format` reformats all `.ts`/`.tsx` files consistently (verify with `git diff`)
- [ ] `.editorconfig` recognized by VSCode — new files created with LF line endings and 2-space indent
- [ ] `import/order` rule enforces alphabetical import grouping — verified manually in `apps/server/src/index.ts`
- [ ] `@typescript-eslint/no-floating-promises` catches a deliberate test case (e.g., `fetch("...")` without `await`)
- [ ] React hooks rules active in `apps/admin` and `apps/mobile` overrides
- [ ] `routeTree.gen.ts` excluded from lint (TanStack Router auto-generated file)
- [ ] `turbo run lint` caches lint results — second run completes in <1s
- [ ] All three apps pass `turbo run type-check && turbo run lint` with no errors

---

## Technical Notes

### ESLint Flat Config vs Legacy

This task uses the legacy `.eslintrc.json` format (ESLint v8). ESLint v9 introduced a flat config (`eslint.config.js`). As of March 2026, most plugins still have better support for v8 format. Migrate to flat config when the ecosystem catches up — it will be a mechanical rename with no logic changes.

### `import/no-cycle` Performance

The `import/no-cycle` rule can be slow on large codebases. If lint times exceed 30s, add `"import/no-cycle": "warn"` only and run it separately in CI, not in the pre-commit hook.

### Prettier vs ESLint Formatting

Prettier owns formatting (spacing, line length, quote style). ESLint owns code quality (unused vars, floating promises, import order). Do **not** use ESLint formatting rules (`indent`, `quotes`, `semi`) — they conflict with Prettier. The config above only uses ESLint for code quality rules.

### Per-App vs Root Config

All apps inherit from the root `.eslintrc.json`. The `overrides` block in the root config handles per-app rule sets (e.g., React rules only for `apps/admin` and `apps/mobile`). This avoids maintaining three separate ESLint configs while still allowing targeted rules.

---

## Common Gotchas

- **`parserOptions.project`** — Points to `./tsconfig.json` at root. For `@typescript-eslint/recommended-requiring-type-checking` rules to work, ESLint must find the tsconfig. If you get "Parsing error: Cannot read file tsconfig.json", run `eslint` from the repo root, not from inside an app directory.
- **`import/no-unresolved` false positives** — The `import` plugin may not resolve `@ceolx/shared` without additional config. Add `"import/resolver": { "typescript": { "project": "./tsconfig.json" } }` if you see false errors.
- **`.eslintignore` vs `ignorePatterns`** — This config uses `ignorePatterns` in `.eslintrc.json`. Do not also create a `.eslintignore` file — duplicate ignore sources cause confusion.
- **React version detection** — `"react": { "version": "detect" }` reads the React version from `node_modules`. If admin and mobile have different React versions this may warn; pin them to the same version.
- **Expo and `console.log`** — React Native development relies on `console.log` for debugging. The `"no-console": "warn"` rule will flag these. Add `// eslint-disable-next-line no-console` on intentional debug logs, or tighten to `"error"` before shipping.

---
