import { Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const url = process.env.DATABASE_URL!;

export const db = url.includes("neon.tech")
  ? drizzleNeon(new NeonPool({ connectionString: url }), { schema })
  : drizzle(new Pool({ connectionString: url }), { schema });

export * from "./schema";
