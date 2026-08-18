/**
 * Idempotently registers all recurring QStash schedules for the CeolX server.
 *
 * Run **once at deployment time** (not on Lambda cold starts — that would
 * register a duplicate schedule on every invocation). Suggested wiring:
 *   pnpm --filter server jobs:setup-crons
 * via a `jobs:setup-crons` script that runs `tsx src/jobs/setup-crons.ts`.
 *
 * Schedules registered here:
 *   - account.flag-inactive   — daily at 02:00 UTC (M11-T1 R6)
 *   - account.anonymize-sweep — daily at 03:00 UTC (M11-T1 GDPR erasure)
 *   - subscription.trial-ending-sweep — daily at 04:00 UTC (M8-T2 D-30)
 */

import { publishCron } from './publish.js';

async function main() {
  await publishCron('account.flag-inactive', '0 2 * * *', {});
  console.warn('[crons] account.flag-inactive registered (daily 02:00 UTC)');

  await publishCron('account.anonymize-sweep', '0 3 * * *', {});
  console.warn('[crons] account.anonymize-sweep registered (daily 03:00 UTC)');

  await publishCron('subscription.trial-ending-sweep', '0 4 * * *', {});
  console.warn('[crons] subscription.trial-ending-sweep registered (daily 04:00 UTC)');
}

void main().catch((err) => {
  console.error('[crons] registration failed:', err);
  process.exitCode = 1;
});
