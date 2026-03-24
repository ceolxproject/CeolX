import { z } from "zod";

// Bounding-box query params for GET /api/v1/events/map
export const MapQuerySchema = z.object({
  swLat: z.string().transform(Number),
  swLng: z.string().transform(Number),
  neLat: z.string().transform(Number),
  neLng: z.string().transform(Number),
});

export const CreateEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  coverImage: z.string().url().optional(),
  dateStart: z.string().datetime(),
  dateEnd: z.string().datetime().optional(),
  lat: z.number(),
  lng: z.number(),
  venueId: z.string().optional(),
  venueAddress: z.string().optional(),
  category: z.string().min(1),
  collaborators: z.array(z.string()).optional(),
  ticketLink: z.string().url().optional(),
  isGigOpportunity: z.boolean().default(false),
});

export const UpdateEventSchema = CreateEventSchema.partial();

export type MapQuery = z.infer<typeof MapQuerySchema>;
export type CreateEvent = z.infer<typeof CreateEventSchema>;
export type UpdateEvent = z.infer<typeof UpdateEventSchema>;
