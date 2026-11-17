import { Router } from "express";
import { and, desc, eq, gt, ilike, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db/client.js";
import { bookingHistory, bookings, clinicServices, clinics, customerPets, customers, roles, services, users } from "../db/schema.js";
import { requirePermission } from "../middleware/auth.js";
import { ApiError } from "../lib/errors.js";
import { parseBody, parseQuery } from "../lib/validation.js";
import { appendAudit } from "../services/audit.service.js";
import type { AuthPrincipal } from "../auth/types.js";

const router = Router();
const uuid = z.string().uuid();
const listSchema = z.object({
  search: z.string().trim().max(120).optional(), status: z.string().trim().max(40).optional(), clinicId: uuid.optional(),
  from: z.coerce.date().optional(), to: z.coerce.date().optional(), limit: z.coerce.number().int().min(1).max(100).default(30), offset: z.coerce.number().int().min(0).default(0),
});
const customerSchema = z.object({ name: z.string().trim().min(2).max(160), phone: z.string().trim().min(7).max(30), email: z.string().trim().email().optional(), petName: z.string().trim().max(120).optional(), petSpecies: z.string().trim().max(80).optional() });
const createSchema = z.object({ customerId: uuid.optional(), petId: uuid.optional(), customer: customerSchema.optional(), clinicId: uuid, serviceId: uuid, assignedStaffId: uuid.optional(), startsAt: z.coerce.date(), endsAt: z.coerce.date().optional(), notes: z.string().trim().max(2000).default(""), source: z.string().trim().max(60).default("bark") }).refine((value) => value.customerId || value.customer, { message: "Select a customer or enter their details.", path: ["customerId"] });
const availabilitySchema = z.object({ clinicId: uuid, serviceId: uuid, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
const rescheduleSchema = z.object({ startsAt: z.coerce.date(), endsAt: z.coerce.date(), assignedStaffId: uuid.nullable().optional(), reason: z.string().trim().min(3).max(500) }).refine((value) => value.endsAt > value.startsAt, { message: "The end time must be after the start time.", path: ["endsAt"] });
const assignSchema = z.object({ assignedStaffId: uuid, reason: z.string().trim().min(3).max(500) });
const cancelSchema = z.object({ reason: z.string().trim().min(3).max(500) });
const statusSchema = z.object({ status: z.enum(["in_progress", "completed"]), reason: z.string().trim().min(3).max(500) });

function bookingReference() {
  const date = new Date();
  return `BKG-${date.getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function canManageBooking(actor: AuthPrincipal, booking: { clinicId: string; createdBy: string }) {
  return actor.permissions.has("bookings:manage:any") || booking.createdBy === actor.userId || actor.clinicIds.includes(booking.clinicId);
}

async function requireBookingAccess(id: string, actor: AuthPrincipal) {
  const [record] = await db.select().from(bookings).where(and(eq(bookings.id, id), isNull(bookings.deletedAt))).limit(1);
  if (!record) throw new ApiError(404, "BOOKING_NOT_FOUND", "The booking was not found.");
  if (!canManageBooking(actor, record)) throw new ApiError(403, "BOOKING_ACCESS_DENIED", "You do not have access to this booking.");
  return record;
}

async function assertAvailable(staffId: string | null | undefined, startsAt: Date, endsAt: Date, excludeId?: string) {
  if (!staffId) return;
  const conditions = [eq(bookings.assignedStaffId, staffId), lt(bookings.startsAt, endsAt), gt(bookings.endsAt, startsAt), isNull(bookings.deletedAt), inArray(bookings.status, ["pending", "confirmed", "checked_in", "in_progress"])] as const;
  const conflicts = await db.select({ id: bookings.id }).from(bookings).where(and(...conditions, ...(excludeId ? [ne(bookings.id, excludeId)] : []))).limit(1);
  if (conflicts.length) throw new ApiError(409, "BOOKING_CONFLICT", "The assigned staff member already has an overlapping appointment.");
}

router.get("/availability", requirePermission("bookings:view"), async (request, response) => {
  const input = parseQuery(request, availabilitySchema);
  const actor = request.auth!;
  if (actor.clinicIds.length && !actor.clinicIds.includes(input.clinicId) && !actor.permissions.has("bookings:manage:any")) throw new ApiError(403, "CLINIC_ACCESS_DENIED", "You cannot view this clinic schedule.");
  const [clinicService] = await db.select({ duration: clinicServices.durationMinutes, serviceDuration: services.durationMinutes })
    .from(clinicServices).innerJoin(services, eq(clinicServices.serviceId, services.id))
    .where(and(eq(clinicServices.clinicId, input.clinicId), eq(clinicServices.serviceId, input.serviceId), eq(clinicServices.active, true), eq(services.active, true))).limit(1);
  if (!clinicService) throw new ApiError(404, "SERVICE_UNAVAILABLE", "This service is not offered at the selected clinic.");
  const duration = clinicService.duration ?? clinicService.serviceDuration;
  const dayStart = new Date(`${input.date}T09:00:00+05:30`);
  const dayEnd = new Date(`${input.date}T18:00:00+05:30`);
  const existing = await db.select({ startsAt: bookings.startsAt, endsAt: bookings.endsAt }).from(bookings)
    .where(and(eq(bookings.clinicId, input.clinicId), isNull(bookings.deletedAt), inArray(bookings.status, ["pending", "confirmed", "checked_in", "in_progress"]), lt(bookings.startsAt, dayEnd), gt(bookings.endsAt, dayStart)));
  const slots: Array<{ startsAt: string; endsAt: string }> = [];
  const step = 15 * 60_000;
  for (let starts = dayStart.getTime(); starts + duration * 60_000 <= dayEnd.getTime(); starts += step) {
    const ends = starts + duration * 60_000;
    if (starts <= Date.now()) continue;
    if (existing.some((booking) => booking.startsAt.getTime() < ends && booking.endsAt.getTime() > starts)) continue;
    slots.push({ startsAt: new Date(starts).toISOString(), endsAt: new Date(ends).toISOString() });
  }
  response.json({ data: { durationMinutes: duration, slots } });
});

router.get("/", requirePermission("bookings:view"), async (request, response) => {
  const input = parseQuery(request, listSchema);
  const actor = request.auth!;
  const access = actor.permissions.has("bookings:manage:any") || actor.permissions.has("bookings:cancel") ? undefined : or(eq(bookings.createdBy, actor.userId), ...(actor.clinicIds.length ? [inArray(bookings.clinicId, [...actor.clinicIds])] : []));
  const conditions = [isNull(bookings.deletedAt), ...(access ? [access] : []), ...(input.status ? [eq(bookings.status, input.status)] : []), ...(input.clinicId ? [eq(bookings.clinicId, input.clinicId)] : []), ...(input.from ? [gt(bookings.startsAt, input.from)] : []), ...(input.to ? [lt(bookings.startsAt, input.to)] : []), ...(input.search ? [or(ilike(bookings.reference, `%${input.search}%`), ilike(customers.name, `%${input.search}%`), ilike(customers.phone, `%${input.search}%`))!] : [])];
  const creator = alias(users, "booking_creator");
  const cancellationHistory = alias(bookingHistory, "cancellation_history");
  const canceller = alias(users, "booking_canceller");
  const records = await db.select({ booking: bookings, customer: { id: customers.id, name: customers.name, phone: customers.phone, petName: customers.petName }, clinic: { id: clinics.id, name: clinics.name }, service: { id: services.id, name: services.name }, staff: { id: users.id, displayName: users.displayName, role: roles.name }, createdBy: { id: creator.id, displayName: creator.displayName, email: creator.email }, cancelledBy: { id: canceller.id, displayName: canceller.displayName, email: canceller.email } })
    .from(bookings).innerJoin(customers, eq(bookings.customerId, customers.id)).innerJoin(clinics, eq(bookings.clinicId, clinics.id)).innerJoin(services, eq(bookings.serviceId, services.id)).leftJoin(users, eq(bookings.assignedStaffId, users.id)).leftJoin(roles, eq(users.roleId, roles.id)).leftJoin(creator, eq(bookings.createdBy, creator.id)).leftJoin(cancellationHistory, and(eq(cancellationHistory.bookingId, bookings.id), eq(cancellationHistory.action, "cancelled"))).leftJoin(canceller, eq(cancellationHistory.actorId, canceller.id))
    .where(and(...conditions)).orderBy(desc(bookings.startsAt)).limit(input.limit).offset(input.offset);
  response.json({ data: records, meta: { limit: input.limit, offset: input.offset, returned: records.length } });
});

router.post("/", requirePermission("bookings:create"), async (request, response) => {
  const input = parseBody(request, createSchema);
  const actor = request.auth!;
  if (actor.clinicIds.length && !actor.clinicIds.includes(input.clinicId) && !actor.permissions.has("bookings:manage:any")) throw new ApiError(403, "CLINIC_ACCESS_DENIED", "You cannot create bookings for this clinic.");
  const [pet] = input.petId && input.customerId ? await db.select().from(customerPets).where(and(eq(customerPets.id, input.petId), eq(customerPets.customerId, input.customerId))).limit(1) : [];
  if (input.petId && !pet) throw new ApiError(400, "PET_INVALID", "Select a pet registered to this customer.");
  const [clinicService] = await db.select({ duration: clinicServices.durationMinutes, serviceDuration: services.durationMinutes, sku: services.sku, name: services.name })
    .from(clinicServices).innerJoin(services, eq(clinicServices.serviceId, services.id))
    .where(and(eq(clinicServices.clinicId, input.clinicId), eq(clinicServices.serviceId, input.serviceId), eq(clinicServices.active, true), eq(services.active, true))).limit(1);
  if (!clinicService) throw new ApiError(400, "SERVICE_UNAVAILABLE", "This service is not offered at the selected clinic.");
  if (clinicService.sku === "GROOM-LONG" && pet?.coatType === "Short") throw new ApiError(400, "GROOMING_COAT_MISMATCH", "Long-coat grooming cannot be booked for a pet registered with a short coat.");
  if (clinicService.sku === "GROOM-LONG" && pet?.coatType !== "Long") throw new ApiError(400, "COAT_TYPE_REQUIRED", "Confirm the pet's long-coat type before booking this routine.");
  if (clinicService.sku === "GROOM-SHORT" && pet?.coatType !== "Short") throw new ApiError(400, "COAT_TYPE_REQUIRED", "Confirm the pet's short-coat type before booking this routine.");
  const duration = clinicService.duration ?? clinicService.serviceDuration;
  const endsAt = new Date(input.startsAt.getTime() + duration * 60_000);
  const created = await db.transaction(async (transaction) => {
    await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.clinicId}))`);
    const [conflict] = await transaction.select({ id: bookings.id }).from(bookings).where(and(eq(bookings.clinicId, input.clinicId), lt(bookings.startsAt, endsAt), gt(bookings.endsAt, input.startsAt), isNull(bookings.deletedAt), inArray(bookings.status, ["pending", "confirmed", "checked_in", "in_progress"]))).limit(1);
    if (conflict) throw new ApiError(409, "BOOKING_CONFLICT", "That slot was just booked. Choose another available time.");
    await assertAvailable(input.assignedStaffId, input.startsAt, endsAt);
    let customerId = input.customerId;
    if (!customerId && input.customer) {
      const [customer] = await transaction.insert(customers).values({ ...input.customer, email: input.customer.email ?? null, petName: input.customer.petName ?? null, petSpecies: input.customer.petSpecies ?? null }).returning({ id: customers.id });
      customerId = customer?.id;
    }
    if (!customerId) throw new ApiError(400, "CUSTOMER_REQUIRED", "A valid customer is required.");
    const [booking] = await transaction.insert(bookings).values({ reference: bookingReference(), customerId, petId: input.petId ?? null, clinicId: input.clinicId, serviceId: input.serviceId, assignedStaffId: input.assignedStaffId ?? null, startsAt: input.startsAt, endsAt, notes: input.notes, source: input.source, createdBy: actor.userId, updatedBy: actor.userId }).returning();
    if (!booking) throw new ApiError(500, "BOOKING_CREATE_FAILED", "The booking could not be created.");
    await transaction.insert(bookingHistory).values({ bookingId: booking.id, actorId: actor.userId, action: "created", newValue: { reference: booking.reference, customerId: booking.customerId, petId: booking.petId, clinicId: booking.clinicId, serviceId: booking.serviceId, durationMinutes: duration, startsAt: booking.startsAt.toISOString(), endsAt: booking.endsAt.toISOString(), assignedStaffId: booking.assignedStaffId } });
    await appendAudit(transaction, { actor, action: "booking.created", entityType: "booking", entityId: booking.id, newValue: { reference: booking.reference, customerId: booking.customerId, petId: booking.petId, clinicId: booking.clinicId, serviceId: booking.serviceId, durationMinutes: duration, startsAt: booking.startsAt.toISOString(), endsAt: booking.endsAt.toISOString(), assignedStaffId: booking.assignedStaffId }, requestId: request.requestId, ipAddress: request.ip });
    return booking;
  });
  response.status(201).json({ data: created });
});

router.get("/:id", requirePermission("bookings:view"), async (request, response) => {
  const id = uuid.parse(request.params.id);
  const booking = await requireBookingAccess(id, request.auth!);
  const history = await db.select().from(bookingHistory).where(eq(bookingHistory.bookingId, id)).orderBy(desc(bookingHistory.createdAt));
  response.json({ data: { ...booking, history } });
});

router.post("/:id/reschedule", requirePermission("bookings:update"), async (request, response) => {
  const id = uuid.parse(request.params.id);
  const input = parseBody(request, rescheduleSchema);
  const actor = request.auth!;
  const current = await requireBookingAccess(id, actor);
  const assignedStaffId = input.assignedStaffId === undefined ? current.assignedStaffId : input.assignedStaffId;
  if (assignedStaffId) await assertAvailable(assignedStaffId, input.startsAt, input.endsAt, id);
  const [updated] = await db.transaction(async (transaction) => {
    const records = await transaction.update(bookings).set({ startsAt: input.startsAt, endsAt: input.endsAt, assignedStaffId, updatedBy: actor.userId, updatedAt: new Date() }).where(eq(bookings.id, id)).returning();
    const next = records[0]!;
    const before = { startsAt: current.startsAt.toISOString(), endsAt: current.endsAt.toISOString(), assignedStaffId: current.assignedStaffId };
    const after = { startsAt: next.startsAt.toISOString(), endsAt: next.endsAt.toISOString(), assignedStaffId: next.assignedStaffId };
    await transaction.insert(bookingHistory).values({ bookingId: id, actorId: actor.userId, action: "rescheduled", previousValue: before, newValue: after, reason: input.reason });
    await appendAudit(transaction, { actor, action: "booking.rescheduled", entityType: "booking", entityId: id, previousValue: before, newValue: after, reason: input.reason, requestId: request.requestId, ipAddress: request.ip });
    return records;
  });
  response.json({ data: updated });
});

router.post("/:id/assign", requirePermission("bookings:update"), async (request, response) => {
  const id = uuid.parse(request.params.id);
  const input = parseBody(request, assignSchema);
  const actor = request.auth!;
  const current = await requireBookingAccess(id, actor);
  await assertAvailable(input.assignedStaffId, current.startsAt, current.endsAt, id);
  const [updated] = await db.transaction(async (transaction) => {
    const records = await transaction.update(bookings).set({ assignedStaffId: input.assignedStaffId, updatedBy: actor.userId, updatedAt: new Date() }).where(eq(bookings.id, id)).returning();
    await transaction.insert(bookingHistory).values({ bookingId: id, actorId: actor.userId, action: "assigned", previousValue: { assignedStaffId: current.assignedStaffId }, newValue: { assignedStaffId: input.assignedStaffId }, reason: input.reason });
    await appendAudit(transaction, { actor, action: "booking.assigned", entityType: "booking", entityId: id, previousValue: { assignedStaffId: current.assignedStaffId }, newValue: { assignedStaffId: input.assignedStaffId }, reason: input.reason, requestId: request.requestId, ipAddress: request.ip });
    return records;
  });
  response.json({ data: updated });
});

router.post("/:id/cancel", requirePermission("bookings:cancel"), async (request, response) => {
  const id = uuid.parse(request.params.id);
  const input = parseBody(request, cancelSchema);
  const actor = request.auth!;
  const [current] = await db.select().from(bookings).where(and(eq(bookings.id, id), isNull(bookings.deletedAt))).limit(1);
  if (!current) throw new ApiError(404, "BOOKING_NOT_FOUND", "The booking was not found.");
  if (["cancelled", "completed"].includes(current.status)) throw new ApiError(409, "BOOKING_STATUS_INVALID", `A ${current.status} booking cannot be cancelled.`);
  const [updated] = await db.transaction(async (transaction) => {
    const records = await transaction.update(bookings).set({ status: "cancelled", cancellationReason: input.reason, cancelledAt: new Date(), updatedBy: actor.userId, updatedAt: new Date() }).where(eq(bookings.id, id)).returning();
    await transaction.insert(bookingHistory).values({ bookingId: id, actorId: actor.userId, action: "cancelled", previousValue: { status: current.status }, newValue: { status: "cancelled" }, reason: input.reason });
    await appendAudit(transaction, { actor, action: "booking.cancelled", entityType: "booking", entityId: id, previousValue: { status: current.status }, newValue: { status: "cancelled" }, reason: input.reason, requestId: request.requestId, ipAddress: request.ip });
    return records;
  });
  response.json({ data: updated });
});

router.patch("/:id/status", requirePermission("bookings:status:update"), async (request, response) => {
  const id = uuid.parse(request.params.id);
  const input = parseBody(request, statusSchema);
  const actor = request.auth!;
  const current = await requireBookingAccess(id, actor);
  if (!["pending", "confirmed", "checked_in", "in_progress"].includes(current.status)) throw new ApiError(409, "BOOKING_STATUS_INVALID", `A ${current.status} booking cannot be marked ${input.status.replaceAll("_", " ")}.`);
  if (current.status === input.status) throw new ApiError(409, "BOOKING_STATUS_UNCHANGED", "The appointment already has this status.");
  const [updated] = await db.transaction(async (transaction) => {
    const records = await transaction.update(bookings).set({ status: input.status, updatedBy: actor.userId, updatedAt: new Date() }).where(eq(bookings.id, id)).returning();
    await transaction.insert(bookingHistory).values({ bookingId: id, actorId: actor.userId, action: input.status, previousValue: { status: current.status }, newValue: { status: input.status }, reason: input.reason });
    await appendAudit(transaction, { actor, action: `booking.${input.status}`, entityType: "booking", entityId: id, previousValue: { status: current.status }, newValue: { status: input.status }, reason: input.reason, requestId: request.requestId, ipAddress: request.ip });
    return records;
  });
  response.json({ data: updated });
});

export { router as bookingRouter };
