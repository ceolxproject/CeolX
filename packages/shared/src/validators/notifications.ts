import { z } from 'zod';

import { NOTIFICATION_PERSONAS } from '../enums.js';

// --- Inbox list query ---

export const listNotificationsSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(20),
});

export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;

// --- Mark single read ---

export const markNotificationReadSchema = z.object({
  id: z.string().uuid(),
});

export type MarkNotificationReadInput = z.infer<typeof markNotificationReadSchema>;

// --- Notification DTO returned to clients ---

export const notificationDtoSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  route: z.string(),
  persona: z.enum(NOTIFICATION_PERSONAS),
  isRead: z.boolean(),
  createdAt: z.string(),
});

export type NotificationDto = z.infer<typeof notificationDtoSchema>;

export const notificationsListResponseSchema = z.object({
  notifications: z.array(notificationDtoSchema),
  total: z.number().int().min(0),
  hasMore: z.boolean(),
});

export type NotificationsListResponse = z.infer<typeof notificationsListResponseSchema>;
