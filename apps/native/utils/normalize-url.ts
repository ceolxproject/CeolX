// Prepends `https://` when the user typed a bare domain like `instagram.com/me`.
// The shared `socialLinksSchema` validates with `z.string().url()`, which rejects
// protocol-less strings — this normalizes at the submit boundary so the common
// "forgot the https://" UX failure doesn't surface as a generic save error.
export function normalizeOptionalUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
