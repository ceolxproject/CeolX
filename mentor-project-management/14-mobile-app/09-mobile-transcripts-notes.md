# Mobile Transcripts and Notes

## Description

Implement transcript viewing with auto-scroll synchronization to video position and searchable transcript content. Enable users to create, edit, and manage timestamped notes linked to specific lesson moments with easy jump-to-moment functionality.

## Affected Apps/Packages

- `apps/mobile/src/components/video/TranscriptPanel.tsx` (new)
- `apps/mobile/src/components/video/NotesPanel.tsx` (new)
- `apps/mobile/src/screens/lesson/NotesListScreen.tsx` (new)
- `packages/shared/src/services/notesService.ts` (new)

## Requirements

### 1. Transcript Panel Component

File: `src/components/video/TranscriptPanel.tsx`

Interactive transcript display with auto-scrolling:

```typescript
interface TranscriptSegment {
  id: string;
  startTime: number; // milliseconds
  endTime: number;
  text: string;
  speaker?: string;
  confidence?: number; // 0-1 for ML-generated transcripts
}

interface TranscriptPanelProps {
  transcript: TranscriptSegment[];
  currentPosition: number; // milliseconds
  onTimestampPress: (time: number) => void;
  isLoading?: boolean;
}

export function TranscriptPanel({
  transcript,
  currentPosition,
  onTimestampPress,
  isLoading = false,
}: TranscriptPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(
    new Set()
  );
  const scrollViewRef = useRef<ScrollView>(null);
  const segmentRefs = useRef<Map<string, View>>(new Map());

  // Find currently playing segment
  const currentSegmentIndex = useMemo(() => {
    return transcript.findIndex(
      (seg) => seg.startTime <= currentPosition && currentPosition < seg.endTime
    );
  }, [currentPosition, transcript]);

  // Auto-scroll to current segment
  useEffect(() => {
    if (currentSegmentIndex >= 0) {
      const currentSegmentId = transcript[currentSegmentIndex].id;
      const segmentRef = segmentRefs.current.get(currentSegmentId);

      if (segmentRef) {
        segmentRef.measureLayout(
          findNodeHandle(scrollViewRef.current),
          (x, y) => {
            scrollViewRef.current?.scrollTo({
              y: Math.max(0, y - 100),
              animated: true,
            });
          }
        );
      }
    }
  }, [currentSegmentIndex]);

  // Search filtering
  const filteredTranscript = useMemo(() => {
    if (!searchQuery.trim()) return transcript;
    return transcript.filter((seg) =>
      seg.text.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [transcript, searchQuery]);

  const handleSegmentPress = (segment: TranscriptSegment) => {
    onTimestampPress(segment.startTime);
  };

  const toggleSegmentExpanded = (segmentId: string) => {
    const updated = new Set(expandedSegments);
    if (updated.has(segmentId)) {
      updated.delete(segmentId);
    } else {
      updated.add(segmentId);
    }
    setExpandedSegments(updated);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={18}
          color={colors.textTertiary}
          style={styles.searchIcon}
        />
        <TextInput
          placeholder="Search transcript..."
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>

      {/* Transcript list */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.transcriptList}
        showsVerticalScrollIndicator={false}
      >
        {filteredTranscript.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No transcript available</Text>
          </View>
        ) : (
          filteredTranscript.map((segment, index) => {
            const isCurrentSegment = currentSegmentIndex === index;
            const isExpanded = expandedSegments.has(segment.id);

            return (
              <View
                key={segment.id}
                ref={(ref) => {
                  if (ref) {
                    segmentRefs.current.set(segment.id, ref);
                  }
                }}
                style={[
                  styles.segment,
                  isCurrentSegment && styles.segmentCurrent,
                ]}
              >
                <Pressable
                  style={styles.segmentButton}
                  onPress={() => handleSegmentPress(segment)}
                >
                  <View style={styles.timeAndText}>
                    <Text style={styles.timestamp}>
                      {formatTime(segment.startTime / 1000)}
                    </Text>
                    {segment.speaker && (
                      <Text style={styles.speaker}>{segment.speaker}</Text>
                    )}
                  </View>
                  {searchQuery.length > 0 ? (
                    <Text
                      style={styles.text}
                      numberOfLines={3}
                    >
                      {highlightSearchTerm(segment.text, searchQuery)}
                    </Text>
                  ) : (
                    <>
                      <Text
                        style={styles.text}
                        numberOfLines={isExpanded ? undefined : 2}
                      >
                        {segment.text}
                      </Text>
                      {segment.text.length > 100 && !isExpanded && (
                        <Pressable
                          onPress={() => toggleSegmentExpanded(segment.id)}
                        >
                          <Text style={styles.expandLink}>Show more</Text>
                        </Pressable>
                      )}
                    </>
                  )}
                </Pressable>

                {/* Confidence indicator for ML-generated transcripts */}
                {segment.confidence !== undefined && (
                  <View style={styles.confidenceIndicator}>
                    <View
                      style={[
                        styles.confidenceDot,
                        {
                          backgroundColor:
                            segment.confidence > 0.9
                              ? colors.success
                              : segment.confidence > 0.7
                              ? colors.warning
                              : colors.error,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// Helper to highlight search terms
function highlightSearchTerm(text: string, query: string): React.ReactNode {
  const parts = text.split(new RegExp(`(${query})`, 'gi'));

  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <Text key={index} style={styles.highlight}>
        {part}
      </Text>
    ) : (
      part
    )
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchIcon: {
    paddingHorizontal: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    color: colors.text,
  },
  transcriptList: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  segment: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  segmentCurrent: {
    backgroundColor: colors.primaryLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  segmentButton: {
    gap: spacing.sm,
  },
  timeAndText: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  timestamp: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    minWidth: 40,
  },
  speaker: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  text: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  highlight: {
    backgroundColor: colors.warning,
    fontWeight: '600',
  },
  expandLink: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  confidenceIndicator: {
    position: 'absolute',
    right: spacing.lg,
    top: '50%',
    transform: [{ translateY: -6 }],
  },
  confidenceDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});

export default TranscriptPanel;
```

### 2. Notes Panel Component

File: `src/components/video/NotesPanel.tsx`

Create, view, and manage timestamped notes:

```typescript
interface Note {
  id: string;
  text: string;
  timestamp: number; // milliseconds
  createdAt: string;
  updatedAt?: string;
}

interface NotesPanelProps {
  lessonId: string;
  currentPosition: number;
}

export function NotesPanel({
  lessonId,
  currentPosition,
}: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [showComposeBox, setShowComposeBox] = useState(false);

  useEffect(() => {
    loadNotes();
  }, [lessonId]);

  const loadNotes = async () => {
    setIsLoading(true);
    try {
      const notesData = await notesService.getLessonNotes(lessonId);
      setNotes(notesData.sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      showError('Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNote = async () => {
    if (!newNoteText.trim()) return;

    try {
      const newNote = await notesService.createNote({
        lessonId,
        text: newNoteText,
        timestamp: currentPosition,
      });

      setNotes([newNote, ...notes]);
      setNewNoteText('');
      setShowComposeBox(false);
    } catch (error) {
      showError('Failed to save note');
    }
  };

  const handleUpdateNote = async (noteId: string, text: string) => {
    try {
      const updatedNote = await notesService.updateNote(noteId, text);
      setNotes(notes.map((n) => (n.id === noteId ? updatedNote : n)));
      setEditingNoteId(null);
    } catch (error) {
      showError('Failed to update note');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    Alert.alert('Delete note?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await notesService.deleteNote(noteId);
            setNotes(notes.filter((n) => n.id !== noteId));
          } catch (error) {
            showError('Failed to delete note');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <>
          {/* Compose box */}
          {!showComposeBox ? (
            <Pressable
              style={styles.composePrompt}
              onPress={() => setShowComposeBox(true)}
            >
              <Ionicons name="add-circle" size={20} color={colors.primary} />
              <Text style={styles.composePromptText}>
                Add a note at {formatTime(currentPosition / 1000)}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.composeBox}>
              <View style={styles.composeHeader}>
                <Text style={styles.composeTime}>
                  {formatTime(currentPosition / 1000)}
                </Text>
                <Pressable onPress={() => setShowComposeBox(false)}>
                  <Ionicons name="close" size={20} color={colors.text} />
                </Pressable>
              </View>
              <TextInput
                placeholder="What would you like to remember?"
                placeholderTextColor={colors.textTertiary}
                value={newNoteText}
                onChangeText={setNewNoteText}
                multiline
                style={styles.composeInput}
                maxLength={500}
              />
              <View style={styles.composeFooter}>
                <Text style={styles.charCount}>
                  {newNoteText.length}/500
                </Text>
                <Button
                  title="Save Note"
                  onPress={handleCreateNote}
                  disabled={!newNoteText.trim()}
                />
              </View>
            </View>
          )}

          {/* Notes list */}
          <FlatList
            data={notes}
            renderItem={({ item: note }) => (
              <NoteCard
                note={note}
                isEditing={editingNoteId === note.id}
                onEdit={() => setEditingNoteId(note.id)}
                onSave={(text) => handleUpdateNote(note.id, text)}
                onDelete={() => handleDeleteNote(note.id)}
                onTimestampPress={(time) => {
                  // Handled by parent screen
                }}
              />
            )}
            keyExtractor={(note) => note.id}
            contentContainerStyle={styles.notesList}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="document-text" size={40} color={colors.border} />
                <Text style={styles.emptyText}>No notes yet</Text>
                <Text style={styles.emptySubtext}>
                  Create notes to help you remember key moments
                </Text>
              </View>
            }
            scrollEnabled={false}
          />
        </>
      )}
    </View>
  );
}

function NoteCard({
  note,
  isEditing,
  onEdit,
  onSave,
  onDelete,
  onTimestampPress,
}: {
  note: Note;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (text: string) => void;
  onDelete: () => void;
  onTimestampPress: (time: number) => void;
}) {
  const [editText, setEditText] = useState(note.text);

  if (isEditing) {
    return (
      <View style={styles.noteCard}>
        <TextInput
          value={editText}
          onChangeText={setEditText}
          multiline
          style={styles.noteEditInput}
          maxLength={500}
        />
        <View style={styles.noteCardFooter}>
          <Text style={styles.charCount}>{editText.length}/500</Text>
          <View style={styles.noteCardActions}>
            <Button
              title="Cancel"
              variant="outline"
              size="sm"
              onPress={() => setEditText(note.text)}
            />
            <Button
              title="Save"
              size="sm"
              onPress={() => onSave(editText)}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.noteCard}>
      <Pressable
        style={styles.noteTimestamp}
        onPress={() => onTimestampPress(note.timestamp)}
      >
        <Ionicons name="play-circle" size={16} color={colors.primary} />
        <Text style={styles.noteTimestampText}>
          {formatTime(note.timestamp / 1000)}
        </Text>
      </Pressable>

      <Text style={styles.noteText}>{note.text}</Text>

      <View style={styles.noteCardFooter}>
        <Text style={styles.noteDate}>
          {new Date(note.createdAt).toLocaleDateString()}
        </Text>
        <View style={styles.noteCardActions}>
          <Pressable onPress={onEdit} style={styles.actionButton}>
            <Ionicons name="pencil" size={16} color={colors.primary} />
          </Pressable>
          <Pressable onPress={onDelete} style={styles.actionButton}>
            <Ionicons name="trash" size={16} color={colors.error} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  composePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  composePromptText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  composeBox: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  composeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  composeTime: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  composeInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 80,
    color: colors.text,
  },
  composeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  notesList: {
    paddingVertical: spacing.md,
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  noteCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteTimestamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  noteTimestampText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  noteText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  noteEditInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 80,
    color: colors.text,
    marginBottom: spacing.md,
  },
  noteCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteDate: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  noteCardActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    padding: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  emptySubtext: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

export default NotesPanel;
```

### 3. Notes Service

File: `packages/shared/src/services/notesService.ts`

```typescript
interface CreateNoteData {
  lessonId: string;
  text: string;
  timestamp: number;
}

export class NotesService {
  private api = axios.create({
    baseURL: process.env.EXPO_PUBLIC_API_URL,
  });

  async getLessonNotes(lessonId: string): Promise<Note[]> {
    const { data } = await this.api.get(`/lessons/${lessonId}/notes`);
    return data.notes;
  }

  async createNote(note: CreateNoteData): Promise<Note> {
    const { data } = await this.api.post(`/lessons/${note.lessonId}/notes`, {
      text: note.text,
      timestamp: note.timestamp,
    });
    return data.note;
  }

  async updateNote(noteId: string, text: string): Promise<Note> {
    const { data } = await this.api.patch(`/notes/${noteId}`, {
      text,
    });
    return data.note;
  }

  async deleteNote(noteId: string): Promise<void> {
    await this.api.delete(`/notes/${noteId}`);
  }

  async exportNotes(lessonId: string): Promise<string> {
    // Export as text/markdown
    const notes = await this.getLessonNotes(lessonId);
    return notes
      .map((note) => `[${formatTime(note.timestamp / 1000)}] ${note.text}`)
      .join("\n\n");
  }
}

export const notesService = new NotesService();
```

## Acceptance Criteria

- [ ] Transcript panel displays all transcript segments
- [ ] Current segment highlighted during playback
- [ ] Auto-scroll to current segment
- [ ] Search functionality filters transcript
- [ ] Timestamp tap seeks video to that position
- [ ] Confidence indicators shown for ML transcripts
- [ ] Show more/less expansion for long segments
- [ ] Notes panel allows creating new notes at current position
- [ ] Notes display with timestamps and creation date
- [ ] Edit notes in-place with character counter
- [ ] Delete notes with confirmation
- [ ] Tap timestamp on note to jump in video
- [ ] Notes persist across sessions
- [ ] Notes sync to backend
- [ ] Empty states shown when no content
- [ ] Character limits enforced (500 chars per note)
- [ ] No console errors during use
- [ ] Smooth scrolling in both panels

## Dependencies

- react-native (TextInput, FlatList, ScrollView)
- @react-navigation/native

## Technical Notes

### Transcript Auto-Sync

- Update current segment every 500ms
- Smooth scroll with tolerance for 100ms
- Stop auto-scroll when user manually scrolls

### Note Timestamps

- Store as milliseconds for precision
- Display in MM:SS format
- Allow jumping to timestamp by tapping note

### Search Implementation

- Case-insensitive matching
- Real-time filtering
- Highlight matching text with background color
- Show result count

### Offline Support

- Cache notes locally in AsyncStorage
- Sync on background/periodic intervals
- Queue failed creates for retry

### Accessibility

- All text readable by screen readers
- Touch targets 44pt minimum
- Color not sole indicator (use icons)
- Keyboard navigation for text inputs
