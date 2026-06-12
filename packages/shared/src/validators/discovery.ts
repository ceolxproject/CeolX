import { z } from 'zod';

/**
 * Input for `discovery.suggest` — the search autocomplete dropdown.
 *
 * `scope` decides which entity groups are returned: the Events tab wants
 * artist/venue/event name hints, the Posts tab only artist/venue (posts have no
 * event entity to suggest). Defaults to `events`.
 */
export const suggestSchema = z.object({
  q: z.string().trim().min(1).max(100),
  scope: z.enum(['events', 'posts']).default('events'),
});
export type SuggestInput = z.infer<typeof suggestSchema>;

/** A single autocomplete row: the term plus an optional context sub-line. */
export type Suggestion = {
  label: string;
  sublabel?: string;
};

/** Grouped suggestion payload returned by `discovery.suggest`. */
export type SuggestResult = {
  artists: Suggestion[];
  venues: Suggestion[];
  events: Suggestion[];
};
