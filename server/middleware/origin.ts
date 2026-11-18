import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../lib/errors.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export function isTrustedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (origin === env.APP_ORIGIN) return true;
  if (env.isProduction) return false;
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" || url.port !== "5173") return false;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]") return true;
    const octets = url.hostname.split(".").map(Number);
    const first = octets[0];
    const second = octets[1];
    const isPrivateIpv4 = octets.length === 4 && octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)
      && (first === 10 || (first === 192 && second === 168) || (first === 172 && second !== undefined && second >= 16 && second <= 31));
    return isPrivateIpv4;
  } catch {
    return false;
  }
}

export const enforceTrustedOrigin: RequestHandler = (request, _response, next) => {
  if (safeMethods.has(request.method)) return next();
  const origin = request.header("origin");
  if (!origin) {
    if (env.isProduction) return next(new ApiError(403, "ORIGIN_REQUIRED", "A trusted origin is required for state-changing requests."));
    return next();
  }
  if (!isTrustedOrigin(origin)) return next(new ApiError(403, "ORIGIN_REJECTED", "The request origin is not allowed."));
  next();
};
