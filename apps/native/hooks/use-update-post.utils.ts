/**
 * Decide what should happen to a post's media when an *edit* is saved.
 *
 * The post edit form holds a single `media` object. Media seeded from the
 * existing post carries a `cdnUrl` (it is already uploaded); a freshly-picked
 * image does not. This pure helper turns the before/after state into one of
 * three actions the screen then executes:
 *
 *   - `upload` — a new image was picked; upload it and point the post at it.
 *               `cleanupUrl` is the previously-stored image to delete (or null
 *               when the post had no image before).
 *   - `clear`  — the existing image was removed; revert the post to text-only
 *               and delete the previously-stored image (`cleanupUrl`).
 *   - `keep`   — nothing about the media changed; leave it as-is.
 *
 * Video posts are intentionally never touched: their media is managed by the
 * Mux pipeline server-side, so swapping/removing it on edit is out of scope.
 */
export type PostMediaPlan =
  | { action: 'upload'; cleanupUrl: string | null }
  | { action: 'clear'; cleanupUrl: string }
  | { action: 'keep' };

export function planPostMediaUpdate(input: {
  originalMediaType: string | null | undefined;
  originalMediaUrl: string | null | undefined;
  /** The kind of media currently selected in the form, or null if none. */
  currentKind: 'image' | 'video' | null;
  /** True when the selected media is already uploaded (seeded from the post). */
  currentHasCdnUrl: boolean;
}): PostMediaPlan {
  // Video media is server-managed (Mux). Never swap or clear it on edit.
  if (input.originalMediaType === 'video') return { action: 'keep' };

  const originalImageUrl =
    input.originalMediaType === 'image' && input.originalMediaUrl ? input.originalMediaUrl : null;

  // A freshly-picked image has no CDN url yet — upload it and replace.
  if (input.currentKind === 'image' && !input.currentHasCdnUrl) {
    return { action: 'upload', cleanupUrl: originalImageUrl };
  }

  // The existing image was removed — revert the post to text-only.
  if (input.currentKind === null && originalImageUrl) {
    return { action: 'clear', cleanupUrl: originalImageUrl };
  }

  // Unchanged image, or a text post with nothing selected — leave media as-is.
  return { action: 'keep' };
}
