import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { closeDatabase } from "./db/client.js";
import { logger } from "./lib/logger.js";

const server = createApp().listen(env.PORT, "0.0.0.0", () => {
  logger.info({ port: env.PORT, environment: env.NODE_ENV }, "Bark API listening");
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down Bark API");
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
