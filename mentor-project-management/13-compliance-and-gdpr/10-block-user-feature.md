# Block User Feature

## Description

Implement a user blocking system allowing learners and instructors to block other users from the platform. When a user is blocked, the blocker and blocked user cannot see each other's content, profiles, or community interactions. Blocking is mutual (neither can see the other), and users can manage their block list in Settings.

This feature enables users to control their privacy and avoid harassment, complementing the report content system.

## Affected Apps/Packages

- **Web App** (Next.js) - block UI in profiles and settings
- **Mobile Apps** (iOS/Android) - native block UI
- **API Server** - block management endpoints
- **Database** - user_blocks table
- **Search/Discovery** - filter blocked users from results

## API Endpoints

- `POST /api/blocks/create` - Block a user
- `DELETE /api/blocks/:user_id` - Unblock a user
- `GET /api/blocks/list` - Get user's block list
- `GET /api/blocks/check/:user_id` - Check if user is blocked
- `POST /api/blocks/blocked-by-check/:user_id` - Check if user has blocked me

## Requirements

- **Block Trigger Points**:
  - User profile page: "Block User" button (three-dot menu)
  - Comment author profile: "Block User" option
  - Forum post author profile: "Block User" option
  - Settings > Privacy & Safety: "Manage Blocked Users"
  - Search results: "Block" action in user card

- **Block Confirmation**:
  - Modal/sheet confirming block action
  - Explanation: "You won't be able to see their posts, messages, or profile"
  - Explanation: "They won't be notified that you blocked them"
  - "Block" and "Cancel" buttons
  - Success toast: "User blocked successfully"

- **Block List Management** (Settings > Privacy & Safety > Blocked Users):
  - List of all blocked users
  - User card showing:
    - Profile photo (or placeholder)
    - Display name
    - Account type (learner/instructor)
    - Date blocked
    - "Unblock" button
  - Empty state: "You haven't blocked anyone"
  - Search within blocked list
  - Sort by: date blocked, name
  - Bulk unblock (select multiple, unblock)

- **Mutual Content Hiding**:
  - Blocker cannot see blocked user's:
    - Profile page (shows "This profile is not available")
    - Forum posts or comments
    - Public course pages
    - Messages (if messaging exists)
    - In follower/following lists
    - In search results
    - In course enrollments list (instructors don't see enrollees)
  - Blocked user cannot see blocker's:
    - Profile page (shows "This profile is not available")
    - Forum posts or comments
    - Public course pages
    - Messages
    - In follower/following lists
    - In search results

- **Database Schema**:

  ```
  user_blocks table:
  - id: UUID (primary key)
  - blocker_id: UUID (foreign key, user doing blocking)
  - blocked_user_id: UUID (foreign key, user being blocked)
  - created_at: timestamp with timezone
  - reason: enum (harassment, spam, other) (optional)
  - notes: text (nullable, user-provided reason)
  - updated_at: timestamp with timezone
  - is_active: boolean (default true)

  Constraints:
  - UNIQUE(blocker_id, blocked_user_id)
  - Check blocker_id != blocked_user_id
  ```

- **API Behavior**:
  - `POST /api/blocks/create`:

    ```json
    {
      "blocked_user_id": "user_xyz",
      "reason": "spam", // optional
      "notes": "spamming course reviews" // optional
    }
    ```

    Response: 201 Created

    ```json
    {
      "id": "block_123",
      "blocker_id": "user_abc",
      "blocked_user_id": "user_xyz",
      "created_at": "2025-02-18T10:00:00Z",
      "is_active": true
    }
    ```

  - `DELETE /api/blocks/:user_id`: Unblock user
    Response: 204 No Content

  - `GET /api/blocks/list`: Get all blocks for current user
    Response: 200 OK

    ```json
    {
      "blocks": [
        {
          "id": "block_123",
          "blocked_user_id": "user_xyz",
          "blocked_user": {
            "id": "user_xyz",
            "name": "Jane Doe",
            "profile_photo": "https://...",
            "account_type": "learner"
          },
          "created_at": "2025-02-15T14:30:00Z"
        }
      ],
      "total": 5
    }
    ```

  - `GET /api/blocks/check/:user_id`: Check if I have blocked user X
    Response: 200 OK

    ```json
    {
      "is_blocked": true,
      "block_id": "block_123",
      "blocked_at": "2025-02-15T14:30:00Z"
    }
    ```

  - `POST /api/blocks/blocked-by-check/:user_id`: Check if user X has blocked me
    Response: 200 OK
    ```json
    {
      "is_blocked_by": true,
      "blocked_at": "2025-02-10T09:00:00Z"
    }
    ```

- **Content Visibility Implementation**:
  - Middleware check in profile API:

    ```javascript
    async function getProfile(userId) {
      const currentUser = req.user;

      // Check if blocked in either direction
      const isBlocked = await db.user_blocks.findOne({
        $or: [
          { blocker_id: currentUser.id, blocked_user_id: userId },
          { blocker_id: userId, blocked_user_id: currentUser.id },
        ],
        is_active: true,
      });

      if (isBlocked) {
        return { error: "This profile is not available" };
      }

      return await db.users.findById(userId);
    }
    ```

  - Search/Discovery filter:

    ```javascript
    async function search(query) {
      const blocks = await db.user_blocks.find({
        $or: [
          { blocker_id: currentUser.id },
          { blocked_user_id: currentUser.id },
        ],
        is_active: true,
      });
      const blockedIds = blocks.map((b) =>
        b.blocker_id === currentUser.id ? b.blocked_user_id : b.blocker_id,
      );

      return db.users.find({
        $or: [{ name: { $regex: query } }, { email: { $regex: query } }],
        id: { $nin: blockedIds }, // Exclude blocked users
      });
    }
    ```

  - Forum post filtering:

    ```javascript
    async function getForumPosts(forumId) {
      const blocks = await getActiveBlocks(currentUser.id);
      const blockedIds = blocks.map((b) =>
        b.blocker_id === currentUser.id ? b.blocked_user_id : b.blocker_id,
      );

      return db.forum_posts.find({
        forum_id: forumId,
        author_id: { $nin: blockedIds },
      });
    }
    ```

- **User Notifications**:
  - Blocker gets confirmation: "User blocked successfully"
  - Blocked user is NOT notified (privacy)
  - No indication in blocked user's account that they're blocked

- **Unblock Process**:
  - User clicks "Unblock" on block list
  - Confirmation modal: "Are you sure you want to unblock this user?"
  - "Unblock" and "Cancel" buttons
  - Success toast: "User unblocked successfully"
  - Block record marked is_active=false (soft delete for audit trail)

- **Admin Capabilities**:
  - Admin can view who a user has blocked
  - Admin can view who has blocked a user
  - Admin can override block (if harassment/abuse investigation)
  - Admin cannot force users to unblock (respects user privacy)
  - Admin actions logged in audit trail

- **Edge Cases**:
  - Cannot block yourself (validation on API)
  - Cannot block user who doesn't exist (validation)
  - Cannot block twice (UNIQUE constraint)
  - Unblocking non-existent block returns 404
  - Block list pagination (if many blocks)
  - Performance optimization: cache block lists (5-min TTL)

- **Mobile App Specifics**:
  - Block button in user card (three-dot menu)
  - Block confirmation uses native alert/action sheet
  - Block list in Settings accessed via native navigation
  - Deep link to user profile returns "Profile Not Available" if blocked

- **Privacy Considerations**:
  - Blocked user never notified
  - Block not visible in any feed or notification
  - Block list only visible to user who created it
  - IP address not stored (unlike reports)
  - Block reason (optional) is user-private, not shared

## Acceptance Criteria

- [ ] Block button visible on user profiles (three-dot menu)
- [ ] Block confirmation modal shows clear explanation
- [ ] Block created successfully in database
- [ ] user_blocks table created with correct constraints
- [ ] UNIQUE constraint prevents duplicate blocks
- [ ] Check preventing self-blocking works
- [ ] Block list accessible in Settings > Privacy & Safety
- [ ] Blocked users listed with photos and dates
- [ ] Unblock button removes block successfully
- [ ] Blocker cannot see blocked user's profile
- [ ] Blocker cannot see blocked user's forum posts
- [ ] Blocked user cannot see blocker's profile
- [ ] Blocked user cannot see blocker's posts
- [ ] Both users hidden from each other's search results
- [ ] Blocked users hidden from follower/following lists
- [ ] /api/blocks/list returns correct block list
- [ ] /api/blocks/check/:user_id works correctly
- [ ] /api/blocks/blocked-by-check/:user_id works correctly
- [ ] Content visibility filters working in all contexts
- [ ] Unblock successful and block becomes inactive
- [ ] Soft delete (is_active=false) preserves audit trail
- [ ] Admin can view block relationships
- [ ] Block pagination working (if many blocks)
- [ ] Cache invalidation on block/unblock
- [ ] Mobile app shows block confirmation
- [ ] Deep link behavior correct for blocked profiles
- [ ] Performance acceptable with large block lists
- [ ] Search filters work correctly with blocks
- [ ] Forum posts correctly filtered for blocked users

## Dependencies

- **User Profiles** - profile visibility
- **Search & Discovery** - filtering from results
- **Community & Forum** - post/comment filtering
- **Authentication** - current user context
- **Admin Dashboard** - block relationship viewing

## Technical Notes

- User_blocks table can grow large (1 block per user pair)
- Consider indexing: (blocker_id, is_active) and (blocked_user_id, is_active)
- Query optimization: use set intersection for bulk visibility checks
- Cache block relationships in Redis (5-min TTL)
- Middleware to check blocks on every profile view (performance critical)
- Soft delete (is_active=false) allows unblocking
- Hard delete option for GDPR deletion (when user account deleted)
- Block reason/notes useful for moderation analysis
- Monitor for block abuse (e.g., blocking to hide negative reviews)
- Consider escalation: if user blocks > 50 people, flag for review
- Mutual blocking creates circular dependency, handle gracefully
- Test with high-volume users (thousands of blocks)
- Ensure block filtering doesn't leak blocked user existence
- Consider batch unblock API for users deleting accounts
- Block list export for GDPR requests
- Implement block metrics: most blocked users, block reasons
- Consider appeal process if user feels wrongly blocked (future)
- Document block behavior clearly in privacy policy
