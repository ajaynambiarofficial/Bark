import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.NODE_ENV === "test" ? 4 : 12,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: env.databaseSsl ? { rejectUnauthorized: true } : undefined,
});

export const db = drizzle(pool, { schema });

export async function closeDatabase() {
  await pool.end();
}
