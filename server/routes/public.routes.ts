import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { applicationSettings } from "../db/schema.js";

export const publicRouter = Router();

publicRouter.get("/login-settings", async (_request, response) => {
  const [setting] = await db.select({ value: applicationSettings.value }).from(applicationSettings).where(eq(applicationSettings.key, "login.snow.enabled")).limit(1);
  response.json({ data: { snowEnabled: setting?.value !== false } });
});
