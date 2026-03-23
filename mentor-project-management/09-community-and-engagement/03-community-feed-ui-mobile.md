# Task 3: Community Feed UI (React Native Mobile)

## Description

Implement the community feed user interface for the React Native mobile application using FlatList for efficient list rendering. This includes post cards, pull-to-refresh gesture, and proper performance optimization for mobile devices. Only instructors can create posts (via the mentor web app); learners can view, like, and comment on the mobile app. The UI must follow mobile UX best practices and use the design system from ui-mobile package.

## Affected Apps/Packages

- `apps/mobile` - React Native mobile app (Expo)
- `packages/ui-mobile` - React Native components and design system
- `packages/api-client` - TypeScript API client hooks
- `packages/validators` - Zod schemas for form validation

## Mobile Components

### 1. CommunityPostCard Component

**Location:** `packages/ui-mobile/src/components/CommunityPostCard.tsx`

**Props:**

```typescript
interface CommunityPostCardProps {
  post: CommunityPostData;
  onLike?: (postId: string) => Promise<void>;
  onUnlike?: (postId: string) => Promise<void>;
  onCommentPress?: (postId: string) => void;
  onBookmark?: (postId: string) => Promise<void>;
  onMorePress?: (postId: string) => void;
  currentUserId: string;
  isLoading?: boolean;
}
```

**Layout:**

```
┌──────────────────────────────────┐
│ [Avatar] Name                    │
│           Timestamp              │
├──────────────────────────────────┤
│ Post content text with proper    │
│ wrapping and line breaks...      │
├──────────────────────────────────┤
│ [Image - full width, 16:9 ratio] │
├──────────────────────────────────┤
│ [🔹 Course Tag 1] [🔹 Topic Tag 1]│
├──────────────────────────────────┤
│ ❤️ 45 likes | 💬 12 comments     │
├──────────────────────────────────┤
│ [❤️ Like] [💬 Comment] [🔖 Save] │
│          [⋯ More]                │
└──────────────────────────────────┘
```

**Features:**

- Touch-friendly sizing (min 44pt tappable areas)
- Image aspect ratio maintenance (16:9 or 1:1 square)
- Tap on post to expand/navigate to detail view
- Tap on comments to jump to comment section
- Long-press menu for additional actions (report, block)
- Author info with tap to view mentor/profile
- Timestamp with relative date formatting
- Like button animation (heart animation on double tap)
- Action button loading states

### 2. CommunityFeedScreen Component

**Location:** `apps/mobile/src/screens/CommunityFeedScreen.tsx`

**Props:**

```typescript
interface CommunityFeedScreenProps {
  navigation: NavigationProp<any>;
  mentorId?: string;
  courseId?: string;
}
```

**Features:**

- FlatList with optimized rendering
- Pull-to-refresh gesture (RefreshControl)
- Load more on end reached (onEndReached)
- Keyboard dismiss on scroll (automaticallyAdjustKeyboardInsets)
- Empty state component
- Error state with retry button
- Loading state (initial load)
- Safe area handling
- Status bar customization

**FlatList Configuration:**

```typescript
<FlatList
  data={posts}
  renderItem={({ item }) => <CommunityPostCard post={item} />}
  keyExtractor={(item) => item.id}
  onEndReached={loadMorePosts}
  onEndReachedThreshold={0.3}
  refreshControl={
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={onRefresh}
      colors={[theme.colors.primary]}
      tintColor={theme.colors.primary}
    />
  }
  ListEmptyComponent={<EmptyState />}
  ListFooterComponent={isLoadingMore ? <LoadingIndicator /> : null}
  scrollIndicatorInsets={{ right: 1 }}
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  updateCellsBatchingPeriod={50}
  initialNumToRender={12}
/>
```

### 3. ComposePostSheet Component

**Location:** `packages/ui-mobile/src/components/ComposePostSheet.tsx`

**Props:**

```typescript
interface ComposePostSheetProps {
  isVisible: boolean;
  onClose: () => void;
  onSubmit: (data: PostFormData) => Promise<void>;
  mentorId: string;
  isLoading?: boolean;
}
```

**Layout (Bottom Sheet):**

```
┌──────────────────────────────────┐
│ [─────] Create Post              │
├──────────────────────────────────┤
│ [Avatar] Your Name               │
├──────────────────────────────────┤
│ [TextInput Multiline]            │
│ "What's on your mind?"           │
│ (2000 char counter)              │
├──────────────────────────────────┤
│ [Image] [Course Tag] [Topic Tag] │
│ [+ Add]     [+ Add]              │
├──────────────────────────────────┤
│ 📋 Community Guidelines (required)│
│ [☐ I agree to guidelines]        │
├──────────────────────────────────┤
│        [Cancel] [Post]           │
└──────────────────────────────────┘
```

**Features:**

- Bottom sheet modal (half or full screen on expand)
- Keyboard-aware positioning
- Multiline text input with character counter
- Image picker integration
- Course/topic tag pickers inline
- Community guidelines checkbox
- Submit button enabled only when valid
- Dismiss keyboard on sheet close
- Auto-save draft to AsyncStorage on close (optional)
- Loading overlay during submission

### 4. ImagePickerModal Component

**Location:** `packages/ui-mobile/src/components/ImagePickerModal.tsx`

**Props:**

```typescript
interface ImagePickerModalProps {
  isVisible: boolean;
  onImageSelected: (asset: ImagePickerAsset) => void;
  onCancel: () => void;
  maxSizeBytes?: number;
}
```

**Features:**

- Options to choose from:
  - Take photo (camera)
  - Choose from library (photo picker)
  - Cancel
- Camera permissions handling with user education
- Photo library permissions handling
- Image size validation before selection
- Format validation (JPEG, PNG, WebP)
- Load image metadata (dimensions)
- Handle different image orientations
- Preview after selection

**Permissions Handling:**

```typescript
// iOS: Info.plist entries for NSCameraUsageDescription, NSPhotoLibraryUsageDescription
// Android: AndroidManifest.xml + request at runtime

const { status: cameraStatus } =
  await ImagePicker.requestCameraPermissionsAsync();
const { status: libraryStatus } =
  await ImagePicker.requestMediaLibraryPermissionsAsync();

if (cameraStatus !== "granted" || libraryStatus !== "granted") {
  // Show alert directing to settings
  Alert.alert(
    "Permissions Required",
    "Allow camera and photo library access in Settings",
    [{ text: "Cancel" }, { text: "Go to Settings", onPress: openSettings }]
  );
}
```

### 5. CourseTagPickerModal Component

**Location:** `packages/ui-mobile/src/components/CourseTagPickerModal.tsx`

**Props:**

```typescript
interface CourseTagPickerModalProps {
  isVisible: boolean;
  selectedCourses: CourseData[];
  onCoursesSelected: (courses: CourseData[]) => void;
  onClose: () => void;
  maxTags?: number;
  isLoading?: boolean;
}
```

**Features:**

- Search bar to filter courses
- Scrollable list of courses
- Checkboxes for multi-select
- Show selected count
- Disable selection when max reached
- Course thumbnails and titles
- Done/Cancel buttons

### 6. TopicTagInputMobile Component

**Location:** `packages/ui-mobile/src/components/TopicTagInputMobile.tsx`

**Props:**

```typescript
interface TopicTagInputMobileProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  suggestions?: string[];
  maxTags?: number;
}
```

**Features:**

- Inline text input for adding tags
- Autocomplete suggestions (FlatList popup)
- Add tag via Done button or comma separator
- Remove tags via swipe or × button
- Show tag count indicator
- Prevent duplicate tags
- Keyboard-aware positioning

### 7. CommentSheetModal Component

**Location:** `packages/ui-mobile/src/components/CommentSheetModal.tsx`

**Props:**

```typescript
interface CommentSheetModalProps {
  isVisible: boolean;
  postId: string;
  onClose: () => void;
  onCommentAdded?: (comment: CommentData) => void;
}
```

**Layout (Bottom Sheet):**

```
┌──────────────────────────────────┐
│ [─────] Comments (12)            │
├──────────────────────────────────┤
│ [Comment 1 - Author, timestamp]  │
│ Comment text...                  │
│ [❤️ 5] [Reply] [More]            │
├──────────────────────────────────┤
│ [Comment 2]...                   │
├──────────────────────────────────┤
│ [Load More Comments]             │
├──────────────────────────────────┤
│ [Avatar] [TextInput: Comment]    │
│              [Send →]            │
└──────────────────────────────────┘
```

**Features:**

- FlatList for comments (single-level only)
- Pagination support (load more button)
- Comment compose at bottom
- Keyboard-aware bottom area
- Tap to expand long comments
- Like comment functionality
- Delete comment (author only)
- Timestamp formatting

### 8. EmptyState Component

**Location:** `packages/ui-mobile/src/components/CommunityEmptyState.tsx`

**Scenarios:**

- No posts in feed
- No results for filter/search
- Access denied (no lessons watched)
- Network error

### 9. LoadingState Component

**Location:** `packages/ui-mobile/src/components/CommunityLoadingState.tsx`

**Features:**

- Shimmer skeleton cards (using `react-native-shimmer-placeholder`)
- Animated loading indicator
- Multiple skeleton cards to fill screen

## Navigation Structure

### Tab Navigation

```
Community
  └── Stack Navigator
      ├── Community Feed (initial route)
      ├── Post Detail (modal)
      ├── Mentor Profile (modal or push)
      ├── Image Viewer (modal)
      └── Course Detail (push)
```

### Params

```typescript
type CommunityStackParamList = {
  Feed: {
    mentorId?: string;
    courseId?: string;
  };
  PostDetail: {
    postId: string;
  };
  MentorProfile: {
    mentorId: string;
  };
  ImageViewer: {
    imageUri: string;
    title: string;
  };
};
```

## Requirements

### Performance Optimization

**FlatList Best Practices:**

- Set `removeClippedSubviews={true}` for Android
- Use `maxToRenderPerBatch` and `updateCellsBatchingPeriod`
- Implement `keyExtractor` correctly (never use array index)
- Set `initialNumToRender` to initial visible items + buffer
- Use `getItemLayout` for constant-height lists (if applicable)

**Image Optimization:**

- Lazy load images with visibility detection
- Cache images with `react-native-fast-image`
- Resize large images before display
- Use placeholder/blur hash while loading
- Handle network errors gracefully

**Memory Management:**

- Clear old posts from state (keep only last 100)
- Unsubscribe from listeners on component unmount
- Cancel in-flight requests on unmount
- Clear intervals and timeouts

### State Management

```typescript
interface CommunityState {
  posts: CommunityPostData[];
  page: number;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  error: string | null;
  filterMentorId?: string;
  filterCourseId?: string;
}
```

### Image Handling

- Use `react-native-fast-image` for caching and resizing
- Implement blur hash for placeholders
- Handle different screen densities (1x, 2x, 3x)
- Compress before uploading (use `react-native-image-crop-picker`)

**Cloudinary Mobile Integration:**

```typescript
// Upload with Cloudinary unsigned preset
const uploadImage = async (uri: string) => {
  const formData = new FormData();
  formData.append("file", {
    uri,
    type: "image/jpeg",
    name: "community-post.jpg",
  });
  formData.append("upload_preset", CLOUDINARY_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_NAME}/image/upload`,
    { method: "POST", body: formData }
  );

  return response.json();
};
```

### Keyboard Management

```typescript
// Use react-native-keyboard-aware-scroll-view for scrolling above keyboard
// Or use Keyboard API to adjust content
import { Keyboard } from "react-native";

const [keyboardHeight, setKeyboardHeight] = useState(0);

useEffect(() => {
  const showSubscription = Keyboard.addListener("keyboardWillShow", (e) => {
    setKeyboardHeight(e.endCoordinates.height);
  });
  const hideSubscription = Keyboard.addListener("keyboardWillHide", () => {
    setKeyboardHeight(0);
  });

  return () => {
    showSubscription.remove();
    hideSubscription.remove();
  };
}, []);
```

### Accessibility

- Accessible labels for all interactive elements
- VoiceOver/TalkBack support
- Color contrast compliance
- Touch target sizing (min 44pt)
- Don't rely on color alone for information

```typescript
<TouchableOpacity
  accessible={true}
  accessibilityLabel={`Like post by ${post.author.name}`}
  accessibilityHint="Double tap to like this post"
  accessibilityRole="button"
>
  {/* ... */}
</TouchableOpacity>
```

## Acceptance Criteria

- [ ] CommunityFeedScreen displays posts in FlatList correctly
- [ ] Pull-to-refresh gesture reloads posts
- [ ] onEndReached loads more posts automatically
- [ ] Empty state message shows when no posts
- [ ] Error state with retry button appears on failure
- [ ] Loading indicators appear during initial load and pagination
- [ ] No compose/create post UI shown to learners (post creation is instructor-only via mentor web)
- [ ] Like/unlike buttons work with optimistic updates
- [ ] Comment sheet modal shows all comments
- [ ] Add comment from sheet works properly
- [ ] Delete post button shows only for post author
- [ ] Long-press menu shows available actions
- [ ] Navigation transitions are smooth
- [ ] Memory usage stays reasonable after 500+ scrolls
- [ ] Image rendering optimized (no janky scrolling)
- [ ] Keyboard dismisses properly on all interactions
- [ ] Permissions requests shown appropriately on first use
- [ ] Works on iOS 14+ and Android 9+
- [ ] All touch targets minimum 44pt
- [ ] Screen reader announces content correctly

## Dependencies

- `apps/mobile` - React Native/Expo setup
- `packages/ui-mobile` - React Native design system
- `packages/api-client` - API hooks
- `packages/validators` - Form validation
- `expo-image-picker` - Camera/library access
- `expo-permissions` - Permission handling
- `react-native-fast-image` - Image caching
- `react-native-bottom-sheet` - Bottom sheet modal
- `@react-native-keyboard-toolkit/keyboard-aware-flatlist` - Keyboard handling
- `react-native-shimmer-placeholder` - Loading skeletons
- `@tanstack/react-query` - Server state management

## Technical Notes

### FlatList Key Extractor

```typescript
// GOOD: Use unique ID
keyExtractor={(item) => item.id}

// BAD: Never use index
keyExtractor={(item, index) => String(index)}

// BAD: Using unstable keys
keyExtractor={(item) => `${item.authorId}-${item.timestamp}`}
```

### Scroll Performance Optimization

```typescript
// Debounce rapid scroll events
const scrollEventThrottle = 16; // ~60fps

<FlatList
  scrollEventThrottle={scrollEventThrottle}
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  updateCellsBatchingPeriod={50}
/>
```

### Image Caching Strategy

```typescript
// Use FastImage for automatic caching
import FastImage from 'react-native-fast-image';

<FastImage
  source={{
    uri: imageUrl,
    priority: FastImage.priority.normal,
    cache: FastImage.cacheControl.web
  }}
  style={{ width: '100%', height: 300 }}
  resizeMode={FastImage.resizeMode.cover}
/>
```

### Error Handling

- Network errors: show offline banner with retry
- Permission denied: show alert with settings link
- Image upload failure: show toast error, allow retry
- Image pick failure: silently dismiss modal
- API errors: show user-friendly messages

### Bottom Sheet Behavior

- Sheet should close on outside tap
- Allow drag-to-dismiss gesture
- Snap to predetermined heights
- Handle dynamic content height
- Scroll content inside sheet, not behind

### Test Coverage

- Unit tests for components with props variations
- Integration tests for form submission
- E2E tests for compose → appear in feed
- Performance tests for FlatList with 1000+ items
- Accessibility tests with screen reader
