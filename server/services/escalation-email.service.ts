import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { env } from "../config/env.js";
import { db } from "../db/client.js";
import { clinics, escalations, roles, users } from "../db/schema.js";
import { logger } from "../lib/logger.js";

const recipients = ["akshay.slovespets@supertails.in", "lokesh.klovespets@supertails.com"];
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const display = (value: string | null | undefined) => value?.trim() || "Not provided";

export async function sendEscalationUpdateEmail(escalationId: string, eventLabel: string) {
  if (!env.emailConfigured) {
    logger.warn({ escalationId, eventLabel }, "Escalation email skipped because SMTP is not configured");
    return;
  }

  try {
    const [record] = await db.select({
      reference: escalations.reference,
      issueType: escalations.issueType,
      referenceType: escalations.referenceType,
      title: escalations.title,
      description: escalations.description,
      category: escalations.category,
      module: escalations.module,
      channel: escalations.channel,
      service: escalations.service,
      issueSubtype: escalations.issueSubtype,
      customIssue: escalations.customIssue,
      linkedTicketId: escalations.linkedTicketId,
      customerPhoneMasked: escalations.customerPhoneMasked,
      appointmentId: escalations.appointmentId,
      attachmentMetadata: escalations.attachmentMetadata,
      originatingDepartment: escalations.originatingDepartment,
      responsibleDepartment: escalations.responsibleDepartment,
      assignedTeam: escalations.assignedTeam,
      tier: escalations.tier,
      priority: escalations.priority,
      status: escalations.status,
      slaDueAt: escalations.slaDueAt,
      createdAt: escalations.createdAt,
      updatedAt: escalations.updatedAt,
      clinicName: clinics.name,
      reporterName: users.displayName,
      reporterDepartment: users.department,
      reporterRole: roles.name,
      ownerId: escalations.ownerId,
    }).from(escalations)
      .leftJoin(clinics, eq(escalations.clinicId, clinics.id))
      .innerJoin(users, eq(escalations.reporterId, users.id))
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(escalations.id, escalationId)).limit(1);
    if (!record) return;
    if (record.issueType !== "escalation") return;
    const [owner] = await db.select({ displayName: users.displayName, department: users.department }).from(users).where(eq(users.id, record.ownerId)).limit(1);

    const fields = ([
      ["Reference", record.reference], ["Update", eventLabel], ["Status", record.status], ["Tier", String(record.tier)], ["Priority", record.priority],
      ["Issue type", record.issueType], ["Reference type", record.referenceType], ["Title", record.title], ["Description", record.description],
      ["Category", record.category], ["Issue subtype", record.issueSubtype], ["Custom issue", record.customIssue ?? ""],
      ["Module", record.module ?? ""], ["Channel", record.channel ?? ""], ["Service", record.service ?? ""],
      ["Clinic", record.clinicName ?? ""], ["Linked ticket", record.linkedTicketId ?? ""], ["Appointment ID", record.appointmentId ?? ""],
      ["Customer phone", record.customerPhoneMasked ?? ""], ["Reported by", `${record.reporterName} (${record.reporterRole}, ${record.reporterDepartment})`],
      ["Current owner", owner ? `${owner.displayName} (${owner.department})` : ""], ["Originating department", record.originatingDepartment],
      ["Responsible department", record.responsibleDepartment], ["Assigned team", record.assignedTeam],
      ["SLA due", new Date(record.slaDueAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })],
      ["Created", new Date(record.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })],
      ["Last updated", new Date(record.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })],
      ["Attachments", record.attachmentMetadata.map((attachment) => attachment.name).join(", ")],
    ] satisfies Array<[string, string]>).filter(([, value]) => value.trim().length > 0);

    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST!,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE === "true",
      auth: { user: env.SMTP_USER!, pass: env.SMTP_PASSWORD! },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    const subject = `[Bark ${record.reference}] ${eventLabel}: ${record.title}`;
    const text = `Bark escalation update\n\n${fields.map(([label, value]) => `${label}: ${value}`).join("\n")}`;
    const htmlRows = fields.map(([label, value]) => `<tr><th align="left" style="padding:10px 12px;border-bottom:1px solid #e8eaf0;color:#596176;font-size:12px;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</th><td style="padding:10px 12px;border-bottom:1px solid #e8eaf0;color:#20263a;font-size:13px;line-height:1.5;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`).join("");
    const html = `<div style="margin:0;background:#f5f6fa;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#20263a"><div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #e5e7ef;border-radius:12px;overflow:hidden"><div style="padding:22px 24px;background:#17223f;color:#fff"><p style="margin:0 0 8px;color:#bfc9e8;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">Bark · Escalation update</p><h1 style="margin:0;font-size:21px;line-height:1.35">${escapeHtml(eventLabel)}</h1><p style="margin:8px 0 0;color:#e3e8f5;font-size:14px">${escapeHtml(record.reference)} · ${escapeHtml(record.title)}</p></div><div style="padding:18px 24px"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${htmlRows}</table><p style="margin:18px 0 0;color:#697187;font-size:11px">Automated notification from the Bark operations workspace.</p></div></div></div>`;
    await transport.sendMail({ from: env.EMAIL_FROM!, to: recipients, subject, text, html });
    logger.info({ escalationId, eventLabel, recipientCount: recipients.length }, "Escalation update email sent");
  } catch (error) {
    logger.error({ escalationId, eventLabel, err: error }, "Escalation update email failed");
  }
}
