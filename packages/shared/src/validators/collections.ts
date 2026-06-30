import { z } from 'zod';

// ─── Collection schemas ──────────────────────────────────────────────────────

// Field length limits (characters). Exported so the mobile UI caps inputs with
// the exact same numbers used for validation (no schema/UI drift).
export const COLLECTION_NAME_MAX = 100;
export const COLLECTION_DESCRIPTION_MAX = 500;

export const createCollectionSchema = z.object({
  name: z.string().min(1, 'Collection name is required').max(COLLECTION_NAME_MAX).trim(),
  logo: z.string().url().optional(),
  description: z.string().max(COLLECTION_DESCRIPTION_MAX).optional(),
});

export const updateCollectionSchema = z.object({
  id: z.string().uuid(),
  data: createCollectionSchema.partial(),
});

// ─── Pagination schemas ──────────────────────────────────────────────────────

export const myEventsQuerySchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});

export const savedEventsQuerySchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
  includeArchived: z.boolean().default(false),
});

// ─── Inferred types ──────────────────────────────────────────────────────────

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;
export type MyEventsQueryInput = z.infer<typeof myEventsQuerySchema>;
export type SavedEventsQueryInput = z.infer<typeof savedEventsQuerySchema>;
