import { relations } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { user } from './auth';
import { mediaTypeEnum } from './enums';

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
    mediaType: mediaTypeEnum('media_type').notNull(),
    mediaUrl: text('media_url'), // null for text-only posts; S3/CloudFront URL otherwise
    likeCount: integer('like_count').default(0), // denormalized — do NOT use COUNT(post_likes)
    deletedAt: timestamp('deleted_at'), // soft delete — API filters WHERE deleted_at IS NULL
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('posts_created_by_idx').on(t.createdBy)]
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
