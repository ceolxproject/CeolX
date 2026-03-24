# Task 1: Initialize Turborepo with pnpm Workspaces

## Description

Set up the root Turborepo configuration with pnpm workspaces, create the root `package.json` with workspace definitions, configure `turbo.json` with build/dev/lint/type-check pipelines, set up `.npmrc` for pnpm configuration, and establish the root `.gitignore` file. This foundational setup enables the monorepo to function as a cohesive unit with shared dependencies and efficient task orchestration.

## Affected Apps/Packages

- Root monorepo configuration (all apps and packages depend on this)
- All 5 apps: api, web-learner, web-mentor, web-admin, mobile
- All 10 shared packages: db, auth, api-client, validators, i18n, analytics, ui, ui-mobile, cache, utils

## Requirements

### Root Directory Structure

- Create `/root/package.json` with pnpm workspaces defined
- Create `/root/turbo.json` with task pipeline configuration
- Create `/root/.npmrc` with pnpm settings
- Create `/root/.gitignore` with appropriate exclusions
- Create `/root/pnpm-workspace.yaml` (optional but recommended)

### Root package.json Setup

- Set name to `mentor` or `@mentor/mentor`
- Set version to `0.0.1`
- Define `pnpm-workspaces` array pointing to all apps and packages:
  - `apps/*`
  - `packages/*`
- Include root-level dev dependencies:
  - `turbo`: Latest stable version (v2.x)
  - `typescript`: ^5.4.0
  - `@types/node`: ^20.x
  - `eslint`: ^9.0.0
  - `prettier`: ^3.2.0
  - `husky`: ^9.x
  - `lint-staged`: ^15.x
  - `commitlint`: ^19.x
  - `@commitlint/config-conventional`: ^19.x
- Set `engines.pnpm` to `>=9.0.0`
- Set `engines.node` to `>=20.0.0`

### turbo.json Configuration

- Configure pipelines for:
  - `build`: Include dependencies, outputs for dist/build artifacts
  - `dev`: Run in parallel, no caching
  - `lint`: No dependencies
  - `type-check`: Includes dependencies, no caching
  - `test`: No dependencies
  - `db:migrate`: Run sequentially (database operations)
  - `db:seed`: Run sequentially after migrate
- Use `globalDependencies` for:
  - TypeScript configuration changes
  - ESLint configuration changes
  - Environment variable changes
- Enable `globalEnv` array for environment variables that affect all tasks
- Set `prune` enabled for production builds

### .npmrc Configuration

```
shamefully-hoist=true
strict-peer-dependencies=false
ignore-workspace-root-check=true
auto-install-peers=true
```

### .gitignore Setup

Include patterns for:

- Node modules and package managers: `node_modules/`, `pnpm-lock.yaml`, `.pnpm-store/`
- Build outputs: `dist/`, `build/`, `.next/`, `.turbo/`
- Environment files: `.env`, `.env.local`, `.env.*.local`
- IDE files: `.vscode/`, `.idea/`, `*.swp`, `*.swo`, `.DS_Store`
- OS files: `Thumbs.db`
- Testing outputs: `coverage/`
- Logging: `logs/`, `*.log`

### pnpm-workspace.yaml (Optional but Recommended)

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

## Acceptance Criteria

- [ ] Root `package.json` exists with correct workspace configuration
- [ ] `pnpm install` runs successfully from root and installs all dependencies
- [ ] `turbo.json` contains all required pipelines with correct caching/dependency configurations
- [ ] Running `turbo build` executes builds in correct dependency order
- [ ] Running `turbo dev` starts all development servers without errors
- [ ] Running `turbo lint` checks all packages
- [ ] `.npmrc` file contains all required pnpm settings
- [ ] `.gitignore` prevents committing build artifacts, node_modules, and environment files
- [ ] Root `tsconfig.json` can be extended by all workspace packages
- [ ] No peer dependency warnings when running `pnpm install`
- [ ] Git initialization is clean (only tracked files should be present after setup)

## Dependencies

- Node.js >= 20.0.0 installed and available
- pnpm >= 9.0.0 installed globally
- Git initialized in the repository root

## Technical Notes

### Turborepo Task Pipeline Best Practices

- Always specify `outputs` arrays for build tasks to enable caching
- Use `dependsOn` with `^` prefix for tasks in dependent packages (e.g., `^build` means wait for dependencies to build first)
- Database migration tasks should NOT use caching (use `"cache": false`)
- Development tasks should use `cache: false` and `parallel: true`

### pnpm-specific Considerations

- `shamefully-hoist=true` ensures npm packages expecting hoisted dependencies work correctly
- `strict-peer-dependencies=false` allows more flexibility with peer dependency resolution
- Use `pnpm -r` to run commands across all workspaces from root

### Monorepo Package Structure Expected

```
mentor/
├── apps/
│   ├── api/
│   ├── web-learner/
│   ├── web-mentor/
│   ├── web-admin/
│   └── mobile/
├── packages/
│   ├── auth/
│   ├── api-client/
│   ├── db/
│   ├── validators/
│   ├── i18n/
│   ├── analytics/
│   ├── ui/
│   ├── ui-mobile/
│   ├── cache/
│   └── utils/
├── package.json
├── turbo.json
├── .npmrc
├── pnpm-workspace.yaml
└── .gitignore
```

### Commands to Verify Setup

```bash
# Verify pnpm workspace recognition
pnpm ls --depth=0

# List all tasks available in turbo
turbo list-tasks

# Run a specific task across workspaces
turbo run build --filter=packages/db

# Check which packages depend on each other
turbo graph --json
```

### Common Gotchas

- If `pnpm install` fails, clear the cache: `pnpm store prune && rm -rf node_modules pnpm-lock.yaml`
- TypeScript should be installed at root for IDE support across all packages
- Ensure `engines.node` and `engines.pnpm` match CI/CD environment constraints
- Some Next.js features may require `shamefully-hoist=true` for proper resolution
