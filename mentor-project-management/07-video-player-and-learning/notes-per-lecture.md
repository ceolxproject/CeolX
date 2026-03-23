# Personal Notes per Lecture

## Description

Implement personal note-taking functionality within the video player. Learners can create, edit, and delete personal notes while watching videos. Each note is linked to a video timestamp (click-to-seek functionality), allowing learners to quickly navigate to relevant sections. All notes are persisted and accessible from a dedicated notes tab in the player and from a personal notes section in the user profile.

## Affected Apps/Packages

- `apps/learner-web` (Next.js)
- `apps/learner-mobile` (React Native)
- `packages/ui-components` (notes viewer component)
- Backend: notes storage and API service
- Database: notes table with lesson/user/timestamp linkage

## API Endpoints

- `POST /api/lessons/:lessonId/notes` - Create new note
- `GET /api/lessons/:lessonId/notes` - Get all notes for lesson
- `PATCH /api/notes/:noteId` - Edit note
- `DELETE /api/notes/:noteId` - Delete note
- `GET /api/users/:userId/notes` - Get all notes across all courses (profile)
- `GET /api/lessons/:lessonId/notes/export` - Export notes as PDF/markdown

## Requirements

### 1. Note Structure

```json
{
  "id": "uuid",
  "lessonId": "uuid",
  "userId": "uuid",
  "content": "Important point: use SPF 50+ year-round",
  "timestamp": 342.5, // seconds into video
  "createdAt": "2026-02-18T10:30:00Z",
  "updatedAt": "2026-02-18T10:35:00Z",
  "tags": ["skincare", "sun-protection"],
  "color": "yellow" // optional: yellow, pink, blue, green
}
```

### 2. Note Creation

**In-Player Note Creation**:

- "Add Note" button visible in player UI
- Click button: open modal/popover with text editor
- Text area for note content (multi-line, auto-expand)
- Current video timestamp automatically captured
- Display timestamp: "Note at 5:42"
- User can edit timestamp manually (input field showing MM:SS)
- Optional: color picker (4 colors: yellow, pink, blue, green)
- Optional: tag input (free-form tags for organization)
- "Save" and "Cancel" buttons
- On save: note persisted to API, appears in notes list

**Note Card Display** (after creation):

- Shows first 100 characters of note content
- Timestamp link (MM:SS format, clickable)
- Color indicator (left border or background)
- Edit and delete buttons (small icons)

### 3. Note Editing

- Click "Edit" on note card: open modal with current content
- Edit text, timestamp, color, tags
- "Save" and "Cancel" buttons
- On save: update API and UI
- Show success toast: "Note updated"

### 4. Note Deletion

- Click "Delete" on note card: show confirmation dialog
- "Delete" and "Cancel" buttons
- On confirm: delete via API, remove from UI
- Show toast: "Note deleted"

### 5. Notes Tab in Player

**Notes Tab**:

- Player UI has tabs: Video, Transcript, Notes, Comments
- Notes tab shows list of all notes for this lesson
- Default sort: chronological (by timestamp, earliest first)
- Alternative sort: by creation time (newest first)
- Each note shows:
  - Timestamp link (MM:SS, clickable)
  - Note content (first 100 chars, expandable)
  - Color indicator
  - Edit and delete buttons
  - Creation/update timestamps (small gray text)

**Click to Seek**:

- Click timestamp or note card: video seeks to that timestamp
- Highlight note that corresponds to current playback time
- Auto-scroll notes list to show current note

### 6. Notes in User Profile

**Personal Notes Section**:

- In user profile → "My Notes" tab
- Shows all notes across all courses user is enrolled in
- Filter by:
  - Course (dropdown)
  - Date range (from/to date picker)
  - Search text (full-text search)
- Sort by:
  - Course
  - Timestamp
  - Creation date
  - Color

**Note Preview**:

- Course name and lesson name
- Timestamp (clickable, links back to lesson)
- Note content (full text visible)
- Color indicator
- Edit/delete buttons
- Link: "View in lesson" (navigates to lesson + scrolls note)

### 7. Export & Sharing

**Export Options**:

- Download notes for single lesson as:
  - PDF with timestamps and formatting
  - Markdown (.md file)
  - TXT plain text
- Include: course name, lesson name, timestamps
- Optional: include course content context

### 8. Offline Support

- Notes cached locally (IndexedDB/AsyncStorage)
- Create/edit/delete locally while offline
- Sync to backend when online
- Conflict resolution: server version wins if user edited elsewhere

## Acceptance Criteria

- [ ] "Add Note" button visible in player UI
- [ ] Note creation modal opens with text editor
- [ ] Current timestamp auto-captured in note
- [ ] Manual timestamp edit working (MM:SS input)
- [ ] Optional color selection visible
- [ ] Optional tag input visible
- [ ] Note saved to database on "Save" click
- [ ] Note appears in notes list immediately (optimistic update)
- [ ] Edit button opens note with current content
- [ ] Edit saves changes to API
- [ ] Delete button shows confirmation dialog
- [ ] Delete removes note from UI and database
- [ ] Notes tab present in player (with Transcript, Comments)
- [ ] All notes for lesson displayed in notes tab
- [ ] Timestamp link in note clickable, seeks video
- [ ] Current playback note highlighted
- [ ] Notes list auto-scrolls to current note
- [ ] Notes sortable (chronological/newest first)
- [ ] User profile shows "My Notes" section
- [ ] Notes filterable by course, date range, search
- [ ] Notes sortable in profile view
- [ ] Export notes as PDF/markdown working
- [ ] Offline note creation cached and synced
- [ ] Performance: note operations within 500ms
- [ ] Mobile: note modal responsive and accessible
- [ ] Toast notifications show for save/delete/update

## Dependencies

- Mux player (timestamp retrieval)
- Note storage API (backend)
- User profile service
- Search indexing (for full-text search)
- PDF export library (optional: jsPDF, pdfkit)
- Markdown generator (optional)
- IndexedDB/AsyncStorage (offline caching)

## Technical Notes

### Database Schema

```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  timestamp FLOAT NOT NULL, -- seconds into video
  color VARCHAR(20) DEFAULT 'yellow', -- yellow, pink, blue, green
  tags JSONB DEFAULT '[]', -- ["tag1", "tag2"]
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast lookups
CREATE INDEX idx_notes_lesson_user ON notes(lesson_id, user_id);
CREATE INDEX idx_notes_user ON notes(user_id);
CREATE INDEX idx_notes_timestamp ON notes(timestamp);
CREATE INDEX idx_notes_created ON notes(created_at DESC);

-- Full-text search index
CREATE INDEX idx_notes_content_fts ON notes USING GIN (to_tsvector('english', content));
```

### Web Component: Notes Editor

```typescript
// /packages/ui-components/src/NotesViewer/NoteEditor.tsx
import React, { useState } from 'react';
import styles from './NoteEditor.module.css';

interface NoteEditorProps {
  initialContent?: string;
  timestamp: number;
  onSave: (content: string, timestamp: number, color: string, tags: string[]) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
}

export const NoteEditor = ({
  initialContent = '',
  timestamp,
  onSave,
  onCancel,
  isEditing = false,
}: NoteEditorProps) => {
  const [content, setContent] = useState(initialContent);
  const [editTimestamp, setEditTimestamp] = useState(formatTime(timestamp));
  const [color, setColor] = useState('yellow');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const newTimestamp = parseTime(editTimestamp);
      await onSave(content, newTimestamp, color, tags);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  return (
    <div className={styles.modal}>
      <div className={styles.overlay} onClick={onCancel} />
      <div className={styles.content}>
        <h2>{isEditing ? 'Edit Note' : 'Add Note'}</h2>

        {/* Timestamp Input */}
        <div className={styles.field}>
          <label>Timestamp</label>
          <input
            type="text"
            value={editTimestamp}
            onChange={(e) => setEditTimestamp(e.target.value)}
            placeholder="MM:SS"
            className={styles.input}
          />
        </div>

        {/* Text Editor */}
        <div className={styles.field}>
          <label>Note</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your note here..."
            rows={6}
            className={styles.textarea}
          />
        </div>

        {/* Color Picker */}
        <div className={styles.field}>
          <label>Color</label>
          <div className={styles.colorPicker}>
            {['yellow', 'pink', 'blue', 'green'].map(c => (
              <button
                key={c}
                className={`${styles.colorOption} ${styles[c]} ${color === c ? styles.selected : ''}`}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className={styles.field}>
          <label>Tags</label>
          <div className={styles.tagInput}>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="Add tag and press Enter"
              className={styles.input}
            />
            <button onClick={handleAddTag} className={styles.addTagBtn}>
              +
            </button>
          </div>
          <div className={styles.tags}>
            {tags.map(tag => (
              <span key={tag} className={styles.tag}>
                {tag}
                <button onClick={() => handleRemoveTag(tag)}>×</button>
              </span>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className={styles.buttons}>
          <button
            onClick={handleSave}
            disabled={!content.trim() || isSaving}
            className={styles.saveBtn}
          >
            {isSaving ? 'Saving...' : 'Save Note'}
          </button>
          <button onClick={onCancel} className={styles.cancelBtn}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

function formatTime(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

function parseTime(timeStr: string): number {
  const [mm, ss] = timeStr.split(':').map(Number);
  return mm * 60 + ss;
}
```

### Notes List Component

```typescript
// /packages/ui-components/src/NotesViewer/NotesList.tsx
import React, { useState, useEffect } from 'react';
import styles from './NotesList.module.css';

interface Note {
  id: string;
  content: string;
  timestamp: number;
  color: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface NotesListProps {
  lessonId: string;
  currentTime: number;
  onSeek: (time: number) => void;
  userId: string;
}

export const NotesList = ({
  lessonId,
  currentTime,
  onSeek,
  userId,
}: NotesListProps) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [sortBy, setSortBy] = useState<'timestamp' | 'newest'>('timestamp');
  const [showEditor, setShowEditor] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  // Fetch notes on mount
  useEffect(() => {
    const fetchNotes = async () => {
      const response = await fetch(`/api/lessons/${lessonId}/notes`);
      const data = await response.json();
      setNotes(data);
    };

    fetchNotes();
  }, [lessonId]);

  // Sort notes
  const sortedNotes = [...notes].sort((a, b) => {
    if (sortBy === 'timestamp') {
      return a.timestamp - b.timestamp;
    } else {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  // Find current note
  const currentNote = notes.find(
    n => currentTime >= n.timestamp && currentTime < (notes.find(x => x.timestamp > n.timestamp)?.timestamp ?? Infinity)
  );

  const handleAddNote = () => {
    setEditingNote(null);
    setShowEditor(true);
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setShowEditor(true);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (confirm('Delete this note?')) {
      await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
      setNotes(notes.filter(n => n.id !== noteId));
    }
  };

  const handleSaveNote = async (content: string, timestamp: number, color: string, tags: string[]) => {
    if (editingNote) {
      // Update existing
      await fetch(`/api/notes/${editingNote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, timestamp, color, tags }),
      });
      setNotes(notes.map(n => n.id === editingNote.id
        ? { ...n, content, timestamp, color, tags, updatedAt: new Date() }
        : n
      ));
    } else {
      // Create new
      const response = await fetch(`/api/lessons/${lessonId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, timestamp, color, tags }),
      });
      const newNote = await response.json();
      setNotes([...notes, newNote]);
    }
    setShowEditor(false);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button onClick={handleAddNote} className={styles.addBtn}>
          + Add Note
        </button>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
          <option value="timestamp">By Timestamp</option>
          <option value="newest">Newest First</option>
        </select>
      </div>

      {/* Notes List */}
      <div className={styles.notesList}>
        {sortedNotes.length === 0 ? (
          <p className={styles.empty}>No notes yet. Add one to get started!</p>
        ) : (
          sortedNotes.map(note => (
            <div
              key={note.id}
              className={`${styles.noteCard} ${note.id === currentNote?.id ? styles.current : ''} ${styles[note.color]}`}
            >
              <div className={styles.header}>
                <button
                  className={styles.timestamp}
                  onClick={() => onSeek(note.timestamp)}
                >
                  {formatTime(note.timestamp)}
                </button>
                <div className={styles.actions}>
                  <button onClick={() => handleEditNote(note)} title="Edit">
                    ✎
                  </button>
                  <button onClick={() => handleDeleteNote(note.id)} title="Delete">
                    ×
                  </button>
                </div>
              </div>
              <p className={styles.content}>{note.content}</p>
              {note.tags.length > 0 && (
                <div className={styles.tags}>
                  {note.tags.map(tag => (
                    <span key={tag} className={styles.tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <p className={styles.meta}>
                {formatDate(new Date(note.updatedAt))}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <NoteEditor
          initialContent={editingNote?.content}
          timestamp={editingNote?.timestamp ?? 0}
          onSave={handleSaveNote}
          onCancel={() => setShowEditor(false)}
          isEditing={!!editingNote}
        />
      )}
    </div>
  );
};

function formatTime(seconds: number): string {
  const mm = Math.floor(seconds / 60);
  const ss = Math.floor(seconds % 60);
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
```

### Backend API

```typescript
// Backend: POST /api/lessons/:lessonId/notes
app.post("/lessons/:lessonId/notes", authenticateToken, async (req, res) => {
  const { lessonId } = req.params;
  const userId = req.user.id;
  const { content, timestamp, color, tags } = req.body;

  try {
    const result = await db.query(
      `INSERT INTO notes (lesson_id, user_id, content, timestamp, color, tags)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        lessonId,
        userId,
        content,
        timestamp,
        color || "yellow",
        JSON.stringify(tags || []),
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating note:", error);
    return res.status(500).json({ error: "Failed to create note" });
  }
});

// Backend: GET /api/lessons/:lessonId/notes
app.get("/lessons/:lessonId/notes", authenticateToken, async (req, res) => {
  const { lessonId } = req.params;
  const userId = req.user.id;

  try {
    const result = await db.query(
      "SELECT * FROM notes WHERE lesson_id = $1 AND user_id = $2 ORDER BY timestamp ASC",
      [lessonId, userId]
    );

    const notes = result.rows.map((row) => ({
      ...row,
      tags: JSON.parse(row.tags),
    }));

    return res.json(notes);
  } catch (error) {
    console.error("Error fetching notes:", error);
    return res.status(500).json({ error: "Failed to fetch notes" });
  }
});

// Backend: PATCH /api/notes/:noteId
app.patch("/notes/:noteId", authenticateToken, async (req, res) => {
  const { noteId } = req.params;
  const userId = req.user.id;
  const { content, timestamp, color, tags } = req.body;

  try {
    const result = await db.query(
      `UPDATE notes SET content = $1, timestamp = $2, color = $3, tags = $4, updated_at = NOW()
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [content, timestamp, color, JSON.stringify(tags || []), noteId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Note not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating note:", error);
    return res.status(500).json({ error: "Failed to update note" });
  }
});

// Backend: DELETE /api/notes/:noteId
app.delete("/notes/:noteId", authenticateToken, async (req, res) => {
  const { noteId } = req.params;
  const userId = req.user.id;

  try {
    await db.query("DELETE FROM notes WHERE id = $1 AND user_id = $2", [
      noteId,
      userId,
    ]);

    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting note:", error);
    return res.status(500).json({ error: "Failed to delete note" });
  }
});
```
