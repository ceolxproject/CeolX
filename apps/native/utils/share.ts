import type { ShareContent } from 'react-native';

import { env } from '@CeolX/env/native';

// Every build sets this via eas.json (prod api.ceolx.com, staging
// api-staging.ceolx.com); the fallback only applies to a build that forgot to. It
// must be the API host, NOT the ceolx.com marketing site — ceolx.com serves no
// /post, /event or /u routes, so a link built against it 404s for the recipient.
// Must stay in sync with the associatedDomains / intentFilters host in
// app.config.js, which derives its host from the same variable.
const SHARE_BASE_URL = env.EXPO_PUBLIC_SHARE_BASE_URL ?? 'https://api.ceolx.com';

/** Absolute share link for a path like `/post/<id>`. */
export function shareUrlFor(path: string): string {
  return `${SHARE_BASE_URL}${path}`;
}

/**
 * Share content for a link plus a caption: one string, and deliberately no `url`.
 *
 * `url` is iOS-only. Android drops it and shares `message` alone, but iOS hands
 * both to the target as separate activity items, and each target picks what it
 * wants. Setting both is what produced the duplicated link users reported —
 * targets that take both concatenate a message already ending in the link.
 *
 * Splitting them (link in `url`, caption in `message`) is worse, not better: the
 * targets that read only the string — Copy among them — then paste a caption with
 * no link at all.
 *
 * So the link lives in `message` and nowhere else. Every target gets it exactly
 * once, and none of them can lose it. The cost is that iOS shows a plain text
 * preview in the sheet rather than a rich URL card.
 */
export function buildShareContent(url: string, caption: string, title: string): ShareContent {
  const trimmed = caption.trim();
  return { message: trimmed ? `${trimmed}\n\n${url}` : url, title };
}
