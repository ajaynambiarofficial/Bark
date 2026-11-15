import { mockEmployees } from "../../data/employees";
import type { Employee } from "../../types/auth";
import { categoryDefinitions, getSlaPolicy, routingOwnerIds, statusTransitions } from "./escalation.config";
import { createSeedEscalations } from "./escalation.mock-data";
import { canComment, canCreateEscalation, canIncreaseTier, canTransfer, canTransitionStatus, canViewEscalation } from "./escalation.permissions";
import type { CommentVisibility, CreateEscalationInput, Escalation, EscalationActivity, EscalationStatus, EscalationTier, NotificationContract } from "./escalation.types";
import { maskCustomerPhone, toPerson } from "./escalation.types";

const STORAGE_KEY = "bark.escalations.v1";
const STORAGE_VERSION = 1;
const delay = () => new Promise((resolve) => window.setTimeout(resolve, 120));

interface StoreShape {
  version: number;
  sequence: number;
  escalations: Escalation[];
  notifications: NotificationContract[];
}

function newStore(): StoreShape {
  return { version: STORAGE_VERSION, sequence: 1043, escalations: createSeedEscalations(), notifications: [] };
}

function loadStore(): StoreShape {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as StoreShape | null;
    return parsed?.version === STORAGE_VERSION && Array.isArray(parsed.escalations) ? parsed : newStore();
  } catch {
    return newStore();
  }
}

function saveStore(store: StoreShape) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function requireCase(store: StoreShape, id: string) {
  const item = store.escalations.find((candidate) => candidate.id === id);
  if (!item) throw new Error("Escalation not found.");
  return item;
}

function actorEvent(item: Escalation, actor: Employee, type: EscalationActivity["type"], details: Partial<EscalationActivity> = {}): EscalationActivity {
  return { id: makeId("EVT"), escalationId: item.id, actorId: actor.id, actorName: actor.displayName, actorRole: actor.role, type, timestamp: new Date().toISOString(), ...details };
}

function eligibleOwner(category: CreateEscalationInput["category"], clinic?: string) {
  const match = mockEmployees.find((candidate) => candidate.id === routingOwnerIds[category] && candidate.accountStatus === "active");
  const fallback = mockEmployees.find((candidate) => candidate.id === "emp-central-001");
  return { employee: match ?? fallback, requiresAssignment: !match, clinic };
}

function updateItem(store: StoreShape, item: Escalation) {
  item.updatedAt = new Date().toISOString();
  saveStore(store);
  return structuredClone(item);
}

export const escalationService = {
  async listEscalations(actor: Employee): Promise<Escalation[]> {
    await delay();
    return loadStore().escalations.filter((item) => canViewEscalation(actor, item)).map((item) => structuredClone(item));
  },

  async getEscalationById(id: string, actor: Employee): Promise<Escalation> {
    await delay();
    const item = requireCase(loadStore(), id);
    if (!canViewEscalation(actor, item)) throw new Error("You do not have access to this escalation.");
    return structuredClone(item);
  },

  async createEscalation(input: CreateEscalationInput, actor: Employee): Promise<Escalation> {
    await delay();
    if (!canCreateEscalation(actor)) throw new Error("Your role is not permitted to create operational escalations.");
    const definition = categoryDefinitions[input.category];
    const parent = input.module ?? input.channel ?? input.service;
    const validIssues = definition.issues ?? (parent ? definition.parents?.[parent] ?? [] : []);
    const customClinicIssue = input.category === "clinicops" && input.issueSubtype === "Other / Not Listed" && Boolean(input.customIssue?.trim());
    if ((!validIssues.includes(input.issueSubtype) && !customClinicIssue) || (definition.parents && !parent)) throw new Error("The selected issue does not match its category configuration.");
    if (input.category === "clinicops" && !input.clinic) throw new Error("A clinic is required for ClinicOps issues.");
    if (input.referenceType === "customer") {
      if (!input.linkedTicketId || !/^[A-Z0-9-]{4,30}$/.test(input.linkedTicketId.replace(/\s+/g, "").toUpperCase())) throw new Error("A valid linked ticket ID is required.");
      if (!input.customerPhone || !/^\d{10}$/.test(input.customerPhone)) throw new Error("A valid 10-digit customer phone is required.");
    }
    if (input.issueType === "escalation" && input.description.trim().length < 10) throw new Error("A useful escalation description is required.");
    const store = loadStore();
    const route = categoryDefinitions[input.category];
    const ownerResult = eligibleOwner(input.category, input.clinic);
    if (!ownerResult.employee) throw new Error("No accountable intake owner is configured.");
    const policy = getSlaPolicy(input.issueType, input.category);
    const now = new Date();
    const id = `ESC-${now.getFullYear()}-${store.sequence++}`;
    const reporter = toPerson(actor);
    const owner = toPerson(ownerResult.employee);
    const item: Escalation = {
      id, ...input, linkedTicketId: input.linkedTicketId?.replace(/\s+/g, "").toUpperCase(), customerPhone: maskCustomerPhone(input.customerPhone),
      reporter, originatingDepartment: actor.department, responsibleDepartment: route.responsibleDepartment,
      assignedTeam: route.assignedTeam, accountableOwner: owner, collaborators: [], tier: 1,
      priority: policy.priority, status: "Assigned", createdAt: now.toISOString(), updatedAt: now.toISOString(),
      slaTargetMinutes: policy.minutes, slaDueAt: new Date(now.getTime() + policy.minutes * 60_000).toISOString(),
      comments: [], activity: [], ownershipHistory: [{ owner, assignedAt: now.toISOString(), assignedBy: reporter, reason: ownerResult.requiresAssignment ? "Assigned to intake custodian pending review." : "Assigned by configured category routing." }],
      sharedEmployeeIds: [actor.id, owner.id], sharedDepartments: [actor.department, owner.department, route.responsibleDepartment],
      requiresAssignment: ownerResult.requiresAssignment,
    };
    item.activity.push(actorEvent(item, actor, "created", { newValue: "Assigned", reason: "Issue submitted through Bark." }));
    item.activity.push(actorEvent(item, actor, "owner-assigned", { newValue: owner.displayName, reason: item.ownershipHistory[0]?.reason }));
    item.activity.push(actorEvent(item, actor, "notification-created", { newValue: owner.displayName, reason: "Mock notification recorded; no message was sent." }));
    store.escalations.unshift(item);
    store.notifications.push({ id: makeId("NTF"), escalationId: id, recipientId: owner.id, recipientRole: owner.role, event: "created", createdAt: now.toISOString(), delivery: "mock-activity-only" });
    saveStore(store);
    return structuredClone(item);
  },

  async updateEscalationStatus(id: string, target: EscalationStatus, actor: Employee, reason?: string): Promise<Escalation> {
    await delay();
    const store = loadStore();
    const item = requireCase(store, id);
    if (!statusTransitions[item.status].includes(target) || !canTransitionStatus(actor, item, target)) throw new Error("This status change is not permitted.");
    if (target === "Resolved" && !reason?.trim()) throw new Error("A resolution note is required.");
    if (target === "Reopened" && !reason?.trim()) throw new Error("A reopening reason is required.");
    const previous = item.status;
    item.status = target;
    if (target === "Resolved") item.resolvedAt = new Date().toISOString();
    if (target === "Reopened") item.resolvedAt = undefined;
    item.activity.push(actorEvent(item, actor, target === "Resolved" ? "resolution-submitted" : target === "Reopened" ? "reopened" : "status-changed", { previousValue: previous, newValue: target, reason: reason?.trim() }));
    return updateItem(store, item);
  },

  async transferEscalationOwnership(id: string, newOwnerId: string, reason: string, actor: Employee): Promise<Escalation> {
    await delay();
    const store = loadStore();
    const item = requireCase(store, id);
    if (!canTransfer(actor, item)) throw new Error("You are not permitted to transfer this escalation.");
    if (!reason.trim()) throw new Error("A transfer reason is required.");
    const next = mockEmployees.find((candidate) => candidate.id === newOwnerId && candidate.accountStatus === "active" && candidate.role !== "system-administrator");
    if (!next) throw new Error("Select an eligible active owner.");
    const previous = item.accountableOwner;
    const owner = toPerson(next);
    item.accountableOwner = owner;
    item.sharedEmployeeIds = Array.from(new Set([...item.sharedEmployeeIds, previous.id, owner.id]));
    item.collaborators = [...item.collaborators.filter((person) => person.id !== previous.id), previous];
    item.ownershipHistory.push({ owner, assignedAt: new Date().toISOString(), assignedBy: toPerson(actor), reason: reason.trim() });
    item.activity.push(actorEvent(item, actor, "owner-transferred", { previousValue: previous.displayName, newValue: owner.displayName, reason: reason.trim() }));
    return updateItem(store, item);
  },

  async escalateTier(id: string, targetTier: EscalationTier, reason: string, actor: Employee): Promise<Escalation> {
    await delay();
    const store = loadStore();
    const item = requireCase(store, id);
    if ((targetTier !== 2 && targetTier !== 3) || !canIncreaseTier(actor, item, targetTier)) throw new Error("You are not permitted to increase this tier.");
    if (!reason.trim()) throw new Error("An escalation reason is required.");
    const previous = item.tier;
    item.tier = targetTier;
    item.activity.push(actorEvent(item, actor, "tier-increased", { previousValue: `Tier ${previous}`, newValue: `Tier ${targetTier}`, reason: reason.trim() }));
    item.activity.push(actorEvent(item, actor, "notification-created", { newValue: targetTier === 3 ? "Higher management" : "Relevant manager", reason: "Mock tier notification recorded; no message was sent." }));
    return updateItem(store, item);
  },

  async addEscalationComment(id: string, body: string, visibility: CommentVisibility, actor: Employee): Promise<Escalation> {
    await delay();
    const store = loadStore();
    const item = requireCase(store, id);
    if (!canComment(actor, item)) throw new Error("You are not permitted to comment on this escalation.");
    if (!body.trim()) throw new Error("Enter a comment before posting.");
    const comment = { id: makeId("CMT"), author: toPerson(actor), body: body.trim(), visibility, createdAt: new Date().toISOString() };
    item.comments.push(comment);
    item.activity.push(actorEvent(item, actor, "comment-added", { newValue: visibility, reason: body.trim() }));
    return updateItem(store, item);
  },

  getEligibleOwners() {
    return mockEmployees.filter((employee) => employee.accountStatus === "active" && employee.role !== "system-administrator");
  },

  resetDemoData() {
    const store = newStore();
    saveStore(store);
    return structuredClone(store.escalations);
  },
};
