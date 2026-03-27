import { resolve } from 'path';

import { Pool as NeonPool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { sql } from 'drizzle-orm';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// Load env from the server app before reading DATABASE_URL
dotenv.config({ path: resolve(process.cwd(), '../../apps/server/.env') });

const url = process.env.DATABASE_URL;

if (!url) {
  console.error('✗ DATABASE_URL is not set.');
  console.error('  Create apps/server/.env from apps/server/.env.example and set DATABASE_URL.');
  process.exit(1);
}

const target = url.includes('neon.tech') ? 'Neon' : 'Docker (local)';
console.warn(`Checking connection → ${target}`);

const db = url.includes('neon.tech')
  ? drizzleNeon(new NeonPool({ connectionString: url }))
  : drizzle(new Pool({ connectionString: url }));

const result = await db.execute(sql`SELECT version()`);
const version = (result.rows[0] as { version: string }).version;

console.warn(`✓ Connected: ${version}`);
process.exit(0);
