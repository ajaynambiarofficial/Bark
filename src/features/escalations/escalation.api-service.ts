import type { Employee } from "../../types/auth";
import type { ActivityType, CommentVisibility, CreateEscalationInput, Escalation, EscalationStatus, EscalationTier, PersonSnapshot } from "./escalation.types";
import { dataSources } from "../../config/data-sources";

type ApiPerson = { id: string; displayName: string; email?: string; role?: string; roleLabel?: string; department?: string; assignment?: string };
type ApiRecord = Record<string, unknown>;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${dataSources.internalApi.baseUrl}${path}`, { ...init, credentials: "include", headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => null) as { data?: T; error?: { message?: string } } | null;
  if (!response.ok) throw new Error(body?.error?.message ?? "The escalation request failed.");
  return body?.data as T;
}

function person(value: unknown, fallback?: Employee): PersonSnapshot {
  const data = (value ?? {}) as Partial<ApiPerson>;
  const role = data.role ?? fallback?.role ?? "central-management";
  return {
    id: data.id ?? fallback?.id ?? "unknown",
    displayName: data.displayName ?? fallback?.displayName ?? "Unknown user",
    email: data.email ?? fallback?.email ?? "",
    role: role as Employee["role"],
    roleLabel: data.roleLabel ?? fallback?.roleLabel ?? role,
    department: data.department ?? fallback?.department ?? "",
    assignment: data.assignment ?? fallback?.assignment ?? "",
  };
}

function textValue(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).map((item) => String(item)).join(" · ");
  return undefined;
}

function mapRecord(source: ApiRecord, actor: Employee): Escalation {
  const row = (source.escalation ?? source) as ApiRecord;
  const reporter = person(source.reporter, actor);
  const owner = person(source.owner ?? source.accountableOwner, actor);
  const slaDueAt = new Date(String(row.slaDueAt)).toISOString();
  const createdAt = new Date(String(row.createdAt)).toISOString();
  const activityRows = (source.activity ?? []) as ApiRecord[];
  const comments = (source.comments ?? []) as ApiRecord[];
  const history = (source.ownershipHistory ?? []) as ApiRecord[];
  const actionTypes: Record<string, ActivityType> = { created: "created", "owner-assigned": "owner-assigned", "owner-transferred": "owner-transferred", "status-changed": "status-changed", "tier-increased": "tier-increased", "comment-added": "comment-added" };
  const mappedActivity = activityRows.map((event) => {
    const actorData = event.actor;
    return {
      id: String(event.id), escalationId: String(row.id), actorId: String(event.actorId),
      actorName: person(actorData, actor).displayName, actorRole: person(actorData, actor).role,
      type: actionTypes[String(event.action)] ?? "status-changed", timestamp: new Date(String(event.createdAt)).toISOString(),
      previousValue: textValue(event.previousValue), newValue: textValue(event.newValue),
      reason: typeof event.reason === "string" ? event.reason : undefined,
    };
  });
  return {
    id: String(row.id), reference: String(row.reference ?? row.id),
    issueType: String(row.issueType) as Escalation["issueType"], referenceType: String(row.referenceType) as Escalation["referenceType"],
    title: String(row.title), description: String(row.description ?? ""), category: String(row.category) as Escalation["category"],
    module: row.module ? String(row.module) : undefined, channel: row.channel ? String(row.channel) : undefined,
    clinic: typeof source.clinic === "string" ? source.clinic : ((source.clinic as { name?: string } | null)?.name ?? undefined),
    service: row.service ? String(row.service) : undefined, issueSubtype: String(row.issueSubtype), customIssue: row.customIssue ? String(row.customIssue) : undefined,
    linkedTicketId: row.linkedTicketId ? String(row.linkedTicketId) : undefined, customerPhone: row.customerPhoneMasked ? String(row.customerPhoneMasked) : undefined,
    appointmentId: row.appointmentId ? String(row.appointmentId) : undefined,
    reporter, originatingDepartment: String(row.originatingDepartment), responsibleDepartment: String(row.responsibleDepartment), assignedTeam: String(row.assignedTeam),
    accountableOwner: owner, collaborators: [], tier: Number(row.tier) as EscalationTier, priority: String(row.priority) as Escalation["priority"], status: String(row.status) as EscalationStatus,
    createdAt, updatedAt: new Date(String(row.updatedAt)).toISOString(), slaTargetMinutes: Math.max(1, Math.round((Date.parse(slaDueAt) - Date.parse(createdAt)) / 60_000)), slaDueAt,
    resolvedAt: row.resolvedAt ? new Date(String(row.resolvedAt)).toISOString() : undefined,
    attachments: (row.attachmentMetadata as Array<{ id: string; name: string; size: number; type: string }> | undefined) ?? [],
    comments: comments.map((comment) => ({ id: String(comment.id), author: person(comment.author, actor), body: String(comment.body), visibility: String(comment.visibility) as CommentVisibility, createdAt: new Date(String(comment.createdAt)).toISOString() })),
    activity: mappedActivity,
    ownershipHistory: history.map((entry) => ({ owner: person(entry.owner, actor), assignedBy: person(entry.assignedBy, actor), assignedAt: new Date(String(entry.assignedAt)).toISOString(), reason: String(entry.reason) })),
    sharedEmployeeIds: [reporter.id, owner.id], sharedDepartments: [String(row.originatingDepartment), String(row.responsibleDepartment)], requiresAssignment: false,
  };
}

export const escalationApiService = {
  async listEscalations(actor: Employee): Promise<Escalation[]> {
    const rows = await request<ApiRecord[]>("/escalations?limit=100");
    return rows.map((row) => mapRecord(row, actor));
  },
  async getEscalationById(id: string, actor: Employee): Promise<Escalation> {
    return mapRecord(await request<ApiRecord>(`/escalations/${encodeURIComponent(id)}`), actor);
  },
  async createEscalation(input: CreateEscalationInput, actor: Employee): Promise<Escalation> {
    const clinics = input.clinic ? await request<Array<{ id: string; name: string }>>("/catalog/clinics") : [];
    const clinic = input.clinic ? clinics.find((item) => item.name.toLowerCase() === input.clinic?.toLowerCase() || item.name.toLowerCase().startsWith(input.clinic?.toLowerCase() ?? "")) : undefined;
    const created = await request<{ id: string }>("/escalations", { method: "POST", body: JSON.stringify({
      issueType: input.issueType, referenceType: input.referenceType, title: input.title, description: input.description, category: input.category,
      issueSubtype: input.issueSubtype, customIssue: input.customIssue, module: input.module, channel: input.channel, service: input.service,
      linkedTicketId: input.linkedTicketId, customerPhone: input.customerPhone, appointmentId: input.appointmentId, attachments: input.attachments.map(({ name, size, type }) => ({ name, size, type })), ...(clinic ? { clinicId: clinic.id } : {}),
    }) });
    return this.getEscalationById(created.id, actor);
  },
  async updateEscalationStatus(id: string, status: EscalationStatus, actor: Employee, reason?: string): Promise<Escalation> {
    await request(`/escalations/${encodeURIComponent(id)}/status`, { method: "POST", body: JSON.stringify({ status, reason }) });
    return this.getEscalationById(id, actor);
  },
  async transferEscalationOwnership(id: string, ownerId: string, reason: string, actor: Employee): Promise<Escalation> {
    await request(`/escalations/${encodeURIComponent(id)}/assign`, { method: "POST", body: JSON.stringify({ ownerId, reason }) });
    return this.getEscalationById(id, actor);
  },
  async escalateTier(id: string, tier: EscalationTier, reason: string, actor: Employee): Promise<Escalation> {
    await request(`/escalations/${encodeURIComponent(id)}/tier`, { method: "POST", body: JSON.stringify({ tier, reason }) });
    return this.getEscalationById(id, actor);
  },
  async addEscalationComment(id: string, body: string, visibility: CommentVisibility, actor: Employee): Promise<Escalation> {
    await request(`/escalations/${encodeURIComponent(id)}/comments`, { method: "POST", body: JSON.stringify({ body, visibility }) });
    return this.getEscalationById(id, actor);
  },
  async getEligibleOwners(): Promise<Employee[]> {
    return (await request<ApiPerson[]>("/escalations/owners")).map((value) => ({ id: value.id, displayName: value.displayName ?? "", email: value.email ?? "", role: (value.role ?? "central-management") as Employee["role"], roleLabel: value.roleLabel ?? value.role ?? "", department: value.department ?? "", assignment: value.assignment ?? "", accountStatus: "active" }));
  },
};
