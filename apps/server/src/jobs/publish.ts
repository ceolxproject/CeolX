import { getQStashClient } from './client.js';
import type { JobPayload, JobType } from './types.js';

// ---------------------------------------------------------------------------
// Duration parser — converts human-readable strings to seconds for the SDK.
// The @upstash/qstash TypeScript SDK takes `delay` as a number (seconds).
// ---------------------------------------------------------------------------

const DURATION_UNITS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

export function parseDuration(str: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(str);
  if (!match) {
    throw new Error(
      `Invalid duration: "${str}". Expected format: <number><unit> (e.g. 30d, 5m, 1h, 10s)`
    );
  }
  const value = Number(match[1] ?? '0');
  const unit = match[2] ?? 's';
  return value * (DURATION_UNITS[unit] ?? 1);
}

// ---------------------------------------------------------------------------
// publishJob — type-safe fire-and-forget job publisher
// ---------------------------------------------------------------------------

export interface PublishOptions {
  delay?: string; // e.g. "30d", "5m", "1h", "10s"
  retries?: number; // default: 3
}

export async function publishJob<T extends JobType>(
  type: T,
  payload: JobPayload<T>,
  options: PublishOptions = {}
): Promise<void> {
  const baseUrl = process.env.QSTASH_BASE_URL;
  if (!baseUrl) throw new Error('QSTASH_BASE_URL is not set');

  const client = getQStashClient();

  await client.publishJSON({
    url: baseUrl,
    body: { type, payload },
    retries: options.retries ?? 3,
    ...(options.delay !== undefined && { delay: parseDuration(options.delay) }),
  });
}

// ---------------------------------------------------------------------------
// publishCron — registers a recurring cron schedule with QStash
// Run once at deploy time (or via Upstash console) per job type.
// ---------------------------------------------------------------------------

export async function publishCron(
  type: JobType,
  schedule: string, // cron expression e.g. "*/5 * * * *"
  payload: Record<string, unknown> = {}
): Promise<void> {
  const baseUrl = process.env.QSTASH_BASE_URL;
  if (!baseUrl) throw new Error('QSTASH_BASE_URL is not set');

  const client = getQStashClient();

  await client.schedules.create({
    destination: baseUrl,
    cron: schedule,
    body: JSON.stringify({ type, payload }),
    headers: { 'Content-Type': 'application/json' },
  });
}
