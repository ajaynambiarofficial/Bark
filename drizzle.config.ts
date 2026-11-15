import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://bark:bark@localhost:5432/bark";
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
  verbose: true,
});
