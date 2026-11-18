import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { ApiError, errorHandler } from "./lib/errors.js";
import { requestContext } from "./middleware/request-context.js";
import { enforceTrustedOrigin, isTrustedOrigin } from "./middleware/origin.js";
import { requireAuth } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.routes.js";
import { bookingRouter } from "./routes/booking.routes.js";
import { escalationRouter } from "./routes/escalation.routes.js";
import { calendarRouter } from "./routes/calendar.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { catalogRouter } from "./routes/catalog.routes.js";
import { customerRouter } from "./routes/customer.routes.js";
import { resolve } from "node:path";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (env.trustProxy) app.set("trust proxy", 1);

  app.use(requestContext);
  app.use(pinoHttp({ logger }));
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        // Local LAN testing uses HTTP; upgrading same-origin bundles to HTTPS leaves the SPA blank.
        upgradeInsecureRequests: env.APP_ORIGIN.startsWith("https://") ? [] : null,
      },
    },
    crossOriginResourcePolicy: { policy: "same-site" },
  }));
  app.use((request, response, next) => {
    const origin = request.header("origin");
    if (origin && isTrustedOrigin(origin)) {
      response.setHeader("access-control-allow-origin", origin);
      response.setHeader("access-control-allow-credentials", "true");
      response.setHeader("vary", "Origin");
    }
    response.setHeader("access-control-allow-headers", "content-type, x-request-id");
    response.setHeader("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    if (request.method === "OPTIONS") return response.sendStatus(origin && isTrustedOrigin(origin) ? 204 : 403);
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(enforceTrustedOrigin);

  app.get("/api/health", (_request, response) => response.json({ status: "ok", version: process.env.npm_package_version ?? "0.1.0" }));
  app.use("/api/auth", authRouter);
  app.use("/api", requireAuth);
  app.use("/api/bookings", bookingRouter);
  app.use("/api/escalations", escalationRouter);
  app.use("/api/calendar", calendarRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/catalog", catalogRouter);
  app.use("/api/customers", customerRouter);
  app.use("/api/admin", adminRouter);
  if (env.isProduction) {
    const webRoot = resolve(process.cwd(), "dist");
    app.use(express.static(webRoot, { index: false }));
    app.get(/.*/, (request, response, next) => {
      if (request.path.startsWith("/api/")) return next(new ApiError(404, "NOT_FOUND", "The requested resource was not found."));
      response.sendFile(resolve(webRoot, "index.html"));
    });
  }
  app.use((_request, _response, next) => next(new ApiError(404, "NOT_FOUND", "The requested resource was not found.")));
  app.use(errorHandler);
  return app;
}
