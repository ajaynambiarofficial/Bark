import { Building2, Headphones, PawPrint, Stethoscope, TicketCheck } from "lucide-react";
import type { EscalationCategory, EscalationPriority, EscalationStatus, IssueType } from "./escalation.types";

export interface CategoryDefinition {
  id: EscalationCategory;
  name: string;
  description: string;
  icon: typeof PawPrint;
  parentLabel?: string;
  parents?: Record<string, readonly string[]>;
  issues?: readonly string[];
  responsibleDepartment: string;
  assignedTeam: string;
}

export const clinics = [
  "Koramangala", "Banashankari", "Brookfield", "Bannerghatta", "Kalyan Nagar", "KR Puram",
  "Whitefield", "Hosur Road", "RT Nagar", "RMV", "Rajajinagar", "Indiranagar",
] as const;

export const categoryDefinitions: Record<EscalationCategory, CategoryDefinition> = {
  pawcare: {
    id: "pawcare", name: "PawCare", description: "Access, sync, and application issues", icon: PawPrint,
    parentLabel: "Module / Feature", responsibleDepartment: "Product & Technology", assignedTeam: "PawCare Support",
    parents: {
      "Login / Access": ["Unable to login to PawCare", "OTP not received", "Account locked"],
      "App Sync Issue": ["Appointment not syncing", "Customer data mismatch", "Payment status not updated"],
      "App Crash / Freeze": ["App crashes on opening", "App freezes during booking", "App crashes while uploading file"],
      Other: ["Other issue not listed above"],
    },
  },
  nugget: {
    id: "nugget", name: "Nugget", description: "CRM ticket creation and disposal", icon: Building2,
    responsibleDepartment: "CRM Operations", assignedTeam: "CRM Team",
    issues: ["Inbound call received but no ticket created", "Not able to dispose the ticket", "Auto-merging of tickets not working"],
  },
  ameyo: {
    id: "ameyo", name: "Ameyo", description: "Calling and agent availability", icon: Headphones,
    responsibleDepartment: "Telephony Operations", assignedTeam: "Telephony Team",
    issues: ["Not able to make outbound calls", "Not able to use AUX", "Applied AUX but automatically came online", "Not able to dispose the call", "Not able to login to Ameyo"],
  },
  ticket: {
    id: "ticket", name: "Ticket", description: "Queues, leads, and follow-ups", icon: TicketCheck,
    parentLabel: "Ticket Channel / Queue", responsibleDepartment: "Ticketing Operations", assignedTeam: "Ticketing Operations Team",
    parents: {
      "Clinic IB": ["Phone number not updated in the ticket", "Wrong ticket created", "Duplicate ticket created under same customer", "Customer already booked but ABC ticket created", "Customer already visited but No-Show ticket created", "Customer cancelled appointment but No-Show ticket created", "Customer rescheduled appointment but No-Show ticket created", "Incorrect follow-up ticket created"],
      "Clinic OB New Leads": ["Lead not updated after call", "Wrong disposition selected", "Duplicate lead ticket created"],
      "Clinic OB Existing": ["Existing customer ticket not linked", "Follow-up ticket missing", "Wrong status updated on ticket"],
      "Confirmation Calling": ["Confirmation call not logged", "Wrong appointment confirmed", "Ticket not closed after confirmation"],
    },
  },
  clinicops: {
    id: "clinicops", name: "ClinicOps", description: "Clinic services and appointments", icon: Stethoscope,
    parentLabel: "Service", responsibleDepartment: "Clinic Operations", assignedTeam: "Clinic Operations Team",
    parents: {
      "Vet Consultation": ["Long waiting time at clinic", "Groomer took leave — appointment cancelled", "Roster not updated — slots not showing in PawCare", "Clinic cancelled appointment without informing customer", "Customer visited but invoice not generated", "Bad service experience reported by customer"],
      Vaccination: ["Vaccine stock not available", "Appointment slot not showing", "Wrong vaccine schedule updated"],
      Grooming: ["Groomer unavailable", "Grooming package not updated correctly", "Customer complaint about service quality"],
      Diagnostics: ["Lab report delayed", "Sample collection missed", "Incorrect report shared with customer"],
    },
  },
};

export const slaPolicy: Record<IssueType, Partial<Record<EscalationCategory, { priority: EscalationPriority; minutes: number }>>> = {
  standard: {
    pawcare: { priority: "Standard", minutes: 1440 }, nugget: { priority: "Standard", minutes: 1440 },
    ameyo: { priority: "Standard", minutes: 1440 }, ticket: { priority: "Standard", minutes: 1440 }, clinicops: { priority: "Standard", minutes: 1440 },
  },
  escalation: {
    clinicops: { priority: "P1", minutes: 30 }, pawcare: { priority: "P2", minutes: 60 },
    ameyo: { priority: "P2", minutes: 60 }, nugget: { priority: "P3", minutes: 120 }, ticket: { priority: "P3", minutes: 120 },
  },
};

export const statusTransitions: Record<EscalationStatus, readonly EscalationStatus[]> = {
  New: ["Assigned"],
  Assigned: ["In Progress"],
  "In Progress": ["Awaiting Response", "Resolved"],
  "Awaiting Response": ["In Progress"],
  Resolved: ["Closed", "Reopened"],
  Closed: ["Reopened"],
  Reopened: ["In Progress", "Awaiting Response", "Resolved"],
};

export const allStatuses = Object.keys(statusTransitions) as EscalationStatus[];
export const priorities: EscalationPriority[] = ["Standard", "P1", "P2", "P3"];
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const acceptedAttachmentTypes = ["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain"];
export const routingOwnerIds: Record<EscalationCategory, string> = {
  pawcare: "emp-admin-001",
  nugget: "emp-sales-lead-001",
  ameyo: "emp-sales-manager-001",
  ticket: "emp-sales-lead-001",
  clinicops: "emp-clinic-manager-001",
};

export function getSlaPolicy(issueType: IssueType, category: EscalationCategory) {
  return slaPolicy[issueType][category] ?? { priority: "Standard" as const, minutes: 1440 };
}

export function formatSlaTarget(minutes: number) {
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes === 60) return "1 hour";
  if (minutes < 1440) return `${minutes / 60} hours`;
  return `${minutes / 1440} hours`;
}
