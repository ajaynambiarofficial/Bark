import { Router } from "express";
import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { clinicServices, clinics, offers, services } from "../db/schema.js";
import { requirePermission } from "../middleware/auth.js";
import { z } from "zod";

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
  const bookingOnly = request.query.surface === "booking";
  if (clinicId && actor.clinicIds.length && !actor.clinicIds.includes(clinicId) && !actor.permissions.has("bookings:manage:any")) {
    return response.status(403).json({ error: { code: "CLINIC_ACCESS_DENIED", message: "You cannot view services for this clinic." } });
  }
  const rows = clinicId
    ? await db.select({ id: services.id, sku: services.sku, name: services.name, category: services.category, description: services.description, metadata: services.metadata, durationMinutes: sql<number | null>`coalesce(${clinicServices.durationMinutes}, ${services.durationMinutes})`, price: sql<number>`coalesce(${clinicServices.price}, ${services.basePrice})`.mapWith(Number) }).from(clinicServices).innerJoin(services, eq(clinicServices.serviceId, services.id)).where(and(eq(clinicServices.clinicId, clinicId), eq(clinicServices.active, true), eq(services.active, true), ...(bookingOnly ? [eq(services.bookingEnabled, true), sql`coalesce(${clinicServices.durationMinutes}, ${services.durationMinutes}) > 0`] : []))).orderBy(asc(services.name))
    : await db.select({ id: services.id, sku: services.sku, name: services.name, category: services.category, description: services.description, metadata: services.metadata, durationMinutes: services.durationMinutes, price: sql<number>`${services.basePrice}`.mapWith(Number) }).from(services).where(and(eq(services.active, true), ...(bookingOnly ? [eq(services.bookingEnabled, true), sql`${services.durationMinutes} > 0`] : []))).orderBy(asc(services.name));
  response.json({ data: rows });
});

router.get("/offers", requirePermission("services:view"), async (request, response) => {
  const actor = request.auth!;
  const parsedClinicId = z.string().uuid().safeParse(request.query.clinicId);
  if (!parsedClinicId.success) return response.status(400).json({ error: { code: "CLINIC_REQUIRED", message: "Choose a valid clinic to view available offers." } });
  const clinicId = parsedClinicId.data;
  if (actor.clinicIds.length && !actor.clinicIds.includes(clinicId) && !actor.permissions.has("bookings:manage:any")) {
    return response.status(403).json({ error: { code: "CLINIC_ACCESS_DENIED", message: "You cannot view offers for this clinic." } });
  }
  const [clinic] = await db.select({ id: clinics.id }).from(clinics).where(and(eq(clinics.id, clinicId), eq(clinics.active, true))).limit(1);
  if (!clinic) return response.status(404).json({ error: { code: "CLINIC_NOT_FOUND", message: "The selected clinic is unavailable." } });
  const now = new Date();
  const rows = await db.select({ id: offers.id, code: offers.code, name: offers.name, description: offers.description, discountType: offers.discountType, discountValue: offers.discountValue, minimumSubtotal: offers.minimumSubtotal, clinicId: offers.clinicId, startsAt: offers.startsAt, endsAt: offers.endsAt })
    .from(offers).where(and(eq(offers.active, true), or(isNull(offers.clinicId), eq(offers.clinicId, clinicId)), or(isNull(offers.startsAt), lte(offers.startsAt, now)), or(isNull(offers.endsAt), gte(offers.endsAt, now)))).orderBy(asc(offers.name));
  response.json({ data: rows });
});
export { router as catalogRouter };
