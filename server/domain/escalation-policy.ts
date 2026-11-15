export const escalationStatuses = ["New", "Assigned", "In Progress", "Awaiting Response", "Resolved", "Closed", "Reopened"] as const;
export type EscalationStatus = (typeof escalationStatuses)[number];

export const escalationStatusTransitions: Record<EscalationStatus, readonly EscalationStatus[]> = {
  New: ["Assigned"],
  Assigned: ["In Progress", "Closed"],
  "In Progress": ["Awaiting Response", "Resolved"],
  "Awaiting Response": ["In Progress", "Resolved"],
  Resolved: ["Closed", "Reopened"],
  Closed: ["Reopened"],
  Reopened: ["In Progress", "Awaiting Response", "Resolved"],
};

export function canTransitionEscalation(from: EscalationStatus, to: EscalationStatus) {
  return escalationStatusTransitions[from].includes(to);
}

export function requiredPermissionForTier(tier: number) {
  if (tier === 2) return "escalations:tier:2";
  if (tier === 3) return "escalations:tier:3";
  return null;
}
