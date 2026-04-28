/**
 * Idempotently registers all recurring QStash schedules for the CeolX server.
 *
 * Run **once at deployment time** (not on Lambda cold starts — that would
 * register a duplicate schedule on every invocation). Suggested wiring:
 *   pnpm --filter server jobs:setup-crons
 * via a `jobs:setup-crons` script that runs `tsx src/jobs/setup-crons.ts`.
 *
 * Schedules registered here:
 *   - account.flag-inactive — daily at 02:00 UTC (M11-T1 R6)
 */

import { publishCron } from './publish.js';

async function main() {
  await publishCron('account.flag-inactive', '0 2 * * *', {});
  console.warn('[crons] account.flag-inactive registered (daily 02:00 UTC)');
}

void main().catch((err) => {
  console.error('[crons] registration failed:', err);
  process.exitCode = 1;
});
