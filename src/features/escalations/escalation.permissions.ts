import type { Employee, EmployeeRole } from "../../types/auth";
import type { Escalation, EscalationStatus } from "./escalation.types";
import { statusTransitions } from "./escalation.config";

interface RolePermissions {
  viewTeam: boolean;
  transfer: boolean;
  tier2: boolean;
  tier3: boolean;
  close: boolean;
}

export const escalationRolePermissions: Record<EmployeeRole, RolePermissions> = {
  "sales-agent": { viewTeam: false, transfer: false, tier2: false, tier3: false, close: false },
  "sales-team-lead": { viewTeam: true, transfer: true, tier2: true, tier3: false, close: true },
  "sales-manager": { viewTeam: true, transfer: true, tier2: true, tier3: true, close: true },
  "zonal-head": { viewTeam: true, transfer: true, tier2: true, tier3: true, close: true },
  "clinic-front-desk": { viewTeam: false, transfer: false, tier2: false, tier3: false, close: false },
  "clinic-manager": { viewTeam: true, transfer: true, tier2: true, tier3: true, close: true },
  doctor: { viewTeam: false, transfer: false, tier2: false, tier3: false, close: false },
  groomer: { viewTeam: false, transfer: false, tier2: false, tier3: false, close: false },
  "central-management": { viewTeam: true, transfer: true, tier2: true, tier3: true, close: true },
  "system-administrator": { viewTeam: false, transfer: false, tier2: false, tier3: false, close: false },
  god: { viewTeam: true, transfer: true, tier2: true, tier3: true, close: true },
};

const clinicRoles = new Set<EmployeeRole>(["clinic-front-desk", "clinic-manager", "zonal-head", "doctor", "groomer"]);

export function canViewEscalation(employee: Employee, item: Escalation): boolean {
  if (item.reporter.id === employee.id || item.accountableOwner.id === employee.id || item.sharedEmployeeIds.includes(employee.id)) return true;
  const permissions = escalationRolePermissions[employee.role];
  if (employee.role === "central-management" || employee.role === "god") return true;
  if (permissions.viewTeam && item.originatingDepartment === employee.department) return true;
  if (permissions.viewTeam && item.responsibleDepartment === employee.department) return true;
  if (clinicRoles.has(employee.role) && item.clinic && item.clinic === employee.assignment.replace(" Clinic", "")) return true;
  return false;
}

export function canTransfer(employee: Employee, item: Escalation) {
  return canViewEscalation(employee, item) && escalationRolePermissions[employee.role].transfer;
}

export function canIncreaseTier(employee: Employee, item: Escalation, targetTier: 2 | 3) {
  const permissions = escalationRolePermissions[employee.role];
  return canViewEscalation(employee, item) && targetTier === item.tier + 1 && (targetTier === 2 ? permissions.tier2 : permissions.tier3);
}

export function canTransitionStatus(employee: Employee, item: Escalation, target: EscalationStatus) {
  if (!canViewEscalation(employee, item) || !statusTransitions[item.status].includes(target)) return false;
  if (target === "Closed") return escalationRolePermissions[employee.role].close;
  if (item.status === "Closed" && target === "Reopened") return escalationRolePermissions[employee.role].close;
  if (target === "Reopened") return item.reporter.id === employee.id || item.accountableOwner.id === employee.id || escalationRolePermissions[employee.role].viewTeam;
  return item.accountableOwner.id === employee.id || escalationRolePermissions[employee.role].viewTeam;
}

export function canComment(employee: Employee, item: Escalation) {
  return canViewEscalation(employee, item);
}

export function canCreateEscalation(employee: Employee) {
  return employee.accountStatus === "active" && employee.role !== "system-administrator";
}
