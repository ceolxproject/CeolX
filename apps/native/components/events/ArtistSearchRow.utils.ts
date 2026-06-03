type SubtitleParts = {
  name: string | null;
  stageName: string;
  genre: string | null;
};

/**
 * Secondary line for an artist search row, or null when there's nothing to show.
 *
 * The account name is shown only when it differs from the public stage name
 * (so "Vivek" searching as "Tune Bomb" is recognisable), combined with the
 * genre as `name · genre`. Either part is omitted when absent.
 */
export function getArtistRowSubtitle({ name, stageName, genre }: SubtitleParts): string | null {
  const parts: string[] = [];
  if (name && name !== stageName) parts.push(name);
  if (genre) parts.push(genre);
  return parts.length > 0 ? parts.join(' · ') : null;
}
