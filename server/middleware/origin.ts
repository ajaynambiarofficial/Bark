import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../lib/errors.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export const enforceTrustedOrigin: RequestHandler = (request, _response, next) => {
  if (safeMethods.has(request.method)) return next();
  const origin = request.header("origin");
  if (!origin) {
    if (env.isProduction) return next(new ApiError(403, "ORIGIN_REQUIRED", "A trusted origin is required for state-changing requests."));
    return next();
  }
  if (origin !== env.APP_ORIGIN) return next(new ApiError(403, "ORIGIN_REJECTED", "The request origin is not allowed."));
  next();
};
