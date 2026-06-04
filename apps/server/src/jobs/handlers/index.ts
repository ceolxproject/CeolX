import { z } from 'zod';

import { jobPayloadSchemas, type JobType } from '../types.js';

import {
  handleAccountAnonymize,
  handleAccountAnonymizeSweep,
  handleAccountCleanup,
} from './account.js';
import { handleDataExportNotify, handleDataExportProcess } from './dataExport.js';
import { handleEmailSend } from './email.js';
import { handleAccountFlagInactive } from './inactive.js';
import { handleIpAnonymize } from './ip.js';
import { handleNotificationBatch, handleNotificationPush } from './notification.js';
import { handleVenueSubscriptionRetry } from './venue.js';

// ---------------------------------------------------------------------------
// Job dispatch table
// Each entry validates the incoming payload against its Zod schema,
// then calls the handler. Zod parse errors propagate as-is (→ 500 to QStash).
// ---------------------------------------------------------------------------

const handlers: Record<JobType, (payload: unknown) => Promise<void>> = {
  'email.send': (p) => handleEmailSend(jobPayloadSchemas['email.send'].parse(p)),
  'account.anonymize': (p) =>
    handleAccountAnonymize(jobPayloadSchemas['account.anonymize'].parse(p)),
  'account.cleanup': (p) => handleAccountCleanup(jobPayloadSchemas['account.cleanup'].parse(p)),
  'account.flag-inactive': (p) =>
    handleAccountFlagInactive(jobPayloadSchemas['account.flag-inactive'].parse(p)),
  'account.anonymize-sweep': (p) =>
    handleAccountAnonymizeSweep(jobPayloadSchemas['account.anonymize-sweep'].parse(p)),
  'ip.anonymize': (p) => handleIpAnonymize(jobPayloadSchemas['ip.anonymize'].parse(p)),
  'notification.push': (p) =>
    handleNotificationPush(jobPayloadSchemas['notification.push'].parse(p)),
  'notification.batch': (p) =>
    handleNotificationBatch(jobPayloadSchemas['notification.batch'].parse(p)),
  'venue.subscription-retry': (p) =>
    handleVenueSubscriptionRetry(jobPayloadSchemas['venue.subscription-retry'].parse(p)),
  'data-export.process': (p) =>
    handleDataExportProcess(jobPayloadSchemas['data-export.process'].parse(p)),
  'data-export.notify': (p) =>
    handleDataExportNotify(jobPayloadSchemas['data-export.notify'].parse(p)),
};

const incomingSchema = z.object({
  type: z.string(),
  payload: z.unknown(),
});

export async function routeJob(rawBody: string): Promise<void> {
  const { type, payload } = incomingSchema.parse(JSON.parse(rawBody));

  const handler = handlers[type as JobType];
  if (!handler) {
    throw new Error(`Unknown job type: ${type}`);
  }

  console.warn(`[QStash] job type=${type} at=${new Date().toISOString()}`);
  await handler(payload);
}
