import { inArray } from "drizzle-orm";
import { Router } from "express";
import { APP_MODULES } from "../../shared/app-modules.js";
import { db } from "../db/client.js";
import { featureFlags } from "../db/schema.js";

const router = Router();

router.get("/", async (_request, response) => {
  const rows = await db.select({ key: featureFlags.key, enabled: featureFlags.enabled })
    .from(featureFlags)
    .where(inArray(featureFlags.key, APP_MODULES.map((module) => module.key)));
  const enabledByKey = new Map(rows.map((row) => [row.key, row.enabled]));
  response.json({ data: APP_MODULES.map((module) => ({ ...module, enabled: enabledByKey.get(module.key) ?? true })) });
});

export { router as moduleRouter };
