# Lesson Comments Feature

## Description

Implement a comment system for individual lessons allowing learners to post text comments, view chronological threads, and instructors to reply. Comments are single-level (no nested replies or @mentions) with flagging capability for inappropriate content. Comments display below the video with pagination for long comment threads.

## Affected Apps/Packages

- `apps/learner-web` (Next.js)
- `apps/learner-mobile` (React Native)
- `packages/ui-components` (comments section component)
- Backend: comments service and API
- Database: comments table

## API Endpoints

- `POST /api/lessons/:lessonId/comments` - Create comment
- `GET /api/lessons/:lessonId/comments` - Get comments (paginated)
- `PATCH /api/comments/:commentId` - Edit comment (owner only)
- `DELETE /api/comments/:commentId` - Delete comment (owner or instructor)
- `POST /api/comments/:commentId/replies` - Instructor reply to comment
- `POST /api/comments/:commentId/flag` - Flag comment as inappropriate
- `GET /api/admin/flagged-comments` - View flagged comments (admin)

## Requirements

### 1. Comment Structure

```json
{
  "id": "uuid",
  "lessonId": "uuid",
  "userId": "uuid",
  "userName": "Sarah Johnson",
  "userAvatar": "https://...",
  "content": "Great explanation of contouring techniques!",
  "createdAt": "2026-02-18T10:30:00Z",
  "updatedAt": null,
  "flagged": false,
  "flagCount": 0,
  "replies": {
    "id": "uuid",
    "lessonId": "uuid",
    "commentId": "uuid", // parent comment
    "userId": "uuid", // instructor only
    "userName": "Instructor Name",
    "userAvatar": "https://...",
    "content": "Thank you! This technique is essential for...",
    "createdAt": "2026-02-18T10:35:00Z",
    "updatedAt": null
  }
}
```

### 2. Comment Display

**Comments Section**:

- Below video player, after transcript/notes tabs
- Title: "Comments ([count])"
- Collapsible/expandable (initially visible)
- Display mode: chronological (newest first, or oldest first option)

**Comment Card**:

- User avatar (small, 32x32px)
- User name (clickable, links to profile if public)
- Comment timestamp (e.g., "2 days ago", exact on hover)
- Comment text (max 500 characters, truncated with "Show more")
- Actions: Edit (owner only), Delete (owner/instructor), Flag (all users)
- Instructor badge on instructor comments
- Reply (if instructor reply exists): nested below, indent/different styling

**Empty State**:

- Message: "No comments yet. Be the first to ask!"

### 3. Comment Creation

**Comment Input**:

- Text area above comment list
- Placeholder: "Share your thoughts about this lesson..."
- Character counter: "X/500"
- Buttons: "Post Comment" and "Cancel"
- Disabled until 1+ character entered
- Post button shows loading state

**Validation**:

- Minimum 1 character, maximum 500 characters
- No URL spam detection (optional)
- Require authentication (cannot post if not logged in)

### 4. Comment Editing

- Edit button on own comments only
- Opens modal with current comment text
- Same 500 character limit
- "Save" and "Cancel" buttons
- Show "(edited)" indicator after comment timestamp
- Update timestamp shows edit time on hover

### 5. Comment Deletion

- Delete button on own comments and instructor comments
- Confirmation dialog: "Delete this comment?"
- "Delete" and "Cancel" buttons
- On deletion: remove from UI immediately

### 6. Instructor Replies

- Instructor can reply to any comment
- Reply form appears below/nested in comment
- Text area for reply (max 1000 characters for instructors)
- Reply marked with "Instructor" badge
- Single reply per comment (no threaded replies)
- Learner cannot reply to instructor reply (only instructor can reply)

### 7. Flag Inappropriate Comments

- Flag icon on each comment (exclamation mark, report icon)
- Click flag: open confirmation dialog
- Reason dropdown: "Inappropriate language", "Offensive", "Spam", "Other"
- Optional: text area for detail
- "Flag" and "Cancel" buttons
- User can flag their own comment or others
- Show "This comment has been flagged" message if multiple flags
- Flagged comments visible to admins/instructors for review

### 8. Pagination

- Show 5-10 comments per page (configurable)
- "Load More" button to fetch next page
- Or: traditional pagination (Previous/Next)
- Or: infinite scroll on mobile

### 9. Sorting & Filtering

- Sort options: "Newest First", "Oldest First"
- Optional: "Most Helpful" (future, requires upvotes)
- No filtering in MVP (show all non-flagged comments)

## Acceptance Criteria

- [ ] Comment input visible below video
- [ ] Text area accepts comment text (min 1, max 500 chars)
- [ ] Character counter working
- [ ] "Post Comment" button functional
- [ ] Comment appears in list immediately after posting
- [ ] Comments displayed chronologically
- [ ] User avatar, name, timestamp visible on each comment
- [ ] Comment timestamp accurate and human-readable ("2 days ago")
- [ ] Edit button visible on own comments only
- [ ] Edit modal opens with current comment text
- [ ] Edit saves changes to API and UI
- [ ] "(edited)" indicator shown after edit
- [ ] Delete button visible on own comments
- [ ] Delete confirmation dialog shows
- [ ] Delete removes comment from UI and database
- [ ] Instructor badge visible on instructor comments
- [ ] Instructor reply form present below instructor comments
- [ ] Instructor can reply to learner comments
- [ ] Reply appears indented/nested under comment
- [ ] Flag icon present on all comments
- [ ] Flag dialog opens with reason options
- [ ] Flagged comments visible in admin panel
- [ ] Pagination working (load more or next page)
- [ ] Sort options present and functional
- [ ] Mobile: comment input responsive
- [ ] Mobile: comment cards readable on small screens
- [ ] Performance: comment load within 1 second
- [ ] Authentication required to post comment
- [ ] Empty state message shown if no comments

## Dependencies

- User authentication (require login to post)
- User profile service (display names, avatars)
- Comments API (CRUD operations)
- Admin panel (moderate flagged comments)
- Pagination system
- Design system (colors, typography, spacing)

## Technical Notes

### Database Schema

```sql
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP,
  deleted BOOLEAN DEFAULT FALSE, -- Soft delete
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE comment_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL,
  user_id UUID NOT NULL, -- Must be instructor
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP,
  UNIQUE(comment_id), -- One reply per comment
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE comment_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL,
  user_id UUID NOT NULL,
  reason VARCHAR(100), -- "inappropriate-language", "offensive", "spam", "other"
  detail TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  UNIQUE(comment_id, user_id), -- User can flag once per comment
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_comments_lesson ON comments(lesson_id);
CREATE INDEX idx_comments_user ON comments(user_id);
CREATE INDEX idx_comments_created ON comments(created_at DESC);
CREATE INDEX idx_comment_flags_comment ON comment_flags(comment_id);
```

### Web Component: Comments Section

```typescript
// /packages/ui-components/src/CommentsSection/index.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { CommentCard } from './CommentCard';
import { CommentInput } from './CommentInput';
import styles from './CommentsSection.module.css';

interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  isInstructor: boolean;
  reply?: any;
  flagged: boolean;
  flagCount: number;
}

interface CommentsSectionProps {
  lessonId: string;
  instructorId: string;
}

export const CommentsSection = ({
  lessonId,
  instructorId,
}: CommentsSectionProps) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);

  // Fetch comments
  useEffect(() => {
    const fetchComments = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `/api/lessons/${lessonId}/comments?page=${page}&sort=${sortBy}`
        );
        const data = await response.json();

        if (page === 1) {
          setComments(data.comments);
        } else {
          setComments(prev => [...prev, ...data.comments]);
        }

        setHasMore(data.hasMore);
      } catch (error) {
        showToast('Failed to load comments', 'error');
        console.error('Error fetching comments:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchComments();
  }, [lessonId, page, sortBy]);

  const handlePostComment = async (content: string) => {
    try {
      const response = await fetch(`/api/lessons/${lessonId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, userId: user?.id }),
      });

      const newComment = await response.json();
      setComments(prev => [newComment, ...prev]); // Add to top
      showToast('Comment posted!', 'success');

      analytics.track('comment_posted', { lessonId, userId: user?.id });
    } catch (error) {
      showToast('Failed to post comment', 'error');
      console.error('Error posting comment:', error);
    }
  };

  const handleEditComment = async (commentId: string, newContent: string) => {
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent }),
      });

      const updated = await response.json();
      setComments(prev =>
        prev.map(c => (c.id === commentId ? updated : c))
      );

      setEditingCommentId(null);
      showToast('Comment updated', 'success');

      analytics.track('comment_edited', { commentId, lessonId });
    } catch (error) {
      showToast('Failed to edit comment', 'error');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;

    try {
      await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
      setComments(prev => prev.filter(c => c.id !== commentId));
      showToast('Comment deleted', 'success');

      analytics.track('comment_deleted', { commentId, lessonId });
    } catch (error) {
      showToast('Failed to delete comment', 'error');
    }
  };

  const handleFlagComment = async (commentId: string, reason: string) => {
    try {
      await fetch(`/api/comments/${commentId}/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      showToast('Comment flagged. Thanks for helping keep our community safe!', 'success');
      analytics.track('comment_flagged', { commentId, reason });
    } catch (error) {
      showToast('Failed to flag comment', 'error');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Comments ({comments.length})</h3>
        {comments.length > 0 && (
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        )}
      </div>

      {/* Comment Input */}
      {user ? (
        <CommentInput onSubmit={handlePostComment} />
      ) : (
        <div className={styles.loginPrompt}>
          <p>Please log in to comment</p>
        </div>
      )}

      {/* Comments List */}
      {isLoading && comments.length === 0 ? (
        <div className={styles.loading}>Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className={styles.empty}>
          <p>No comments yet. Be the first to ask!</p>
        </div>
      ) : (
        <div className={styles.commentsList}>
          {comments.map(comment => (
            <CommentCard
              key={comment.id}
              comment={comment}
              isOwner={comment.userId === user?.id}
              isInstructor={user?.id === instructorId}
              isEditing={editingCommentId === comment.id}
              onEdit={(content) => handleEditComment(comment.id, content)}
              onDelete={() => handleDeleteComment(comment.id)}
              onFlag={(reason) => handleFlagComment(comment.id, reason)}
              onCancelEdit={() => setEditingCommentId(null)}
            />
          ))}
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <button
          className={styles.loadMoreBtn}
          onClick={() => setPage(prev => prev + 1)}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Load More Comments'}
        </button>
      )}
    </div>
  );
};
```

### Comment Card Component

```typescript
// /packages/ui-components/src/CommentsSection/CommentCard.tsx
import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import styles from './CommentCard.module.css';

interface CommentCardProps {
  comment: any;
  isOwner: boolean;
  isInstructor: boolean;
  isEditing: boolean;
  onEdit: (content: string) => void;
  onDelete: () => void;
  onFlag: (reason: string) => void;
  onCancelEdit: () => void;
}

export const CommentCard = ({
  comment,
  isOwner,
  isInstructor,
  isEditing,
  onEdit,
  onDelete,
  onFlag,
  onCancelEdit,
}: CommentCardProps) => {
  const [editContent, setEditContent] = useState(comment.content);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');

  const handleFlag = () => {
    if (!selectedReason) return;
    onFlag(selectedReason);
    setShowFlagDialog(false);
  };

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.header}>
        <img
          src={comment.userAvatar}
          alt={comment.userName}
          className={styles.avatar}
        />
        <div className={styles.userInfo}>
          <div className={styles.nameRow}>
            <span className={styles.userName}>{comment.userName}</span>
            {comment.isInstructor && (
              <span className={styles.instructorBadge}>Instructor</span>
            )}
          </div>
          <time className={styles.timestamp} title={new Date(comment.createdAt).toISOString()}>
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            {comment.updatedAt && ' (edited)'}
          </time>
        </div>
      </div>

      {/* Content */}
      {isEditing ? (
        <div className={styles.editForm}>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            maxLength={500}
            rows={4}
          />
          <div className={styles.editButtons}>
            <button onClick={() => onEdit(editContent)}>Save</button>
            <button onClick={onCancelEdit} className={styles.cancel}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className={styles.content}>{comment.content}</p>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        {isOwner && !isEditing && (
          <>
            <button className={styles.actionBtn} onClick={() => setIsEditing(true)}>
              Edit
            </button>
            <button className={styles.actionBtn} onClick={onDelete}>
              Delete
            </button>
          </>
        )}
        {isInstructor && !isOwner && (
          <button className={styles.actionBtn}>Reply</button>
        )}
        <button
          className={styles.actionBtn}
          onClick={() => setShowFlagDialog(true)}
        >
          Flag
        </button>
      </div>

      {/* Instructor Reply */}
      {comment.reply && (
        <div className={styles.reply}>
          <div className={styles.replyHeader}>
            <img
              src={comment.reply.userAvatar}
              alt={comment.reply.userName}
              className={styles.replyAvatar}
            />
            <span className={styles.replyUserName}>{comment.reply.userName}</span>
            <span className={styles.instructorBadge}>Instructor</span>
          </div>
          <p className={styles.replyContent}>{comment.reply.content}</p>
        </div>
      )}

      {/* Flag Dialog */}
      {showFlagDialog && (
        <div className={styles.flagDialog}>
          <div className={styles.flagOverlay} onClick={() => setShowFlagDialog(false)} />
          <div className={styles.flagContent}>
            <h4>Report Comment</h4>
            <select value={selectedReason} onChange={(e) => setSelectedReason(e.target.value)}>
              <option value="">Select reason...</option>
              <option value="inappropriate-language">Inappropriate Language</option>
              <option value="offensive">Offensive</option>
              <option value="spam">Spam</option>
              <option value="other">Other</option>
            </select>
            <div className={styles.flagButtons}>
              <button onClick={handleFlag} disabled={!selectedReason}>
                Flag Comment
              </button>
              <button onClick={() => setShowFlagDialog(false)} className={styles.cancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

### Backend API

```typescript
// Backend: POST /api/lessons/:lessonId/comments
app.post("/lessons/:lessonId/comments", authenticateToken, async (req, res) => {
  const { lessonId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  if (!content || content.length < 1 || content.length > 500) {
    return res.status(400).json({ error: "Comment must be 1-500 characters" });
  }

  try {
    const result = await db.query(
      `INSERT INTO comments (lesson_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING c.id, c.user_id, u.first_name, u.last_name, u.avatar_url, c.content, c.created_at,
                 CASE WHEN u.role = 'instructor' THEN true ELSE false END as is_instructor
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = LASTVAL()`,
      [lessonId, userId, content],
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating comment:", error);
    return res.status(500).json({ error: "Failed to create comment" });
  }
});

// Backend: GET /api/lessons/:lessonId/comments (paginated)
app.get("/lessons/:lessonId/comments", async (req, res) => {
  const { lessonId } = req.params;
  const { page = 1, sort = "newest" } = req.query;
  const pageSize = 10;
  const offset = (parseInt(page) - 1) * pageSize;

  try {
    const sortOrder = sort === "newest" ? "DESC" : "ASC";

    const result = await db.query(
      `SELECT c.id, c.user_id, u.first_name, u.last_name, u.avatar_url,
              c.content, c.created_at, c.updated_at,
              CASE WHEN u.role = 'instructor' THEN true ELSE false END as is_instructor,
              COALESCE(r.*, NULL) as reply,
              COALESCE((SELECT COUNT(*) FROM comment_flags WHERE comment_id = c.id), 0) as flag_count
       FROM comments c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN comment_replies r ON c.id = r.comment_id
       WHERE c.lesson_id = $1 AND c.deleted = false
       ORDER BY c.created_at ${sortOrder}
       LIMIT $2 OFFSET $3`,
      [lessonId, pageSize + 1, offset],
    );

    const hasMore = result.rows.length > pageSize;
    const comments = result.rows.slice(0, pageSize);

    return res.json({ comments, hasMore });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// Backend: PATCH /api/comments/:commentId
app.patch("/comments/:commentId", authenticateToken, async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  if (!content || content.length < 1 || content.length > 500) {
    return res.status(400).json({ error: "Comment must be 1-500 characters" });
  }

  try {
    const result = await db.query(
      `UPDATE comments SET content = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [content, commentId, userId],
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating comment:", error);
    return res.status(500).json({ error: "Failed to update comment" });
  }
});

// Backend: DELETE /api/comments/:commentId
app.delete("/comments/:commentId", authenticateToken, async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user.id;

  try {
    await db.query(
      "UPDATE comments SET deleted = true WHERE id = $1 AND user_id = $2",
      [commentId, userId],
    );

    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return res.status(500).json({ error: "Failed to delete comment" });
  }
});

// Backend: POST /api/comments/:commentId/flag
app.post("/comments/:commentId/flag", authenticateToken, async (req, res) => {
  const { commentId } = req.params;
  const { reason } = req.body;
  const userId = req.user.id;

  try {
    await db.query(
      `INSERT INTO comment_flags (comment_id, user_id, reason)
       VALUES ($1, $2, $3)
       ON CONFLICT (comment_id, user_id) DO NOTHING`,
      [commentId, userId, reason],
    );

    return res.json({ success: true });
  } catch (error) {
    console.error("Error flagging comment:", error);
    return res.status(500).json({ error: "Failed to flag comment" });
  }
});
```
