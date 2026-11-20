import { Router } from "express";
import { and, asc, count, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { noticeAcknowledgements, noticeComments, notices, users } from "../db/schema.js";
import { ApiError } from "../lib/errors.js";
import { parseBody } from "../lib/validation.js";
import { appendAudit } from "../services/audit.service.js";

const router = Router();
const idSchema = z.string().uuid();
const createSchema = z.object({
  title: z.string().trim().min(3).max(180),
  body: z.string().trim().min(1).max(10_000),
  type: z.enum(["general", "important", "reminder"]),
  cadence: z.enum(["once", "daily", "weekly"]),
  expiresAt: z.coerce.date(),
});
const commentSchema = z.object({ body: z.string().trim().min(1).max(3000) });

function requirePublisher(clearanceLevel: number) {
  if (clearanceLevel <= 10) throw new ApiError(403, "NOTICE_PUBLISH_DENIED", "Only team leads, managers, and higher-level users can publish notices.");
}

async function activeNotice(id: string) {
  const [notice] = await db.select().from(notices).where(and(eq(notices.id, id), isNull(notices.archivedAt), gt(notices.expiresAt, new Date()))).limit(1);
  if (!notice) throw new ApiError(404, "NOTICE_NOT_FOUND", "This notice is no longer available.");
  return notice;
}

router.get("/", async (request, response) => {
  const actor = request.auth!;
  const now = new Date();
  const rows = await db.select({
    notice: notices,
    author: { id: users.id, displayName: users.displayName },
  }).from(notices).innerJoin(users, eq(notices.createdBy, users.id))
    .where(and(isNull(notices.archivedAt), gt(notices.expiresAt, now)))
    .orderBy(desc(notices.createdAt));
  const [counts, ownAcks, commentCounts] = await Promise.all([
    db.select({ noticeId: noticeAcknowledgements.noticeId, total: count() }).from(noticeAcknowledgements).groupBy(noticeAcknowledgements.noticeId),
    db.select({ noticeId: noticeAcknowledgements.noticeId }).from(noticeAcknowledgements).where(eq(noticeAcknowledgements.userId, actor.userId)),
    db.select({ noticeId: noticeComments.noticeId, total: count() }).from(noticeComments).groupBy(noticeComments.noticeId),
  ]);
  const countByNotice = new Map(counts.map((row) => [row.noticeId, Number(row.total)]));
  const commentsByNotice = new Map(commentCounts.map((row) => [row.noticeId, Number(row.total)]));
  const acknowledged = new Set(ownAcks.map((row) => row.noticeId));
  response.json({ data: { notices: rows.map(({ notice, author }) => ({
    ...notice,
    author,
    acknowledgedByMe: acknowledged.has(notice.id),
    acknowledgementCount: countByNotice.get(notice.id) ?? 0,
    commentCount: commentsByNotice.get(notice.id) ?? 0,
  })), canPublish: actor.clearanceLevel > 10 } });
});

router.post("/", async (request, response) => {
  const input = parseBody(request, createSchema);
  const actor = request.auth!;
  requirePublisher(actor.clearanceLevel);
  if (input.expiresAt <= new Date()) throw new ApiError(400, "NOTICE_EXPIRY_INVALID", "Choose an expiry time in the future.");
  const [notice] = await db.transaction(async (transaction) => {
    const created = await transaction.insert(notices).values({ ...input, createdBy: actor.userId }).returning();
    const record = created[0];
    if (!record) throw new ApiError(500, "NOTICE_CREATE_FAILED", "The notice could not be created.");
    await appendAudit(transaction, { actor, action: "notice.created", entityType: "notice", entityId: record.id, newValue: { title: record.title, type: record.type, cadence: record.cadence, expiresAt: record.expiresAt.toISOString() }, requestId: request.requestId, ipAddress: request.ip });
    return created;
  });
  response.status(201).json({ data: { ...notice, author: { id: actor.userId, displayName: actor.displayName }, acknowledgedByMe: false, acknowledgementCount: 0, commentCount: 0 } });
});

router.get("/:id/comments", async (request, response) => {
  const id = idSchema.parse(request.params.id);
  await activeNotice(id);
  const rows = await db.select({ id: noticeComments.id, body: noticeComments.body, createdAt: noticeComments.createdAt, author: { id: users.id, displayName: users.displayName } })
    .from(noticeComments).innerJoin(users, eq(noticeComments.authorId, users.id))
    .where(eq(noticeComments.noticeId, id)).orderBy(asc(noticeComments.createdAt));
  response.json({ data: rows });
});

router.post("/:id/comments", async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const input = parseBody(request, commentSchema);
  const actor = request.auth!;
  await activeNotice(id);
  const [comment] = await db.insert(noticeComments).values({ noticeId: id, authorId: actor.userId, body: input.body }).returning();
  response.status(201).json({ data: { ...comment, author: { id: actor.userId, displayName: actor.displayName } } });
});

router.post("/:id/acknowledge", async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const actor = request.auth!;
  await activeNotice(id);
  await db.insert(noticeAcknowledgements).values({ noticeId: id, userId: actor.userId }).onConflictDoNothing();
  const [summary] = await db.select({ total: count() }).from(noticeAcknowledgements).where(eq(noticeAcknowledgements.noticeId, id));
  response.json({ data: { acknowledged: true, acknowledgementCount: Number(summary?.total ?? 0) } });
});

router.post("/:id/archive", async (request, response) => {
  const id = idSchema.parse(request.params.id);
  const actor = request.auth!;
  const [notice] = await db.select().from(notices).where(and(eq(notices.id, id), isNull(notices.archivedAt))).limit(1);
  if (!notice) throw new ApiError(404, "NOTICE_NOT_FOUND", "The notice was not found.");
  if (notice.createdBy !== actor.userId) requirePublisher(actor.clearanceLevel);
  await db.transaction(async (transaction) => {
    await transaction.update(notices).set({ archivedAt: new Date(), archivedBy: actor.userId, updatedAt: new Date() }).where(eq(notices.id, id));
    await appendAudit(transaction, { actor, action: "notice.archived", entityType: "notice", entityId: id, previousValue: { archivedAt: null }, newValue: { archivedBy: actor.userId }, requestId: request.requestId, ipAddress: request.ip });
  });
  response.json({ data: { archived: true } });
});

export const noticeRouter = router;
