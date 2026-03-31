export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip fadas: á→a, é→e, ó→o, etc.
    .replace(/[^\w\s-]/g, '') // remove remaining special chars
    .replace(/[\s_]+/g, '-') // spaces/underscores to hyphens
    .replace(/-+/g, '-') // collapse multiple hyphens
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens
}

/** @deprecated Use generateSlug instead */
export function slugify(str: string): string {
  return generateSlug(str);
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  const lastSpace = str.lastIndexOf(' ', maxLength);
  if (lastSpace === -1) {
    // No space found — hard truncate as fallback
    return str.slice(0, maxLength) + '…';
  }
  return str.slice(0, lastSpace) + '…';
}
