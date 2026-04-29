/**
 * Seed (or repair) the single Super Admin account.
 *
 * Why this lives here (not in packages/db/seed.ts):
 * BetterAuth keeps password hashes in the `account` table — direct inserts
 * into `user` (as seed.ts does) cannot log in via email/password. This script
 * uses `auth.api.signUpEmail` so BetterAuth itself hashes the credential,
 * then promotes the role to `admin` and clears email verification.
 *
 * Idempotent: re-running with the same email is safe — if the user already
 * exists it only re-asserts role + verification flag.
 *
 * Run: ADMIN_EMAIL=admin@ceolx.test ADMIN_PASSWORD=Admin123! \
 *        pnpm --filter server seed:admin
 */

import { eq } from 'drizzle-orm';

import { auth } from '@CeolX/auth';
import { db } from '@CeolX/db';
import { user } from '@CeolX/db/schema/auth';

async function seedAdmin() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed-admin must never run against production');
  }

  const rawEmail = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!rawEmail || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required');
  }

  const email = rawEmail.toLowerCase().trim();

  const existing = await db.query.user.findFirst({ where: eq(user.email, email) });

  if (!existing) {
    try {
      await auth.api.signUpEmail({
        body: {
          name: 'CeolX Admin',
          email,
          password,
        },
      });
      console.warn(`✓ admin signup created for ${email}`);
    } catch (err) {
      // signUpEmail may throw on a side-effect (e.g. verification email send)
      // after the row was already inserted. Re-check before bubbling up.
      const recheck = await db.query.user.findFirst({ where: eq(user.email, email) });
      if (!recheck) throw err;
      console.warn(`! admin user written despite signup error: ${(err as Error).message}`);
    }
  } else {
    console.warn(`= admin user already exists: ${email}`);
  }

  await db
    .update(user)
    .set({ currentRole: 'admin', emailVerified: true })
    .where(eq(user.email, email));

  console.warn(`✓ admin ready: ${email} (currentRole=admin, emailVerified=true)`);
  process.exit(0);
}

seedAdmin().catch((err: unknown) => {
  console.error('seed-admin failed:', err);
  process.exit(1);
});
