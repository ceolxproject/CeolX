# Search As-You-Type Implementation

## Description

Implement real-time search-as-you-type functionality with 300ms debounce, Typesense instant search, highlighted matching terms, search history, and suggestions. The feature will be available on both Learner Web (Next.js) and Learner Mobile (React Native) with optimized performance and UX.

## Affected Apps/Packages

- `apps/learner-web` — Web search implementation
- `apps/learner-mobile` — React Native search implementation
- `backend/api/hono` — Search endpoints (see typesense-search-setup.md)
- `shared/hooks` — useSearch, useSearchHistory hooks
- `shared/types` — SearchResult, SearchHistory types

## Search Implementation

### Web (Next.js) Implementation

#### SearchBar Component

```typescript
// apps/learner-web/components/SearchBar.tsx
import { useState, useCallback, useEffect } from 'react';
import { debounce } from 'lodash-es';
import { useSearchCourses } from '@/hooks/useSearchCourses';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  onSearchSubmit?: (query: string) => void;
  placeholder?: string;
  showSuggestions?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearchSubmit,
  placeholder = 'Search courses, instructors...',
  showSuggestions = true,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { results, facets, loading } = useSearchCourses();
  const { history, suggestions, addToHistory } = useSearchHistory();

  // Debounced search function (300ms)
  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (searchQuery.length >= 2) {
        await results.search(searchQuery);
      } else {
        results.clear();
      }
    }, 300),
    [results]
  );

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setIsOpen(true);

    if (newQuery.length >= 2) {
      debouncedSearch(newQuery);
    } else if (newQuery.length === 0) {
      setIsOpen(false);
    }
  };

  // Handle search submission (Enter key or click)
  const handleSubmit = (searchQuery: string) => {
    addToHistory(searchQuery);
    onSearchSubmit?.(searchQuery);
    setQuery('');
    setIsOpen(false);
  };

  // Display options: recent searches or search results
  const displayOptions = query.length >= 2 ? results : history;

  return (
    <div className={styles.container}>
      <div className={styles.inputWrapper}>
        <span className={styles.icon}>🔍</span>
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder={placeholder}
          className={styles.input}
          aria-label="Search courses"
        />
        {query && (
          <button
            className={styles.clearButton}
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (
        <div className={styles.dropdown}>
          {loading && <div className={styles.loading}>Searching...</div>}

          {query.length >= 2 && !loading && (
            <>
              {/* Search Results */}
              {results.length > 0 ? (
                <>
                  <div className={styles.section}>
                    <div className={styles.sectionTitle}>Courses</div>
                    {results.slice(0, 5).map((course) => (
                      <SearchResultItem
                        key={course.id}
                        course={course}
                        query={query}
                        onSelect={() => handleSubmit(query)}
                      />
                    ))}
                    {results.length > 5 && (
                      <div className={styles.viewAll}>
                        View all {results.length} results
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className={styles.noResults}>
                  No courses found for "{query}"
                </div>
              )}
            </>
          )}

          {query.length < 2 && (
            <>
              {/* Recent Searches */}
              {history.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Recent Searches</div>
                  {history.slice(0, 5).map((item, idx) => (
                    <div
                      key={idx}
                      className={styles.historyItem}
                      onClick={() => {
                        setQuery(item);
                        debouncedSearch(item);
                      }}
                    >
                      <span className={styles.historyIcon}>🕐</span>
                      {item}
                    </div>
                  ))}
                </div>
              )}

              {/* Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Suggestions</div>
                  {suggestions.slice(0, 5).map((item, idx) => (
                    <div
                      key={idx}
                      className={styles.suggestionItem}
                      onClick={() => {
                        setQuery(item);
                        debouncedSearch(item);
                      }}
                    >
                      <span className={styles.suggestionIcon}>✨</span>
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

interface SearchResultItemProps {
  course: any;
  query: string;
  onSelect: () => void;
}

const SearchResultItem: React.FC<SearchResultItemProps> = ({
  course,
  query,
  onSelect,
}) => {
  // Render title with highlights
  const HighlightedText = ({ text, query }: { text: string; query: string }) => {
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, idx) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={idx}>{part}</mark>
          ) : (
            <span key={idx}>{part}</span>
          )
        )}
      </>
    );
  };

  return (
    <div className={styles.resultItem} onClick={onSelect}>
      <div className={styles.thumbnail}>
        <img
          src={course.thumbnail_url}
          alt={course.title}
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3C/svg%3E';
          }}
        />
      </div>
      <div className={styles.resultContent}>
        <div className={styles.resultTitle}>
          <HighlightedText text={course.title} query={query} />
        </div>
        <div className={styles.resultMeta}>
          {course.instructor_name}
          {course.price_type === 'paid' && (
            <span className={styles.price}>€{course.price.toFixed(2)}</span>
          )}
        </div>
      </div>
    </div>
  );
};
```

#### Styling (CSS Modules)

```css
/* apps/learner-web/components/SearchBar.module.css */

.container {
  position: relative;
  width: 100%;
  max-width: 500px;
}

.inputWrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: border-color 0.2s;
}

.inputWrapper:focus-within {
  border-color: #ff6b9d;
  box-shadow: 0 1px 3px rgba(255, 107, 157, 0.2);
}

.icon {
  font-size: 18px;
  flex-shrink: 0;
}

.input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 14px;
  font-family: inherit;
  background: transparent;
  color: #333;
}

.input::placeholder {
  color: #999;
}

.clearButton {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  color: #999;
  padding: 0;
  transition: color 0.2s;
}

.clearButton:hover {
  color: #333;
}

.dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 8px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 400px;
  overflow-y: auto;
  z-index: 1000;
}

.loading {
  padding: 16px;
  text-align: center;
  color: #999;
  font-size: 14px;
}

.section {
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.section:last-child {
  border-bottom: none;
}

.sectionTitle {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.resultItem {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.resultItem:hover {
  background-color: #f9f9f9;
}

.thumbnail {
  width: 48px;
  height: 27px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  background: #f0f0f0;
}

.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.resultContent {
  flex: 1;
  min-width: 0;
}

.resultTitle {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.resultTitle mark {
  background-color: #fff3cd;
  font-weight: 600;
}

.resultMeta {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.price {
  margin-left: 8px;
  color: #ff6b9d;
  font-weight: 600;
}

.historyItem,
.suggestionItem {
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #666;
}

.historyItem:hover,
.suggestionItem:hover {
  background-color: #f9f9f9;
}

.historyIcon,
.suggestionIcon {
  font-size: 16px;
  flex-shrink: 0;
}

.viewAll {
  padding: 8px 12px;
  text-align: center;
  font-size: 13px;
  color: #ff6b9d;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.viewAll:hover {
  background-color: #f9f9f9;
}

.noResults {
  padding: 16px 12px;
  text-align: center;
  color: #999;
  font-size: 14px;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .dropdown {
    max-height: 60vh;
  }

  .resultItem {
    gap: 8px;
    padding: 6px 8px;
  }

  .thumbnail {
    width: 40px;
    height: 22px;
  }
}
```

#### useSearchCourses Hook

```typescript
// apps/learner-web/hooks/useSearchCourses.ts
import { useState, useCallback } from "react";
import axios from "axios";

interface SearchResult {
  id: string;
  title: string;
  thumbnail_url: string;
  instructor_name: string;
  price: number;
  price_type: "free" | "paid";
  course_type: string;
  slug: string;
}

export const useSearchCourses = () => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get("/api/v1/search/courses", {
        params: { q: query, limit: 10 },
      });
      setResults(response.data.data.results || []);
    } catch (err) {
      setError("Search failed. Please try again.");
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    results,
    loading,
    error,
    search,
    clear,
    length: results.length,
    slice: (start: number, end?: number) => results.slice(start, end),
  };
};
```

#### useSearchHistory Hook

```typescript
// apps/learner-web/hooks/useSearchHistory.ts
import { useState, useEffect } from "react";

const STORAGE_KEY = "search_history";
const MAX_HISTORY = 10;

export const useSearchHistory = () => {
  const [history, setHistory] = useState<string[]>([]);
  const [suggestions] = useState<string[]>([
    "Makeup",
    "Skincare",
    "Natural Beauty",
    "Bridal Makeup",
  ]);

  // Load history from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, []);

  const addToHistory = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setHistory((prev) => {
      const filtered = prev.filter(
        (item) => item.toLowerCase() !== trimmed.toLowerCase()
      );
      const updated = [trimmed, ...filtered].slice(0, MAX_HISTORY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    history,
    suggestions,
    addToHistory,
    clearHistory,
  };
};
```

### Mobile (React Native) Implementation

#### SearchBar Component

```typescript
// apps/learner-mobile/screens/SearchScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Text,
  SafeAreaView,
} from 'react-native';
import { debounce } from 'lodash-es';
import { useSearchCourses } from '@/hooks/useSearchCourses';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import styles from './SearchScreen.styles';

export const SearchScreen = ({ navigation }) => {
  const [query, setQuery] = useState('');
  const { results, loading } = useSearchCourses();
  const { history, addToHistory } = useSearchHistory();

  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (searchQuery.length >= 2) {
        await results.search(searchQuery);
      }
    }, 300),
    [results]
  );

  const handleInputChange = (text: string) => {
    setQuery(text);
    if (text.length >= 2) {
      debouncedSearch(text);
    } else {
      results.clear();
    }
  };

  const handleSelectResult = (course: any) => {
    addToHistory(query);
    navigation.navigate('CourseDetail', { courseId: course.id });
  };

  const handleSelectHistory = (item: string) => {
    setQuery(item);
    debouncedSearch(item);
  };

  const displayData = query.length >= 2 ? results : history;

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.input}
          placeholder="Search courses..."
          value={query}
          onChangeText={handleInputChange}
          placeholderTextColor="#999"
        />
        {query ? (
          <TouchableOpacity
            onPress={() => {
              setQuery('');
              results.clear();
            }}
          >
            <Text style={styles.clearButton}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Results or History */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff6b9d" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {!loading && query.length >= 2 ? (
        <FlatList
          data={results}
          renderItem={({ item }) => (
            <SearchResultRow
              course={item}
              query={query}
              onPress={() => handleSelectResult(item)}
            />
          )}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No courses found for "{query}"
              </Text>
            </View>
          }
        />
      ) : (
        !loading && (
          <FlatList
            data={history}
            renderItem={({ item }) => (
              <HistoryRow
                item={item}
                onPress={() => handleSelectHistory(item)}
              />
            )}
            keyExtractor={(item) => item}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Start typing to search</Text>
              </View>
            }
          />
        )
      )}
    </SafeAreaView>
  );
};

const SearchResultRow = ({ course, query, onPress }) => {
  const HighlightedText = ({ text }) => {
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <Text style={styles.resultTitle}>
        {parts.map((part, idx) => (
          <Text
            key={idx}
            style={
              part.toLowerCase() === query.toLowerCase()
                ? styles.highlight
                : styles.normalText
            }
          >
            {part}
          </Text>
        ))}
      </Text>
    );
  };

  return (
    <TouchableOpacity style={styles.resultRow} onPress={onPress}>
      <Image
        source={{ uri: course.thumbnail_url }}
        style={styles.thumbnail}
      />
      <View style={styles.resultContent}>
        <HighlightedText text={course.title} />
        <Text style={styles.instructorName}>{course.instructor_name}</Text>
        {course.price_type === 'paid' && (
          <Text style={styles.price}>€{course.price.toFixed(2)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const HistoryRow = ({ item, onPress }) => (
  <TouchableOpacity style={styles.historyRow} onPress={onPress}>
    <Text style={styles.historyIcon}>🕐</Text>
    <Text style={styles.historyText}>{item}</Text>
  </TouchableOpacity>
);
```

#### Styling (StyleSheet)

```typescript
// apps/learner-mobile/screens/SearchScreen.styles.ts
import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    marginHorizontal: 12,
    marginVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
  },
  clearButton: {
    fontSize: 18,
    color: "#999",
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#999",
    fontSize: 14,
  },
  resultRow: {
    flexDirection: "row",
    padding: 12,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  thumbnail: {
    width: 48,
    height: 27,
    borderRadius: 4,
    marginRight: 12,
    backgroundColor: "#f0f0f0",
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 4,
  },
  highlight: {
    backgroundColor: "#fff3cd",
    fontWeight: "600",
  },
  normalText: {
    color: "#333",
  },
  instructorName: {
    fontSize: 12,
    color: "#999",
    marginBottom: 2,
  },
  price: {
    fontSize: 12,
    color: "#ff6b9d",
    fontWeight: "600",
  },
  historyRow: {
    flexDirection: "row",
    padding: 12,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  historyIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  historyText: {
    fontSize: 14,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
  },
});
```

## Search History and Local Storage

### Web Implementation

```typescript
// localStorage: 10 most recent searches, JSON array
// Key: "search_history"
// Value: ["Makeup", "Skincare", "Natural Beauty", ...]

const STORAGE_KEY = "search_history";
const MAX_HISTORY = 10;

function getHistory(): string[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

function addToHistory(query: string): void {
  const history = getHistory();
  const updated = [query, ...history.filter((h) => h !== query)].slice(
    0,
    MAX_HISTORY
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
```

### Mobile Implementation

```typescript
// React Native AsyncStorage
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "search_history";
const MAX_HISTORY = 10;

async function getHistory(): Promise<string[]> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

async function addToHistory(query: string): Promise<void> {
  const history = await getHistory();
  const updated = [query, ...history.filter((h) => h !== query)].slice(
    0,
    MAX_HISTORY
  );
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
```

## Debouncing Configuration

- **Debounce Delay:** 300ms
- **Minimum Query Length:** 2 characters
- **Implementation:** lodash-es `debounce` function
- **Cancellation:** Clear pending debounce on component unmount

## Highlighting Strategy

**Web:**

- Parse API response `highlights` field
- Render `<mark>` tags around matching terms
- CSS styling: yellow background (#fff3cd), bold text

**Mobile:**

- Regex-based term highlighting
- Highlighted text: yellow background, bold weight (600)
- Normal text: regular weight (400)

## Acceptance Criteria

- [ ] Search input renders in header with 🔍 icon
- [ ] Debounce delay of 300ms working (test with rapid typing)
- [ ] Search results appear after 2+ character input
- [ ] Minimum 5-10 courses returned in suggestions
- [ ] Matching terms highlighted in yellow (#fff3cd) on web, mobile
- [ ] Recent searches displayed when search is empty
- [ ] Search history stored in localStorage (web) or AsyncStorage (mobile)
- [ ] Max 10 items in search history
- [ ] Clear button removes search and shows history
- [ ] Suggestions show even without typing (v2+)
- [ ] Loading spinner shows during search
- [ ] "No results" message shown if no courses found
- [ ] Typing "makup" returns makeup courses (typo tolerance)
- [ ] Multi-word search works ("makeup tutorial")
- [ ] Click/tap on result navigates to course detail page
- [ ] Search history item click triggers search for that term
- [ ] Search bar keyboard accessible (tab, enter keys)
- [ ] Mobile: keyboard auto-shows on screen open
- [ ] Mobile: dismiss keyboard on result select
- [ ] Web: dropdown closes on ESC key or outside click
- [ ] Performance: search response < 500ms even with 1000+ courses
- [ ] No memory leaks on component unmount
- [ ] Works offline: show history and cached results
- [ ] Internationalization: search supports locale parameter

## Dependencies

- `lodash-es` — Debounce utility
- `axios` — HTTP client (alternative: native fetch)
- `react` (18+) / `react-native` — UI framework
- AsyncStorage (React Native only) — Local history storage

## Technical Notes

- Debounce must cancel previous requests on new query
- Highlighting must preserve original text case
- Search should be case-insensitive (handled by API)
- Support special characters in search (accents, apostrophes)
- Mobile: render FlatList for virtualization (many results)
- Web: limit visible results to 5-10, show "View All" link
- History persistence survives app close/reopen
- Cache search results for 2 minutes (see API endpoint caching)
- Track search analytics: popular terms, no-result searches
- Test search with edge cases: empty string, single char, only spaces
- Keyboard handling: Enter key submits search (web)
- Mobile: TextInput returnKeyType="search" for better UX
