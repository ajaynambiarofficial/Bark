import type { EmployeeRole } from "../types/auth";

const senderRoles = new Set<EmployeeRole>(["sales-team-lead", "sales-manager", "zonal-head", "clinic-manager", "central-management", "system-administrator", "god"]);

export function canSendTeamEmail(role: EmployeeRole | undefined) {
  return Boolean(role && senderRoles.has(role));
}
