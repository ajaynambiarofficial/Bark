import { Router } from "express";
import { and, asc, eq, gt, isNull, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { calendarEvents } from "../db/schema.js";
import { requirePermission } from "../middleware/auth.js";
import { ApiError } from "../lib/errors.js";
import { parseBody, parseQuery } from "../lib/validation.js";
import { appendAudit } from "../services/audit.service.js";

const router = Router();
const uuid = z.string().uuid();
const eventTypes = ["Meetings", "Offers", "Feedback session", "Others"] as const;
const querySchema = z.object({ from: z.coerce.date(), to: z.coerce.date(), clinicId: uuid.optional() }).refine((value) => value.to > value.from, { message: "The end date must be after the start date.", path: ["to"] });
const eventFieldsSchema = z.object({ title: z.string().trim().min(2).max(160), eventType: z.enum(eventTypes), startsAt: z.coerce.date(), endsAt: z.coerce.date().optional(), description: z.string().trim().max(2000).default(""), clinicId: uuid.optional() });
const eventSchema = eventFieldsSchema.refine((value) => !value.endsAt || value.endsAt > value.startsAt, { message: "The event end must be after its start.", path: ["endsAt"] });
const updateSchema = eventFieldsSchema.partial().extend({ reason: z.string().trim().min(3).max(500) });

router.get("/events", requirePermission("calendar:view"), async (request, response) => {
  const input = parseQuery(request, querySchema);
  const actor = request.auth!;
  if (input.clinicId && actor.clinicIds.length && !actor.clinicIds.includes(input.clinicId) && !actor.permissions.has("calendar:manage")) throw new ApiError(403, "CLINIC_ACCESS_DENIED", "You cannot view this clinic calendar.");
  const records = await db.select().from(calendarEvents).where(and(isNull(calendarEvents.cancelledAt), gt(calendarEvents.startsAt, input.from), lt(calendarEvents.startsAt, input.to), ...(input.clinicId ? [eq(calendarEvents.clinicId, input.clinicId)] : []))).orderBy(asc(calendarEvents.startsAt));
  response.json({ data: records });
});

router.post("/events", requirePermission("calendar:manage"), async (request, response) => {
  const input = parseBody(request, eventSchema);
  const actor = request.auth!;
  if (input.clinicId && actor.clinicIds.length && !actor.clinicIds.includes(input.clinicId) && !actor.permissions.has("admin:settings")) throw new ApiError(403, "CLINIC_ACCESS_DENIED", "You cannot manage this clinic calendar.");
  const [event] = await db.transaction(async (transaction) => {
    const records = await transaction.insert(calendarEvents).values({ ...input, endsAt: input.endsAt ?? null, clinicId: input.clinicId ?? null, createdBy: actor.userId, updatedBy: actor.userId }).returning();
    const created = records[0]!;
    await appendAudit(transaction, { actor, action: "calendar.created", entityType: "calendar_event", entityId: created.id, newValue: { title: created.title, eventType: created.eventType, startsAt: created.startsAt.toISOString(), clinicId: created.clinicId }, requestId: request.requestId, ipAddress: request.ip });
    return records;
  });
  response.status(201).json({ data: event });
});

router.patch("/events/:id", requirePermission("calendar:manage"), async (request, response) => {
  const id = uuid.parse(request.params.id);
  const input = parseBody(request, updateSchema);
  const actor = request.auth!;
  const [current] = await db.select().from(calendarEvents).where(and(eq(calendarEvents.id, id), isNull(calendarEvents.cancelledAt))).limit(1);
  if (!current) throw new ApiError(404, "CALENDAR_EVENT_NOT_FOUND", "The calendar event was not found.");
  if (current.clinicId && actor.clinicIds.length && !actor.clinicIds.includes(current.clinicId) && !actor.permissions.has("admin:settings")) throw new ApiError(403, "CLINIC_ACCESS_DENIED", "You cannot manage this clinic calendar.");
  const { reason, ...changes } = input;
  const [updated] = await db.transaction(async (transaction) => {
    const records = await transaction.update(calendarEvents).set({ ...changes, updatedBy: actor.userId, updatedAt: new Date() }).where(eq(calendarEvents.id, id)).returning();
    await appendAudit(transaction, { actor, action: "calendar.updated", entityType: "calendar_event", entityId: id, previousValue: { title: current.title, eventType: current.eventType, startsAt: current.startsAt.toISOString(), endsAt: current.endsAt?.toISOString() }, newValue: changes as Record<string, unknown>, reason, requestId: request.requestId, ipAddress: request.ip });
    return records;
  });
  response.json({ data: updated });
});

router.delete("/events/:id", requirePermission("calendar:manage"), async (request, response) => {
  const id = uuid.parse(request.params.id);
  const input = parseBody(request, z.object({ reason: z.string().trim().min(3).max(500) }));
  const actor = request.auth!;
  const [current] = await db.select().from(calendarEvents).where(and(eq(calendarEvents.id, id), isNull(calendarEvents.cancelledAt))).limit(1);
  if (!current) throw new ApiError(404, "CALENDAR_EVENT_NOT_FOUND", "The calendar event was not found.");
  await db.transaction(async (transaction) => {
    await transaction.update(calendarEvents).set({ cancelledAt: new Date(), updatedBy: actor.userId, updatedAt: new Date() }).where(eq(calendarEvents.id, id));
    await appendAudit(transaction, { actor, action: "calendar.cancelled", entityType: "calendar_event", entityId: id, previousValue: { cancelledAt: null }, newValue: { cancelledAt: new Date().toISOString() }, reason: input.reason, requestId: request.requestId, ipAddress: request.ip });
  });
  response.status(204).end();
});

export { router as calendarRouter };
