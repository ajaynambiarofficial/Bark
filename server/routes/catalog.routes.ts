import { Router } from "express";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { clinicServices, clinics, services } from "../db/schema.js";
import { requirePermission } from "../middleware/auth.js";

const router = Router();
router.get("/clinics", requirePermission("clinics:view"), async (request, response) => {
  const actor = request.auth!;
  const rows = await db.select({ id: clinics.id, code: clinics.code, name: clinics.name, timezone: clinics.timezone }).from(clinics)
    .where(and(eq(clinics.active, true), ...(actor.clinicIds.length && !actor.permissions.has("bookings:manage:any") ? [inArray(clinics.id, [...actor.clinicIds])] : []))).orderBy(asc(clinics.name));
  response.json({ data: rows });
});
router.get("/services", requirePermission("services:view"), async (request, response) => {
  const actor = request.auth!;
  const clinicId = typeof request.query.clinicId === "string" ? request.query.clinicId : undefined;
  if (clinicId && actor.clinicIds.length && !actor.clinicIds.includes(clinicId) && !actor.permissions.has("bookings:manage:any")) {
    return response.status(403).json({ error: { code: "CLINIC_ACCESS_DENIED", message: "You cannot view services for this clinic." } });
  }
  const rows = clinicId
    ? await db.select({ id: services.id, sku: services.sku, name: services.name, category: services.category, durationMinutes: services.durationMinutes, price: sql<number>`coalesce(${clinicServices.price}, ${services.basePrice})`.mapWith(Number) }).from(clinicServices).innerJoin(services, eq(clinicServices.serviceId, services.id)).where(and(eq(clinicServices.clinicId, clinicId), eq(clinicServices.active, true), eq(services.active, true))).orderBy(asc(services.name))
    : await db.select({ id: services.id, sku: services.sku, name: services.name, category: services.category, durationMinutes: services.durationMinutes, price: sql<number>`${services.basePrice}`.mapWith(Number) }).from(services).where(eq(services.active, true)).orderBy(asc(services.name));
  response.json({ data: rows });
});
export { router as catalogRouter };
