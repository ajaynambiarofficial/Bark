import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

export async function sendPasswordResetEmail(input: { email: string; resetUrl: string; expiresInMinutes: number }) {
  if (!env.emailConfigured) {
    logger.warn("Password reset email skipped because SMTP is not configured");
    return false;
  }

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST!,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE === "true",
    auth: { user: env.SMTP_USER!, pass: env.SMTP_PASSWORD! },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
  const safeUrl = escapeHtml(input.resetUrl);
  await transport.sendMail({
    from: { name: "Bark by Supertails", address: env.EMAIL_FROM! },
    to: input.email,
    subject: "Reset your Bark password",
    text: `We received a request to reset your Bark password. Open this link within ${input.expiresInMinutes} minutes to choose a new password:\n\n${input.resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<div style="margin:0;background:#f4f6f4;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#1b2b22"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8e3;border-radius:14px;overflow:hidden"><div style="padding:24px 28px;background:#173b2d;color:#fff"><p style="margin:0 0 8px;color:#bce4ce;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">Bark by Supertails</p><h1 style="margin:0;font-size:24px;line-height:1.3">Reset your password</h1></div><div style="padding:28px;font-size:14px;line-height:1.7"><p>We received a request to reset your Bark password.</p><p><a href="${safeUrl}" style="display:inline-block;background:#72cf95;color:#123426;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:8px">Choose a new password</a></p><p style="color:#66756b;font-size:12px">This link expires in ${input.expiresInMinutes} minutes and can only be used once. If you did not request this, you can ignore this email.</p></div></div></div>`,
  });
  logger.info("Password reset email sent");
  return true;
}
