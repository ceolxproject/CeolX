# shadcn/ui Initialization and Brand Theme Configuration

## Description

Initialize shadcn/ui component library in `packages/ui` with Mentor brand theme
customization. Configure base components aligned with Tailwind CSS v4 setup and
brand colors. Build a reusable, accessible component library serving all web
applications. Establish a central component export strategy to avoid duplication
across apps.

## Affected Apps/Packages

- `packages/ui` - Primary shared component library
- `apps/web` - Consumer of shared components
- `apps/admin` - Consumer of shared components
- `apps/instructor` - Consumer of shared components
- Monorepo TypeScript configuration

## Requirements

### Initial Setup

- Install shadcn/ui CLI and dependencies
- Initialize in `packages/ui` with TypeScript configuration
- Use Tailwind CSS v4 config from monorepo root
- Configure path aliases for clean imports (`@/components`, `@/lib`, `@/types`)

### Brand Theme Customization

- Override default colors with Mentor brand palette
- Primary: #FF3B6B (Hot Pink) for CTAs, highlights, links
- Secondary: #1A1A2E (Dark Navy) for text, backgrounds
- Accent: #FFFFFF (White) for contrast, borders
- Ensure all shadcn components respect brand color variables

### Base Components to Install

1. **Layout & Structure**

- `button` - Primary action trigger
- `card` - Content container
- `dialog` - Modal overlay
- `sheet` - Side panel / drawer

2. **Forms & Input**

- `input` - Text input field
- `form` - Form wrapper with validation
- `select` - Dropdown selector
- `checkbox` - Multiple selection
- `radio-group` - Single selection
- `textarea` - Multi-line text
- `label` - Form field label
- `switch` - Toggle control

3. **Data Display**

- `table` - Data grid
- `tabs` - Tabbed content sections
- `pagination` - Multi-page navigation
- `badge` - Label/tag display
- `avatar` - User profile image
- `popover` - Floating content panel

4. **Feedback & Status**

- `toast` - Temporary notification
- `alert-dialog` - Confirmation modal
- `alert` - Status message box
- `skeleton` - Loading placeholder

5. **Navigation & Dropdowns**

- `dropdown-menu` - Context menu
- `navigation-menu` - Primary nav
- `command` - Command palette / search
- `breadcrumb` - Navigation path

### Component Customization Strategy

- Create wrapper components extending shadcn base components
- Override Tailwind classes with brand colors using CSS variable references
- Add semantic prop variants (e.g., `variant="primary" | "secondary"`)
- Ensure TypeScript types exported for consumer app usage

### Accessibility Requirements

- Verify WCAG 2.1 AA compliance for all components
- Test keyboard navigation (Tab, Enter, Escape, Arrow keys)
- Validate ARIA attributes and roles
- Test with screen readers (NVDA, JAWS, VoiceOver)
- Ensure focus indicators visible with 3:1 contrast minimum

### Export Strategy

- Create barrel exports (`index.ts`) in `packages/ui/components/`
- Organize by category: `ui/button`, `ui/card`, `ui/form`, etc.
- Re-export from `packages/ui` root with stable versioning
- Provide TypeScript type definitions for all exported components
- Document component variants and usage patterns

## Acceptance Criteria

- [x] `packages/ui` initialized with shadcn/ui and project structure created
- [x] TypeScript paths configured for clean imports (`@/components`, `@/lib`)
- [x] All 20+ base components installed and customized with brand theme
- [x] Component colors reference Mentor brand palette (primary #FF3B6B,
      secondary #1A1A2E)
- [x] Button component supports multiple variants: primary, secondary, ghost,
      outline, destructive
- [x] Input component styled with brand colors and proper focus states
- [x] Card component with customizable padding and shadow levels
- [x] Dialog/Sheet components support brand theme with proper animations
- [x] Table component renders with striped rows, hover states, sorting
      indicators
- [x] Form components (Input, Select, Checkbox) export validation helpers
- [x] Toast notification component configured with custom positioning and
      auto-dismiss
- [x] All exported components have TypeScript definitions with JSDoc comments
- [x] Barrel exports available from `@mentor/ui` (or configured alias)
- [x] Example/demo page showing all components with variant gallery
- [x] Zero accessibility warnings in axe DevTools or Lighthouse
- [x] Components work in all web apps without style conflicts
- [x] Build succeeds with no TypeScript errors

## Dependencies

- `shadcn/ui@latest` - Component library
- `@radix-ui/*` - Headless component primitives (installed with shadcn)
- `class-variance-authority` - Type-safe component variants
- `clsx` - Conditional class merging
- `tailwindcss-animate` - Animation utilities
- React 18.x (already in monorepo)
- TypeScript 5.x

## Technical Notes

### Project Structure

```
packages/ui/
├── components/
│   ├── ui/                    # shadcn base components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── form.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   ├── toast.tsx
│   │   └── ... (20+ components)
│   ├── layout/                # Custom layout components
│   │   ├── AppShell.tsx
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   └── index.ts               # Barrel export
├── lib/
│   ├── utils.ts               # shadcn utilities + custom
│   └── cn.ts                  # Class merge helper
├── hooks/
│   └── useToast.ts            # Toast trigger hook
├── types/
│   └── index.ts               # Component type definitions
├── tsconfig.json
├── tailwind.config.ts         # Extends root config
└── package.json
```

### Theme Customization Example

```typescript
// components/ui/button.tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary-600 text-white hover:bg-primary-700", // Brand primary
        secondary: "bg-secondary-900 text-white hover:bg-secondary-800", // Brand secondary
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline: "border border-gray-300 hover:bg-gray-50",
        ghost: "hover:bg-gray-100",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className = { cn(buttonVariants({ variant, size, className }))
  }
    ref = { ref }
    {...
      props
    }
    />
  )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

### CSS Variables Integration

```css
/* packages/ui/styles/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --primary: 255 59 107; /* #FF3B6B as RGB */
    --primary-50: #fff5f9;
    --primary-100: #ffe0ec;
    --primary-600: #ff3b6b;
    --primary-700: #f02a5c;

    --secondary: 26 26 46; /* #1A1A2E as RGB */
    --secondary-900: #1a1a2e;

    --background: 255 255 255;
    --foreground: 26 26 46;

    --card: 255 255 255;
    --card-foreground: 26 26 46;

    --muted: 229 231 235;
    --muted-foreground: 107 114 128;

    --border: 229 231 235;
    --input: 229 231 235;
    --ring: 255 59 107;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
  }
}
```

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/components/*": ["./components/*"],
      "@/lib/*": ["./lib/*"],
      "@/hooks/*": ["./hooks/*"],
      "@/types/*": ["./types/*"]
    },
    "moduleResolution": "bundler"
  }
}
```

### Installation Command Sequence

```bash
# From monorepo root
cd packages/ui

# Initialize shadcn/ui
npx shadcn-ui@latest init

# Install base components
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add input
npx shadcn-ui@latest add form
npx shadcn-ui@latest add select
npx shadcn-ui@latest add checkbox
npx shadcn-ui@latest add radio-group
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add table
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add avatar
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add alert-dialog
npx shadcn-ui@latest add skeleton
npx shadcn-ui@latest add pagination
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add sheet
npx shadcn-ui@latest add popover
npx shadcn-ui@latest add command
```

### Consumer App Integration

```typescript
// apps/web/components/MyComponent.tsx
import { Button, Card, Input } from '@mentor/ui'

export function MyComponent() {
  return (
    <Card>
      <Input placeholder = "Enter text..." / >
    <Button variant = "primary" > Submit < /Button>
      < /Card>
  )
}
```

### Documentation & Examples

- Create a component gallery page (`packages/ui/demo.tsx`)
- Document each component with usage examples and variant gallery
- Include accessibility notes (keyboard shortcuts, screen reader support)
- Provide Figma/design file links for reference
- Create migration guide for future theme updates

### Testing Strategy

1. Unit tests for component variants and props
2. Accessibility testing with axe DevTools
3. Visual regression testing with Percy or similar
4. Cross-browser testing (Chrome, Firefox, Safari, Edge)
5. Mobile responsive testing (375px, 768px, 1920px viewports)
6. Keyboard navigation testing (Tab, Enter, Escape, Arrows)
7. Screen reader testing (NVDA, JAWS, VoiceOver)

### Performance Notes

- Tree-shake unused components in consumer apps
- Lazy load heavy components if needed
- Minimize CSS-in-JS runtime overhead
- Ensure components don't cause layout shift on mount

### Future Enhancements

- Custom hook library (useForm, useModal, useToast, etc.)
- Animation presets and transition utilities
- Data table component with sorting/filtering
- Rich text editor integration
- Charts and visualization components
- Form field builder
- Component composition patterns documentation
