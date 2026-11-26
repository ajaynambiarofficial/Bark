import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "../db/client.js";
import { ApiError } from "../lib/errors.js";
import { parseBody } from "../lib/validation.js";
import { appendAudit } from "../services/audit.service.js";
import { completeMailboxAuthorization, createAuthorizationUrl, disconnectMailbox, mailboxStatus, sendWithGmailApi, storeOAuthState } from "../services/gmail-api.service.js";
import { env } from "../config/env.js";
import { roles, teamEmails, users } from "../db/schema.js";

const router = Router();
const idSchema = z.string().uuid();
const draftSchema = z.object({
  subject: z.string().trim().max(200).default(""),
  body: z.string().trim().max(20_000).default(""),
  recipientUserIds: z.array(idSchema).max(200).default([]),
});
const sendSubjectSchema = z.string().trim().min(3).max(200).regex(/^[^\r\n]+$/);

function requireSender(clearanceLevel: number) {
  if (clearanceLevel <= 10) throw new ApiError(403, "TEAM_EMAIL_DENIED", "Team email is available to team leads, managers, and administrators.");
}

function requireMailboxAdmin(clearanceLevel: number) {
  if (clearanceLevel < 90) throw new ApiError(403, "TEAM_EMAIL_SETTINGS_DENIED", "Only administrators can connect the shared Gmail account.");
}

function hasDeliverableEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  return Boolean(domain && domain.includes(".") && !domain.endsWith(".local") && !domain.endsWith(".test") && !domain.endsWith(".invalid") && !["example.com", "example.net", "example.org"].includes(domain));
}

async function resolveRecipients(ids: string[]) {
  const recipientUserIds = [...new Set(ids)];
  if (recipientUserIds.length > 200) throw new ApiError(400, "TEAM_EMAIL_RECIPIENT_LIMIT", "Choose no more than 200 recipients per email.");
  if (!recipientUserIds.length) return { recipientUserIds, recipients: [] as Array<{ id: string; email: string; displayName: string }> };
  const recipients = await db.select({ id: users.id, email: users.email, displayName: users.displayName })
    .from(users).innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(inArray(users.id, recipientUserIds), eq(users.accountStatus, "active"), eq(roles.active, true)))
    .orderBy(asc(users.displayName));
  const deliverableRecipients = recipients.filter((recipient) => hasDeliverableEmail(recipient.email));
  if (deliverableRecipients.length !== recipientUserIds.length) throw new ApiError(400, "TEAM_EMAIL_RECIPIENT_UNAVAILABLE", "One or more selected team members have an inactive, unavailable, or non-deliverable email address.");
  return { recipientUserIds, recipients: deliverableRecipients };
}

router.get("/recipients", async (request, response) => {
  const actor = request.auth!;
  requireSender(actor.clearanceLevel);
  const recipients = (await db.select({ id: users.id, displayName: users.displayName, email: users.email, department: users.department, roleKey: roles.key, roleName: roles.name })
    .from(users).innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.accountStatus, "active"), eq(roles.active, true)))
    .orderBy(asc(users.displayName))).filter((recipient) => hasDeliverableEmail(recipient.email));
  const mailbox = await mailboxStatus();
  response.json({ data: { recipients, emailConfigured: mailbox.configured, mailboxConnectedEmail: mailbox.connectedEmail, mailboxSetupAvailable: mailbox.setupAvailable, canManageMailbox: actor.clearanceLevel >= 90, replyToEmail: hasDeliverableEmail(actor.email) ? actor.email : mailbox.connectedEmail, maxRecipients: 200 } });
});

router.post("/mailbox/connect", async (request, response) => {
  const actor = request.auth!;
  requireMailboxAdmin(actor.clearanceLevel);
  const status = await mailboxStatus();
  if (!status.setupAvailable) throw new ApiError(503, "TEAM_EMAIL_OAUTH_NOT_CONFIGURED", "Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MAIL_TOKEN_ENCRYPTION_KEY, and EMAIL_FROM to the server environment first.");
  const state = randomBytes(32).toString("base64url");
  await storeOAuthState(state);
  response.json({ data: { authorizationUrl: createAuthorizationUrl(state) } });
});

router.get("/google/callback", async (request, response) => {
  const actor = request.auth!;
  requireMailboxAdmin(actor.clearanceLevel);
  const code = typeof request.query.code === "string" ? request.query.code : "";
  const state = typeof request.query.state === "string" ? request.query.state : "";
  const oauthError = typeof request.query.error === "string" ? request.query.error : "";
  let result = "error";
  if (code && state && !oauthError) {
    try {
      await completeMailboxAuthorization(code, state, actor.userId);
      await appendAudit(db, { actor, action: "team_email.mailbox_connected", entityType: "team_email_mailbox", entityId: "shared", newValue: { connected: true }, requestId: request.requestId, ipAddress: request.ip });
      result = "connected";
    } catch {
      result = "error";
    }
  }
  const redirect = new URL("/team-email", env.APP_ORIGIN);
  redirect.searchParams.set("mailbox", result);
  response.redirect(303, redirect.toString());
});

router.post("/mailbox/disconnect", async (request, response) => {
  const actor = request.auth!;
  requireMailboxAdmin(actor.clearanceLevel);
  const previous = await mailboxStatus();
  await disconnectMailbox();
  await appendAudit(db, { actor, action: "team_email.mailbox_disconnected", entityType: "team_email_mailbox", entityId: "shared", previousValue: { connected: Boolean(previous.connectedEmail) }, newValue: { connected: false }, requestId: request.requestId, ipAddress: request.ip });
  response.json({ data: { disconnected: true } });
});

router.get("/", async (request, response) => {
  const actor = request.auth!;
  requireSender(actor.clearanceLevel);
  const rows = await db.select().from(teamEmails).where(eq(teamEmails.createdBy, actor.userId)).orderBy(desc(teamEmails.updatedAt)).limit(50);
  response.json({ data: rows });
});

router.post("/", async (request, response) => {
  const actor = request.auth!;
  requireSender(actor.clearanceLevel);
  const input = parseBody(request, draftSchema);
  const recipients = await resolveRecipients(input.recipientUserIds);
  const [draft] = await db.transaction(async (transaction) => {
    const created = await transaction.insert(teamEmails).values({ ...input, recipientUserIds: recipients.recipientUserIds, createdBy: actor.userId }).returning();
    const record = created[0];
    if (!record) throw new ApiError(500, "TEAM_EMAIL_DRAFT_FAILED", "The email draft could not be saved.");
    await appendAudit(transaction, { actor, action: "team_email.draft_created", entityType: "team_email", entityId: record.id, newValue: { status: record.status, recipientCount: recipients.recipientUserIds.length }, requestId: request.requestId, ipAddress: request.ip });
    return created;
  });
  response.status(201).json({ data: draft });
});

router.put("/:id", async (request, response) => {
  const actor = request.auth!;
  requireSender(actor.clearanceLevel);
  const id = idSchema.parse(request.params.id);
  const input = parseBody(request, draftSchema);
  const recipients = await resolveRecipients(input.recipientUserIds);
  const [draft] = await db.transaction(async (transaction) => {
    const [updated] = await transaction.update(teamEmails).set({ ...input, recipientUserIds: recipients.recipientUserIds, updatedAt: new Date() })
      .where(and(eq(teamEmails.id, id), eq(teamEmails.createdBy, actor.userId), eq(teamEmails.status, "draft"))).returning();
    if (!updated) throw new ApiError(404, "TEAM_EMAIL_DRAFT_NOT_FOUND", "This editable draft was not found.");
    await appendAudit(transaction, { actor, action: "team_email.draft_updated", entityType: "team_email", entityId: id, newValue: { status: updated.status, recipientCount: recipients.recipientUserIds.length }, requestId: request.requestId, ipAddress: request.ip });
    return [updated];
  });
  response.json({ data: draft });
});

router.post("/:id/send", async (request, response) => {
  const actor = request.auth!;
  requireSender(actor.clearanceLevel);
  if (!(await mailboxStatus()).configured) throw new ApiError(503, "TEAM_EMAIL_NOT_CONFIGURED", "Connect the shared Gmail account before sending. Drafts can still be saved.");
  const id = idSchema.parse(request.params.id);
  const [draft] = await db.select().from(teamEmails).where(and(eq(teamEmails.id, id), eq(teamEmails.createdBy, actor.userId))).limit(1);
  if (!draft) throw new ApiError(404, "TEAM_EMAIL_DRAFT_NOT_FOUND", "This draft was not found.");
  if (draft.status !== "draft") throw new ApiError(409, "TEAM_EMAIL_ALREADY_PROCESSED", "This email is no longer an editable draft.");
  const subject = sendSubjectSchema.parse(draft.subject);
  if (draft.body.trim().length < 3) throw new ApiError(400, "TEAM_EMAIL_BODY_REQUIRED", "Write an email body before sending.");
  const { recipients } = await resolveRecipients(draft.recipientUserIds);
  if (!recipients.length) throw new ApiError(400, "TEAM_EMAIL_RECIPIENTS_REQUIRED", "Select at least one active team member before sending.");
  const [claimed] = await db.update(teamEmails).set({ status: "sending", updatedAt: new Date() })
    .where(and(eq(teamEmails.id, id), eq(teamEmails.createdBy, actor.userId), eq(teamEmails.status, "draft"))).returning({ id: teamEmails.id });
  if (!claimed) throw new ApiError(409, "TEAM_EMAIL_ALREADY_PROCESSED", "This email was already opened for sending.");

  let messageId: string;
  try {
    ({ messageId } = await sendWithGmailApi({ senderName: actor.displayName, senderRole: actor.roleName, senderEmail: hasDeliverableEmail(actor.email) ? actor.email : (await mailboxStatus()).connectedEmail!, subject, body: draft.body, recipients }));
  } catch (error) {
    await db.transaction(async (transaction) => {
      await transaction.update(teamEmails).set({ status: "failed", updatedAt: new Date() }).where(eq(teamEmails.id, id));
      await appendAudit(transaction, { actor, action: "team_email.send_failed", entityType: "team_email", entityId: id, newValue: { recipientCount: recipients.length }, requestId: request.requestId, ipAddress: request.ip });
    });
    throw new ApiError(502, "TEAM_EMAIL_SEND_FAILED", "The email could not be sent. Check the mail configuration or create a new draft and try again.");
  }

  const [sent] = await db.transaction(async (transaction) => {
    const updated = await transaction.update(teamEmails).set({ status: "sent", sentAt: new Date(), providerMessageId: messageId, updatedAt: new Date() }).where(eq(teamEmails.id, id)).returning();
    await appendAudit(transaction, { actor, action: "team_email.sent", entityType: "team_email", entityId: id, newValue: { subject, recipientCount: recipients.length }, requestId: request.requestId, ipAddress: request.ip });
    return updated;
  });
  response.json({ data: sent });
});

export const teamEmailRouter = router;
