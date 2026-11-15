import { mockEmployees } from "../../data/employees";
import { categoryDefinitions, getSlaPolicy } from "./escalation.config";
import type { Escalation, EscalationCategory, EscalationStatus, EscalationTier, IssueType } from "./escalation.types";
import { maskCustomerPhone, toPerson } from "./escalation.types";

function employee(id: string) {
  const match = mockEmployees.find((candidate) => candidate.id === id);
  if (!match) throw new Error(`Missing mock employee: ${id}`);
  return toPerson(match);
}

interface SeedOptions {
  id: string;
  reporterId: string;
  ownerId: string;
  category: EscalationCategory;
  title: string;
  issue: string;
  status: EscalationStatus;
  tier: EscalationTier;
  ageMinutes: number;
  issueType?: IssueType;
  clinic?: string;
  module?: string;
  channel?: string;
  service?: string;
  ticket?: string;
  phone?: string;
  transferredFromId?: string;
}

function seed(options: SeedOptions): Escalation {
  const reporter = employee(options.reporterId);
  const owner = employee(options.ownerId);
  const issueType = options.issueType ?? "escalation";
  const policy = getSlaPolicy(issueType, options.category);
  const now = Date.now();
  const createdAt = new Date(now - options.ageMinutes * 60_000).toISOString();
  const updatedAt = new Date(now - Math.min(20, Math.floor(options.ageMinutes / 3)) * 60_000).toISOString();
  const route = categoryDefinitions[options.category];
  const transferredFrom = options.transferredFromId ? employee(options.transferredFromId) : undefined;
  const baseActivity: Escalation["activity"] = [
    { id: `${options.id}-event-1`, escalationId: options.id, actorId: reporter.id, actorName: reporter.displayName, actorRole: reporter.role, type: "created", timestamp: createdAt, newValue: options.status === "New" ? "New" : "Assigned", reason: "Issue submitted through Bark." },
    { id: `${options.id}-event-2`, escalationId: options.id, actorId: reporter.id, actorName: reporter.displayName, actorRole: reporter.role, type: "notification-created", timestamp: new Date(new Date(createdAt).getTime() + 20_000).toISOString(), newValue: owner.displayName, reason: "Mock owner notification recorded." },
  ];
  if (transferredFrom) {
    baseActivity.push({ id: `${options.id}-event-3`, escalationId: options.id, actorId: employee("emp-clinic-manager-001").id, actorName: employee("emp-clinic-manager-001").displayName, actorRole: "clinic-manager", type: "owner-transferred", timestamp: updatedAt, previousValue: transferredFrom.displayName, newValue: owner.displayName, reason: "Transferred to the current operational owner." });
  }
  return {
    id: options.id,
    issueType,
    referenceType: options.ticket ? "customer" : "internal",
    title: options.title,
    description: `Fictional demonstration record: ${options.issue}. The team needs a clear owner and a documented next step.`,
    category: options.category,
    module: options.module,
    channel: options.channel,
    clinic: options.clinic,
    service: options.service,
    issueSubtype: options.issue,
    linkedTicketId: options.ticket,
    customerPhone: maskCustomerPhone(options.phone),
    appointmentId: options.clinic ? `APT-${options.id.slice(-4)}` : undefined,
    reporter,
    originatingDepartment: reporter.department,
    responsibleDepartment: route.responsibleDepartment,
    assignedTeam: route.assignedTeam,
    accountableOwner: owner,
    collaborators: transferredFrom ? [transferredFrom] : [],
    tier: options.tier,
    priority: policy.priority,
    status: options.status,
    createdAt,
    updatedAt,
    slaTargetMinutes: policy.minutes,
    slaDueAt: new Date(new Date(createdAt).getTime() + policy.minutes * 60_000).toISOString(),
    resolvedAt: options.status === "Resolved" || options.status === "Closed" ? updatedAt : undefined,
    attachments: [],
    comments: [],
    activity: baseActivity,
    ownershipHistory: [{ owner, assignedAt: createdAt, assignedBy: reporter, reason: "Initial routing assignment." }],
    sharedEmployeeIds: [reporter.id, owner.id, ...(transferredFrom ? [transferredFrom.id] : [])],
    sharedDepartments: [reporter.department, owner.department, route.responsibleDepartment],
    requiresAssignment: false,
  };
}

export function createSeedEscalations(): Escalation[] {
  return [
    seed({ id: "ESC-2026-1042", reporterId: "emp-sales-001", ownerId: "emp-clinic-manager-001", category: "clinicops", title: "Appointment slots unavailable", issue: "Roster not updated — slots not showing in PawCare", service: "Vet Consultation", clinic: "Whitefield", status: "Assigned", tier: 1, ageMinutes: 18, ticket: "TKT-80421", phone: "9000000001" }),
    seed({ id: "ESC-2026-1041", reporterId: "emp-frontdesk-001", ownerId: "emp-sales-lead-001", category: "ticket", title: "Follow-up ticket missing", issue: "Follow-up ticket missing", channel: "Clinic OB Existing", clinic: "Indiranagar", status: "Awaiting Response", tier: 2, ageMinutes: 95, ticket: "TKT-80398", phone: "9000000002" }),
    seed({ id: "ESC-2026-1040", reporterId: "emp-sales-lead-001", ownerId: "emp-sales-manager-001", category: "ameyo", title: "Outbound calls unavailable", issue: "Not able to make outbound calls", status: "In Progress", tier: 2, ageMinutes: 78, ticket: "TKT-80377", phone: "9000000003" }),
    seed({ id: "ESC-2026-1039", reporterId: "emp-clinic-manager-001", ownerId: "emp-doctor-001", category: "clinicops", title: "Lab report delayed", issue: "Lab report delayed", service: "Diagnostics", clinic: "Koramangala", status: "In Progress", tier: 1, ageMinutes: 50 }),
    seed({ id: "ESC-2026-1038", reporterId: "emp-groomer-001", ownerId: "emp-clinic-manager-001", category: "clinicops", title: "Grooming package mismatch", issue: "Grooming package not updated correctly", service: "Grooming", clinic: "Indiranagar", status: "Resolved", tier: 1, ageMinutes: 220 }),
    seed({ id: "ESC-2026-1037", reporterId: "emp-sales-001", ownerId: "emp-admin-001", category: "pawcare", title: "Appointment not syncing", issue: "Appointment not syncing", module: "App Sync Issue", status: "In Progress", tier: 3, ageMinutes: 190, ticket: "TKT-80290", phone: "9000000004", transferredFromId: "emp-sales-lead-001" }),
    seed({ id: "ESC-2026-1036", reporterId: "emp-frontdesk-001", ownerId: "emp-clinic-manager-001", category: "clinicops", title: "Internal roster correction", issue: "Roster not updated — slots not showing in PawCare", service: "Vet Consultation", clinic: "Indiranagar", status: "New", tier: 1, ageMinutes: 8, issueType: "standard" }),
    seed({ id: "ESC-2026-1035", reporterId: "emp-sales-manager-001", ownerId: "emp-sales-lead-001", category: "nugget", title: "Ticket auto-merge failure", issue: "Auto-merging of tickets not working", status: "Closed", tier: 2, ageMinutes: 520, ticket: "TKT-80114", phone: "9000000005" }),
  ];
}
