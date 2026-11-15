import type { Employee, EmployeeRole } from "../../types/auth";

export type IssueType = "standard" | "escalation";
export type ReferenceType = "customer" | "internal";
export type EscalationCategory = "pawcare" | "nugget" | "ameyo" | "ticket" | "clinicops";
export type EscalationPriority = "Standard" | "P1" | "P2" | "P3";
export type EscalationTier = 1 | 2 | 3;
export type EscalationStatus = "New" | "Assigned" | "In Progress" | "Awaiting Response" | "Resolved" | "Closed" | "Reopened";
export type SlaState = "healthy" | "due-soon" | "breached" | "met";
export type CommentVisibility = "internal" | "shared";

export interface PersonSnapshot {
  id: string;
  displayName: string;
  email: string;
  role: EmployeeRole;
  roleLabel: string;
  department: string;
  assignment: string;
}

export interface AttachmentMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
}

export type ActivityType =
  | "created"
  | "owner-assigned"
  | "owner-transferred"
  | "status-changed"
  | "tier-increased"
  | "comment-added"
  | "resolution-submitted"
  | "reopened"
  | "notification-created";

export interface EscalationActivity {
  id: string;
  escalationId: string;
  actorId: string;
  actorName: string;
  actorRole: EmployeeRole;
  type: ActivityType;
  timestamp: string;
  previousValue?: string | undefined;
  newValue?: string | undefined;
  reason?: string | undefined;
  metadata?: Record<string, string> | undefined;
}

export interface EscalationComment {
  id: string;
  author: PersonSnapshot;
  body: string;
  visibility: CommentVisibility;
  createdAt: string;
}

export interface OwnershipRecord {
  owner: PersonSnapshot;
  assignedAt: string;
  assignedBy: PersonSnapshot;
  reason: string;
}

export interface Escalation {
  id: string;
  reference?: string | undefined;
  issueType: IssueType;
  referenceType: ReferenceType;
  title: string;
  description: string;
  category: EscalationCategory;
  module?: string | undefined;
  channel?: string | undefined;
  clinic?: string | undefined;
  service?: string | undefined;
  issueSubtype: string;
  customIssue?: string | undefined;
  linkedTicketId?: string | undefined;
  customerPhone?: string | undefined;
  appointmentId?: string | undefined;
  reporter: PersonSnapshot;
  originatingDepartment: string;
  responsibleDepartment: string;
  assignedTeam: string;
  accountableOwner: PersonSnapshot;
  collaborators: PersonSnapshot[];
  tier: EscalationTier;
  priority: EscalationPriority;
  status: EscalationStatus;
  createdAt: string;
  updatedAt: string;
  slaTargetMinutes: number;
  slaDueAt: string;
  resolvedAt?: string | undefined;
  attachments: AttachmentMetadata[];
  comments: EscalationComment[];
  activity: EscalationActivity[];
  ownershipHistory: OwnershipRecord[];
  sharedEmployeeIds: string[];
  sharedDepartments: string[];
  requiresAssignment: boolean;
}

export interface CreateEscalationInput {
  issueType: IssueType;
  referenceType: ReferenceType;
  title: string;
  description: string;
  category: EscalationCategory;
  module?: string | undefined;
  channel?: string | undefined;
  clinic?: string | undefined;
  service?: string | undefined;
  issueSubtype: string;
  customIssue?: string | undefined;
  linkedTicketId?: string | undefined;
  customerPhone?: string | undefined;
  appointmentId?: string | undefined;
  attachments: AttachmentMetadata[];
}

export interface EscalationFilters {
  search: string;
  status: EscalationStatus | "";
  priority: EscalationPriority | "";
  tier: EscalationTier | "";
  department: string;
  clinic: string;
  slaState: SlaState | "";
}

export type EscalationView = "all" | "raised" | "assigned" | "team" | "action";

export interface NotificationContract {
  id: string;
  escalationId: string;
  recipientId: string;
  recipientRole: EmployeeRole;
  event: "created" | "updated" | "tier-increased";
  createdAt: string;
  delivery: "mock-activity-only";
}

export function toPerson(employee: Employee): PersonSnapshot {
  return {
    id: employee.id,
    displayName: employee.displayName,
    email: employee.email,
    role: employee.role,
    roleLabel: employee.roleLabel,
    department: employee.department,
    assignment: employee.assignment,
  };
}

export function maskCustomerPhone(value?: string): string | undefined {
  if (!value || value.includes("•")) return value;
  return `${value.slice(0, 2)}••••••${value.slice(-2)}`;
}
