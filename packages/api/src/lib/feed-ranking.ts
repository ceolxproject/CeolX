import { distanceBetween } from '@CeolX/shared';

const MAX_DISTANCE_KM = 100;
const DAYS_FOR_RECENCY = 30;
// Posts go stale faster than events (chatter vs future-dated listings).
const POST_DAYS_FOR_RECENCY = 14;
// Posts without a linked event (or viewers without coords) have no distance
// signal; score them neutral so event-less posts aren't buried below every
// located post, nor boosted above nearby ones.
const NEUTRAL_DISTANCE_SCORE = 0.5;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

// ─── Raw event shape from DB (before scoring) ──────────────────────────────

export interface RawFeedEvent {
  id: string;
  title: string;
  dateStart: string;
  dateEnd?: string | null;
  lat: number;
  lng: number;
  venueAddress: string | null;
  category: string;
  coverImageUrl: string | null;
  createdAt: string;
  creatorName: string;
  creatorId: string;
  joinedCount: number;
}

// ─── Scored event (after ranking) ───────────────────────────────────────────

export interface ScoredFeedEvent extends RawFeedEvent {
  distanceKm: number;
  score: number;
  isFollowedCreator: boolean;
}

// ─── Scoring functions ──────────────────────────────────────────────────────

export function computeRecencyScore(createdAt: Date): number {
  const daysSince = (Date.now() - createdAt.getTime()) / MS_PER_DAY;
  return Math.max(0, 1 - daysSince / DAYS_FOR_RECENCY);
}

export function computeDistanceScore(distanceKm: number): number {
  return Math.max(0, 1 - distanceKm / MAX_DISTANCE_KM);
}

export function computeSocialScore(isFollowing: boolean): number {
  return isFollowing ? 1.0 : 0.0;
}

export function computeFeedScore(recency: number, distance: number, social: number): number {
  return 0.4 * recency + 0.4 * distance + 0.2 * social;
}

export function computePostRecencyScore(createdAt: Date): number {
  const daysSince = (Date.now() - createdAt.getTime()) / MS_PER_DAY;
  return Math.max(0, 1 - daysSince / POST_DAYS_FOR_RECENCY);
}

// Recency dominates so a fresh post from a stranger can still beat a stale post
// from a followed author; social outweighs distance because it's the stronger
// intent signal and works when location is missing. Parameter order matches
// computeFeedScore (recency, distance, social).
export function computePostFeedScore(recency: number, distance: number, social: number): number {
  return 0.45 * recency + 0.2 * distance + 0.35 * social;
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

export function rankFeedEvents(
  events: RawFeedEvent[],
  userLat: number,
  userLng: number,
  followedUserIds: Set<string>
): ScoredFeedEvent[] {
  return events
    .map((event) => {
      const distanceKm = distanceBetween(userLat, userLng, event.lat, event.lng);
      const isFollowedCreator = followedUserIds.has(event.creatorId);

      const recency = computeRecencyScore(new Date(event.createdAt));
      const distance = computeDistanceScore(distanceKm);
      const social = computeSocialScore(isFollowedCreator);
      const score = computeFeedScore(recency, distance, social);

      return {
        ...event,
        distanceKm: Math.round((distanceKm + Number.EPSILON) * 10) / 10,
        score,
        isFollowedCreator,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Tie-break: newer events first
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

// ─── Post feed ranking ──────────────────────────────────────────────────────

export interface RankablePost {
  createdAt: Date | string;
  createdBy: string;
  /** Coordinates of the linked event; null when the post has no event. */
  eventLat: number | null;
  eventLng: number | null;
}

/**
 * Rank feed posts by recency + followed-author + proximity to the linked
 * event. Rows pass through untouched (input order is not preserved); posts or
 * viewers without coordinates get a neutral distance score.
 */
export function rankFeedPosts<T extends RankablePost>(
  posts: T[],
  viewerLat: number | undefined,
  viewerLng: number | undefined,
  followedUserIds: Set<string>
): T[] {
  return posts
    .map((post) => {
      const recency = computePostRecencyScore(new Date(post.createdAt));
      const social = computeSocialScore(followedUserIds.has(post.createdBy));
      const distance =
        viewerLat !== undefined &&
        viewerLng !== undefined &&
        post.eventLat !== null &&
        post.eventLng !== null
          ? computeDistanceScore(
              distanceBetween(viewerLat, viewerLng, post.eventLat, post.eventLng)
            )
          : NEUTRAL_DISTANCE_SCORE;
      return { post, score: computePostFeedScore(recency, distance, social) };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        // Tie-break: newer posts first
        new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime()
    )
    .map((s) => s.post);
}
