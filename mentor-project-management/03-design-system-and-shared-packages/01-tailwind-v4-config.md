# Tailwind CSS v4 Configuration Setup

## Description

Establish a centralized Tailwind CSS v4 configuration across all web applications (web, admin, instructor dashboard) using shared design tokens aligned with the Mentor brand identity. Create a single source of truth for styling with custom color scales, typography presets, spacing scales, and responsive breakpoints. Implement CSS variables for runtime theming flexibility and ensure consistency across all web packages.

## Affected Apps/Packages

- `apps/web` - Main SaaS platform
- `apps/admin` - Super admin panel
- `apps/instructor` - Instructor dashboard
- `packages/ui` - Shared UI component library
- Build tooling and monorepo configuration

## Requirements

### Brand Color System

- Primary Color: `#FF3B6B` (Hot Pink/Coral) with full shade spectrum (50-950)
- Secondary Color: `#1A1A2E` (Dark Navy) with full shade spectrum (50-950)
- Accent Color: `#FFFFFF` (White) for high contrast elements
- Neutrals: Gray scale (50-950) for backgrounds, borders, text
- Semantic Colors: Success (#10B981), Warning (#F59E0B), Error (#EF4444), Info (#3B82F6)

### CSS Variables Strategy

- Use CSS custom properties for all color tokens
- Implement in root `:root` selector with fallback RGB values
- Enable runtime switching without rebuilding (future dark mode support)
- Scope variables by component/context where needed

### Typography

- Font Family: Inter (web UI), SF Pro (alternative)
- Font Sizes: 12px, 14px, 16px, 18px, 20px, 24px, 32px, 48px (xs, sm, base, lg, xl, 2xl, 4xl, 6xl)
- Font Weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- Line Heights: 1.2 (tight), 1.5 (normal), 1.75 (relaxed), 2 (loose)
- Letter Spacing: -0.02em, 0, 0.02em, 0.05em for emphasis

### Responsive Breakpoints

- Mobile: < 640px (sm breakpoint)
- Tablet: 640px - 1024px (md, lg breakpoints)
- Desktop: > 1024px (xl, 2xl breakpoints)
- Custom breakpoints: `xs: 320px`, `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`, `2xl: 1536px`

### Spacing Scale

- Base unit: 4px (matches typical design systems)
- Scale: 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 120 (0-30 in Tailwind units)
- Gap sizes align with padding for consistency
- Container padding adjusts per breakpoint (md: 16px, lg: 24px, xl: 32px)

### Additional Tailwind Features

- Custom shadow system aligned with elevation levels
- Border radius: 4px (sm), 8px (md), 12px (lg), 16px (xl), 9999px (full)
- Z-index strategy: base (10), elevated (20), modal (30), dropdown (40), tooltip (50)
- Custom opacity scale for transparency variants
- Animation/transition presets for micro-interactions

## Acceptance Criteria

- [x] Create `tailwind.config.ts` at monorepo root with shared configuration
- [x] Define all brand colors as Tailwind theme extensions with 50-950 shade scales
- [x] Implement CSS variables in `globals.css` or `variables.css` for every color token
- [x] Configure typography with Inter/SF Pro font stack and custom font sizes
- [x] Set responsive breakpoints matching mobile/tablet/desktop spec (640px, 1024px boundaries)
- [x] Create consistent spacing scale (4px base unit, 30 levels)
- [x] Configure shadow system with semantic elevation levels (sm, md, lg, xl)
- [x] Set border radius and z-index custom values
- [x] Document color naming convention (e.g., `primary-600`, `secondary-800`)
- [x] Create example component showing proper utility usage and responsive design
- [x] All web apps inherit configuration via `@tailwind` directives
- [x] Test responsive behavior on actual devices/emulators (375px mobile, 768px tablet, 1920px desktop)
- [x] CSS variables compile correctly without build errors
- [x] Zero Tailwind warnings about undefined colors or sizing mismatches

## Dependencies

- `tailwindcss@4.x` - CSS utility framework
- `@tailwindcss/typography` - Prose component styles (optional, for rich text)
- `postcss` - CSS processing
- `autoprefixer` - Vendor prefix support
- TypeScript 5.x (for `tailwind.config.ts`)

## Technical Notes

### Monorepo Setup

```
monorepo/
├── tailwind.config.ts          # Root shared config
├── css/
│   ├── globals.css             # Global styles + CSS variables
│   └── variables.css           # Theme variable definitions
├── apps/
│   ├── web/tailwind.config.ts  # Extends root config
│   ├── admin/tailwind.config.ts
│   └── instructor/tailwind.config.ts
└── packages/ui/tailwind.config.ts
```

### CSS Variables Implementation

```css
/* css/variables.css */
:root {
  /* Primary colors with RGB fallback */
  --color-primary-50: #fff5f9;
  --color-primary-100: #ffe0ec;
  --color-primary-600: #ff3b6b;
  --color-primary-700: #f02a5c;
  /* ... full spectrum 50-950 */

  /* Secondary colors */
  --color-secondary-900: #1a1a2e;

  /* Semantic colors */
  --color-success-500: #10b981;
  --color-error-500: #ef4444;
  --color-warning-500: #f59e0b;
  --color-info-500: #3b82f6;
}
```

### Tailwind Config Structure

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        primary: { 50: '#fff5f9', 600: '#FF3B6B', ... },
        secondary: { 900: '#1A1A2E', ... },
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', 'system-ui', ...],
        mono: ['Fira Code', ...],
      },
      fontSize: {
        xs: ['12px', { lineHeight: '1.5' }],
        sm: ['14px', { lineHeight: '1.5' }],
        base: ['16px', { lineHeight: '1.5' }],
        // ... 6xl and 7xl
      },
      spacing: { /* 0-120 with 4px increment */ },
      screens: {
        xs: '320px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      zIndex: {
        auto: 'auto',
        0: '0',
        10: '10',
        20: '20',
        30: '30',
        40: '40',
        50: '50',
      },
    },
  },
  content: [
    './apps/**/*.{ts,tsx}',
    './packages/**/*.{ts,tsx}',
  ],
  plugins: [
    // Custom plugin for dark mode fallback if needed
  ],
}
```

### Font Loading Strategy

- Use `@font-face` with `font-display: swap` for Inter and SF Pro
- Load from CDN (Google Fonts for Inter) or local files
- Fallback: system fonts (San Francisco on macOS/iOS, Segoe UI on Windows)
- Avoid cumulative layout shift (CLS) with font-size-adjust

### Performance Considerations

- Tree-shake unused CSS in production builds
- Tailwind v4 uses Oxide parser for faster compilation
- Configure `content` paths to avoid scanning unnecessary files
- Use CSS variables judiciously (minimal performance impact in v4)

### Testing Checklist

1. Build all apps successfully without warnings
2. Test color output in browser DevTools (computed styles show correct values)
3. Verify responsive breakpoints with browser dev tools
4. Check font rendering at various sizes across devices
5. Validate contrast ratios meet WCAG AA standards (4.5:1 for text)
6. Performance: Measure production CSS bundle size < 50KB gzipped
7. Test across browsers: Chrome, Firefox, Safari (macOS & iOS), Edge

### Future Considerations

- Dark mode support via CSS variable switching (post-V1)
- Dynamic theme customization per tenant/workspace
- Theme preview in admin panel
- Animation/motion preferences with `prefers-reduced-motion`
