// Persona → badge classes. Distinct cool/purple/pink hues, kept clear of the
// status palette (emerald/amber/red/zinc) so a persona tag never reads as a status.
export const PERSONA_CLASS: Record<string, string> = {
  spectator: 'border-sky-200 bg-sky-50 text-sky-700',
  artist: 'border-violet-200 bg-violet-50 text-violet-700',
  venue: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
};

// First-letter initials (max 2) for avatar fallbacks. Shared by the table + detail sheet.
export function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
