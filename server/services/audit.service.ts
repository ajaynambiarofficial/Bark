import { auditEvents } from "../db/schema.js";
import type { AuthPrincipal } from "../auth/types.js";

interface DatabaseExecutor {
  insert: (table: typeof auditEvents) => {
    values: (value: typeof auditEvents.$inferInsert) => PromiseLike<unknown>;
  };
}

const sensitiveKeys = new Set(["password", "passwordHash", "phone", "email", "customerPhone", "token", "tokenHash"]);

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !sensitiveKeys.has(key)).map(([key, nested]) => [key, sanitize(nested)]));
}

export interface AuditInput {
  actor: AuthPrincipal;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: Record<string, unknown> | undefined;
  newValue?: Record<string, unknown> | undefined;
  reason?: string | undefined;
  requestId?: string | undefined;
  ipAddress?: string | undefined;
}

export async function appendAudit(database: DatabaseExecutor, input: AuditInput) {
  await database.insert(auditEvents).values({
    actorId: input.actor.userId,
    actorRole: input.actor.roleKey,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    previousValue: input.previousValue ? sanitize(input.previousValue) as Record<string, unknown> : null,
    newValue: input.newValue ? sanitize(input.newValue) as Record<string, unknown> : null,
    reason: input.reason ?? null,
    requestId: input.requestId ?? null,
    ipAddress: input.ipAddress ?? null,
  });
}
