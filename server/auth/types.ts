export interface AuthPrincipal {
  userId: string;
  sessionId: string;
  employeeCode: string;
  email: string;
  displayName: string;
  roleKey: string;
  roleName: string;
  clearanceLevel: number;
  department: string;
  assignment: string;
  permissions: ReadonlySet<string>;
  clinicIds: readonly string[];
}
