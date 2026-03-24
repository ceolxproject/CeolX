import { z } from "zod";

export const CreateBookingSchema = z.object({
  eventId: z.string().min(1),
  artistId: z.string().min(1),
  // direction is inferred from the calling persona in M5-T1
  message: z.string().optional(),
});

export const UpdateBookingSchema = z.object({
  status: z.enum(["accepted", "rejected", "cancelled"]),
});

export type CreateBooking = z.infer<typeof CreateBookingSchema>;
export type UpdateBooking = z.infer<typeof UpdateBookingSchema>;
