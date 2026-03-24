# Category Filters Implementation

## Description

Implement hierarchical category filtering for course discovery. This includes displaying categories from the admin system with filter counts, multi-select checkbox UI, URL-based filter state persistence for shareable filtered views, and real-time count updates. Categories will be sourced from the admin panel and displayed across web and mobile platforms.

## Affected Apps/Packages

- `apps/learner-web` — Web category filter sidebar/sheet
- `apps/learner-mobile` — React Native filter bottom sheet
- `backend/api/hono` — GET /categories endpoint
- `backend/db/migrations` — Category schema (from admin setup)
- `shared/types` — Category type definitions

## Category Data Structure

### Database Schema

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon_url VARCHAR(500),
  color_hex VARCHAR(7) DEFAULT '#FF6B9D',
  parent_category_id UUID REFERENCES categories(id),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  course_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Example categories (flat for MVP, hierarchical in v2)
INSERT INTO categories (name, slug, icon_url, color_hex) VALUES
  ('Makeup', 'makeup', 'https://cdn.../makeup.svg', '#FF6B9D'),
  ('Skincare', 'skincare', 'https://cdn.../skincare.svg', '#00C9A7'),
  ('Haircare', 'haircare', 'https://cdn.../haircare.svg', '#FFB347'),
  ('Fragrance', 'fragrance', 'https://cdn.../fragrance.svg', '#9370DB'),
  ('Natural Beauty', 'natural-beauty', 'https://cdn.../natural.svg', '#90EE90');
```

### Category Count Updates

- Update `course_count` when course is published/unpublished
- Triggered by QStash worker on course status change
- Cache category list in Redis (TTL: 1 hour)

## API Endpoints

### GET /categories

Retrieve all active categories with course counts.

**Query Parameters:**

- `locale` (string, default: "en") — Language locale

**Response Schema (200 OK):**

```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "uuid",
        "name": "Makeup",
        "slug": "makeup",
        "description": "Learn makeup techniques from professional artists",
        "icon_url": "https://cdn.example.com/icons/makeup.svg",
        "color_hex": "#FF6B9D",
        "course_count": 45,
        "is_active": true
      },
      {
        "id": "uuid",
        "name": "Skincare",
        "slug": "skincare",
        "description": "Master skincare routines and products",
        "icon_url": "https://cdn.example.com/icons/skincare.svg",
        "color_hex": "#00C9A7",
        "course_count": 32,
        "is_active": true
      }
    ]
  }
}
```

**Caching:**

- Cache key: `categories:{locale}`
- TTL: 1 hour (3600s)
- Invalidate on category create/update/delete

## Web Implementation

### Filter Sidebar Component

**Desktop Layout:**

```
Filters
─────────────────────────
Category
  ☐ Makeup (45)
  ☐ Skincare (32)
  ☐ Haircare (18)
  ☐ Fragrance (12)
  ☐ Natural Beauty (8)

  [View More Categories]
─────────────────────────
[Clear All Filters]
```

**Component Structure:**

```typescript
// apps/learner-web/components/CategoryFilter.tsx
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from './CategoryFilter.module.css';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon_url: string;
  color_hex: string;
  course_count: number;
}

interface CategoryFilterProps {
  categories: Category[];
  selectedCategories: string[];
  onCategoryChange: (categoryIds: string[]) => void;
  maxInitialDisplay?: number;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategories,
  onCategoryChange,
  maxInitialDisplay = 5,
}) => {
  const [showAll, setShowAll] = useState(false);
  const router = useRouter();

  const displayedCategories = showAll
    ? categories
    : categories.slice(0, maxInitialDisplay);

  const handleCategoryToggle = (categoryId: string) => {
    const updated = selectedCategories.includes(categoryId)
      ? selectedCategories.filter((id) => id !== categoryId)
      : [...selectedCategories, categoryId];

    onCategoryChange(updated);

    // Update URL with selected categories
    const query = { ...router.query };
    if (updated.length > 0) {
      query.category = updated.join(',');
    } else {
      delete query.category;
    }
    router.push({ pathname: router.pathname, query }, undefined, {
      shallow: true,
    });
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Category</h3>

      <div className={styles.checkboxList}>
        {displayedCategories.map((category) => (
          <label key={category.id} className={styles.checkboxItem}>
            <input
              type="checkbox"
              checked={selectedCategories.includes(category.id)}
              onChange={() => handleCategoryToggle(category.id)}
              className={styles.checkbox}
            />
            <span
              className={styles.categoryIcon}
              style={{
                backgroundColor: category.color_hex,
                backgroundImage: `url(${category.icon_url})`,
              }}
              title={category.name}
            />
            <span className={styles.categoryName}>{category.name}</span>
            <span className={styles.count}>({category.course_count})</span>
          </label>
        ))}
      </div>

      {categories.length > maxInitialDisplay && (
        <button
          className={styles.viewMoreButton}
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? 'View Less' : `View More (${categories.length - maxInitialDisplay} more)`}
        </button>
      )}
    </div>
  );
};
```

### Styling

```css
/* apps/learner-web/components/CategoryFilter.module.css */

.container {
  padding: 16px 0;
  border-bottom: 1px solid #f0f0f0;
}

.title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin: 0 0 12px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.checkboxList {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkboxItem {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 0;
  transition: background-color 0.2s;
}

.checkboxItem:hover {
  background-color: #f9f9f9;
  border-radius: 4px;
  padding-left: 6px;
  padding-right: 6px;
}

.checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  flex-shrink: 0;
  accent-color: #ff6b9d;
}

.categoryIcon {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background-size: cover;
  background-position: center;
  flex-shrink: 0;
  display: inline-block;
}

.categoryName {
  font-size: 14px;
  color: #333;
  font-weight: 500;
  flex: 1;
}

.count {
  font-size: 13px;
  color: #999;
  font-weight: 400;
}

.viewMoreButton {
  margin-top: 12px;
  background: none;
  border: none;
  color: #ff6b9d;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  padding: 4px 0;
  transition: opacity 0.2s;
}

.viewMoreButton:hover {
  opacity: 0.8;
}
```

### Mobile Filter Bottom Sheet

**UI Layout:**

```
┌──────────────────────────────────┐
│ Categories               [Close]  │
├──────────────────────────────────┤
│ ☐ Makeup (45)                    │
│ ☐ Skincare (32)                  │
│ ☐ Haircare (18)                  │
│ ☐ Fragrance (12)                 │
│ ☐ Natural Beauty (8)             │
│ [View More Categories]           │
│                                  │
│                [Apply] [Cancel]  │
└──────────────────────────────────┘
```

**Component:**

```typescript
// apps/learner-mobile/components/CategoryFilterSheet.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import CheckBox from '@react-native-community/checkbox';
import styles from './CategoryFilterSheet.styles';

interface Category {
  id: string;
  name: string;
  icon_url: string;
  color_hex: string;
  course_count: number;
}

interface CategoryFilterSheetProps {
  categories: Category[];
  selectedCategories: string[];
  onApply: (categoryIds: string[]) => void;
  onCancel: () => void;
}

export const CategoryFilterSheet: React.FC<CategoryFilterSheetProps> = ({
  categories,
  selectedCategories,
  onApply,
  onCancel,
}) => {
  const [tmpSelected, setTmpSelected] = useState(selectedCategories);
  const [showAll, setShowAll] = useState(false);

  const displayedCategories = showAll ? categories : categories.slice(0, 5);

  const handleToggle = (categoryId: string) => {
    setTmpSelected((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Categories</Text>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayedCategories}
        renderItem={({ item: category }) => (
          <TouchableOpacity
            style={styles.categoryRow}
            onPress={() => handleToggle(category.id)}
          >
            <CheckBox
              value={tmpSelected.includes(category.id)}
              onValueChange={() => handleToggle(category.id)}
              tintColor="#ff6b9d"
              onTintColor="#ff6b9d"
            />
            <View
              style={[
                styles.categoryIcon,
                { backgroundColor: category.color_hex },
              ]}
            />
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryName}>{category.name}</Text>
            </View>
            <Text style={styles.count}>({category.course_count})</Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
      />

      {categories.length > 5 && (
        <TouchableOpacity
          style={styles.viewMoreButton}
          onPress={() => setShowAll(!showAll)}
        >
          <Text style={styles.viewMoreText}>
            {showAll ? 'Show Less' : `Show More (${categories.length - 5})`}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.applyButton}
          onPress={() => onApply(tmpSelected)}
        >
          <Text style={styles.applyButtonText}>Apply</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};
```

### Styling (Mobile)

```typescript
// apps/learner-mobile/components/CategoryFilterSheet.styles.ts
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
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f9f9f9",
  },
  categoryIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginLeft: 8,
  },
  categoryInfo: {
    flex: 1,
    marginLeft: 12,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  count: {
    fontSize: 12,
    color: "#999",
  },
  viewMoreButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  viewMoreText: {
    color: "#ff6b9d",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
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

## URL Query Parameter Format

**Single Category:**

```
/courses?category=makeup
```

**Multiple Categories:**

```
/courses?category=makeup,skincare,haircare
```

**With Other Filters:**

```
/courses?category=makeup,skincare&price_type=free&sort_by=popular
```

### URL State Sync Hook

```typescript
// apps/learner-web/hooks/useCategoryFilter.ts
import { useState, useEffect } from "react";
import { useRouter } from "next/router";

export const useCategoryFilter = () => {
  const router = useRouter();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Load from URL on mount
  useEffect(() => {
    if (router.query.category) {
      const categoryParam = router.query.category;
      const categories = Array.isArray(categoryParam)
        ? categoryParam
        : categoryParam.split(",");
      setSelectedCategories(categories);
    }
  }, [router.query.category]);

  const updateCategories = (categoryIds: string[]) => {
    setSelectedCategories(categoryIds);

    const query = { ...router.query };
    if (categoryIds.length > 0) {
      query.category = categoryIds.join(",");
    } else {
      delete query.category;
    }

    router.push({ pathname: router.pathname, query }, undefined, {
      shallow: true,
    });
  };

  return { selectedCategories, updateCategories };
};
```

## Category Filter Badge

**Badge Display on Cards:**

```
┌─────────────────────┐
│  Category Badge     │ ← Single category tag
│  [Makeup]           │   Colored background (#FF6B9D)
│                     │
│  Price Badge        │
│  [€29.99]           │
└─────────────────────┘
```

**Styling:**

```css
.categoryBadge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: white;
  text-transform: capitalize;
  /* Background color from category.color_hex */
}
```

## Filter Count Badges

**Main Filter Button:**

```
[Filters 🔽] (3)  ← Shows active filter count
```

**Implementation:**

```typescript
const activeFilterCount =
  selectedCategories.length +
  (priceType !== 'all' ? 1 : 0) +
  (courseType !== 'all' ? 1 : 0);

return (
  <button className={styles.filterButton}>
    Filters {activeFilterCount > 0 && <span className={styles.badge}>{activeFilterCount}</span>}
  </button>
);
```

## Acceptance Criteria

- [ ] GET /categories endpoint returns all active categories with course counts
- [ ] Categories cached in Redis with 1-hour TTL
- [ ] Category cache invalidates on category create/update/delete
- [ ] Category filter sidebar visible on desktop (240px width)
- [ ] Category filter collapses to bottom sheet on mobile
- [ ] Up to 5 categories displayed initially, "View More" expands full list
- [ ] Category checkboxes work: select/deselect updates filter
- [ ] Selected categories update URL query params
- [ ] URL-based categories restore on page reload
- [ ] Multiple categories can be selected simultaneously
- [ ] Category badges show correct color from category.color_hex
- [ ] Course count displayed next to category name
- [ ] Filter count badge shows total active filters
- [ ] "Clear All Filters" button resets category selection
- [ ] Category icons load and display correctly
- [ ] Responsive: category names truncate if too long
- [ ] Touch-friendly: checkboxes are 44x44px on mobile
- [ ] Bottom sheet modal slides from bottom on mobile
- [ ] Apply/Cancel buttons work correctly on mobile
- [ ] Category filter integrates with other filters (price, type)
- [ ] Sharing filtered URL works: others see same filtered courses
- [ ] Performance: category list loads < 200ms
- [ ] No console errors or warnings
- [ ] Category filter accessible: keyboard navigation (Tab, Space)
- [ ] Mobile tested on iOS Safari, Android Chrome

## Dependencies

- `next` — Web framework (router, URL handling)
- `react` (18+) — UI framework
- `react-native` — Mobile framework
- `@react-native-community/checkbox` (mobile) — Checkbox component
- `axios` — HTTP client for GET /categories

## Technical Notes

- Category count must be accurate: update count on course publish/unpublish
- Category icons: use SVG for scalability, fallback to colored circle
- Color hex codes: validate format (#RRGGBB) on save
- Deep linking support (mobile): `app://courses?category=makeup`
- Analytics: track category filter usage for product insights
- Sorting: display categories by sort_order then alphabetically
- Hierarchical categories (v2+): implement nested checkbox trees
- Category search (v2+): type to filter category list
- Category sorting: put most popular categories first
- Disable uncategorized courses: all courses must have primary category
