import { Router } from "express";
import { aliasedTable, and, asc, desc, eq, gt, ilike, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { applicationSettings, assignmentRules, auditEvents, clinicServices, clinics, escalations, featureFlags, offers, permissions, rolePermissions, roles, services, sessions, slaPolicies, userClinics, userPermissions, users } from "../db/schema.js";
import { hashPassword } from "../auth/password.js";
import { requireClearance, requirePermission } from "../middleware/auth.js";
import { ApiError } from "../lib/errors.js";
import { parseBody, parseQuery } from "../lib/validation.js";
import { appendAudit } from "../services/audit.service.js";

const router = Router();
const adminEscalationReporter = aliasedTable(users, "admin_escalation_reporter");
const adminEscalationReporterRole = aliasedTable(roles, "admin_escalation_reporter_role");
const adminEscalationOwner = aliasedTable(users, "admin_escalation_owner");
const adminEscalationOwnerRole = aliasedTable(roles, "admin_escalation_owner_role");
const uuid = z.string().uuid();
const clinicScopedRoles = new Set(["clinic-front-desk", "clinic-manager", "doctor", "groomer", "zonal-head"]);
const reason = z.string().trim().min(3).max(1000);
const listSchema = z.object({ search: z.string().trim().max(120).optional(), status: z.enum(["active", "inactive", "suspended"]).optional(), roleId: uuid.optional(), limit: z.coerce.number().int().min(1).max(100).default(30), offset: z.coerce.number().int().min(0).default(0) });
const dashboardListSchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(100), offset: z.coerce.number().int().min(0).default(0) });
const userCreateSchema = z.object({ employeeCode: z.string().trim().min(2).max(80), email: z.string().trim().email().transform((value) => value.toLowerCase()), displayName: z.string().trim().min(2).max(160), password: z.string().min(14).max(1024), roleId: uuid, department: z.string().trim().min(2).max(120), assignment: z.string().trim().min(2).max(160), clearanceLevel: z.number().int().min(1).max(100).optional(), clinicIds: z.array(uuid).max(100).default([]) });
const userUpdateSchema = z.object({ employeeCode: z.string().trim().min(2).max(80).optional(), email: z.string().trim().email().transform((value) => value.toLowerCase()).optional(), displayName: z.string().trim().min(2).max(160).optional(), contactPhone: z.string().trim().max(40).nullable().optional(), profileBio: z.string().trim().max(500).nullable().optional(), roleId: uuid.optional(), department: z.string().trim().min(2).max(120).optional(), assignment: z.string().trim().min(2).max(160).optional(), accountStatus: z.enum(["active", "inactive", "suspended"]).optional(), clearanceLevel: z.number().int().min(1).max(100).optional(), clinicIds: z.array(uuid).max(100).optional(), reason });
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

router.get("/escalation-dashboard", requirePermission("admin:users"), async (request, response) => {
  const input = parseQuery(request, dashboardListSchema);
  const records = await db.select({
    escalation: escalations,
    reporter: { id: adminEscalationReporter.id, displayName: adminEscalationReporter.displayName, department: adminEscalationReporter.department, roleLabel: adminEscalationReporterRole.name },
    owner: { id: adminEscalationOwner.id, displayName: adminEscalationOwner.displayName, department: adminEscalationOwner.department, roleLabel: adminEscalationOwnerRole.name },
    clinic: { id: clinics.id, name: clinics.name },
  }).from(escalations)
    .innerJoin(adminEscalationReporter, eq(escalations.reporterId, adminEscalationReporter.id))
    .innerJoin(adminEscalationReporterRole, eq(adminEscalationReporter.roleId, adminEscalationReporterRole.id))
    .innerJoin(adminEscalationOwner, eq(escalations.ownerId, adminEscalationOwner.id))
    .innerJoin(adminEscalationOwnerRole, eq(adminEscalationOwner.roleId, adminEscalationOwnerRole.id))
    .leftJoin(clinics, eq(escalations.clinicId, clinics.id))
    .where(isNull(escalations.deletedAt)).orderBy(desc(escalations.updatedAt)).limit(input.limit).offset(input.offset);
  response.json({ data: records, meta: { limit: input.limit, offset: input.offset, returned: records.length } });
});

router.get("/configuration/catalog", requirePermission("admin:settings"), async (_request, response) => {
  const [clinicRows, serviceRows] = await Promise.all([
    db.select({ id: clinics.id, code: clinics.code, name: clinics.name, active: clinics.active }).from(clinics).orderBy(asc(clinics.name)),
    db.select({ id: services.id, sku: services.sku, name: services.name, description: services.description, category: services.category, durationMinutes: services.durationMinutes, basePrice: services.basePrice, active: services.active }).from(services).orderBy(asc(services.name)),
  ]);
  const clinicServiceRows = await db.select({ clinicId: clinicServices.clinicId, serviceId: clinicServices.serviceId, active: clinicServices.active, price: clinicServices.price, durationMinutes: clinicServices.durationMinutes }).from(clinicServices);
  response.json({ data: { clinics: clinicRows, services: serviceRows.map((service) => ({ ...service, clinicSettings: Object.fromEntries(clinicServiceRows.filter((row) => row.serviceId === service.id).map((row) => [row.clinicId, { active: row.active, price: row.price, durationMinutes: row.durationMinutes }])) })) } });
});

const clinicSettingsSchema = z.record(uuid, z.object({ active: z.boolean(), price: z.number().min(0).max(1_000_000).nullable(), durationMinutes: z.number().int().min(1).max(1440).nullable() }));
const serviceInputSchema = z.object({ sku: z.string().trim().min(2).max(80).transform((value) => value.toUpperCase()), name: z.string().trim().min(2).max(200), description: z.string().trim().max(2000).default(""), category: z.string().trim().min(2).max(80), durationMinutes: z.number().int().min(1).max(1440), basePrice: z.number().min(0).max(1_000_000), active: z.boolean().default(true), clinicSettings: clinicSettingsSchema, reason });
const offerInputSchema = z.object({ code: z.string().trim().min(2).max(64).regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/).transform((value) => value.toUpperCase()), name: z.string().trim().min(2).max(160), description: z.string().trim().max(1000).default(""), discountType: z.enum(["percent", "amount"]), discountValue: z.number().positive().max(1_000_000), minimumSubtotal: z.number().min(0).max(1_000_000).default(0), clinicId: uuid.nullable().default(null), startsAt: z.coerce.date().nullable().default(null), endsAt: z.coerce.date().nullable().default(null), active: z.boolean().default(true), reason }).superRefine((input, context) => {
  if (input.discountType === "percent" && input.discountValue > 100) context.addIssue({ code: "custom", path: ["discountValue"], message: "Percentage offers cannot exceed 100%." });
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) context.addIssue({ code: "custom", path: ["endsAt"], message: "The end time must be after the start time." });
});

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function saveClinicServiceSettings(transaction: DbTransaction, serviceId: string, settings: z.infer<typeof clinicSettingsSchema>) {
  for (const [clinicId, setting] of Object.entries(settings)) {
    const [clinic] = await transaction.select({ id: clinics.id, active: clinics.active }).from(clinics).where(eq(clinics.id, clinicId)).limit(1);
    if (!clinic) throw new ApiError(400, "CLINIC_INVALID", "A clinic configuration references an unknown clinic.");
    if (setting.active && !clinic.active) throw new ApiError(400, "CLINIC_INACTIVE", "Services cannot be enabled at an inactive clinic.");
    await transaction.insert(clinicServices).values({ clinicId, serviceId, active: setting.active, price: setting.price === null ? null : setting.price.toFixed(2), durationMinutes: setting.durationMinutes })
      .onConflictDoUpdate({ target: [clinicServices.clinicId, clinicServices.serviceId], set: { active: setting.active, price: setting.price === null ? null : setting.price.toFixed(2), durationMinutes: setting.durationMinutes } });
  }
}

router.post("/configuration/services", requirePermission("admin:settings"), async (request, response) => {
  const input = parseBody(request, serviceInputSchema);
  const actor = request.auth!;
  const [duplicate] = await db.select({ id: services.id }).from(services).where(eq(sql`lower(${services.sku})`, input.sku.toLowerCase())).limit(1);
  if (duplicate) throw new ApiError(409, "SERVICE_SKU_IN_USE", "That service code is already in use.");
  const created = await db.transaction(async (transaction) => {
    const [service] = await transaction.insert(services).values({ sku: input.sku, name: input.name, description: input.description, category: input.category, durationMinutes: input.durationMinutes, basePrice: input.basePrice.toFixed(2), active: input.active }).returning();
    if (!service) throw new ApiError(500, "SERVICE_CREATE_FAILED", "The service could not be created.");
    await saveClinicServiceSettings(transaction, service.id, input.clinicSettings);
    await appendAudit(transaction, { actor, action: "admin.service_created", entityType: "service", entityId: service.id, newValue: { sku: service.sku, name: service.name, category: service.category, active: service.active, clinicSettings: input.clinicSettings }, reason: input.reason, requestId: request.requestId, ipAddress: request.ip });
    return service;
  });
  response.status(201).json({ data: created });
});

router.put("/configuration/services/:id", requirePermission("admin:settings"), async (request, response) => {
  const id = uuid.parse(request.params.id);
  const input = parseBody(request, serviceInputSchema.omit({ sku: true }));
  const actor = request.auth!;
  const [current] = await db.select().from(services).where(eq(services.id, id)).limit(1);
  if (!current) throw new ApiError(404, "SERVICE_NOT_FOUND", "The service was not found.");
  const previousClinicSettings = await db.select({ clinicId: clinicServices.clinicId, active: clinicServices.active, price: clinicServices.price, durationMinutes: clinicServices.durationMinutes }).from(clinicServices).where(eq(clinicServices.serviceId, id));
  const [updated] = await db.transaction(async (transaction) => {
    const rows = await transaction.update(services).set({ name: input.name, description: input.description, category: input.category, durationMinutes: input.durationMinutes, basePrice: input.basePrice.toFixed(2), active: input.active, updatedAt: new Date() }).where(eq(services.id, id)).returning();
    await saveClinicServiceSettings(transaction, id, input.clinicSettings);
    await appendAudit(transaction, { actor, action: "admin.service_configured", entityType: "service", entityId: id, previousValue: { sku: current.sku, name: current.name, description: current.description, category: current.category, durationMinutes: current.durationMinutes, basePrice: current.basePrice, active: current.active, clinicSettings: previousClinicSettings }, newValue: { name: input.name, description: input.description, category: input.category, durationMinutes: input.durationMinutes, basePrice: input.basePrice, clinicSettings: input.clinicSettings, active: input.active }, reason: input.reason, requestId: request.requestId, ipAddress: request.ip });
    return rows;
  });
  response.json({ data: updated });
});

router.get("/configuration/offers", requirePermission("admin:settings"), async (_request, response) => {
  const rows = await db.select({ offer: offers, clinicName: clinics.name }).from(offers).leftJoin(clinics, eq(offers.clinicId, clinics.id)).orderBy(desc(offers.updatedAt));
  response.json({ data: rows.map(({ offer, clinicName }) => ({ ...offer, clinicName })) });
});

router.post("/configuration/offers", requirePermission("admin:settings"), async (request, response) => {
  const input = parseBody(request, offerInputSchema);
  const { reason: changeReason, ...offerInput } = input;
  const actor = request.auth!;
  if (input.clinicId) {
    const [clinic] = await db.select({ id: clinics.id, active: clinics.active }).from(clinics).where(eq(clinics.id, input.clinicId)).limit(1);
    if (!clinic?.active) throw new ApiError(400, "CLINIC_INVALID", "Offers can only be assigned to an active clinic.");
  }
  const duplicate = await db.select({ id: offers.id }).from(offers).where(eq(sql`lower(${offers.code})`, input.code.toLowerCase())).limit(1);
  if (duplicate.length) throw new ApiError(409, "OFFER_CODE_IN_USE", "That offer code is already in use.");
  const [created] = await db.transaction(async (transaction) => {
    const rows = await transaction.insert(offers).values({ ...offerInput, discountValue: input.discountValue.toFixed(2), minimumSubtotal: input.minimumSubtotal.toFixed(2), createdBy: actor.userId, updatedBy: actor.userId }).returning();
    const offer = rows[0]!;
    await appendAudit(transaction, { actor, action: "admin.offer_created", entityType: "offer", entityId: offer.id, newValue: { code: offer.code, name: offer.name, discountType: offer.discountType, discountValue: offer.discountValue, clinicId: offer.clinicId, active: offer.active }, reason: changeReason, requestId: request.requestId, ipAddress: request.ip });
    return rows;
  });
  response.status(201).json({ data: created });
});

router.put("/configuration/offers/:id", requirePermission("admin:settings"), async (request, response) => {
  const id = uuid.parse(request.params.id);
  const input = parseBody(request, offerInputSchema);
  const actor = request.auth!;
  const [current] = await db.select().from(offers).where(eq(offers.id, id)).limit(1);
  if (!current) throw new ApiError(404, "OFFER_NOT_FOUND", "The offer was not found.");
  if (input.clinicId) {
    const [clinic] = await db.select({ id: clinics.id, active: clinics.active }).from(clinics).where(eq(clinics.id, input.clinicId)).limit(1);
    if (!clinic?.active) throw new ApiError(400, "CLINIC_INVALID", "Offers can only be assigned to an active clinic.");
  }
  const [duplicate] = await db.select({ id: offers.id }).from(offers).where(and(eq(sql`lower(${offers.code})`, input.code.toLowerCase()), ne(offers.id, id))).limit(1);
  if (duplicate) throw new ApiError(409, "OFFER_CODE_IN_USE", "That offer code is already in use.");
  const [updated] = await db.transaction(async (transaction) => {
    const rows = await transaction.update(offers).set({ code: input.code, name: input.name, description: input.description, discountType: input.discountType, discountValue: input.discountValue.toFixed(2), minimumSubtotal: input.minimumSubtotal.toFixed(2), clinicId: input.clinicId, startsAt: input.startsAt, endsAt: input.endsAt, active: input.active, updatedBy: actor.userId, updatedAt: new Date() }).where(eq(offers.id, id)).returning();
    await appendAudit(transaction, { actor, action: "admin.offer_updated", entityType: "offer", entityId: id, previousValue: { code: current.code, name: current.name, discountType: current.discountType, discountValue: current.discountValue, minimumSubtotal: current.minimumSubtotal, clinicId: current.clinicId, startsAt: current.startsAt, endsAt: current.endsAt, active: current.active }, newValue: { code: input.code, name: input.name, discountType: input.discountType, discountValue: input.discountValue, minimumSubtotal: input.minimumSubtotal, clinicId: input.clinicId, startsAt: input.startsAt, endsAt: input.endsAt, active: input.active }, reason: input.reason, requestId: request.requestId, ipAddress: request.ip });
    return rows;
  });
  response.json({ data: updated });
});

router.put("/configuration/clinics/:id", requirePermission("admin:settings"), async (request, response) => {
  const id = uuid.parse(request.params.id);
  const input = parseBody(request, z.object({ name: z.string().trim().min(2).max(160), address: z.string().trim().max(1000), timezone: z.string().trim().min(3).max(80), phone: z.string().trim().max(30).nullable(), email: z.string().trim().email().nullable(), active: z.boolean(), reason }));
  const actor = request.auth!;
  const [current] = await db.select().from(clinics).where(eq(clinics.id, id)).limit(1);
  if (!current) throw new ApiError(404, "CLINIC_NOT_FOUND", "The clinic was not found.");
  const [updated] = await db.transaction(async (transaction) => {
    const rows = await transaction.update(clinics).set({ name: input.name, address: input.address, timezone: input.timezone, phone: input.phone, email: input.email, active: input.active, updatedAt: new Date() }).where(eq(clinics.id, id)).returning({ id: clinics.id, code: clinics.code, name: clinics.name, address: clinics.address, timezone: clinics.timezone, phone: clinics.phone, email: clinics.email, active: clinics.active });
    await appendAudit(transaction, { actor, action: "admin.clinic_configured", entityType: "clinic", entityId: id, previousValue: { name: current.name, address: current.address, timezone: current.timezone, phone: current.phone, email: current.email, active: current.active }, newValue: { name: input.name, address: input.address, timezone: input.timezone, phone: input.phone, email: input.email, active: input.active }, reason: input.reason, requestId: request.requestId, ipAddress: request.ip });
    return rows;
  });
  response.json({ data: updated });
});

router.get("/users", requirePermission("admin:users"), async (request, response) => {
  const input = parseQuery(request, listSchema);
  const records = await db.select({ id: users.id, employeeCode: users.employeeCode, email: users.email, displayName: users.displayName, contactPhone: users.contactPhone, profileBio: users.profileBio, department: users.department, assignment: users.assignment, accountStatus: users.accountStatus, clearanceLevel: users.clearanceLevel, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt, role: { id: roles.id, key: roles.key, name: roles.name, clearanceLevel: roles.clearanceLevel } }).from(users).innerJoin(roles, eq(users.roleId, roles.id)).where(and(...(input.status ? [eq(users.accountStatus, input.status)] : []), ...(input.roleId ? [eq(users.roleId, input.roleId)] : []), ...(input.search ? [or(ilike(users.displayName, `%${input.search}%`), ilike(users.email, `%${input.search}%`), ilike(users.employeeCode, `%${input.search}%`))!] : []))).orderBy(asc(users.displayName)).limit(input.limit).offset(input.offset);
  const clinicLinks = records.length ? await db.select({ userId: userClinics.userId, clinicId: userClinics.clinicId }).from(userClinics).where(inArray(userClinics.userId, records.map((record) => record.id))) : [];
  const data = records.map((record) => ({ ...record, clinicIds: clinicLinks.filter((link) => link.userId === record.id).map((link) => link.clinicId) }));
  response.json({ data, meta: { limit: input.limit, offset: input.offset, returned: records.length } });
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
  if (id === actor.userId && input.roleId && input.roleId !== current.user.roleId) throw new ApiError(409, "SELF_ROLE_CHANGE_DENIED", "You cannot change your own role.");
  if (id === actor.userId && input.clearanceLevel !== undefined && input.clearanceLevel !== current.user.clearanceLevel) throw new ApiError(409, "SELF_CLEARANCE_CHANGE_DENIED", "You cannot change your own clearance.");
  if (actor.clearanceLevel < 100 && input.clearanceLevel !== undefined && input.clearanceLevel >= actor.clearanceLevel) throw new ApiError(403, "CLEARANCE_ESCALATION_DENIED", "You cannot assign clearance at or above your own level.");
  const nextRole = input.roleId ? await assertAssignableRole(input.roleId, actor.clearanceLevel) : current.role;
  const { reason: changeReason, clinicIds, ...changes } = input;
  if (input.roleId && input.roleId !== current.user.roleId && input.clearanceLevel === undefined) changes.clearanceLevel = nextRole.clearanceLevel;
  if ((input.roleId !== undefined || input.clearanceLevel !== undefined) && (changes.clearanceLevel ?? current.user.clearanceLevel) > nextRole.clearanceLevel) {
    throw new ApiError(400, "CLEARANCE_ROLE_MISMATCH", "A user's clearance cannot exceed the clearance assigned to their role.");
  }
  if (changes.employeeCode) {
    const [duplicate] = await db.select({ id: users.id }).from(users).where(and(eq(users.employeeCode, changes.employeeCode), ne(users.id, id))).limit(1);
    if (duplicate) throw new ApiError(409, "EMPLOYEE_CODE_IN_USE", "That employee ID is already assigned to another user.");
  }
  if (changes.email) {
    const [duplicate] = await db.select({ id: users.id }).from(users).where(and(eq(sql`lower(${users.email})`, changes.email), ne(users.id, id))).limit(1);
    if (duplicate) throw new ApiError(409, "EMAIL_IN_USE", "That email address is already assigned to another user.");
  }
  const normalizedClinicIds = clinicIds ? [...new Set(clinicIds)] : undefined;
  const effectiveClinics = normalizedClinicIds ?? (await db.select({ clinicId: userClinics.clinicId }).from(userClinics).where(eq(userClinics.userId, id))).map((row) => row.clinicId);
  if (clinicScopedRoles.has(nextRole.key) && !effectiveClinics.length) throw new ApiError(400, "CLINIC_ACCESS_REQUIRED", "Assign at least one clinic to this role.");
  if (normalizedClinicIds?.length) {
    const activeClinics = await db.select({ id: clinics.id }).from(clinics).where(and(inArray(clinics.id, normalizedClinicIds), eq(clinics.active, true)));
    if (activeClinics.length !== normalizedClinicIds.length) throw new ApiError(400, "CLINIC_INVALID", "Select active clinics for the user's access.");
  }
  const updated = await db.transaction(async (transaction) => {
    const [user] = await transaction.update(users).set({ ...changes, deactivatedAt: changes.accountStatus && changes.accountStatus !== "active" ? new Date() : changes.accountStatus === "active" ? null : current.user.deactivatedAt, updatedAt: new Date() }).where(eq(users.id, id)).returning({ id: users.id, employeeCode: users.employeeCode, email: users.email, roleId: users.roleId, accountStatus: users.accountStatus, clearanceLevel: users.clearanceLevel, displayName: users.displayName, contactPhone: users.contactPhone, profileBio: users.profileBio, department: users.department, assignment: users.assignment });
    if (normalizedClinicIds) {
      await transaction.delete(userClinics).where(eq(userClinics.userId, id));
      if (normalizedClinicIds.length) await transaction.insert(userClinics).values(normalizedClinicIds.map((clinicId) => ({ userId: id, clinicId, accessLevel: "manage" })));
    }
    if (changes.accountStatus && changes.accountStatus !== "active") await transaction.update(sessions).set({ revokedAt: new Date(), revokedReason: `Account ${changes.accountStatus}` }).where(and(eq(sessions.userId, id), isNull(sessions.revokedAt)));
    await appendAudit(transaction, { actor, action: "admin.user_updated", entityType: "user", entityId: id, previousValue: { employeeCode: current.user.employeeCode, email: current.user.email, displayName: current.user.displayName, contactPhone: current.user.contactPhone, profileBio: current.user.profileBio, roleId: current.user.roleId, department: current.user.department, assignment: current.user.assignment, accountStatus: current.user.accountStatus, clearanceLevel: current.user.clearanceLevel }, newValue: { ...changes, clinicIds: normalizedClinicIds }, reason: changeReason, requestId: request.requestId, ipAddress: request.ip });
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
