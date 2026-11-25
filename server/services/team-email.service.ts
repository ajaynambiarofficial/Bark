import nodemailer, { type SentMessageInfo } from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

export async function sendTeamEmail(input: {
  senderName: string;
  senderRole: string;
  senderEmail: string;
  subject: string;
  body: string;
  recipients: Array<{ email: string; displayName: string }>;
}) {
  if (!env.emailConfigured) throw new Error("Email delivery is not configured.");

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST!,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE === "true",
    auth: { user: env.SMTP_USER!, pass: env.SMTP_PASSWORD! },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
  const safeBody = escapeHtml(input.body).replace(/\r?\n/g, "<br>");
  const sender = `${input.senderName} (${input.senderRole})`;
  let info: SentMessageInfo;
  try {
    info = await transport.sendMail({
      from: { name: `${input.senderName} via Bark`, address: env.EMAIL_FROM! },
      replyTo: { name: input.senderName, address: input.senderEmail },
      to: "undisclosed-recipients:;",
      bcc: input.recipients.map((recipient) => ({ address: recipient.email })),
      subject: input.subject,
      text: `${input.body}\n\n— ${sender} via Bark`,
      html: `<div style="margin:0;background:#f4f6f4;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#1b2b22"><div style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #e2e8e3;border-radius:14px;overflow:hidden"><div style="padding:22px 26px;background:#173b2d;color:#fff"><p style="margin:0 0 8px;color:#bce4ce;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">Bark team update</p><h1 style="margin:0;font-size:21px;line-height:1.35">${escapeHtml(input.subject)}</h1></div><div style="padding:24px 26px;font-size:14px;line-height:1.7;white-space:normal">${safeBody}</div><div style="padding:0 26px 22px;color:#66756b;font-size:12px">Sent by ${escapeHtml(sender)} via Bark. Replies go to ${escapeHtml(input.senderEmail)}.</div></div></div>`,
    });
  } catch (error) {
    logger.error({ recipientCount: input.recipients.length, err: error }, "Team email delivery failed");
    throw error;
  }
  logger.info({ recipientCount: input.recipients.length, messageId: info.messageId }, "Team email sent");
  return { messageId: info.messageId };
}
