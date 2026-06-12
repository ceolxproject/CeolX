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

/**
 * A single autocomplete row.
 *
 * `label` is the primary term (and what fills the search box on tap). The rest
 * are optional row decorations the redesigned dropdown renders:
 * - `sublabel` — a muted secondary line (e.g. an artist's genre).
 * - `imageUrl` — avatar/thumbnail (artist & venue profile image, event cover).
 * - `location` — event area/venue address, shown with a pin icon.
 * - `dateStart` — event start time as a Unix timestamp in **seconds**
 *   (matches Typesense `date_start`), shown with a calendar icon.
 */
export type Suggestion = {
  label: string;
  sublabel?: string;
  imageUrl?: string;
  location?: string;
  dateStart?: number;
};

/** Grouped suggestion payload returned by `discovery.suggest`. */
export type SuggestResult = {
  artists: Suggestion[];
  venues: Suggestion[];
  events: Suggestion[];
};
