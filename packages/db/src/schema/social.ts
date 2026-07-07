import { relations } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { user } from './auth';
import { mediaTypeEnum } from './enums';
import { events } from './events';

// ---------------------------------------------------------------------------
// posts — soft-deleted, never hard deleted.
// like_count is denormalized for fast feed rendering — updated atomically
// alongside post_likes inserts/deletes inside a transaction.
// ---------------------------------------------------------------------------
export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    caption: text('caption').notNull(),
    // Set when this post promotes an event (auto-created on event creation).
    // Tapping such a post deep-links to the event instead of post detail.
    // set null (not cascade): events are never hard-deleted, and posts must never
    // be hard-deleted either — the removed/archived/expired coupling is app-level.
    eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
    mediaType: mediaTypeEnum('media_type').notNull(),
    mediaUrl: text('media_url'), // null for text-only posts; S3/CloudFront URL or Mux HLS URL otherwise
    // Mux fields — populated only for video posts (M10-T1).
    // mux_upload_id is set on createPost (client receives it from
    // uploads.createMuxUpload). mux_asset_id and mux_playback_id are filled by
    // the mux webhook once transcoding completes; mediaUrl is also rewritten
    // to https://stream.mux.com/<playbackId>.m3u8 at that point.
    muxUploadId: text('mux_upload_id'),
    muxAssetId: text('mux_asset_id'),
    muxPlaybackId: text('mux_playback_id'),
    muxStatus: text('mux_status'), // 'pending' | 'ready' | 'errored'
    likeCount: integer('like_count').default(0), // denormalized — do NOT use COUNT(post_likes)
    deletedAt: timestamp('deleted_at'), // soft delete — API filters WHERE deleted_at IS NULL
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('posts_created_by_idx').on(t.createdBy),
    // Lookup a post by its event — toggling promo-post visibility on status change,
    // and joined for the read-time expiry filter.
    index('posts_event_id_idx').on(t.eventId),
    // Webhook lookup: UPDATE posts ... WHERE mux_upload_id = $1
    index('posts_mux_upload_id_idx').on(t.muxUploadId),
    // Delete-asset ownership lookup: SELECT 1 WHERE mux_asset_id = $1 AND created_by = $2
    index('posts_mux_asset_id_idx').on(t.muxAssetId),
  ]
);

// ---------------------------------------------------------------------------
// comments — flat (no threading in V1). Soft-deleted rows display as
// "Comment deleted" so reply context remains coherent.
// ---------------------------------------------------------------------------
export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    deletedAt: timestamp('deleted_at'), // soft delete
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('comments_post_id_idx').on(t.postId)]
);

// ---------------------------------------------------------------------------
// post_likes — unique constraint enables idempotent like/unlike:
//   like:   INSERT INTO post_likes ... ON CONFLICT DO NOTHING
//   unlike: DELETE FROM post_likes WHERE post_id = ? AND user_id = ?
// Always wrap with an UPDATE to posts.like_count inside a transaction.
// ---------------------------------------------------------------------------
export const postLikes = pgTable(
  'post_likes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('post_likes_post_user_idx').on(t.postId, t.userId)]
);

// ---------------------------------------------------------------------------
// follows — both columns FK to users; self-referencing.
// Prevent self-follows at the application layer (not a DB constraint in V1).
// ---------------------------------------------------------------------------
export const follows = pgTable(
  'follows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    followerId: text('follower_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    followeeId: text('followee_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('follows_follower_followee_idx').on(t.followerId, t.followeeId)]
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(user, {
    fields: [posts.createdBy],
    references: [user.id],
  }),
  comments: many(comments),
  likes: many(postLikes),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  author: one(user, {
    fields: [comments.userId],
    references: [user.id],
  }),
}));

export const postLikesRelations = relations(postLikes, ({ one }) => ({
  post: one(posts, {
    fields: [postLikes.postId],
    references: [posts.id],
  }),
  user: one(user, {
    fields: [postLikes.userId],
    references: [user.id],
  }),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(user, {
    fields: [follows.followerId],
    references: [user.id],
    relationName: 'follower',
  }),
  followee: one(user, {
    fields: [follows.followeeId],
    references: [user.id],
    relationName: 'followee',
  }),
}));

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type PostLike = typeof postLikes.$inferSelect;
export type Follow = typeof follows.$inferSelect;
