import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { ApiError } from "../lib/errors.js";
import { parseQuery } from "../lib/validation.js";
import { requirePermission } from "../middleware/auth.js";

const router = Router();
const searchSchema = z.object({ q: z.string().trim().min(3).max(200) });
interface GeocodedLocation { latitude: number; longitude: number; displayName: string }
interface CachedLocation { location: GeocodedLocation | null; expiresAt: number }

const cache = new Map<string, CachedLocation>();
let lastLookupAt = 0;
let lookupQueue: Promise<void> = Promise.resolve();
const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function lookupLocation(query: string): Promise<GeocodedLocation | null> {
  const cacheKey = query.toLowerCase().replace(/\s+/g, " ");
  const existing = cache.get(cacheKey);
  if (existing && existing.expiresAt > Date.now()) return existing.location;

  const lookup = lookupQueue.then(async () => {
    const queuedCache = cache.get(cacheKey);
    if (queuedCache && queuedCache.expiresAt > Date.now()) return queuedCache.location;

    const wait = Math.max(0, 1_100 - (Date.now() - lastLookupAt));
    if (wait) await delay(wait);
    lastLookupAt = Date.now();

    const search = /\b(bengaluru|bangalore|karnataka|india)\b/i.test(query) ? query : `${query}, Bengaluru, Karnataka, India`;
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.search = new URLSearchParams({ q: search, format: "jsonv2", limit: "1", countrycodes: "in" }).toString();
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "User-Agent": `BarkBySupertails/0.1 (${env.APP_ORIGIN})`, "Accept-Language": "en" },
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      throw new ApiError(502, "LOCATION_SEARCH_UNAVAILABLE", "Location search is temporarily unavailable. Try again shortly.");
    }
    if (!response.ok) throw new ApiError(502, "LOCATION_SEARCH_UNAVAILABLE", "Location search is temporarily unavailable. Try again shortly.");

    const results = await response.json() as Array<{ lat?: string; lon?: string; display_name?: string }>;
    const first = results[0];
    const latitude = Number(first?.lat);
    const longitude = Number(first?.lon);
    const location = Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude, displayName: first?.display_name ?? query }
      : null;
    cache.set(cacheKey, { location, expiresAt: Date.now() + 24 * 60 * 60 * 1_000 });
    if (cache.size > 250) cache.delete(cache.keys().next().value!);
    return location;
  });
  lookupQueue = lookup.then(() => undefined, () => undefined);
  return lookup;
}

router.get("/search", requirePermission("clinics:view"), async (request, response) => {
  const { q } = parseQuery(request, searchSchema);
  const location = await lookupLocation(q);
  if (!location) throw new ApiError(404, "LOCATION_NOT_FOUND", "We could not find that place. Try a Bengaluru area, landmark, or PIN code.");
  response.json({ data: location });
});

export { router as clinicMapRouter };
