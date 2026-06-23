// Subscription / account status → badge classes for the Users surface.
// Mirrors DESIGN.md's status palette; shared by the table (StatusCell) and the
// detail sheet so the two never drift. Keyed by venue subscription status.
export const SUB_CLASS: Record<string, string> = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  inactive: 'border-zinc-200 bg-zinc-100 text-zinc-700',
  past_due: 'border-amber-200 bg-amber-50 text-amber-800',
  cancelled: 'border-red-200 bg-red-50 text-red-700',
};

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
