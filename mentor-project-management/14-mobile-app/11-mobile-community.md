# Mobile Community

## Description

Implement a community feed with post creation (text + images), like/comment interactions, lesson-specific Q&A sections, and community guidelines acknowledgment. The feed displays user-generated content with proper moderation and blocking capabilities.

## Affected Apps/Packages

- `apps/mobile/src/screens/community/CommunityScreen.tsx` (new)
- `apps/mobile/src/components/community/` (new)
- `packages/shared/src/services/communityService.ts` (new)

## Requirements

### 1. Community Feed Screen

File: `src/screens/community/CommunityScreen.tsx`

Main feed with FlatList and post creation:

```typescript
interface Post {
  id: string;
  author: {
    id: string;
    fullName: string;
    avatarUrl: string;
    badge?: 'instructor' | 'verified';
  };
  content: string;
  images?: Array<{ url: string; id: string }>;
  type: 'discussion' | 'question' | 'announcement';
  createdAt: string;
  updatedAt?: string;
  likesCount: number;
  commentsCount: number;
  userLiked: boolean;
  lessonId?: string; // For lesson-specific posts
  category?: string;
}

export function CommunityScreen({
  route,
  navigation,
}: CommunityScreenProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'questions' | 'discussions'>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showGuidelinesOnce, setShowGuidelinesOnce] = useState(false);

  const FILTER_OPTIONS = [
    { label: 'All', value: 'all' },
    { label: 'Questions', value: 'questions' },
    { label: 'Discussions', value: 'discussions' },
  ];

  useEffect(() => {
    checkShowGuidelines();
    fetchPosts(1, false);
  }, []);

  useEffect(() => {
    if (selectedFilter !== 'all') {
      fetchPosts(1, false);
    }
  }, [selectedFilter]);

  const checkShowGuidelines = async () => {
    const hasAcknowledged = await AsyncStorage.getItem('community_guidelines_acknowledged');
    if (!hasAcknowledged) {
      setShowGuidelinesOnce(true);
    }
  };

  const fetchPosts = async (pageNum = 1, append = false) => {
    if (pageNum === 1) {
      setIsLoading(true);
    }

    try {
      const results = await communityService.getFeed({
        type: selectedFilter === 'all' ? undefined : selectedFilter,
        page: pageNum,
        limit: 15,
      });

      if (append) {
        setPosts((prev) => [...prev, ...results.data]);
      } else {
        setPosts(results.data);
      }

      setHasMore(results.hasMore);
      setPage(pageNum);
    } catch (error) {
      showError('Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchPosts(1, false);
    setIsRefreshing(false);
  };

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      fetchPosts(page + 1, true);
    }
  };

  const handleLikeToggle = async (postId: string, liked: boolean) => {
    try {
      if (liked) {
        await communityService.unlikePost(postId);
      } else {
        await communityService.likePost(postId);
      }

      setPosts(
        posts.map((post) =>
          post.id === postId
            ? {
                ...post,
                userLiked: !post.userLiked,
                likesCount: post.likesCount + (post.userLiked ? -1 : 1),
              }
            : post
        )
      );
    } catch (error) {
      showError('Failed to update post');
    }
  };

  const handleDeletePost = async (postId: string) => {
    Alert.alert('Delete post?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await communityService.deletePost(postId);
            setPosts(posts.filter((p) => p.id !== postId));
          } catch (error) {
            showError('Failed to delete post');
          }
        },
      },
    ]);
  };

  const handleComposePress = () => {
    if (showGuidelinesOnce) {
      // Show guidelines first
      return;
    }
    navigation.navigate('Modal', {
      screen: 'ComposePost',
      params: { onPostCreated: handlePostCreated },
    });
  };

  const handlePostCreated = (newPost: Post) => {
    setPosts([newPost, ...posts]);
  };

  const handleGuidelinesAccepted = async () => {
    await AsyncStorage.setItem('community_guidelines_acknowledged', 'true');
    setShowGuidelinesOnce(false);
  };

  if (showGuidelinesOnce) {
    return (
      <GuidelinesModal
        onAccept={handleGuidelinesAccepted}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Filter tabs */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {FILTER_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              style={[
                styles.filterButton,
                selectedFilter === option.value && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedFilter(option.value as any)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  selectedFilter === option.value && styles.filterButtonTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Posts list */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : posts.length === 0 ? (
        <EmptyState
          icon="chat-bubble-outline"
          title="No posts yet"
          description="Be the first to start a discussion"
        />
      ) : (
        <FlatList
          data={posts}
          renderItem={({ item: post }) => (
            <PostCard
              post={post}
              onLike={() => handleLikeToggle(post.id, post.userLiked)}
              onComment={() =>
                navigation.navigate('PostDetail', { postId: post.id })
              }
              onDelete={() => handleDeletePost(post.id)}
              onUserPress={() =>
                navigation.navigate('UserProfile', { userId: post.author.id })
              }
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          scrollEventThrottle={16}
        />
      )}

      {/* Compose button (FAB) */}
      <Pressable
        style={styles.fab}
        onPress={handleComposePress}
      >
        <Ionicons name="add" size={24} color={colors.white} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  filterContainer: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  filterContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  filterButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  filterButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingVertical: spacing.md,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});

export default CommunityScreen;
```

### 2. Post Card Component

File: `src/components/community/PostCard.tsx`

Individual post display with interactions:

```typescript
export function PostCard({
  post,
  onLike,
  onComment,
  onDelete,
  onUserPress,
}: {
  post: Post;
  onLike: () => void;
  onComment: () => void;
  onDelete: () => void;
  onUserPress: () => void;
}) {
  const [showOptions, setShowOptions] = useState(false);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.authorInfo}
          onPress={onUserPress}
        >
          <Image
            source={{ uri: post.author.avatarUrl }}
            style={styles.avatar}
          />
          <View style={styles.authorText}>
            <View style={styles.authorNameRow}>
              <Text style={styles.authorName}>{post.author.fullName}</Text>
              {post.author.badge && (
                <View style={styles.badge}>
                  <Ionicons
                    name={
                      post.author.badge === 'instructor'
                        ? 'school'
                        : 'checkmark-circle'
                    }
                    size={14}
                    color={colors.primary}
                  />
                </View>
              )}
            </View>
            <Text style={styles.timestamp}>
              {formatTimeAgo(new Date(post.createdAt))}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => setShowOptions(!showOptions)}
          style={styles.moreButton}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
        </Pressable>

        {showOptions && (
          <View style={styles.optionsMenu}>
            <Pressable
              style={styles.menuOption}
              onPress={() => {
                setShowOptions(false);
                onDelete();
              }}
            >
              <Ionicons name="trash" size={16} color={colors.error} />
              <Text style={styles.menuOptionText}>Delete</Text>
            </Pressable>
            <Pressable
              style={styles.menuOption}
              onPress={() => {
                setShowOptions(false);
                // Show report modal
              }}
            >
              <Ionicons name="flag" size={16} color={colors.warning} />
              <Text style={styles.menuOptionText}>Report</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {post.type !== 'discussion' && (
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {post.type === 'question' ? '❓ Question' : '📢 Announcement'}
            </Text>
          </View>
        )}

        <Text style={styles.postText}>{post.content}</Text>

        {/* Images */}
        {post.images && post.images.length > 0 && (
          <View style={styles.imagesContainer}>
            {post.images.slice(0, 4).map((image, index) => (
              <Image
                key={image.id}
                source={{ uri: image.url }}
                style={[
                  styles.postImage,
                  post.images!.length > 1 && styles.postImageSmall,
                  index === 3 &&
                    post.images!.length > 4 &&
                    styles.postImageOverlay,
                ]}
              />
            ))}
            {post.images.length > 4 && (
              <View style={[styles.postImage, styles.postImageMore]}>
                <Text style={styles.moreImagesText}>
                  +{post.images.length - 4}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <Text style={styles.statText}>{post.likesCount} likes</Text>
        <View style={styles.statDivider} />
        <Text style={styles.statText}>{post.commentsCount} comments</Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          style={styles.actionButton}
          onPress={onLike}
        >
          <Ionicons
            name={post.userLiked ? 'heart' : 'heart-outline'}
            size={18}
            color={post.userLiked ? colors.error : colors.text}
          />
          <Text style={[styles.actionText, post.userLiked && styles.actionTextActive]}>
            Like
          </Text>
        </Pressable>

        <Pressable
          style={styles.actionButton}
          onPress={onComment}
        >
          <Ionicons name="chatbubble-outline" size={18} color={colors.text} />
          <Text style={styles.actionText}>Comment</Text>
        </Pressable>

        <Pressable style={styles.actionButton}>
          <Ionicons name="share-social" size={18} color={colors.text} />
          <Text style={styles.actionText}>Share</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    marginVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.lg,
  },
  authorInfo: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  authorText: {
    flex: 1,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  badge: {
    marginLeft: spacing.xs,
  },
  timestamp: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  moreButton: {
    padding: spacing.sm,
  },
  optionsMenu: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 100,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuOptionText: {
    fontSize: 13,
    color: colors.text,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 4,
    backgroundColor: colors.primaryLight,
  },
  typeBadgeText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  postText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  postImageSmall: {
    width: '48%',
    height: 100,
  },
  postImageOverlay: {
    opacity: 0.7,
  },
  postImageMore: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.border,
  },
  moreImagesText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 12,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  actionText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  actionTextActive: {
    color: colors.error,
    fontWeight: '600',
  },
});
```

### 3. Compose Post Modal

File: `src/screens/community/ComposePostScreen.tsx`

Create new posts with text and images:

```typescript
export function ComposePostScreen({
  route,
  navigation,
}: ComposePostScreenProps) {
  const { onPostCreated } = route.params || {};

  const [content, setContent] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [postType, setPostType] = useState<'discussion' | 'question'>('discussion');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        maxNumberOfImages: 4,
        quality: 0.7,
      });

      if (!result.cancelled) {
        setSelectedImages([
          ...selectedImages,
          ...result.assets.map((asset) => asset.uri),
        ]);
      }
    } catch (error) {
      showError('Failed to pick image');
    }
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      showError('Please enter some content');
      return;
    }

    setIsSubmitting(true);
    try {
      const newPost = await communityService.createPost({
        content: content.trim(),
        type: postType,
        images: selectedImages,
      });

      onPostCreated?.(newPost);
      navigation.goBack();
    } catch (error) {
      showError('Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New Post</Text>
        <Button
          title="Post"
          size="sm"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting || !content.trim()}
        />
      </View>

      <ScrollView style={styles.content}>
        {/* Post type selector */}
        <View style={styles.typeSelector}>
          <Pressable
            style={[
              styles.typeButton,
              postType === 'discussion' && styles.typeButtonActive,
            ]}
            onPress={() => setPostType('discussion')}
          >
            <Text style={styles.typeButtonText}>Discussion</Text>
          </Pressable>
          <Pressable
            style={[
              styles.typeButton,
              postType === 'question' && styles.typeButtonActive,
            ]}
            onPress={() => setPostType('question')}
          >
            <Text style={styles.typeButtonText}>Question</Text>
          </Pressable>
        </View>

        {/* Text input */}
        <TextInput
          placeholder="What's on your mind?"
          placeholderTextColor={colors.textTertiary}
          value={content}
          onChangeText={setContent}
          multiline
          style={styles.textInput}
          maxLength={1000}
        />

        {/* Character count */}
        <Text style={styles.charCount}>{content.length}/1000</Text>

        {/* Images */}
        {selectedImages.length > 0 && (
          <View style={styles.imagesContainer}>
            {selectedImages.map((image, index) => (
              <View key={index} style={styles.imageWrapper}>
                <Image
                  source={{ uri: image }}
                  style={styles.image}
                />
                <Pressable
                  style={styles.removeButton}
                  onPress={() => handleRemoveImage(index)}
                >
                  <Ionicons name="close-circle" size={24} color={colors.error} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom actions */}
      <View style={styles.footer}>
        <Pressable onPress={handlePickImage}>
          <Ionicons
            name="image"
            size={24}
            color={colors.primary}
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelButton: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  typeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  typeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 120,
    color: colors.text,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },
  imagesContainer: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  imageWrapper: {
    position: 'relative',
  },
  image: {
    height: 150,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
```

### 4. Community Service

File: `packages/shared/src/services/communityService.ts`

```typescript
export class CommunityService {
  private api = axios.create({
    baseURL: process.env.EXPO_PUBLIC_API_URL,
  });

  async getFeed(params: {
    type?: string;
    page: number;
    limit: number;
  }): Promise<{ data: Post[]; hasMore: boolean }> {
    const { data } = await this.api.get("/community/feed", { params });
    return data;
  }

  async createPost(data: {
    content: string;
    type: "discussion" | "question";
    images?: string[];
  }): Promise<Post> {
    const formData = new FormData();
    formData.append("content", data.content);
    formData.append("type", data.type);

    if (data.images) {
      data.images.forEach((image, index) => {
        formData.append(`images[${index}]`, {
          uri: image,
          type: "image/jpeg",
          name: `image-${index}.jpg`,
        } as any);
      });
    }

    const { data: result } = await this.api.post("/community/posts", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return result.post;
  }

  async deletePost(postId: string): Promise<void> {
    await this.api.delete(`/community/posts/${postId}`);
  }

  async likePost(postId: string): Promise<void> {
    await this.api.post(`/community/posts/${postId}/like`);
  }

  async unlikePost(postId: string): Promise<void> {
    await this.api.delete(`/community/posts/${postId}/like`);
  }

  async getPostComments(postId: string): Promise<Comment[]> {
    const { data } = await this.api.get(`/community/posts/${postId}/comments`);
    return data.comments;
  }

  async createComment(postId: string, content: string): Promise<Comment> {
    const { data } = await this.api.post(
      `/community/posts/${postId}/comments`,
      { content },
    );
    return data.comment;
  }
}

export const communityService = new CommunityService();
```

## Acceptance Criteria

- [ ] Community feed loads with all posts
- [ ] Filter by discussions/questions works
- [ ] Pull-to-refresh syncs feed
- [ ] Like/unlike toggle works
- [ ] Comment count accurate
- [ ] Compose post opens modal
- [ ] Post type selection (discussion/question) works
- [ ] Image upload supports up to 4 images
- [ ] Character limit enforced (1000 chars)
- [ ] Delete post with confirmation
- [ ] Report post functionality available
- [ ] Instructor/verified badges display
- [ ] Time ago format accurate
- [ ] Posts sync to backend
- [ ] No console errors
- [ ] Smooth scrolling performance

## Dependencies

- react-native (FlatList, ImageBackground)
- expo-image-picker (image selection)
- @react-navigation/native
- axios (HTTP client)

## Technical Notes

### Community Moderation

- Flag/report posts with reason
- Block users from settings
- Show content warnings for flagged posts
- Hide posts from blocked users

### Image Handling

- Compress to 70% quality before upload
- Max 4 images per post
- Support jpg, png formats
- Upload to CDN with progress tracking

### Cache Strategy

- Cache feed locally for offline viewing
- Sync on app background
- Clear old posts after 30 days
