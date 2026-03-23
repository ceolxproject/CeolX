# Free/Paid Filter Implementation

## Description

Implement a price type filter toggle allowing users to filter courses by All Courses, Free Only, or Paid Only. The selection persists in session storage and must be clearly integrated into the catalog and integrated with the course API filtering. Pricing should be consistently displayed on all course cards (€XX or "Free").

## Affected Apps/Packages

- `apps/learner-web` — Price filter toggle component
- `apps/learner-mobile` — React Native price filter
- `backend/api/hono` — GET /courses with price_type filtering
- `shared/types` — PriceType enum
- `shared/hooks` — usePriceFilter hook

## Price Filter UI Components

### Web Implementation

#### Price Filter Toggle (Desktop)

**Segment Control Style:**

```
Price
[All Courses] [Free Only] [Paid Only]
```

**Design:**

```css
.priceFilterContainer {
  display: flex;
  gap: 8px;
  margin: 12px 0;
}

.priceFilterOption {
  flex: 1;
  padding: 8px 12px;
  text-align: center;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  background: white;
  transition: all 0.2s;
}

.priceFilterOption:hover {
  border-color: #ff6b9d;
  color: #ff6b9d;
}

.priceFilterOption.active {
  background: #ff6b9d;
  color: white;
  border-color: #ff6b9d;
}
```

**Component:**

```typescript
// apps/learner-web/components/PriceFilter.tsx
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from './PriceFilter.module.css';

type PriceType = 'all' | 'free' | 'paid';

interface PriceFilterProps {
  onPriceTypeChange: (priceType: PriceType) => void;
}

export const PriceFilter: React.FC<PriceFilterProps> = ({
  onPriceTypeChange,
}) => {
  const router = useRouter();
  const [priceType, setPriceType] = useState<PriceType>('all');

  // Load from URL and session storage on mount
  useEffect(() => {
    // Try URL first
    if (router.query.price_type) {
      const urlPriceType = router.query.price_type as PriceType;
      if (['all', 'free', 'paid'].includes(urlPriceType)) {
        setPriceType(urlPriceType);
        return;
      }
    }

    // Fall back to session storage
    const stored = sessionStorage.getItem('priceFilter');
    if (stored && ['all', 'free', 'paid'].includes(stored)) {
      setPriceType(stored as PriceType);
    }
  }, []);

  const handlePriceTypeChange = (newPriceType: PriceType) => {
    setPriceType(newPriceType);
    onPriceTypeChange(newPriceType);

    // Update session storage
    sessionStorage.setItem('priceFilter', newPriceType);

    // Update URL
    const query = { ...router.query };
    if (newPriceType !== 'all') {
      query.price_type = newPriceType;
    } else {
      delete query.price_type;
    }

    router.push({ pathname: router.pathname, query }, undefined, {
      shallow: true,
    });
  };

  const options: Array<{ value: PriceType; label: string }> = [
    { value: 'all', label: 'All Courses' },
    { value: 'free', label: 'Free Only' },
    { value: 'paid', label: 'Paid Only' },
  ];

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Price</h3>
      <div className={styles.filterContainer}>
        {options.map((option) => (
          <button
            key={option.value}
            className={`${styles.filterOption} ${
              priceType === option.value ? styles.active : ''
            }`}
            onClick={() => handlePriceTypeChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};
```

### Mobile Implementation

#### Price Filter in Bottom Sheet

**Component:**

```typescript
// apps/learner-mobile/components/PriceFilterSheet.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import RadioButton from '@react-native-community/radio-buttons-group';
import styles from './PriceFilterSheet.styles';

type PriceType = 'all' | 'free' | 'paid';

interface PriceFilterSheetProps {
  selectedPriceType: PriceType;
  onApply: (priceType: PriceType) => void;
  onCancel: () => void;
}

export const PriceFilterSheet: React.FC<PriceFilterSheetProps> = ({
  selectedPriceType,
  onApply,
  onCancel,
}) => {
  const [tmpPriceType, setTmpPriceType] = useState(selectedPriceType);

  const options = [
    { id: '1', label: 'All Courses', value: 'all' },
    { id: '2', label: 'Free Only', value: 'free' },
    { id: '3', label: 'Paid Only', value: 'paid' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Price</Text>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={styles.radioOption}
            onPress={() => setTmpPriceType(option.value as PriceType)}
          >
            <View
              style={[
                styles.radioButton,
                tmpPriceType === option.value && styles.radioButtonSelected,
              ]}
            >
              {tmpPriceType === option.value && (
                <View style={styles.radioButtonDot} />
              )}
            </View>
            <Text style={styles.optionLabel}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.applyButton}
          onPress={() => onApply(tmpPriceType)}
        >
          <Text style={styles.applyButtonText}>Apply</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};
```

#### Styling (Mobile)

```typescript
// apps/learner-mobile/components/PriceFilterSheet.styles.ts
import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  closeButton: {
    fontSize: 24,
    color: "#999",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f9f9f9",
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  radioButtonSelected: {
    borderColor: "#ff6b9d",
  },
  radioButtonDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#ff6b9d",
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  cancelButtonText: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#ff6b9d",
  },
  applyButtonText: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
```

## Price Display on Course Cards

### Price Badge Styling

**Paid Course:**

```
┌─────────────────┐
│ Course Title    │
│ Instructor Name │
├─────────────────┤
│ Category | Type │
│ €29.99 | 8 less │
└─────────────────┘
```

**Free Course:**

```
┌─────────────────┐
│ Course Title    │
│ Instructor Name │
├─────────────────┤
│ Category | Type │
│ FREE | 8 lessons│
└─────────────────┘
```

**Component:**

```typescript
// apps/learner-web/components/PriceDisplay.tsx
import React from 'react';
import styles from './PriceDisplay.module.css';

interface PriceDisplayProps {
  priceType: 'free' | 'paid';
  amount?: number;
  currency?: string;
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  priceType,
  amount,
  currency = 'EUR',
}) => {
  if (priceType === 'free') {
    return <span className={styles.freeBadge}>FREE</span>;
  }

  return (
    <span className={`${styles.priceBadge} ${styles.paid}`}>
      {currency === 'EUR' && '€'}
      {amount?.toFixed(2)}
    </span>
  );
};
```

**Styling:**

```css
/* apps/learner-web/components/PriceDisplay.module.css */

.priceBadge {
  display: inline-block;
  font-size: 14px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
}

.freeBadge {
  composes: priceBadge;
  background-color: #27ae60;
  color: white;
}

.paid {
  color: #ff6b9d;
  background-color: transparent;
}
```

## Session Storage Persistence

**Storage Key:** `priceFilter`

**Implementation:**

```typescript
// apps/learner-web/hooks/usePriceFilter.ts
import { useState, useEffect } from "react";
import { useRouter } from "next/router";

type PriceType = "all" | "free" | "paid";

export const usePriceFilter = () => {
  const router = useRouter();
  const [priceType, setPriceType] = useState<PriceType>("all");

  // Load on mount
  useEffect(() => {
    // Priority: URL > sessionStorage > default ('all')
    if (router.query.price_type) {
      const urlValue = router.query.price_type as PriceType;
      if (["all", "free", "paid"].includes(urlValue)) {
        setPriceType(urlValue);
        return;
      }
    }

    const storedValue = sessionStorage.getItem(
      "priceFilter"
    ) as PriceType | null;
    if (storedValue && ["all", "free", "paid"].includes(storedValue)) {
      setPriceType(storedValue);
    }
  }, [router.isReady]);

  const updatePriceType = (newType: PriceType) => {
    setPriceType(newType);
    sessionStorage.setItem("priceFilter", newType);

    // Update URL
    const query = { ...router.query };
    if (newType !== "all") {
      query.price_type = newType;
    } else {
      delete query.price_type;
    }

    router.push({ pathname: router.pathname, query }, undefined, {
      shallow: true,
    });
  };

  return { priceType, updatePriceType };
};
```

## API Integration

### Query Parameter

```typescript
// Catalog API request with price filter
GET /api/v1/courses?price_type=free&page=1&limit=12
GET /api/v1/courses?price_type=paid&sort_by=popular
GET /api/v1/courses  // price_type=all (default)
```

### API Response Filter

The backend `GET /courses` endpoint filters by `price_type` query param:

- `all` — Return all courses (both free and paid)
- `free` — Return only courses with price_type = 'free'
- `paid` — Return only courses with price_type = 'paid'

(See 01-course-catalog-api.md for full endpoint details)

### Frontend Integration

```typescript
// apps/learner-web/hooks/useCourses.ts
import { useQuery } from "react-query";
import { usePriceFilter } from "./usePriceFilter";

export const useCourses = (page: number = 1) => {
  const { priceType } = usePriceFilter();

  return useQuery(
    ["courses", page, priceType],
    async () => {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      if (priceType !== "all") {
        params.append("price_type", priceType);
      }

      const response = await fetch(`/api/v1/courses?${params}`);
      return response.json();
    },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );
};
```

## Clear Filters

When user clicks "Clear All Filters," also reset price filter to `all`:

```typescript
const handleClearAllFilters = () => {
  updatePriceType("all");
  updateCategories([]);
  updateCourseType("all");
  // ... reset other filters
};
```

## Price Data in Database

**Courses Table:**

```sql
CREATE TABLE courses (
  -- ... other fields
  price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  price_type ENUM('free', 'paid') NOT NULL DEFAULT 'free',
  currency VARCHAR(3) DEFAULT 'EUR',
  created_at TIMESTAMP DEFAULT NOW(),
  -- ... other fields
);

-- Example data
INSERT INTO courses (title, price_type, price, currency) VALUES
  ('Free Makeup Basics', 'free', 0.00, 'EUR'),
  ('Advanced Makeup Techniques', 'paid', 29.99, 'EUR'),
  ('Natural Beauty Skincare', 'free', 0.00, 'EUR');
```

**Constraints:**

- If `price_type = 'free'`, then `price = 0.00`
- If `price_type = 'paid'`, then `price > 0`
- Validate on course creation/update

## Analytics and Tracking

Track filter usage for insights:

```typescript
// Track when user changes price filter
const handlePriceTypeChange = (newPriceType: PriceType) => {
  // ... update state

  // Analytics event
  analytics.track("price_filter_changed", {
    from: priceType,
    to: newPriceType,
    timestamp: new Date().toISOString(),
  });
};
```

## Acceptance Criteria

- [ ] Price filter toggle shows 3 options: All Courses, Free Only, Paid Only
- [ ] Default selection is "All Courses"
- [ ] Selecting filter option updates course list via API
- [ ] Selected option highlighted with primary color (#ff6b9d)
- [ ] Price filter selection persists in sessionStorage
- [ ] URL updated with price_type param (e.g., ?price_type=free)
- [ ] Page reload restores price filter from URL or sessionStorage
- [ ] "All Courses" option removes price_type from URL
- [ ] API correctly filters courses by price_type parameter
- [ ] Paid course cards display price: "€29.99" format
- [ ] Free course cards display "FREE" badge
- [ ] Price always displayed on course cards (not hidden)
- [ ] Price display uses correct currency (EUR)
- [ ] Mobile: radio button filter in bottom sheet
- [ ] Mobile: apply/cancel buttons work correctly
- [ ] Responsive: toggle visible on desktop, segment control
- [ ] Touch targets: min 44x44px on mobile
- [ ] Combining price filter with category filter works
- [ ] Combining price filter with course type filter works
- [ ] Clear all filters resets price to 'all'
- [ ] No console errors or warnings
- [ ] Performance: filter change loads results < 1s
- [ ] Mobile tested on iOS Safari, Android Chrome
- [ ] Desktop tested on Chrome, Firefox, Safari, Edge
- [ ] Keyboard accessible: Tab, Space to change selection
- [ ] Sharing URL with price filter works for others

## Dependencies

- `next` — URL routing and query params
- `react` (18+) — UI framework
- `react-native` — Mobile framework
- `react-query` / `swr` — API caching

## Technical Notes

- Session storage clears on browser close (unlike localStorage)
- Price must always be shown with currency symbol (€)
- Free courses: verify price field is 0 in database
- Use ENUM type for price_type (ensures data integrity)
- Monitor price filter usage: most used option?
- Consider A/B test: segment control vs radio buttons on mobile
- Future: support multiple currencies (USD, GBP, etc.) with conversion
- Consider price range slider (v2+): €0 - €100
- Analytics: track which price segment converts best
