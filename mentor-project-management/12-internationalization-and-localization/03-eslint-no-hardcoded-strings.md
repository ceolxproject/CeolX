# Task: Configure ESLint No-Hardcoded-Strings Rule

## Description

Implement ESLint rule `eslint-plugin-i18next/no-literal-string` across all apps to prevent hardcoded UI strings and enforce translation key usage throughout the codebase. CI/CD pipeline must fail builds with hardcoded strings violations. Set up whitelisting for technical strings (CSS class names, URLs, etc.) and provide auto-fix suggestions via linting tools.

## Affected Apps/Packages

- `apps/web` (Next.js)
- `apps/mobile` (React Native)
- `apps/admin` (Next.js)
- `apps/instructor` (Next.js)
- `.eslintrc.json` (monorepo root)

## Requirements

### ESLint Rule Installation

- Install `eslint-plugin-i18next` (latest version)
- Configure rule in all `.eslintrc.json` files
- Apply same configuration across monorepo
- Enable rule as ERROR (not warning) to block builds

### Rule Configuration

Enable `i18next/no-literal-string` rule with:

- Default language set to EN
- Markup allowed for technical elements
- Function call whitelisting for non-UI strings
- Namespace validation

### Hardcoded Strings Detection

Rule must catch:

- Text in JSX elements: `<button>Save</button>`
- String literals in `console.log()` for production
- Object property values (with exceptions for technical keys)
- Template literals with text content
- Component props for text content

### Whitelisting Strategy

Whitelist specific strings/patterns that are technical, not user-facing:

- CSS class names
- HTML data attributes
- JavaScript identifiers
- Regular expression patterns
- Error stack traces
- URLs and domains (except labels/descriptions)
- Logger names, analytics event names

### CI Integration

- Lint check runs on every commit
- Pre-commit hook to catch violations early
- Build fails if ESLint errors found
- Error report clearly indicates which strings need translation

## Acceptance Criteria

- [ ] `eslint-plugin-i18next` installed across all apps
- [ ] Rule configured as ERROR in all ESLint configs
- [ ] Linting detects hardcoded strings in JSX
- [ ] Linting detects hardcoded strings in string literals
- [ ] Linting detects hardcoded strings in object values
- [ ] Whitelisted patterns don't trigger errors (CSS, URLs, etc.)
- [ ] CI/CD pipeline fails build on hardcoded strings
- [ ] Auto-fix suggestions available (where possible)
- [ ] Team documentation with examples provided
- [ ] False positives minimized via whitelist

## Dependencies

- React-i18next setup complete (Task: react-i18next-setup.md)
- Locale files created (Task: locale-files-scaffold.md)

## Technical Notes

### Installation

**monorepo package.json:**

```bash
npm install --save-dev eslint-plugin-i18next
```

### ESLint Configuration

**apps/web/.eslintrc.json:**

```json
{
  "root": true,
  "extends": ["next/core-web-vitals"],
  "plugins": ["i18next"],
  "rules": {
    "i18next/no-literal-string": [
      "error",
      {
        "markupOnly": false,
        "ignoreAttribute": ["alt", "placeholder"],
        "onlyAttribute": [],
        "validLocaleLanguageKey": "en",
        "FunctionProperties": {
          "alwaysConsiderValues": false,
          "ignoreFunctions": [
            "defineMessages",
            "defineMessage",
            "setStyle",
            "debug",
            "warn",
            "log",
            "info",
            "error",
            "makeStyles",
            "useStyles"
          ]
        }
      }
    ]
  }
}
```

**apps/mobile/.eslintrc.json (React Native):**

```json
{
  "root": true,
  "extends": ["plugin:react-native/all"],
  "plugins": ["i18next"],
  "rules": {
    "i18next/no-literal-string": [
      "error",
      {
        "markupOnly": false,
        "validLocaleLanguageKey": "en",
        "FunctionProperties": {
          "ignoreFunctions": [
            "StyleSheet.create",
            "useStyles",
            "debug",
            "warn",
            "log",
            "info",
            "error"
          ]
        }
      }
    ]
  }
}
```

**apps/admin/.eslintrc.json:**

```json
{
  "root": true,
  "extends": ["next/core-web-vitals"],
  "plugins": ["i18next"],
  "rules": {
    "i18next/no-literal-string": [
      "error",
      {
        "markupOnly": false,
        "validLocaleLanguageKey": "en",
        "FunctionProperties": {
          "ignoreFunctions": [
            "defineMessages",
            "defineMessage",
            "debug",
            "warn",
            "log",
            "info",
            "error"
          ]
        }
      }
    ]
  }
}
```

### Rule Configuration Explanation

```json
{
  "markupOnly": false,
  // false = check ALL strings, not just JSX markup
  // true = check only JSX/HTML content

  "validLocaleLanguageKey": "en",
  // Default language for the project (used for determining
  // what counts as a "hardcoded" string)

  "FunctionProperties": {
    "ignoreFunctions": [
      // Array of function names where string literals are OK
      // (e.g., console.log, debug utilities, styling functions)
    ]
  },

  "ignoreAttribute": ["alt", "placeholder"],
  // Attributes that are allowed to contain hardcoded strings
  // (security/accessibility exceptions)

  "onlyAttribute": []
  // If set, ONLY these attributes will be checked
  // (empty = check all)
}
```

### Incorrect Usage Examples (Will be caught)

**❌ Hardcoded text in JSX:**

```jsx
// Button with hardcoded text
<button>Save</button>

// Component with hardcoded prop
<Label text="Enter your email" />

// String literal for user-facing message
const message = "Course updated successfully";
```

**❌ Hardcoded placeholder/title:**

```jsx
<input placeholder="Enter your name" />
<img alt="Course thumbnail" src="/image.jpg" />
```

**❌ Object with hardcoded labels:**

```javascript
const options = {
  save: "Save",
  delete: "Delete",
  edit: "Edit",
};
```

### Correct Usage Examples (Will pass)

**✅ Using translation keys:**

```jsx
import { useTranslation } from "react-i18next";

function Button() {
  const { t } = useTranslation("common");

  return <button>{t("button.save")}</button>;
}
```

**✅ Using i18n in objects:**

```jsx
import { useTranslation } from "react-i18next";

function Options() {
  const { t } = useTranslation("common");

  const options = [
    { label: t("button.save"), value: "save" },
    { label: t("button.delete"), value: "delete" },
    { label: t("button.edit"), value: "edit" },
  ];

  return <select>{/* ... */}</select>;
}
```

**✅ Whitelisted function calls (technical strings):**

```javascript
// Console logging OK for debug functions
debug("Processing user data");

// CSS class names in style functions (whitelisted)
const styles = makeStyles(() => ({
  container: "course-container",
  header: "course-header",
}));

// Logger names
logger.info("User login event");

// Technical identifiers
const EVENT_NAME = "user_sign_up";
```

**✅ Technical string exceptions (URLs, class names):**

```javascript
// URLs and domains OK (not user-facing labels)
const API_ENDPOINT = 'https://api.example.com/courses';

// CSS class names OK
className="flex flex-col gap-4"

// Data attributes OK
data-testid="course-card"

// Regular expressions OK
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

### Pre-Commit Hook Setup

**husky/pre-commit:**

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "Checking for hardcoded strings..."
npm run lint:i18n

if [ $? -ne 0 ]; then
  echo "❌ Hardcoded strings detected. Please use i18n keys."
  exit 1
fi

npm run lint
```

**package.json scripts:**

```json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx,.js,.jsx",
    "lint:i18n": "eslint . --rule 'i18next/no-literal-string: error' --ext .ts,.tsx,.js,.jsx",
    "lint:fix": "eslint . --fix --ext .ts,.tsx,.js,.jsx",
    "lint:i18n:fix": "eslint . --fix --rule 'i18next/no-literal-string: error' --ext .ts,.tsx,.js,.jsx"
  }
}
```

### CI/CD Integration

**.github/workflows/lint.yml:**

```yaml
name: Lint & Type Check

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install dependencies
        run: npm ci

      - name: Check for hardcoded strings
        run: npm run lint:i18n

      - name: Run full linting
        run: npm run lint
```

### Error Messages & Guidance

**Sample ESLint error output:**

```
❌ apps/web/pages/courses/index.tsx (3:10)
   no-literal-string: Hardcoded string "Save" should be replaced with i18n key

   1 | function Button() {
   2 |   return (
   3 |     <button>Save</button>
         ^^^^

   Suggestion: Replace with t('button.save')
```

### Team Documentation

Create **docs/i18n-guidelines.md:**

````markdown
# i18n Guidelines

## Rule: No Hardcoded Strings

All user-facing text must use react-i18next translation keys.

### What Needs Translation

- Button labels
- Form labels and placeholders
- Error messages
- Success messages
- Page titles and headings
- Navigation labels
- Toast notifications
- Empty states
- Validation messages

### What Doesn't Need Translation

- CSS class names
- HTML data attributes
- URL paths (but not URL labels!)
- Regular expressions
- Logger/event names
- Technical identifiers
- Code comments

### Examples

#### ❌ Wrong

```jsx
<button>Click here</button>
<input placeholder="Enter email" />
const message = "Saved successfully";
```
````

#### ✅ Correct

```jsx
import { useTranslation } from "react-i18next";

function Component() {
  const { t } = useTranslation("common");

  return (
    <>
      <button>{t("button.clickHere")}</button>
      <input placeholder={t("placeholder.enterEmail")} />
    </>
  );
}

// In auth.json:
// "message.success.saved": "Saved successfully"
```

### Common Patterns

#### Conditional Text

```jsx
{
  isLoading ? t("loading.loading") : t("button.submit");
}
```

#### Pluralization

```jsx
{
  t("course.studentCount", { count: 42 });
}
// In locale file:
// "course.studentCount_one": "1 student",
// "course.studentCount_other": "{{count}} students"
```

#### HTML in Translations

```jsx
{
  t("message.clickHere", {
    defaultValue: "Click <a>here</a> to continue",
    interpolation: { escapeValue: false },
  });
}
```

### Adding New Strings

1. Identify the text that needs translation
2. Determine the appropriate namespace (common, auth, course, etc.)
3. Add key to `packages/i18n/locales/en/[namespace].json`
4. Use the key with `t()` hook or `<Trans>` component
5. Notify translation team for ES/FR/RU updates

### Checking for Violations

```bash
# Check single file
npm run lint -- apps/web/pages/courses.tsx

# Check entire app
npm run lint:i18n -- apps/web

# Fix auto-fixable issues
npm run lint:fix -- apps/web
```

````

### Testing ESLint Rule

**__tests__/eslint-i18next.test.js:**
```javascript
const { RuleTester } = require('eslint');
const i18nextRule = require('eslint-plugin-i18next');

const ruleTester = new RuleTester({
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: { jsx: true }
  }
});

ruleTester.run('no-literal-string', i18nextRule.rules['no-literal-string'], {
  valid: [
    {
      code: `
        import { useTranslation } from 'react-i18next';
        function Button() {
          const { t } = useTranslation();
          return <button>{t('button.save')}</button>;
        }
      `
    },
    {
      code: `className="flex gap-4"`
    },
    {
      code: `const API_URL = 'https://api.example.com/courses'`
    }
  ],
  invalid: [
    {
      code: `<button>Save</button>`,
      errors: [{ messageId: 'no-literal-string' }]
    },
    {
      code: `const message = "Error occurred"`,
      errors: [{ messageId: 'no-literal-string' }]
    }
  ]
});
````

### Gradual Adoption Strategy

If adding to existing codebase with many hardcoded strings:

1. **Phase 1**: Set rule to WARNING (not ERROR)
   - Allow CI/CD to pass
   - Team identifies and fixes violations
   - Generate report of all violations

2. **Phase 2**: Fix high-priority components
   - Focus on user-facing pages first
   - Translate UI strings
   - Update 50% of violations

3. **Phase 3**: Switch to ERROR
   - Enforce rule on all new code
   - Block PRs with hardcoded strings
   - Final fixes for remaining violations

4. **Phase 4**: Maintenance
   - Regular audits via ESLint
   - New contributor training
   - Pre-commit hook enforcement

## Implementation Order

1. Install `eslint-plugin-i18next` across all apps
2. Configure rule in each `.eslintrc.json`
3. Set rule to WARNING initially
4. Run linting to identify all violations
5. Create list of all hardcoded strings
6. Begin translation process
7. Set rule to ERROR
8. Add pre-commit hooks
9. Update CI/CD pipeline
10. Create team documentation and training
