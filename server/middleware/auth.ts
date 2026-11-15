import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { loadPrincipalByToken } from "../auth/session.js";
import { ApiError } from "../lib/errors.js";

export const requireAuth: RequestHandler = async (request, _response, next) => {
  const token = request.cookies?.[env.SESSION_COOKIE_NAME] as string | undefined;
  if (!token) return next(new ApiError(401, "AUTH_REQUIRED", "Sign in is required."));
  const principal = await loadPrincipalByToken(token);
  if (!principal) return next(new ApiError(401, "SESSION_INVALID", "Your session is invalid or has expired."));
  request.auth = principal;
  next();
};

export function requirePermission(permission: string): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) return next(new ApiError(401, "AUTH_REQUIRED", "Sign in is required."));
    if (!request.auth.permissions.has(permission)) return next(new ApiError(403, "PERMISSION_DENIED", "You do not have permission to perform this action."));
    next();
  };
}

export function requireClearance(level: number): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) return next(new ApiError(401, "AUTH_REQUIRED", "Sign in is required."));
    if (request.auth.clearanceLevel < level) return next(new ApiError(403, "CLEARANCE_REQUIRED", `Clearance level ${level} is required.`));
    next();
  };
}
