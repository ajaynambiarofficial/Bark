import { Router } from "express";
import { and, asc, desc, eq, gt, ilike, inArray, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { applicationSettings, assignmentRules, auditEvents, clinics, featureFlags, permissions, rolePermissions, roles, sessions, slaPolicies, userClinics, userPermissions, users } from "../db/schema.js";
import { hashPassword } from "../auth/password.js";
import { requireClearance, requirePermission } from "../middleware/auth.js";
import { ApiError } from "../lib/errors.js";
import { parseBody, parseQuery } from "../lib/validation.js";
import { appendAudit } from "../services/audit.service.js";

const router = Router();
const uuid = z.string().uuid();
const clinicScopedRoles = new Set(["clinic-front-desk", "clinic-manager", "doctor", "groomer", "zonal-head"]);
const reason = z.string().trim().min(3).max(1000);
const listSchema = z.object({ search: z.string().trim().max(120).optional(), status: z.enum(["active", "inactive", "suspended"]).optional(), roleId: uuid.optional(), limit: z.coerce.number().int().min(1).max(100).default(30), offset: z.coerce.number().int().min(0).default(0) });
const userCreateSchema = z.object({ employeeCode: z.string().trim().min(2).max(80), email: z.string().trim().email().transform((value) => value.toLowerCase()), displayName: z.string().trim().min(2).max(160), password: z.string().min(14).max(1024), roleId: uuid, department: z.string().trim().min(2).max(120), assignment: z.string().trim().min(2).max(160), clearanceLevel: z.number().int().min(1).max(100).optional(), clinicIds: z.array(uuid).max(100).default([]) });
const userUpdateSchema = z.object({ displayName: z.string().trim().min(2).max(160).optional(), roleId: uuid.optional(), department: z.string().trim().min(2).max(120).optional(), assignment: z.string().trim().min(2).max(160).optional(), accountStatus: z.enum(["active", "inactive", "suspended"]).optional(), clearanceLevel: z.number().int().min(1).max(100).optional(), clinicIds: z.array(uuid).max(100).optional(), reason });
const roleSchema = z.object({ key: z.string().trim().regex(/^[a-z][a-z0-9-]{1,62}$/), name: z.string().trim().min(2).max(120), description: z.string().trim().max(1000).default(""), clearanceLevel: z.number().int().min(1).max(100), permissionKeys: z.array(z.string().min(1)).default([]) });
const clinicSchema = z.object({ code: z.string().trim().min(2).max(40), name: z.string().trim().min(2).max(160), address: z.string().trim().max(1000).default(""), timezone: z.string().trim().min(3).max(80).default("Asia/Calcutta"), phone: z.string().trim().max(30).optional(), email: z.string().trim().email().optional(), operatingHours: z.record(z.string(), z.unknown()).default({}), settings: z.record(z.string(), z.unknown()).default({}) });
const slaSchema = z.object({ name: z.string().trim().min(2).max(120), issueType: z.enum(["standard", "escalation"]), category: z.string().trim().max(80).optional(), priority: z.enum(["Standard", "P1", "P2", "P3"]), targetMinutes: z.number().int().min(1).max(525_600), active: z.boolean().default(true) });
const ruleSchema = z.object({ name: z.string().trim().min(2).max(160), category: z.string().trim().min(2).max(80), clinicId: uuid.optional(), ownerId: uuid.optional(), team: z.string().trim().max(120).optional(), priority: z.number().int().min(1).max(10_000).default(100), active: z.boolean().default(true) });

async function assertAssignableRole(roleId: string, actorClearance: number) {
  const [role] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  if (!role?.active) throw new ApiError(400, "ROLE_INVALID", "Select an active role.");
  if (role.clearanceLevel >= actorClearance && actorClearance < 100) throw new ApiError(403, "ROLE_ESCALATION_DENIED", "You cannot assign a role at or above your own clearance.");
  return role;
}

router.use(requireClearance(90));

router.get("/users", requirePermission("admin:users"), async (request, response) => {
  const input = parseQuery(request, listSchema);
  const records = await db.select({ id: users.id, employeeCode: users.employeeCode, email: users.email, displayName: users.displayName, department: users.department, assignment: users.assignment, accountStatus: users.accountStatus, clearanceLevel: users.clearanceLevel, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt, role: { id: roles.id, key: roles.key, name: roles.name, clearanceLevel: roles.clearanceLevel } }).from(users).innerJoin(roles, eq(users.roleId, roles.id)).where(and(...(input.status ? [eq(users.accountStatus, input.status)] : []), ...(input.roleId ? [eq(users.roleId, input.roleId)] : []), ...(input.search ? [or(ilike(users.displayName, `%${input.search}%`), ilike(users.email, `%${input.search}%`), ilike(users.employeeCode, `%${input.search}%`))!] : []))).orderBy(asc(users.displayName)).limit(input.limit).offset(input.offset);
  response.json({ data: records, meta: { limit: input.limit, offset: input.offset, returned: records.length } });
});

router.post("/users", requirePermission("admin:users"), async (request, response) => {
  const input = parseBody(request, userCreateSchema);
  const actor = request.auth!;
  const role = await assertAssignableRole(input.roleId, actor.clearanceLevel);
  const requestedClearance = input.clearanceLevel ?? role.clearanceLevel;
  if (actor.clearanceLevel < 100 && requestedClearance >= actor.clearanceLevel) throw new ApiError(403, "CLEARANCE_ESCALATION_DENIED", "You cannot assign clearance at or above your own level.");
  const clinicIds = [...new Set(input.clinicIds)];
  if (clinicScopedRoles.has(role.key) && !clinicIds.length) throw new ApiError(400, "CLINIC_ACCESS_REQUIRED", "Assign at least one clinic to this role.");
  if (clinicIds.length) {
    const activeClinics = await db.select({ id: clinics.id }).from(clinics).where(and(inArray(clinics.id, clinicIds), eq(clinics.active, true)));
    if (activeClinics.length !== clinicIds.length) throw new ApiError(400, "CLINIC_INVALID", "Select active clinics for the user's access.");
  }
  const passwordHash = await hashPassword(input.password);
  const created = await db.transaction(async (transaction) => {
    const [user] = await transaction.insert(users).values({ employeeCode: input.employeeCode, email: input.email, displayName: input.displayName, passwordHash, roleId: role.id, department: input.department, assignment: input.assignment, clearanceLevel: requestedClearance }).returning({ id: users.id, employeeCode: users.employeeCode, email: users.email, displayName: users.displayName, roleId: users.roleId, accountStatus: users.accountStatus, clearanceLevel: users.clearanceLevel });
    if (!user) throw new ApiError(500, "USER_CREATE_FAILED", "The user could not be created.");
    if (clinicIds.length) await transaction.insert(userClinics).values(clinicIds.map((clinicId) => ({ userId: user.id, clinicId, accessLevel: "manage" })));
    await appendAudit(transaction, { actor, action: "admin.user_created", entityType: "user", entityId: user.id, newValue: { employeeCode: user.employeeCode, roleId: user.roleId, accountStatus: user.accountStatus, clearanceLevel: user.clearanceLevel, clinicIds }, requestId: request.requestId, ipAddress: request.ip });
    return user;
  });
  response.status(201).json({ data: created });
});

router.patch("/users/:id", requirePermission("admin:users"), async (request, response) => {
  const id = uuid.parse(request.params.id);
  const input = parseBody(request, userUpdateSchema);
  const actor = request.auth!;
  const [current] = await db.select({ user: users, role: roles }).from(users).innerJoin(roles, eq(users.roleId, roles.id)).where(eq(users.id, id)).limit(1);
  if (!current) throw new ApiError(404, "USER_NOT_FOUND", "The user was not found.");
  if (current.role.clearanceLevel >= actor.clearanceLevel && current.user.id !== actor.userId && actor.clearanceLevel < 100) throw new ApiError(403, "CLEARANCE_DENIED", "You cannot modify this account.");
  if (id === actor.userId && input.accountStatus && input.accountStatus !== "active") throw new ApiError(409, "SELF_SUSPEND_DENIED", "You cannot suspend your current account.");
  if (id === actor.userId && input.clearanceLevel !== undefined && input.clearanceLevel !== current.user.clearanceLevel) throw new ApiError(409, "SELF_CLEARANCE_CHANGE_DENIED", "You cannot change your own clearance.");
  if (actor.clearanceLevel < 100 && input.clearanceLevel !== undefined && input.clearanceLevel >= actor.clearanceLevel) throw new ApiError(403, "CLEARANCE_ESCALATION_DENIED", "You cannot assign clearance at or above your own level.");
  const nextRole = input.roleId ? await assertAssignableRole(input.roleId, actor.clearanceLevel) : current.role;
  const { reason: changeReason, clinicIds, ...changes } = input;
  const normalizedClinicIds = clinicIds ? [...new Set(clinicIds)] : undefined;
  const effectiveClinics = normalizedClinicIds ?? (await db.select({ clinicId: userClinics.clinicId }).from(userClinics).where(eq(userClinics.userId, id))).map((row) => row.clinicId);
  if (clinicScopedRoles.has(nextRole.key) && !effectiveClinics.length) throw new ApiError(400, "CLINIC_ACCESS_REQUIRED", "Assign at least one clinic to this role.");
  if (normalizedClinicIds?.length) {
    const activeClinics = await db.select({ id: clinics.id }).from(clinics).where(and(inArray(clinics.id, normalizedClinicIds), eq(clinics.active, true)));
    if (activeClinics.length !== normalizedClinicIds.length) throw new ApiError(400, "CLINIC_INVALID", "Select active clinics for the user's access.");
  }
  const updated = await db.transaction(async (transaction) => {
    const [user] = await transaction.update(users).set({ ...changes, deactivatedAt: changes.accountStatus && changes.accountStatus !== "active" ? new Date() : changes.accountStatus === "active" ? null : current.user.deactivatedAt, updatedAt: new Date() }).where(eq(users.id, id)).returning({ id: users.id, employeeCode: users.employeeCode, roleId: users.roleId, accountStatus: users.accountStatus, clearanceLevel: users.clearanceLevel, displayName: users.displayName, department: users.department, assignment: users.assignment });
    if (normalizedClinicIds) {
      await transaction.delete(userClinics).where(eq(userClinics.userId, id));
      if (normalizedClinicIds.length) await transaction.insert(userClinics).values(normalizedClinicIds.map((clinicId) => ({ userId: id, clinicId, accessLevel: "manage" })));
    }
    if (changes.accountStatus && changes.accountStatus !== "active") await transaction.update(sessions).set({ revokedAt: new Date(), revokedReason: `Account ${changes.accountStatus}` }).where(and(eq(sessions.userId, id), isNull(sessions.revokedAt)));
    await appendAudit(transaction, { actor, action: "admin.user_updated", entityType: "user", entityId: id, previousValue: { roleId: current.user.roleId, accountStatus: current.user.accountStatus, clearanceLevel: current.user.clearanceLevel }, newValue: { ...changes, clinicIds: normalizedClinicIds }, reason: changeReason, requestId: request.requestId, ipAddress: request.ip });
    return user;
  });
  response.json({ data: updated });
});

router.post("/users/:id/revoke-sessions", requirePermission("admin:emergency"), async (request, response) => {
  const id = uuid.parse(request.params.id);
  const input = parseBody(request, z.object({ reason }));
  const actor = request.auth!;
  if (id === actor.userId) throw new ApiError(409, "SELF_REVOKE_DENIED", "Use logout-all to revoke your own sessions.");
  const [target] = await db.select({ clearanceLevel: users.clearanceLevel }).from(users).where(eq(users.id, id)).limit(1);
  if (!target) throw new ApiError(404, "USER_NOT_FOUND", "The user was not found.");
  if (actor.clearanceLevel < 100 && target.clearanceLevel >= actor.clearanceLevel) throw new ApiError(403, "CLEARANCE_DENIED", "You cannot revoke sessions for this account.");
  await db.transaction(async (transaction) => {
    await transaction.update(sessions).set({ revokedAt: new Date(), revokedReason: input.reason }).where(and(eq(sessions.userId, id), isNull(sessions.revokedAt)));
    await appendAudit(transaction, { actor, action: "admin.sessions_revoked", entityType: "user", entityId: id, reason: input.reason, requestId: request.requestId, ipAddress: request.ip });
  });
  response.status(204).end();
});

router.get("/roles", requirePermission("admin:roles"), async (_request, response) => {
  const [roleRows, permissionRows, grants] = await Promise.all([db.select().from(roles).orderBy(desc(roles.clearanceLevel)), db.select().from(permissions).orderBy(asc(permissions.module), asc(permissions.key)), db.select({ roleId: rolePermissions.roleId, permissionKey: permissions.key }).from(rolePermissions).innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))]);
  response.json({ data: roleRows.map((role) => ({ ...role, permissionKeys: grants.filter((grant) => grant.roleId === role.id).map((grant) => grant.permissionKey) })), meta: { permissions: permissionRows } });
});

router.post("/roles", requirePermission("admin:roles"), async (request, response) => {
  const input = parseBody(request, roleSchema);
  const actor = request.auth!;
  if (input.clearanceLevel >= actor.clearanceLevel) throw new ApiError(403, "ROLE_ESCALATION_DENIED", "New roles must have lower clearance than the creating administrator.");
  const created = await db.transaction(async (transaction) => {
    const [role] = await transaction.insert(roles).values({ key: input.key, name: input.name, description: input.description, clearanceLevel: input.clearanceLevel }).returning();
    if (!role) throw new ApiError(500, "ROLE_CREATE_FAILED", "The role could not be created.");
    if (input.permissionKeys.length) {
      const permissionRows = await transaction.select().from(permissions).where(inArray(permissions.key, input.permissionKeys));
      if (permissionRows.length !== new Set(input.permissionKeys).size) throw new ApiError(400, "PERMISSION_INVALID", "One or more permissions are invalid.");
      await transaction.insert(rolePermissions).values(permissionRows.map((permission) => ({ roleId: role.id, permissionId: permission.id })));
    }
    await appendAudit(transaction, { actor, action: "admin.role_created", entityType: "role", entityId: role.id, newValue: { key: role.key, clearanceLevel: role.clearanceLevel, permissionKeys: input.permissionKeys }, requestId: request.requestId, ipAddress: request.ip });
    return role;
  });
  response.status(201).json({ data: created });
});

router.get("/clinics", requirePermission("clinics:view"), async (_request, response) => response.json({ data: await db.select().from(clinics).orderBy(asc(clinics.name)) }));

router.post("/clinics", requirePermission("clinics:manage"), async (request, response) => {
  const input = parseBody(request, clinicSchema);
  const actor = request.auth!;
  const [created] = await db.transaction(async (transaction) => {
    const records = await transaction.insert(clinics).values({ ...input, phone: input.phone ?? null, email: input.email ?? null }).returning();
    const clinic = records[0]!;
    await appendAudit(transaction, { actor, action: "admin.clinic_created", entityType: "clinic", entityId: clinic.id, newValue: { code: clinic.code, name: clinic.name, timezone: clinic.timezone }, requestId: request.requestId, ipAddress: request.ip });
    return records;
  });
  response.status(201).json({ data: created });
});

router.patch("/clinics/:id", requirePermission("clinics:manage"), async (request, response) => {
  const id = uuid.parse(request.params.id);
  const input = parseBody(request, clinicSchema.partial().extend({ reason }));
  const actor = request.auth!;
  const [current] = await db.select().from(clinics).where(eq(clinics.id, id)).limit(1);
  if (!current) throw new ApiError(404, "CLINIC_NOT_FOUND", "The clinic was not found.");
  const { reason: changeReason, ...changes } = input;
  const [updated] = await db.transaction(async (transaction) => {
    const records = await transaction.update(clinics).set({ ...changes, updatedAt: new Date() }).where(eq(clinics.id, id)).returning();
    await appendAudit(transaction, { actor, action: "admin.clinic_updated", entityType: "clinic", entityId: id, previousValue: { code: current.code, name: current.name, active: current.active, settings: current.settings }, newValue: changes, reason: changeReason, requestId: request.requestId, ipAddress: request.ip });
    return records;
  });
  response.json({ data: updated });
});

router.get("/workflows", requirePermission("admin:workflows"), async (_request, response) => {
  const [policies, rules] = await Promise.all([db.select().from(slaPolicies).orderBy(asc(slaPolicies.name)), db.select().from(assignmentRules).orderBy(asc(assignmentRules.priority))]);
  response.json({ data: { slaPolicies: policies, assignmentRules: rules } });
});

router.post("/workflows/sla-policies", requirePermission("admin:workflows"), async (request, response) => {
  const input = parseBody(request, slaSchema);
  const actor = request.auth!;
  const [created] = await db.transaction(async (transaction) => {
    const records = await transaction.insert(slaPolicies).values({ ...input, category: input.category ?? null }).returning();
    const policy = records[0]!;
    await appendAudit(transaction, { actor, action: "admin.sla_policy_created", entityType: "sla_policy", entityId: policy.id, newValue: { name: policy.name, issueType: policy.issueType, category: policy.category, priority: policy.priority, targetMinutes: policy.targetMinutes }, requestId: request.requestId, ipAddress: request.ip });
    return records;
  });
  response.status(201).json({ data: created });
});

router.post("/workflows/assignment-rules", requirePermission("admin:workflows"), async (request, response) => {
  const input = parseBody(request, ruleSchema);
  const actor = request.auth!;
  const [created] = await db.transaction(async (transaction) => {
    const records = await transaction.insert(assignmentRules).values({ ...input, clinicId: input.clinicId ?? null, ownerId: input.ownerId ?? null, team: input.team ?? null }).returning();
    const rule = records[0]!;
    await appendAudit(transaction, { actor, action: "admin.assignment_rule_created", entityType: "assignment_rule", entityId: rule.id, newValue: { name: rule.name, category: rule.category, clinicId: rule.clinicId, ownerId: rule.ownerId, priority: rule.priority }, requestId: request.requestId, ipAddress: request.ip });
    return records;
  });
  response.status(201).json({ data: created });
});

router.get("/settings", requirePermission("admin:settings"), async (_request, response) => {
  const [settings, flags] = await Promise.all([db.select({ key: applicationSettings.key, value: applicationSettings.value, description: applicationSettings.description, secret: applicationSettings.secret, updatedAt: applicationSettings.updatedAt }).from(applicationSettings).where(eq(applicationSettings.secret, false)), db.select().from(featureFlags).orderBy(asc(featureFlags.key))]);
  response.json({ data: { settings, featureFlags: flags } });
});

router.put("/settings/:key", requirePermission("admin:settings"), async (request, response) => {
  const key = z.string().regex(/^[a-z][a-z0-9._-]{1,118}$/).parse(request.params.key);
  const input = parseBody(request, z.object({ value: z.unknown(), description: z.string().trim().max(1000).default(""), secret: z.boolean().default(false), reason }));
  if (input.secret) throw new ApiError(400, "SECRET_STORAGE_UNSUPPORTED", "Integration secrets must be stored in the deployment secret manager, not application settings.");
  const actor = request.auth!;
  const [current] = await db.select().from(applicationSettings).where(eq(applicationSettings.key, key)).limit(1);
  const [updated] = await db.transaction(async (transaction) => {
    const records = await transaction.insert(applicationSettings).values({ key, value: input.value, description: input.description, secret: input.secret, updatedBy: actor.userId }).onConflictDoUpdate({ target: applicationSettings.key, set: { value: input.value, description: input.description, secret: input.secret, updatedBy: actor.userId, updatedAt: new Date() } }).returning({ key: applicationSettings.key, value: applicationSettings.value, description: applicationSettings.description, secret: applicationSettings.secret, updatedAt: applicationSettings.updatedAt });
    await appendAudit(transaction, { actor, action: "admin.setting_updated", entityType: "application_setting", entityId: key, previousValue: current ? { value: current.secret ? "[SECRET]" : current.value, description: current.description, secret: current.secret } : undefined, newValue: { value: input.secret ? "[SECRET]" : input.value, description: input.description, secret: input.secret }, reason: input.reason, requestId: request.requestId, ipAddress: request.ip });
    return records;
  });
  response.json({ data: updated });
});

router.put("/feature-flags/:key", requirePermission("admin:settings"), async (request, response) => {
  const key = z.string().regex(/^[a-z][a-z0-9._-]{1,118}$/).parse(request.params.key);
  const input = parseBody(request, z.object({ enabled: z.boolean(), description: z.string().trim().max(1000).default(""), rules: z.record(z.string(), z.unknown()).default({}), reason }));
  const actor = request.auth!;
  const [current] = await db.select().from(featureFlags).where(eq(featureFlags.key, key)).limit(1);
  const [updated] = await db.transaction(async (transaction) => {
    const records = await transaction.insert(featureFlags).values({ key, enabled: input.enabled, description: input.description, rules: input.rules, updatedBy: actor.userId }).onConflictDoUpdate({ target: featureFlags.key, set: { enabled: input.enabled, description: input.description, rules: input.rules, updatedBy: actor.userId, updatedAt: new Date() } }).returning();
    await appendAudit(transaction, { actor, action: input.enabled ? "admin.feature_enabled" : "admin.feature_disabled", entityType: "feature_flag", entityId: key, previousValue: current ? { enabled: current.enabled, rules: current.rules } : undefined, newValue: { enabled: input.enabled, rules: input.rules }, reason: input.reason, requestId: request.requestId, ipAddress: request.ip });
    return records;
  });
  response.json({ data: updated });
});

router.get("/audit-events", requirePermission("admin:audit"), async (request, response) => {
  const input = parseQuery(request, z.object({ actorId: uuid.optional(), action: z.string().trim().max(100).optional(), entityType: z.string().trim().max(80).optional(), entityId: z.string().trim().max(100).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional(), limit: z.coerce.number().int().min(1).max(100).default(50), offset: z.coerce.number().int().min(0).default(0) }));
  const records = await db.select().from(auditEvents).where(and(...(input.actorId ? [eq(auditEvents.actorId, input.actorId)] : []), ...(input.action ? [eq(auditEvents.action, input.action)] : []), ...(input.entityType ? [eq(auditEvents.entityType, input.entityType)] : []), ...(input.entityId ? [eq(auditEvents.entityId, input.entityId)] : []), ...(input.from ? [gt(auditEvents.createdAt, input.from)] : []), ...(input.to ? [lt(auditEvents.createdAt, input.to)] : []))).orderBy(desc(auditEvents.createdAt)).limit(input.limit).offset(input.offset);
  response.json({ data: records, meta: { limit: input.limit, offset: input.offset, returned: records.length, immutable: true } });
});

export { router as adminRouter };
