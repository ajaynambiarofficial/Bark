export const employeeRoles = [
  "sales-agent",
  "sales-team-lead",
  "sales-manager",
  "zonal-head",
  "clinic-front-desk",
  "clinic-manager",
  "doctor",
  "groomer",
  "central-management",
  "system-administrator",
  "god",
] as const;

export type EmployeeRole = (typeof employeeRoles)[number];
export type AccountStatus = "active" | "inactive";

export interface Employee {
  id: string;
  displayName: string;
  email: string;
  role: EmployeeRole;
  roleLabel: string;
  department: string;
  assignment: string;
  accountStatus: AccountStatus;
}

export interface RoleDefinition {
  label: string;
  welcomeCopy: string;
  permissions: readonly string[];
}

export interface AuthAdapter {
  restoreSession(): Promise<Employee | null>;
  signIn(email: string, password: string, rememberMe?: boolean): Promise<Employee>;
  signInWithGoogle(credential: string): Promise<Employee>;
  signOut(): Promise<void>;
}
