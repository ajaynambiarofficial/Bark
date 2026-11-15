import { eq, inArray } from "drizzle-orm";
import { BUILT_IN_ROLES, BUILT_IN_ROLE_PERMISSIONS, PERMISSIONS } from "../auth/permissions.js";
import { hashPassword } from "../auth/password.js";
import { env } from "../config/env.js";
import { closeDatabase, db } from "./client.js";
import { assignmentRules, clinicServices, clinics, permissions, rolePermissions, roles, services, slaPolicies, userClinics, users } from "./schema.js";

async function seed() {
  await db.transaction(async (transaction) => {
    for (const key of PERMISSIONS) {
      await transaction.insert(permissions).values({
        key,
        description: key.replaceAll(":", " "),
        module: key.split(":")[0] ?? "system",
      }).onConflictDoUpdate({ target: permissions.key, set: { description: key.replaceAll(":", " "), module: key.split(":")[0] ?? "system" } });
    }

    const permissionRows = await transaction.select().from(permissions).where(inArray(permissions.key, [...PERMISSIONS]));
    const permissionByKey = new Map(permissionRows.map((permission) => [permission.key, permission.id]));

    for (const [key, definition] of Object.entries(BUILT_IN_ROLES)) {
      const [role] = await transaction.insert(roles).values({ key, name: definition.name, clearanceLevel: definition.clearance, builtIn: true })
        .onConflictDoUpdate({ target: roles.key, set: { name: definition.name, clearanceLevel: definition.clearance, builtIn: true, active: true, updatedAt: new Date() } }).returning();
      if (!role) throw new Error(`Could not seed role ${key}`);
      await transaction.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
      const grants = BUILT_IN_ROLE_PERMISSIONS[key as keyof typeof BUILT_IN_ROLE_PERMISSIONS]
        .map((permissionKey) => permissionByKey.get(permissionKey))
        .filter((permissionId): permissionId is string => Boolean(permissionId))
        .map((permissionId) => ({ roleId: role.id, permissionId }));
      if (grants.length) await transaction.insert(rolePermissions).values(grants);
    }

    await transaction.insert(clinics).values({ code: "CENTRAL", name: "Supertails Central", timezone: "Asia/Calcutta" })
      .onConflictDoUpdate({ target: clinics.code, set: { active: true, updatedAt: new Date() } });
    for (const name of ["Koramangala", "Banashankari", "Brookfield", "Bannerghatta", "Kalyan Nagar", "KR Puram", "Hosur Road", "Whitefield", "RT Nagar", "RMV", "Rajajinagar", "Indiranagar"]) {
      const code = `CLINIC_${name.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
      await transaction.insert(clinics).values({ code, name, timezone: "Asia/Calcutta" })
        .onConflictDoUpdate({ target: clinics.code, set: { active: true, updatedAt: new Date() } });
    }

    await transaction.insert(slaPolicies).values([
      { name: "Standard P1", issueType: "escalation", priority: "P1", targetMinutes: 60 },
      { name: "Standard P2", issueType: "escalation", priority: "P2", targetMinutes: 240 },
      { name: "Standard P3", issueType: "escalation", priority: "P3", targetMinutes: 1_440 },
      { name: "Standard request", issueType: "standard", priority: "Standard", targetMinutes: 1_440 },
    ]).onConflictDoNothing();
  });

  let godUserId: string | undefined;
  if (env.GOD_EMAIL && env.GOD_PASSWORD) {
    const [godRole] = await db.select().from(roles).where(eq(roles.key, "god")).limit(1);
    if (!godRole) throw new Error("GOD role was not seeded");
    const passwordHash = await hashPassword(env.GOD_PASSWORD);
    const [godUser] = await db.insert(users).values({
      employeeCode: "GOD-001",
      email: env.GOD_EMAIL.toLowerCase(),
      displayName: "Bark Super Admin",
      passwordHash,
      roleId: godRole.id,
      department: "Platform Administration",
      assignment: "Global",
      clearanceLevel: 100,
    }).onConflictDoUpdate({ target: users.employeeCode, set: { email: env.GOD_EMAIL.toLowerCase(), passwordHash, roleId: godRole.id, clearanceLevel: 100, accountStatus: "active", updatedAt: new Date() } }).returning({ id: users.id });
    godUserId = godUser?.id;
  }

  if (env.LOCAL_AGENT_EMAIL && env.LOCAL_AGENT_PASSWORD) {
    const [agentRole] = await db.select().from(roles).where(eq(roles.key, "sales-agent")).limit(1);
    if (!agentRole) throw new Error("Sales Agent role was not seeded");
    const passwordHash = await hashPassword(env.LOCAL_AGENT_PASSWORD);
    await db.insert(users).values({
      employeeCode: "LOCAL-AGENT-001",
      email: env.LOCAL_AGENT_EMAIL.toLowerCase(),
      displayName: "Ajay Nambiar",
      passwordHash,
      roleId: agentRole.id,
      department: "Sales",
      assignment: "Bengaluru Sales Team",
      clearanceLevel: 10,
    }).onConflictDoUpdate({ target: users.employeeCode, set: { email: env.LOCAL_AGENT_EMAIL.toLowerCase(), passwordHash, roleId: agentRole.id, clearanceLevel: 10, accountStatus: "active", updatedAt: new Date() } });
  }

  if (env.LOCAL_TEAM_LEAD_EMAIL && env.LOCAL_TEAM_LEAD_PASSWORD) {
    const [teamLeadRole] = await db.select().from(roles).where(eq(roles.key, "sales-team-lead")).limit(1);
    if (!teamLeadRole) throw new Error("Sales Team Lead role was not seeded");
    const passwordHash = await hashPassword(env.LOCAL_TEAM_LEAD_PASSWORD);
    await db.insert(users).values({
      employeeCode: "LOCAL-TEAM-LEAD-001",
      email: env.LOCAL_TEAM_LEAD_EMAIL.toLowerCase(),
      displayName: "Local Sales Team Lead",
      passwordHash,
      roleId: teamLeadRole.id,
      department: "Sales",
      assignment: "Bengaluru Sales Team",
      clearanceLevel: 40,
    }).onConflictDoUpdate({ target: users.employeeCode, set: { email: env.LOCAL_TEAM_LEAD_EMAIL.toLowerCase(), passwordHash, roleId: teamLeadRole.id, department: "Sales", assignment: "Bengaluru Sales Team", clearanceLevel: 40, accountStatus: "active", updatedAt: new Date() } });
  }

  if (env.LOCAL_CLINIC_MANAGER_EMAIL && env.LOCAL_CLINIC_MANAGER_PASSWORD) {
    const [managerRole] = await db.select().from(roles).where(eq(roles.key, "clinic-manager")).limit(1);
    const [indiranagar] = await db.select().from(clinics).where(eq(clinics.code, "CLINIC_INDIRANAGAR")).limit(1);
    if (!managerRole || !indiranagar) throw new Error("Clinic Manager role or Indiranagar clinic was not seeded");
    const passwordHash = await hashPassword(env.LOCAL_CLINIC_MANAGER_PASSWORD);
    const [manager] = await db.insert(users).values({
      employeeCode: "LOCAL-CLINIC-MANAGER-001",
      email: env.LOCAL_CLINIC_MANAGER_EMAIL.toLowerCase(),
      displayName: "Local Clinic Manager",
      passwordHash,
      roleId: managerRole.id,
      department: "Clinic Operations",
      assignment: "Indiranagar Clinic",
      clearanceLevel: 50,
    }).onConflictDoUpdate({ target: users.employeeCode, set: { email: env.LOCAL_CLINIC_MANAGER_EMAIL.toLowerCase(), passwordHash, roleId: managerRole.id, department: "Clinic Operations", assignment: "Indiranagar Clinic", clearanceLevel: 50, accountStatus: "active", updatedAt: new Date() } }).returning({ id: users.id });
    if (manager) await db.insert(userClinics).values({ userId: manager.id, clinicId: indiranagar.id, accessLevel: "manage" }).onConflictDoUpdate({ target: [userClinics.userId, userClinics.clinicId], set: { accessLevel: "manage" } });
  }

  const [clinic] = await db.select().from(clinics).where(eq(clinics.code, "CENTRAL")).limit(1);
  if (clinic) {
    const serviceCatalog = [
      { sku: "CONSULT-GENERAL", name: "General Consult", category: "Consultation", durationMinutes: 30 },
      { sku: "CONSULT-FOLLOWUP", name: "Follow-up Consult", category: "Consultation", durationMinutes: 30 },
      { sku: "CONSULT-SURGERY", name: "Surgery Consult", category: "Consultation", durationMinutes: 30 },
      { sku: "CONSULT-IV", name: "IV Drip", category: "Consultation", durationMinutes: 60 },
      { sku: "GROOM-LONG", name: "Long-coat Grooming", category: "Grooming", durationMinutes: 90 },
      { sku: "GROOM-SHORT", name: "Short-coat Grooming", category: "Grooming", durationMinutes: 60 },
      { sku: "BATH-DRY", name: "Bath and Dry", category: "Grooming", durationMinutes: 60 },
      { sku: "VACCINE", name: "Vaccination", category: "Vaccination", durationMinutes: 15 },
      { sku: "DEWORM", name: "Deworming", category: "Other", durationMinutes: 15 },
      { sku: "FIT-TRAVEL", name: "Fit-to-Travel Certificate", category: "Other", durationMinutes: 30 },
    ];
    const activeClinics = await db.select({ id: clinics.id }).from(clinics).where(eq(clinics.active, true));
    for (const definition of serviceCatalog) {
      const [service] = await db.insert(services).values({ ...definition, basePrice: "0.00", description: "Duration configured from Pawcare booking rules" })
        .onConflictDoUpdate({ target: services.sku, set: { name: definition.name, category: definition.category, durationMinutes: definition.durationMinutes, active: true, updatedAt: new Date() } }).returning({ id: services.id });
      if (service && activeClinics.length) await db.insert(clinicServices).values(activeClinics.map(({ id }) => ({ clinicId: id, serviceId: service.id }))).onConflictDoNothing();
    }
    if (godUserId) {
      for (const category of ["pawcare", "nugget", "ameyo", "ticket", "clinicops"]) {
        const [rule] = await db.select().from(assignmentRules).where(eq(assignmentRules.category, category)).limit(1);
        if (rule) {
          await db.update(assignmentRules).set({ ownerId: godUserId, clinicId: null, team: "Central Management", active: true, updatedAt: new Date() }).where(eq(assignmentRules.id, rule.id));
        } else {
          await db.insert(assignmentRules).values({ name: `Local ${category} escalation queue`, category, ownerId: godUserId, team: "Central Management", priority: 1 });
        }
      }
    }
  }
}

seed()
  .then(() => console.info("Bark database seeded successfully."))
  .catch((error: unknown) => {
    console.error("Bark database seed failed.", error);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
