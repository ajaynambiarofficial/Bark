import { Router } from "express";
import { aliasedTable, and, asc, desc, eq, gt, ilike, inArray, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { assignmentRules, clinics, escalationActivity, escalationComments, escalationOwnershipHistory, escalations, notifications, roles, slaPolicies, users } from "../db/schema.js";
import { escalationStatuses, canTransitionEscalation, requiredPermissionForTier, type EscalationStatus } from "../domain/escalation-policy.js";
import { requirePermission } from "../middleware/auth.js";
import { ApiError } from "../lib/errors.js";
import { parseBody, parseQuery } from "../lib/validation.js";
import { appendAudit } from "../services/audit.service.js";
import type { AuthPrincipal } from "../auth/types.js";

const router = Router();
const ownerUsers = aliasedTable(users, "escalation_owner");
const reporterRoles = aliasedTable(roles, "escalation_reporter_role");
const ownerRoles = aliasedTable(roles, "escalation_owner_role");
const uuid = z.string().uuid();
const categories = ["pawcare", "nugget", "ameyo", "ticket", "clinicops"] as const;
const listSchema = z.object({ search: z.string().trim().max(120).optional(), status: z.enum(escalationStatuses).optional(), category: z.enum(categories).optional(), tier: z.coerce.number().int().min(1).max(3).optional(), clinicId: uuid.optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional(), limit: z.coerce.number().int().min(1).max(100).default(30), offset: z.coerce.number().int().min(0).default(0) });
const createSchema = z.object({
  issueType: z.enum(["standard", "escalation"]), referenceType: z.enum(["customer", "internal"]), title: z.string().trim().min(3).max(220), description: z.string().trim().min(10).max(10_000), category: z.enum(categories),
  issueSubtype: z.string().trim().min(2).max(180), customIssue: z.string().trim().max(1000).optional(), module: z.string().trim().max(100).optional(), channel: z.string().trim().max(100).optional(), service: z.string().trim().max(160).optional(),
  linkedTicketId: z.string().trim().max(80).optional(), customerPhone: z.string().trim().regex(/^\d{10}$/).optional(), appointmentId: z.string().trim().max(80).optional(), clinicId: uuid.optional(),
  attachments: z.array(z.object({ name: z.string().trim().min(1).max(255), size: z.number().int().min(0).max(8 * 1024 * 1024), type: z.string().trim().min(1).max(128) })).max(10).default([]),
});
const statusSchema = z.object({ status: z.enum(escalationStatuses), reason: z.string().trim().max(2000).optional() });
const assignSchema = z.object({ ownerId: uuid, reason: z.string().trim().min(3).max(1000) });
const tierSchema = z.object({ tier: z.number().int().min(2).max(3), reason: z.string().trim().min(3).max(1000) });
const commentSchema = z.object({ body: z.string().trim().min(1).max(5000), visibility: z.enum(["internal", "shared"]).default("internal") });

function reference() {
  return `ESC-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function maskPhone(phone?: string) {
  return phone ? `${phone.slice(0, 2)}••••••${phone.slice(-2)}` : null;
}

function hasAccess(actor: AuthPrincipal, record: { reporterId: string; ownerId: string; clinicId: string | null; originatingDepartment: string; responsibleDepartment: string }) {
  return actor.permissions.has("escalations:manage:any") || record.reporterId === actor.userId || record.ownerId === actor.userId || Boolean(record.clinicId && actor.clinicIds.includes(record.clinicId)) || ((actor.permissions.has("escalations:assign") || actor.permissions.has("dashboard:view:team")) && [record.originatingDepartment, record.responsibleDepartment].includes(actor.department));
}

async function requireAccess(id: string, actor: AuthPrincipal) {
  const [record] = await db.select().from(escalations).where(and(eq(escalations.id, id), isNull(escalations.deletedAt))).limit(1);
  if (!record) throw new ApiError(404, "ESCALATION_NOT_FOUND", "The escalation was not found.");
  if (!hasAccess(actor, record)) throw new ApiError(403, "ESCALATION_ACCESS_DENIED", "You do not have access to this escalation.");
  return record;
}

async function getPeople(ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return new Map<string, { id: string; displayName: string; email: string; role: string; roleLabel: string; department: string; assignment: string }>();
  const records = await db.select({ id: users.id, displayName: users.displayName, email: users.email, role: roles.key, roleLabel: roles.name, department: users.department, assignment: users.assignment })
    .from(users).innerJoin(roles, eq(users.roleId, roles.id)).where(inArray(users.id, uniqueIds));
  return new Map(records.map((person) => [person.id, person]));
}

router.get("/", requirePermission("escalations:view"), async (request, response) => {
  const input = parseQuery(request, listSchema);
  const actor = request.auth!;
  const access = actor.permissions.has("escalations:manage:any") ? undefined : or(eq(escalations.reporterId, actor.userId), eq(escalations.ownerId, actor.userId), ...(actor.clinicIds.length ? [inArray(escalations.clinicId, [...actor.clinicIds])] : []), ...((actor.permissions.has("escalations:assign") || actor.permissions.has("dashboard:view:team")) ? [eq(escalations.originatingDepartment, actor.department), eq(escalations.responsibleDepartment, actor.department)] : []));
  const conditions = [isNull(escalations.deletedAt), ...(access ? [access] : []), ...(input.status ? [eq(escalations.status, input.status)] : []), ...(input.category ? [eq(escalations.category, input.category)] : []), ...(input.tier ? [eq(escalations.tier, input.tier)] : []), ...(input.clinicId ? [eq(escalations.clinicId, input.clinicId)] : []), ...(input.from ? [gt(escalations.createdAt, input.from)] : []), ...(input.to ? [lt(escalations.createdAt, input.to)] : []), ...(input.search ? [or(ilike(escalations.reference, `%${input.search}%`), ilike(escalations.title, `%${input.search}%`), ilike(escalations.linkedTicketId, `%${input.search}%`))!] : [])];
  const records = await db.select({
    escalation: escalations,
    reporter: { id: users.id, displayName: users.displayName, email: users.email, role: reporterRoles.key, roleLabel: reporterRoles.name, department: users.department, assignment: users.assignment },
    owner: { id: ownerUsers.id, displayName: ownerUsers.displayName, email: ownerUsers.email, role: ownerRoles.key, roleLabel: ownerRoles.name, department: ownerUsers.department, assignment: ownerUsers.assignment },
    clinic: { id: clinics.id, name: clinics.name },
  }).from(escalations)
    .innerJoin(users, eq(escalations.reporterId, users.id)).innerJoin(reporterRoles, eq(users.roleId, reporterRoles.id))
    .innerJoin(ownerUsers, eq(escalations.ownerId, ownerUsers.id)).innerJoin(ownerRoles, eq(ownerUsers.roleId, ownerRoles.id))
    .leftJoin(clinics, eq(escalations.clinicId, clinics.id))
    .where(and(...conditions)).orderBy(desc(escalations.updatedAt)).limit(input.limit).offset(input.offset);
  response.json({ data: records, meta: { limit: input.limit, offset: input.offset, returned: records.length } });
});

router.post("/", requirePermission("escalations:create"), async (request, response) => {
  const input = parseBody(request, createSchema);
  const actor = request.auth!;
  if (input.clinicId && !actor.permissions.has("escalations:manage:any") && actor.clinicIds.length && !actor.clinicIds.includes(input.clinicId)) throw new ApiError(403, "CLINIC_ACCESS_DENIED", "You cannot create escalations for this clinic.");

  const [policy] = await db.select().from(slaPolicies).where(and(eq(slaPolicies.active, true), eq(slaPolicies.issueType, input.issueType), or(eq(slaPolicies.category, input.category), isNull(slaPolicies.category)))).orderBy(asc(slaPolicies.targetMinutes)).limit(1);
  if (!policy) throw new ApiError(422, "SLA_POLICY_MISSING", "No active SLA policy is configured for this issue.");
  const [rule] = await db.select().from(assignmentRules).where(and(eq(assignmentRules.active, true), eq(assignmentRules.category, input.category), ...(input.clinicId ? [or(eq(assignmentRules.clinicId, input.clinicId), isNull(assignmentRules.clinicId))!] : [isNull(assignmentRules.clinicId)]))).orderBy(asc(assignmentRules.priority)).limit(1);
  if (!rule?.ownerId) throw new ApiError(422, "ASSIGNMENT_RULE_MISSING", "No accountable owner is configured for this category.");

  const [owner] = await db.select({ id: users.id, department: users.department }).from(users).where(and(eq(users.id, rule.ownerId), eq(users.accountStatus, "active"))).limit(1);
  if (!owner) throw new ApiError(422, "ASSIGNMENT_OWNER_UNAVAILABLE", "The configured escalation owner is unavailable.");
  const now = new Date();
  const created = await db.transaction(async (transaction) => {
    const [record] = await transaction.insert(escalations).values({
      reference: reference(), issueType: input.issueType, referenceType: input.referenceType, title: input.title, description: input.description, category: input.category, module: input.module ?? null, channel: input.channel ?? null, service: input.service ?? null,
      issueSubtype: input.issueSubtype, customIssue: input.customIssue ?? null, linkedTicketId: input.linkedTicketId?.toUpperCase() ?? null, customerPhoneMasked: maskPhone(input.customerPhone), appointmentId: input.appointmentId ?? null, attachmentMetadata: input.attachments.map((attachment) => ({ ...attachment, id: crypto.randomUUID() })), clinicId: input.clinicId ?? null,
      reporterId: actor.userId, ownerId: owner.id, originatingDepartment: actor.department, responsibleDepartment: owner.department, assignedTeam: rule.team ?? owner.department, tier: 1, priority: policy.priority, status: "Assigned", slaPolicyId: policy.id, slaDueAt: new Date(now.getTime() + policy.targetMinutes * 60_000),
    }).returning();
    if (!record) throw new ApiError(500, "ESCALATION_CREATE_FAILED", "The escalation could not be created.");
    await transaction.insert(escalationActivity).values([{ escalationId: record.id, actorId: actor.userId, action: "created", newValue: { status: record.status, priority: record.priority, tier: record.tier } }, { escalationId: record.id, actorId: actor.userId, action: "owner-assigned", newValue: { ownerId: owner.id }, reason: "Configured assignment rule" }]);
    await transaction.insert(escalationOwnershipHistory).values({ escalationId: record.id, ownerId: owner.id, assignedBy: actor.userId, reason: "Configured assignment rule" });
    await transaction.insert(notifications).values({ userId: owner.id, channel: "email", templateKey: "escalation.created", payload: { escalationId: record.id, reference: record.reference } });
    await appendAudit(transaction, { actor, action: "escalation.created", entityType: "escalation", entityId: record.id, newValue: { reference: record.reference, category: record.category, ownerId: owner.id, status: record.status, priority: record.priority, tier: record.tier }, requestId: request.requestId, ipAddress: request.ip });
    return record;
  });
  response.status(201).json({ data: created });
});

router.get("/owners", requirePermission("escalations:assign"), async (_request, response) => {
  const records = await db.select({ id: users.id, displayName: users.displayName, email: users.email, role: roles.key, roleLabel: roles.name, department: users.department, assignment: users.assignment })
    .from(users).innerJoin(roles, eq(users.roleId, roles.id)).where(eq(users.accountStatus, "active")).orderBy(asc(users.displayName));
  response.json({ data: records });
});

router.get("/:id", requirePermission("escalations:view"), async (request, response) => {
  const id = uuid.parse(request.params.id);
  const record = await requireAccess(id, request.auth!);
  const [comments, activity, ownership, clinic] = await Promise.all([
    db.select().from(escalationComments).where(eq(escalationComments.escalationId, id)).orderBy(asc(escalationComments.createdAt)),
    db.select().from(escalationActivity).where(eq(escalationActivity.escalationId, id)).orderBy(asc(escalationActivity.createdAt)),
    db.select().from(escalationOwnershipHistory).where(eq(escalationOwnershipHistory.escalationId, id)).orderBy(asc(escalationOwnershipHistory.assignedAt)),
    record.clinicId ? db.select({ id: clinics.id, name: clinics.name }).from(clinics).where(eq(clinics.id, record.clinicId)).limit(1).then((rows) => rows[0] ?? null) : Promise.resolve(null),
  ]);
  const people = await getPeople([record.reporterId, record.ownerId, ...comments.map((item) => item.authorId), ...activity.map((item) => item.actorId), ...ownership.flatMap((item) => [item.ownerId, item.assignedBy])]);
  response.json({ data: {
    ...record,
    reporter: people.get(record.reporterId),
    accountableOwner: people.get(record.ownerId),
    clinic: clinic?.name ?? null,
    comments: comments.map((comment) => ({ ...comment, author: people.get(comment.authorId) })),
    activity: activity.map((event) => ({ ...event, actor: people.get(event.actorId) })),
    ownershipHistory: ownership.map((entry) => ({ ...entry, owner: people.get(entry.ownerId), assignedBy: people.get(entry.assignedBy) })),
  } });
});

router.post("/:id/status", requirePermission("escalations:comment"), async (request, response) => {
  const id = uuid.parse(request.params.id);
  const input = parseBody(request, statusSchema);
  const actor = request.auth!;
  const current = await requireAccess(id, actor);
  if (!canTransitionEscalation(current.status as EscalationStatus, input.status)) throw new ApiError(409, "ESCALATION_TRANSITION_INVALID", `Cannot move from ${current.status} to ${input.status}.`);
  if (["Resolved", "Reopened"].includes(input.status) && !input.reason) throw new ApiError(400, "REASON_REQUIRED", `A reason is required when setting status to ${input.status}.`);
  if (input.status === "Closed" && !actor.permissions.has("escalations:close") && !actor.permissions.has("escalations:manage:any")) throw new ApiError(403, "PERMISSION_DENIED", "You cannot close escalations.");
  if (current.ownerId !== actor.userId && !actor.permissions.has("escalations:assign") && !actor.permissions.has("escalations:manage:any")) throw new ApiError(403, "PERMISSION_DENIED", "Only the owner or an authorized lead can change this status.");
  const [updated] = await db.transaction(async (transaction) => {
    const now = new Date();
    const records = await transaction.update(escalations).set({ status: input.status, resolvedAt: input.status === "Resolved" ? now : input.status === "Reopened" ? null : current.resolvedAt, closedAt: input.status === "Closed" ? now : input.status === "Reopened" ? null : current.closedAt, updatedAt: now }).where(eq(escalations.id, id)).returning();
    await transaction.insert(escalationActivity).values({ escalationId: id, actorId: actor.userId, action: "status-changed", previousValue: { status: current.status }, newValue: { status: input.status }, reason: input.reason ?? null });
    await appendAudit(transaction, { actor, action: "escalation.status_changed", entityType: "escalation", entityId: id, previousValue: { status: current.status }, newValue: { status: input.status }, reason: input.reason, requestId: request.requestId, ipAddress: request.ip });
    return records;
  });
  response.json({ data: updated });
});

router.post("/:id/assign", requirePermission("escalations:assign"), async (request, response) => {
  const id = uuid.parse(request.params.id);
  const input = parseBody(request, assignSchema);
  const actor = request.auth!;
  const current = await requireAccess(id, actor);
  const [owner] = await db.select({ id: users.id, department: users.department }).from(users).where(and(eq(users.id, input.ownerId), eq(users.accountStatus, "active"))).limit(1);
  if (!owner) throw new ApiError(400, "OWNER_INVALID", "Select an active owner.");
  const [updated] = await db.transaction(async (transaction) => {
    const records = await transaction.update(escalations).set({ ownerId: owner.id, responsibleDepartment: owner.department, updatedAt: new Date() }).where(eq(escalations.id, id)).returning();
    await transaction.insert(escalationOwnershipHistory).values({ escalationId: id, ownerId: owner.id, assignedBy: actor.userId, reason: input.reason });
    await transaction.insert(escalationActivity).values({ escalationId: id, actorId: actor.userId, action: "owner-transferred", previousValue: { ownerId: current.ownerId }, newValue: { ownerId: owner.id }, reason: input.reason });
    await transaction.insert(notifications).values({ userId: owner.id, channel: "email", templateKey: "escalation.assigned", payload: { escalationId: id, reference: current.reference } });
    await appendAudit(transaction, { actor, action: "escalation.assigned", entityType: "escalation", entityId: id, previousValue: { ownerId: current.ownerId }, newValue: { ownerId: owner.id }, reason: input.reason, requestId: request.requestId, ipAddress: request.ip });
    return records;
  });
  response.json({ data: updated });
});

router.post("/:id/tier", requirePermission("escalations:tier:2"), async (request, response) => {
  const id = uuid.parse(request.params.id);
  const input = parseBody(request, tierSchema);
  const actor = request.auth!;
  const current = await requireAccess(id, actor);
  if (input.tier !== current.tier + 1) throw new ApiError(409, "ESCALATION_TIER_INVALID", "Escalation tiers can only increase one level at a time.");
  const permission = requiredPermissionForTier(input.tier);
  if (permission && !actor.permissions.has(permission) && !actor.permissions.has("escalations:manage:any")) throw new ApiError(403, "PERMISSION_DENIED", `You cannot increase an escalation to tier ${input.tier}.`);
  const [updated] = await db.transaction(async (transaction) => {
    const records = await transaction.update(escalations).set({ tier: input.tier, updatedAt: new Date() }).where(eq(escalations.id, id)).returning();
    await transaction.insert(escalationActivity).values({ escalationId: id, actorId: actor.userId, action: "tier-increased", previousValue: { tier: current.tier }, newValue: { tier: input.tier }, reason: input.reason });
    await appendAudit(transaction, { actor, action: "escalation.tier_increased", entityType: "escalation", entityId: id, previousValue: { tier: current.tier }, newValue: { tier: input.tier }, reason: input.reason, requestId: request.requestId, ipAddress: request.ip });
    return records;
  });
  response.json({ data: updated });
});

router.post("/:id/comments", requirePermission("escalations:comment"), async (request, response) => {
  const id = uuid.parse(request.params.id);
  const input = parseBody(request, commentSchema);
  const actor = request.auth!;
  await requireAccess(id, actor);
  const [comment] = await db.transaction(async (transaction) => {
    const records = await transaction.insert(escalationComments).values({ escalationId: id, authorId: actor.userId, body: input.body, visibility: input.visibility }).returning();
    const created = records[0]!;
    await transaction.insert(escalationActivity).values({ escalationId: id, actorId: actor.userId, action: "comment-added", newValue: { commentId: created.id, visibility: created.visibility } });
    await appendAudit(transaction, { actor, action: "escalation.comment_added", entityType: "escalation", entityId: id, newValue: { commentId: created.id, visibility: created.visibility }, requestId: request.requestId, ipAddress: request.ip });
    return records;
  });
  response.status(201).json({ data: comment });
});

export { router as escalationRouter };
