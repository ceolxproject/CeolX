import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

dotenv.config({ path: '../../apps/server/.env' });

const url = process.env.DATABASE_URL;
if (!url)
  throw new Error('DATABASE_URL is not set — run: cp apps/server/.env.example apps/server/.env');

export default defineConfig({
  schema: './src/schema',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
  migrations: { prefix: 'timestamp' },
});
