import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.enum(["true", "false"]).optional(),
  APP_ORIGIN: z.string().url().default("http://localhost:5173"),
  SESSION_COOKIE_NAME: z.string().min(3).default("bark_session"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),
  ALLOW_LOCAL_PASSWORD_RESET_LINKS: z.enum(["true", "false"]).default("false"),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  GOD_EMAIL: z.string().email().optional(),
  GOD_PASSWORD: z.string().min(14).optional(),
  LOCAL_AGENT_EMAIL: z.string().email().optional(),
  LOCAL_AGENT_PASSWORD: z.string().min(1).optional(),
  LOCAL_TEAM_LEAD_EMAIL: z.string().email().optional(),
  LOCAL_TEAM_LEAD_PASSWORD: z.string().min(14).optional(),
  LOCAL_CLINIC_MANAGER_EMAIL: z.string().email().optional(),
  LOCAL_CLINIC_MANAGER_PASSWORD: z.string().min(14).optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const errors = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid environment configuration: ${errors}`);
}

export const env = {
  ...parsed.data,
  trustProxy: parsed.data.TRUST_PROXY === "true",
  databaseSsl: parsed.data.DATABASE_SSL ? parsed.data.DATABASE_SSL === "true" : parsed.data.NODE_ENV === "production",
  allowLocalPasswordResetLinks: parsed.data.ALLOW_LOCAL_PASSWORD_RESET_LINKS === "true" && ["localhost", "127.0.0.1"].includes(new URL(parsed.data.APP_ORIGIN).hostname),
  isProduction: parsed.data.NODE_ENV === "production",
};
