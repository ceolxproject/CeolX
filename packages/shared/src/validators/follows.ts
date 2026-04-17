import { z } from 'zod';

export const followSchema = z.object({
  followeeId: z.string().min(1, 'followeeId is required'),
});

export const unfollowSchema = z.object({
  followeeId: z.string().min(1, 'followeeId is required'),
});

export const followingQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  profileType: z.enum(['artist', 'venue']).optional(),
});

export const isFollowingSchema = z.object({
  userId: z.string().min(1),
});

export const followerCountSchema = z.object({
  userId: z.string().min(1),
});
