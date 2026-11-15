import { Router } from "express";
import { and, count, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { auditEvents, bookings, clinics, escalations, users } from "../db/schema.js";
import { requirePermission } from "../middleware/auth.js";
import { parseQuery } from "../lib/validation.js";

const router = Router();
const dateQuery = z.object({ from: z.coerce.date().default(() => new Date(new Date().setHours(0, 0, 0, 0))), to: z.coerce.date().default(() => new Date()) });

router.get("/summary", requirePermission("dashboard:view:self"), async (request, response) => {
  const { from, to } = parseQuery(request, dateQuery);
  const actor = request.auth!;
  const global = actor.permissions.has("dashboard:view:global");
  const bookingScope = global ? undefined : actor.clinicIds.length ? inArray(bookings.clinicId, [...actor.clinicIds]) : eq(bookings.createdBy, actor.userId);
  const escalationScope = global ? undefined : actor.clinicIds.length ? inArray(escalations.clinicId, [...actor.clinicIds]) : eq(escalations.reporterId, actor.userId);
  const activeAgentQuery = global
    ? db.select({ value: count() }).from(users).where(eq(users.accountStatus, "active"))
    : actor.permissions.has("dashboard:view:team")
      ? db.select({ value: count() }).from(users).where(and(eq(users.accountStatus, "active"), eq(users.department, actor.department)))
      : Promise.resolve([{ value: 1 }]);
  const activeClinicQuery = global
    ? db.select({ value: count() }).from(clinics).where(eq(clinics.active, true))
    : Promise.resolve([{ value: actor.clinicIds.length }]);
  const [bookingCount, cancelledCount, escalationCount, breachedCount, activeAgents, activeClinics, recentActivity] = await Promise.all([
    db.select({ value: count() }).from(bookings).where(and(isNull(bookings.deletedAt), gt(bookings.startsAt, from), lt(bookings.startsAt, to), ...(bookingScope ? [bookingScope] : []))),
    db.select({ value: count() }).from(bookings).where(and(eq(bookings.status, "cancelled"), gt(bookings.startsAt, from), lt(bookings.startsAt, to), ...(bookingScope ? [bookingScope] : []))),
    db.select({ value: count() }).from(escalations).where(and(isNull(escalations.deletedAt), gt(escalations.createdAt, from), lt(escalations.createdAt, to), ...(escalationScope ? [escalationScope] : []))),
    db.select({ value: count() }).from(escalations).where(and(isNull(escalations.deletedAt), sql`${escalations.slaDueAt} < now()`, inArray(escalations.status, ["New", "Assigned", "In Progress", "Awaiting Response"]), ...(escalationScope ? [escalationScope] : []))),
    activeAgentQuery,
    activeClinicQuery,
    global ? db.select({ id: auditEvents.id, action: auditEvents.action, entityType: auditEvents.entityType, entityId: auditEvents.entityId, createdAt: auditEvents.createdAt }).from(auditEvents).where(and(gt(auditEvents.createdAt, from), sql`${auditEvents.createdAt} <= ${to}`)).orderBy(sql`${auditEvents.createdAt} desc`).limit(10) : Promise.resolve([]),
  ]);
  response.json({ data: { period: { from, to }, bookings: { total: bookingCount[0]?.value ?? 0, cancelled: cancelledCount[0]?.value ?? 0 }, escalations: { total: escalationCount[0]?.value ?? 0, breached: breachedCount[0]?.value ?? 0 }, agents: { active: activeAgents[0]?.value ?? 0 }, clinics: { active: activeClinics[0]?.value ?? 0 }, recentActivity } });
});

export { router as dashboardRouter };
