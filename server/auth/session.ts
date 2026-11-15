import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { permissions, rolePermissions, roles, sessions, userClinics, userPermissions, users } from "../db/schema.js";
import type { AuthPrincipal } from "./types.js";

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function loadPrincipalByToken(token: string): Promise<AuthPrincipal | null> {
  const tokenHash = hashSessionToken(token);
  const [record] = await db.select({
    sessionId: sessions.id,
    userId: users.id,
    employeeCode: users.employeeCode,
    email: users.email,
    displayName: users.displayName,
    roleId: roles.id,
    roleKey: roles.key,
    roleName: roles.name,
    roleClearance: roles.clearanceLevel,
    userClearance: users.clearanceLevel,
    department: users.department,
    assignment: users.assignment,
  }).from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()), eq(users.accountStatus, "active"), eq(roles.active, true)))
    .limit(1);

  if (!record) return null;

  const [roleGrants, overrides, clinicGrants] = await Promise.all([
    db.select({ key: permissions.key }).from(rolePermissions).innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id)).where(eq(rolePermissions.roleId, record.roleId)),
    db.select({ key: permissions.key, granted: userPermissions.granted }).from(userPermissions).innerJoin(permissions, eq(userPermissions.permissionId, permissions.id)).where(eq(userPermissions.userId, record.userId)),
    db.select({ clinicId: userClinics.clinicId }).from(userClinics).where(eq(userClinics.userId, record.userId)),
  ]);

  const effectivePermissions = new Set(roleGrants.map((grant) => grant.key));
  for (const override of overrides) {
    if (override.granted) effectivePermissions.add(override.key);
    else effectivePermissions.delete(override.key);
  }

  await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, record.sessionId));

  return {
    userId: record.userId,
    sessionId: record.sessionId,
    employeeCode: record.employeeCode,
    email: record.email,
    displayName: record.displayName,
    roleKey: record.roleKey,
    roleName: record.roleName,
    clearanceLevel: Math.max(record.roleClearance, record.userClearance),
    department: record.department,
    assignment: record.assignment,
    permissions: effectivePermissions,
    clinicIds: clinicGrants.map((grant) => grant.clinicId),
  };
}

export function employeeResponse(principal: AuthPrincipal) {
  return {
    id: principal.userId,
    userId: principal.userId,
    displayName: principal.displayName,
    email: principal.email,
    role: principal.roleKey,
    roleLabel: principal.roleName,
    department: principal.department,
    assignment: principal.assignment,
    accountStatus: "active" as const,
    clearanceLevel: principal.clearanceLevel,
    permissions: [...principal.permissions],
    clinicIds: principal.clinicIds,
  };
}
