import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { env } from "../config/env.js";
import { db } from "../db/client.js";
import { clinics, escalations, users } from "../db/schema.js";
import { logger } from "../lib/logger.js";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

export async function sendEscalationUpdateEmail(escalationId: string, eventLabel: string) {
  if (!env.emailConfigured) {
    logger.warn({ escalationId, eventLabel }, "Escalation email skipped because SMTP is not configured");
    return;
  }

  try {
    const [record] = await db.select({
      reference: escalations.reference,
      title: escalations.title,
      status: escalations.status,
      tier: escalations.tier,
      clinicName: clinics.name,
      reporterEmail: users.email,
      ownerId: escalations.ownerId,
    }).from(escalations)
      .leftJoin(clinics, eq(escalations.clinicId, clinics.id))
      .innerJoin(users, eq(escalations.reporterId, users.id))
      .where(eq(escalations.id, escalationId)).limit(1);
    if (!record) return;
    const [owner] = await db.select({ email: users.email, displayName: users.displayName }).from(users).where(eq(users.id, record.ownerId)).limit(1);
    const recipients = [...new Set([record.reporterEmail, owner?.email].filter((email): email is string => Boolean(email)))];
    if (!recipients.length) return;

    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST!,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE === "true",
      auth: { user: env.SMTP_USER!, pass: env.SMTP_PASSWORD! },
    });
    const subject = `[Bark ${record.reference}] ${eventLabel}`;
    const text = [
      `Hello,`,
      ``,
      `An escalation was updated in Bark.`,
      `Reference: ${record.reference}`,
      `Title: ${record.title}`,
      `Update: ${eventLabel}`,
      `Status: ${record.status}`,
      `Tier: ${record.tier}`,
      `Clinic: ${record.clinicName ?? "Not specified"}`,
      `Current owner: ${owner?.displayName ?? "Not assigned"}`,
    ].join("\n");
    const html = `<p>An escalation was updated in Bark.</p><dl><dt>Reference</dt><dd>${escapeHtml(record.reference)}</dd><dt>Title</dt><dd>${escapeHtml(record.title)}</dd><dt>Update</dt><dd>${escapeHtml(eventLabel)}</dd><dt>Status</dt><dd>${escapeHtml(record.status)}</dd><dt>Tier</dt><dd>${record.tier}</dd><dt>Clinic</dt><dd>${escapeHtml(record.clinicName ?? "Not specified")}</dd><dt>Current owner</dt><dd>${escapeHtml(owner?.displayName ?? "Not assigned")}</dd></dl>`;
    await transport.sendMail({ from: env.EMAIL_FROM!, to: recipients, subject, text, html });
    logger.info({ escalationId, eventLabel, recipientCount: recipients.length }, "Escalation update email sent");
  } catch (error) {
    logger.error({ escalationId, eventLabel, err: error }, "Escalation update email failed");
  }
}
