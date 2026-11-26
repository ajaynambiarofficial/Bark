import PDFDocument from "pdfkit";
import { eq } from "drizzle-orm";
import { env } from "../config/env.js";
import { db } from "../db/client.js";
import { clinics, escalations, roles, users } from "../db/schema.js";
import { logger } from "../lib/logger.js";
import { mailboxStatus, sendWithGmailApi } from "./gmail-api.service.js";

const recipients = ["akshay.slovespets@supertails.in", "lokesh.klovespets@supertails.com"];
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const display = (value: string | null | undefined) => value?.trim() || "Not provided";

function buildEscalationPdf(record: {
  reference: string; title: string; description: string; category: string; status: string; priority: string; tier: number;
  customerPhone: string | null; clinicName: string | null; reporterName: string; reporterRole: string; reporterDepartment: string;
  originatingDepartment: string; responsibleDepartment: string; assignedTeam: string; slaDueAt: Date; createdAt: Date; updatedAt: Date;
}) {
  return new Promise<Buffer>((resolve, reject) => {
    const document = new PDFDocument({ size: "A4", margin: 48, info: { Title: `${record.reference} - Bark by Supertails`, Author: "Bark by Supertails" } });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    const green = "#17613f";
    const lime = "#b8f27a";
    const muted = "#68756d";
    const line = "#d8dfd9";
    const date = (value: Date) => value.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const field = (label: string, value: string) => { document.fontSize(8).fillColor(muted).text(label.toUpperCase()); document.fontSize(10).fillColor("#1c2821").text(display(value)); };
    document.rect(48, 42, 499, 5).fill(lime);
    document.fillColor(green).fontSize(10).font("Helvetica-Bold").text("BARK / SUPERTAILS", 48, 62, { characterSpacing: 1.5 });
    document.fillColor(muted).font("Helvetica").fontSize(9).text("Escalation summary", 48, 78);
    document.fillColor(muted).fontSize(9).text(record.reference, 440, 68, { width: 107, align: "right" });
    document.moveDown(2);
    document.fillColor(green).font("Helvetica-Bold").fontSize(8).text(record.category.toUpperCase(), 48);
    document.fillColor("#1c2821").fontSize(22).text(record.title, { width: 499 });
    document.fillColor(green).fontSize(9).text(`${record.status}   ·   ${record.priority} priority   ·   Tier ${record.tier}`);
    document.moveDown(1);
    document.strokeColor(line).moveTo(48, document.y).lineTo(547, document.y).stroke();
    document.moveDown(1);
    const top = document.y;
    field("Reporter", `${record.reporterName} · ${record.reporterRole}`); document.x = 300; document.y = top; field("Accountable team", record.assignedTeam);
    document.x = 48; document.moveDown(1); field("Originating department", record.originatingDepartment); document.x = 300; document.y = document.y - 26; field("Responsible department", record.responsibleDepartment);
    document.x = 48; document.moveDown(1); field("Assigned clinic", record.clinicName ?? "Not applicable"); document.x = 300; document.y = document.y - 26; field("Customer phone", record.customerPhone ?? "Not provided");
    document.x = 48; document.moveDown(1); field("Created", date(record.createdAt)); document.x = 300; document.y = document.y - 26; field("Last updated", date(record.updatedAt));
    document.x = 48; document.moveDown(2);
    const section = (title: string, body: string) => { document.fillColor(green).font("Helvetica-Bold").fontSize(12).text(title); document.moveDown(0.35); document.fillColor("#1c2821").font("Helvetica").fontSize(10).text(body || "Not provided", { lineGap: 3 }); document.moveDown(1); document.strokeColor(line).moveTo(48, document.y).lineTo(547, document.y).stroke(); document.moveDown(1); };
    section("Description", record.description);
    section("SLA due", date(record.slaDueAt));
    document.fillColor(muted).fontSize(8).text("Generated from Bark by Supertails", 48, 770);
    document.end();
  });
}

export async function sendEscalationUpdateEmail(escalationId: string, eventLabel: string) {
  try {
    if (!(await mailboxStatus()).configured) {
      logger.warn({ escalationId, eventLabel }, "Escalation email skipped because the shared Gmail account is not connected");
      return;
    }

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
      customerPhone: escalations.customerPhone,
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
      ["Customer phone", record.customerPhone ?? record.customerPhoneMasked ?? ""], ["Reported by", `${record.reporterName} (${record.reporterRole}, ${record.reporterDepartment})`],
      ["Current owner", owner ? `${owner.displayName} (${owner.department})` : ""], ["Originating department", record.originatingDepartment],
      ["Responsible department", record.responsibleDepartment], ["Assigned team", record.assignedTeam],
      ["SLA due", new Date(record.slaDueAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })],
      ["Created", new Date(record.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })],
      ["Last updated", new Date(record.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })],
      ["Attachments", record.attachmentMetadata.map((attachment) => attachment.name).join(", ")],
    ] satisfies Array<[string, string]>).filter(([, value]) => value.trim().length > 0);

    const subject = `[Bark ${record.reference}] ${eventLabel}: ${record.title}`;
    const text = `Bark escalation update\n\n${fields.map(([label, value]) => `${label}: ${value}`).join("\n")}`;
    const htmlRows = fields.map(([label, value]) => `<tr><th align="left" style="padding:10px 12px;border-bottom:1px solid #e8eaf0;color:#596176;font-size:12px;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</th><td style="padding:10px 12px;border-bottom:1px solid #e8eaf0;color:#20263a;font-size:13px;line-height:1.5;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`).join("");
    const html = `<div style="margin:0;background:#f5f6fa;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#20263a"><div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #e5e7ef;border-radius:12px;overflow:hidden"><div style="padding:22px 24px;background:#17223f;color:#fff"><p style="margin:0 0 8px;color:#bfc9e8;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">Bark · Escalation update</p><h1 style="margin:0;font-size:21px;line-height:1.35">${escapeHtml(eventLabel)}</h1><p style="margin:8px 0 0;color:#e3e8f5;font-size:14px">${escapeHtml(record.reference)} · ${escapeHtml(record.title)}</p></div><div style="padding:18px 24px"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${htmlRows}</table><p style="margin:18px 0 0;color:#697187;font-size:11px">Automated notification from the Bark operations workspace.</p></div></div></div>`;
    const pdf = await buildEscalationPdf(record);
    await sendWithGmailApi({
      senderName: "Bark Operations",
      senderRole: "Escalation Alerts",
      senderEmail: env.EMAIL_FROM!,
      subject,
      text,
      html,
      attachments: [{ filename: `${record.reference}-bark-escalation.pdf`, content: pdf, contentType: "application/pdf" }],
      recipients: recipients.map((email) => ({ email, displayName: email })),
    });
    logger.info({ escalationId, eventLabel, recipientCount: recipients.length }, "Escalation update email sent");
  } catch (error) {
    logger.error({ escalationId, eventLabel, err: error }, "Escalation update email failed");
  }
}
