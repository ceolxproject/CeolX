# Shared Web Components Library

## Description

Build application-level shared web components in `packages/ui` extending
shadcn/ui base components. Create layout components (AppShell, Sidebar, Header,
Footer), form components (FormField, SearchInput, FileUpload), data display
components (DataTable, EmptyState, LoadingSpinner, Pagination), and feedback
components (Toast, AlertDialog, Badge, Avatar). These components encapsulate
common patterns and business logic, serving all web applications.

## Affected Apps/Packages

- `packages/ui` - Component library
- `apps/web` - Main SaaS platform
- `apps/admin` - Super admin panel
- `apps/instructor` - Instructor dashboard
- `packages/validators` - Integration with form validation

## Requirements

### Layout Components

#### AppShell

- Main application wrapper with header, sidebar, and content area
- Responsive: sidebar slides to drawer on mobile (<640px)
- Header fixed at top with logo, navigation, user menu
- Sidebar collapsible with smooth animations
- Footer optional at bottom
- Props: title, user, onLogout, children, layout variant

#### Header

- Fixed/sticky top navigation with brand logo
- Responsive logo scaling (full on desktop, icon on mobile)
- Navigation breadcrumb or section title
- Right side: search icon, notifications, user dropdown
- Mobile hamburger menu trigger
- Props: title, showSearch, showNotifications, userDropdown

#### Sidebar

- Vertical navigation menu
- Support for nested menu items with expand/collapse
- Active link highlighting with brand color
- Smooth collapse animation (desktop: sidebar width toggle, mobile: drawer)
- Optional user profile section at bottom
- Props: items, collapsed, onCollapse, defaultExpanded

#### Footer

- Sticky or static footer at bottom
- Company info, links, copyright
- Optional newsletter signup CTA
- Mobile optimized with stacked layout
- Props: columns, copyright, newsletter

### Form Components

#### FormField (Wrapper)

- Extends shadcn form field with additional props
- Automatic label rendering and error message display
- Helper text support with icon
- Required field indicator (asterisk)
- Accessibility: proper labels, descriptions, error associations
- Props: label, required, helper, error, children

#### SearchInput

- Specialized input for search functionality
- Clear button on focus
- Search icon indicator
- Debounced onChange callback (300ms)
- Keyboard: Enter to submit, Escape to clear
- Props: placeholder, onSearch, debounceMs, className

#### FileUpload

- Drag-and-drop area with visual feedback
- File type validation (images, documents, videos)
- File size limit enforcement with user feedback
- Multiple file support
- Progress indicator for upload
- Thumbnail preview for images
- Props: accept, maxSize, maxFiles, onUpload, onError

#### FormErrors

- Centralized error display component
- Supports field-level and form-level errors
- Error icons and colors (red #EF4444)
- Animation on error appearance
- Props: errors, fieldName, className

### Data Display Components

#### DataTable

- Sortable, paginated table
- Column headers with sort indicators
- Striped rows with hover highlight
- Empty state when no data
- Responsive: horizontal scroll on mobile, stacked on small screens
- Supports row selection (checkboxes)
- Props: columns, data, sortable, onSort, pageable, pageSize

#### EmptyState

- Centered empty state placeholder
- Icon, heading, description
- Optional CTA button
- Variants: no results, no access, error
- Props: icon, title, description, action

#### LoadingSpinner

- Animated circular spinner
- Inline and full-page variants
- Customizable size and color
- Optional loading text
- Props: size, text, fullPage, color

#### Pagination

- Previous/Next buttons with number indicators
- Current page, total pages, items per page
- Jump to page input
- Results count display
- Disabled states for first/last page
- Props: currentPage, totalPages, onPageChange, pageSize, total

#### Badge

- Semantic status badges (success, warning, error, info)
- Dismissible variant
- Customizable size and color
- Props: variant, size, dismissible, onDismiss, children

#### Avatar

- User profile image display
- Fallback to initials
- Size variants (sm, md, lg, xl)
- Tooltip with user info on hover
- Props: src, alt, initials, size, tooltip

### Feedback Components

#### Toast

- Temporary notification system
- Variants: success, error, warning, info
- Auto-dismiss with configurable duration (default 4s)
- Position: top-right, bottom-right, bottom-left (customizable)
- Action button support (e.g., "Undo")
- Props: type, message, action, duration, onDismiss
- Hook: `useToast()` for triggering from anywhere

#### AlertDialog

- Confirmation modal for destructive actions
- Primary and destructive button variants
- Focus trap and keyboard handling (Escape to cancel)
- Animated backdrop
- Props: title, description, onConfirm, onCancel, destructive

#### ConfirmationDialog

- Wrapper around AlertDialog for common patterns
- Supports custom content rendering
- Props: open, title, message, confirmLabel, cancelLabel, isLoading, onConfirm

### Status Indicators

- Loading spinner (used in buttons during async actions)
- Progress bar for multi-step processes
- Status dots (online/offline, success/error)
- Skeleton loaders for content placeholders

## Acceptance Criteria

- [x] AppShell component with responsive sidebar (drawer on mobile) and header
- [x] Sidebar component supports nested menu items with expand/collapse
- [x] Header component with logo, navigation, user dropdown, search
- [x] Footer component with configurable columns and copyright
- [x] FormField wrapper with label, required indicator, helper text, error
      display
- [x] SearchInput with debounce, clear button, and keyboard shortcuts
- [x] FileUpload with drag-drop, file validation, size limits, progress
      indicator
- [x] DataTable component with sorting, pagination, row selection, empty state
- [x] EmptyState component with icon, title, description, and CTA
- [x] LoadingSpinner with inline and full-page variants
- [x] Pagination component with page navigation and results count
- [x] Badge component with semantic variants (success, warning, error, info)
- [x] Avatar component with image, initials fallback, and tooltip
- [x] Toast notification system with useToast hook and auto-dismiss
- [x] AlertDialog component for confirmations with proper focus management
- [x] ConfirmationDialog wrapper with simplified API
- [x] All components responsive across mobile (375px), tablet (768px), desktop (
      1920px)
- [x] All components meet WCAG 2.1 AA accessibility standards
- [x] Keyboard navigation works for all interactive components
- [x] TypeScript definitions and JSDoc comments for all components
- [x] Unit tests for component logic and rendering
- [x] Zero console warnings or errors
- [x] Components integrate seamlessly with apps/web, apps/admin, apps/instructor

## Dependencies

- `shadcn/ui` - Base components
- `react` 18.x
- `class-variance-authority` - Component variants
- `clsx` - Class name utilities
- `react-table` - Table component library (optional, for advanced DataTable)
- TypeScript 5.x

## Technical Notes

### Component Directory Structure

```
packages/ui/components/
├── layout/
│   ├── AppShell.tsx
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   ├── Footer.tsx
│   └── index.ts
├── form/
│   ├── FormField.tsx
│   ├── SearchInput.tsx
│   ├── FileUpload.tsx
│   ├── FormErrors.tsx
│   └── index.ts
├── data-display/
│   ├── DataTable.tsx
│   ├── EmptyState.tsx
│   ├── LoadingSpinner.tsx
│   ├── Pagination.tsx
│   ├── Badge.tsx
│   ├── Avatar.tsx
│   └── index.ts
├── feedback/
│   ├── Toast.tsx
│   ├── AlertDialog.tsx
│   ├── ConfirmationDialog.tsx
│   └── index.ts
├── ui/                 # shadcn/ui base components
└── index.ts            # Main barrel export
```

### AppShell Implementation Example

```typescript
// components/layout/AppShell.tsx
import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { Footer } from './Footer'

interface AppShellProps {
  children: React.ReactNode
  title: string
  user?: { name: string; email: string; avatar?: string }
  onLogout?: () => void
  sidebar?: boolean
  footer?: boolean
}

export function AppShell({
                           children,
                           title,
                           user,
                           onLogout,
                           sidebar = true,
                           footer = true,
                         }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className = "flex h-screen flex-col bg-white" >
      {/* Header */ }
      < Header
  title = { title }
  onMenuClick = {()
=>
  setSidebarOpen(!sidebarOpen)
}
  user = { user }
  onLogout = { onLogout }
  />

  < div
  className = "flex flex-1 overflow-hidden" >
    {/* Sidebar */ }
  {
    sidebar && (
      <Sidebar
        open = { sidebarOpen }
    onOpenChange = { setSidebarOpen }
    />
  )
  }

  {/* Main content */
  }
  <main
    className = {
    cn(
    'flex-1 overflow-auto',
    sidebar && 'md:ml-64'
)
}
>
  {
    children
  }
  </main>
  < /div>

  {/* Footer */
  }
  {
    footer && <Footer / >
  }
  </div>
)
}
```

### SearchInput with Debounce

```typescript
// components/form/SearchInput.tsx
import React, { useState, useEffect } from 'react'
import { Input } from '../ui/input'
import { Search, X } from 'lucide-react'

interface SearchInputProps {
  placeholder?: string
  onSearch: (query: string) => void
  debounceMs?: number
}

export function SearchInput({
                              placeholder = 'Search...',
                              onSearch,
                              debounceMs = 300,
                            }: SearchInputProps) {
  const [value, setValue] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(value)
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [value, debounceMs, onSearch])

  return (
    <div className = "relative" >
    <Search className = "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" / >
    <Input
      type = "text"
  placeholder = { placeholder }
  value = { value }
  onChange = {(e)
=>
  setValue(e.target.value)
}
  className = "pl-10 pr-10"
    / >
    { value && (
      <button
        onClick = {()
=>
  setValue('')
}
  className = "absolute right-3 top-1/2 -translate-y-1/2"
  aria - label = "Clear search"
  >
  <X className = "h-4 w-4 text-gray-400" / >
    </button>
)
}
  </div>
)
}
```

### FileUpload Component

```typescript
// components/form/FileUpload.tsx
import React, { useCallback, useState } from 'react'
import { Upload, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '../ui/alert'

interface FileUploadProps {
  accept?: string
  maxSize?: number // bytes
  maxFiles?: number
  onUpload: (files: File[]) => void
  onError?: (error: string) => void
}

export function FileUpload({
                             accept = '*/*',
                             maxSize = 10 * 1024 * 1024, // 10MB
                             maxFiles = 1,
                             onUpload,
                             onError,
                           }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFiles = useCallback((files: FileList) => {
    setError(null)

    // Validate count
    if (files.length > maxFiles) {
      const msg = `Maximum ${maxFiles} file(s) allowed`
      setError(msg)
      onError?.(msg)
      return
    }

    // Validate size
    const validFiles: File[] = []
    for (const file of Array.from(files)) {
      if (file.size > maxSize) {
        const msg = `File "${file.name}" exceeds ${maxSize / 1024 / 1024}MB limit`
        setError(msg)
        onError?.(msg)
        return
      }
      validFiles.push(file)
    }

    onUpload(validFiles)
  }, [maxSize, maxFiles, onUpload, onError])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  return (
    <div
      onDragOver = { handleDragOver }
  onDragLeave = { handleDragLeave }
  onDrop = { handleDrop }
  className = {
    cn(
    'rounded-lg border-2 border-dashed p-8 text-center transition',
    isDragging
    ? 'border-primary-600 bg-primary-50'
    : 'border-gray-300 bg-gray-50'
)
}
>
  <Upload className = "mx-auto h-8 w-8 text-gray-400" / >
  <p className = "mt-2 text-sm font-medium text-gray-700" >
    Drag
  files
  here
  or
  click
  to
  select
  < /p>
  < p
  className = "text-xs text-gray-500" >
    Max
  size: {
    maxSize / 1024 / 1024
  }
  MB
  < /p>

  {
    error && (
      <Alert variant = "destructive"
    className = "mt-4" >
    <AlertCircle className = "h-4 w-4" / >
      <AlertDescription>{ error } < /AlertDescription>
      < /Alert>
  )
  }

  <input
    type = "file"
  accept = { accept }
  multiple = { maxFiles > 1
}
  onChange = {(e)
=>
  handleFiles(e.currentTarget.files!)
}
  className = "hidden"
    / >
    </div>
)
}
```

### DataTable Component

```typescript
// components/data-display/DataTable.tsx
import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../ui/table'
import { Checkbox } from '../ui/checkbox'
import { ArrowUpDown } from 'lucide-react'
import { EmptyState } from './EmptyState'
import { Pagination } from './Pagination'

interface Column<T> {
  key: keyof T
  label: string
  sortable?: boolean
  render?: (value: any, row: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  sortable?: boolean
  pageable?: boolean
  pageSize?: number
  onSort?: (column: string, direction: 'asc' | 'desc') => void
  onPageChange?: (page: number) => void
  selectable?: boolean
}

export function DataTable<T extends { id: string | number }>({
                                                               columns,
                                                               data,
                                                               sortable = true,
                                                               pageable = true,
                                                               pageSize = 10,
                                                               onSort,
                                                               onPageChange,
                                                               selectable = false,
                                                             }: DataTableProps<T>) {
  const [selectedRows, setSelectedRows] = React.useState<Set<string | number>>(new Set())
  const [currentPage, setCurrentPage] = React.useState(1)
  const [sortColumn, setSortColumn] = React.useState<string | null>(null)
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc')

  const handleSort = (column: string) => {
    if (!sortable) return

    const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc'
    setSortColumn(column)
    setSortDirection(newDirection)
    onSort?.(column, newDirection)
  }

  const paginatedData = pageable ? data.slice((currentPage - 1) * pageSize, currentPage * pageSize) : data

  if (data.length === 0) {
    return <EmptyState title = "No data"
    description = "No records to display" / >
  }

  return (
    <div>
      <div className = "overflow-x-auto" >
      <Table>
        <TableHeader>
          <TableRow>
            { selectable && (
        <TableHead className = "w-12" >
        <Checkbox
          checked = { selectedRows.size === data.length }
  onCheckedChange = {(checked)
=>
  {
    if (checked) {
      setSelectedRows(new Set(data.map((row) => row.id)))
    } else {
      setSelectedRows(new Set())
    }
  }
}
  />
  < /TableHead>
)
}
  {
    columns.map((column) => (
      <TableHead
        key = { String(column.key)
  }
    onClick = {()
  =>
    handleSort(String(column.key))
  }
    className = { sortable ? 'cursor-pointer' : '' }
    >
    <div className = "flex items-center gap-2" >
      { column.label }
    {
      sortable && sortColumn === String(column.key) && (
        <ArrowUpDown className = "h-4 w-4" / >
      )
    }
    </div>
    < /TableHead>
  ))
  }
  </TableRow>
  < /TableHeader>
  < TableBody >
  {
    paginatedData.map((row) => (
      <TableRow key = { row.id } className = "hover:bg-gray-50" >
      { selectable && (
        <TableCell>
          <Checkbox
            checked = { selectedRows.has(row.id) }
    onCheckedChange = {(checked)
=>
  {
    const newSelection = new Set(selectedRows)
    if (checked) {
      newSelection.add(row.id)
    } else {
      newSelection.delete(row.id)
    }
    setSelectedRows(newSelection)
  }
}
  />
  < /TableCell>
)
}
  {
    columns.map((column) => (
      <TableCell key = { String(column.key)
  }>
    {
      column.render
        ? column.render(row[column.key], row)
        : String(row[column.key])
    }
    </TableCell>
  ))
  }
  </TableRow>
))
}
  </TableBody>
  < /Table>
  < /div>

  {
    pageable && (
      <Pagination
        currentPage = { currentPage }
    totalPages = { Math.ceil(data.length / pageSize) }
    onPageChange = { setCurrentPage }
    />
  )
  }
  </div>
)
}
```

### Toast Hook

```typescript
// hooks/useToast.ts
import { useState, useCallback } from "react";

interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(
    (
      message: string,
      type: Toast["type"] = "info",
      options?: { action?: Toast["action"]; duration?: number }
    ) => {
      const id = Math.random().toString(36).substr(2, 9);
      const toast: Toast = { id, type, message, ...options };

      setToasts((prev) => [...prev, toast]);

      if (options?.duration !== 0) {
        setTimeout(() => removeToast(id), options?.duration ?? 4000);
      }

      return id;
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}
```

### Accessibility Checklist

- AppShell: Skip link to main content, ARIA landmarks (header, nav, main,
  footer)
- Sidebar: ARIA role="navigation", keyboard navigation with Arrow keys, focus
  management
- DataTable: ARIA role="table", sortable headers have aria-sort, focus
  indicators
- FormField: Associated labels, aria-describedby for helper text, aria-invalid
  for errors
- Toast: ARIA role="alert" or "status", auto-announce to screen readers
- FileUpload: Drag-drop accessible via keyboard and screen reader
- Dialog/Modal: Focus trap, Escape to close, proper role and aria-modal

### Testing Requirements

1. Unit tests for component logic (sorting, pagination, validation)
2. Visual tests for responsive behavior (375px, 768px, 1280px)
3. Accessibility tests with axe DevTools (WCAG 2.1 AA)
4. Keyboard navigation tests
5. Screen reader testing (VoiceOver, NVDA)
6. Integration tests with validator schemas
7. Performance tests (large DataTable with 1000+ rows)

### Performance Optimization

- Memoize components to prevent unnecessary re-renders
- Use virtual scrolling for DataTable with large datasets
- Lazy load modal/drawer content
- Optimize animations with CSS transforms
- Minimize bundle size with tree-shaking
