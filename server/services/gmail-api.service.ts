import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";
import { db } from "../db/client.js";
import { teamEmailMailbox } from "../db/schema.js";
import { logger } from "../lib/logger.js";

const MAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const MAILBOX_ID = "shared";

function getOAuthClient() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new Error("Google OAuth credentials are missing.");
  return new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, getRedirectUri());
}

export function getRedirectUri() {
  return new URL("/api/team-emails/google/callback", env.APP_ORIGIN).toString();
}

function encryptionKey() {
  if (!env.MAIL_TOKEN_ENCRYPTION_KEY) throw new Error("Mail token encryption key is missing.");
  return Buffer.from(env.MAIL_TOKEN_ENCRYPTION_KEY, "hex");
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function decrypt(value: string) {
  const [ivText, tagText, ciphertextText] = value.split(".");
  if (!ivText || !tagText || !ciphertextText) throw new Error("Stored mail token is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8");
}

export async function mailboxStatus() {
  const [mailbox] = await db.select({ connectedEmail: teamEmailMailbox.connectedEmail, encryptedRefreshToken: teamEmailMailbox.encryptedRefreshToken })
    .from(teamEmailMailbox).where(eq(teamEmailMailbox.id, MAILBOX_ID)).limit(1);
  return {
    configured: Boolean(env.googleMailConfigured && mailbox?.encryptedRefreshToken),
    connectedEmail: mailbox?.encryptedRefreshToken ? mailbox.connectedEmail : null,
    setupAvailable: env.googleMailConfigured,
  };
}

export function createAuthorizationUrl(state: string) {
  return getOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: ["openid", "email", MAIL_SCOPE],
    state,
  });
}

export async function completeMailboxAuthorization(code: string, state: string, actorId: string) {
  const stateHash = createHash("sha256").update(state).digest("hex");
  const [pending] = await db.select({ oauthStateHash: teamEmailMailbox.oauthStateHash })
    .from(teamEmailMailbox)
    .where(and(eq(teamEmailMailbox.id, MAILBOX_ID), eq(teamEmailMailbox.oauthStateHash, stateHash), gt(teamEmailMailbox.oauthStateExpiresAt, new Date())))
    .limit(1);
  if (!pending) throw new Error("The Gmail connection request expired. Start the connection again.");

  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) throw new Error("Google did not return a refresh token. Disconnect the existing Bark app authorization in Google Account settings and connect again.");
  client.setCredentials(tokens);
  const userInfo = await client.request<{ email?: string; verified_email?: boolean }>({ url: "https://www.googleapis.com/oauth2/v2/userinfo" });
  const connectedEmail = userInfo.data.email?.trim().toLowerCase();
  const senderEmail = (env.EMAIL_FROM ?? "").trim().toLowerCase();
  if (!connectedEmail || userInfo.data.verified_email === false || connectedEmail !== senderEmail) throw new Error(`Connect the shared sender account ${env.EMAIL_FROM ?? "configured Bark address"}.`);

  await db.update(teamEmailMailbox).set({
    connectedEmail,
    encryptedRefreshToken: encrypt(tokens.refresh_token),
    oauthStateHash: null,
    oauthStateExpiresAt: null,
    updatedBy: actorId,
    updatedAt: new Date(),
  }).where(and(eq(teamEmailMailbox.id, MAILBOX_ID), eq(teamEmailMailbox.oauthStateHash, stateHash)));
}

export async function disconnectMailbox() {
  await db.update(teamEmailMailbox).set({ connectedEmail: null, encryptedRefreshToken: null, oauthStateHash: null, oauthStateExpiresAt: null, updatedAt: new Date() })
    .where(eq(teamEmailMailbox.id, MAILBOX_ID));
}

export async function sendWithGmailApi(input: {
  senderName: string;
  senderRole: string;
  senderEmail: string;
  subject: string;
  body: string;
  recipients: Array<{ email: string; displayName: string }>;
}) {
  const [mailbox] = await db.select({ encryptedRefreshToken: teamEmailMailbox.encryptedRefreshToken, connectedEmail: teamEmailMailbox.connectedEmail })
    .from(teamEmailMailbox).where(eq(teamEmailMailbox.id, MAILBOX_ID)).limit(1);
  if (!env.googleMailConfigured || !mailbox?.encryptedRefreshToken || !mailbox.connectedEmail) throw new Error("The shared Gmail account is not connected.");

  const client = getOAuthClient();
  client.setCredentials({ refresh_token: decrypt(mailbox.encryptedRefreshToken) });
  const accessToken = await client.getAccessToken();
  if (!accessToken.token) throw new Error("Google did not provide a Gmail access token.");

  const sender = `${input.senderName} (${input.senderRole})`;
  const validHeaderEmail = (email: string) => /^[^\s<>@]+@[^\s<>@]+$/.test(email);
  if (!validHeaderEmail(mailbox.connectedEmail) || !validHeaderEmail(input.senderEmail) || input.recipients.some((recipient) => !validHeaderEmail(recipient.email))) {
    throw new Error("An email address contains invalid header characters.");
  }
  const boundary = `bark_${randomBytes(18).toString("hex")}`;
  const encodeHeader = (value: string) => {
    const chunks: string[] = [];
    let chunk = "";
    for (const character of value) {
      if (Buffer.byteLength(chunk + character, "utf8") > 30 && chunk) {
        chunks.push(chunk);
        chunk = "";
      }
      chunk += character;
    }
    if (chunk) chunks.push(chunk);
    return chunks.map((part) => `=?UTF-8?B?${Buffer.from(part, "utf8").toString("base64")}?=`).join("\r\n ");
  };
  const wrapBase64 = (value: string) => value.match(/.{1,76}/g)?.join("\r\n") ?? "";
  const headers = [
    `From: ${encodeHeader(`${input.senderName} via Bark`)} <${mailbox.connectedEmail}>`,
    `Reply-To: ${encodeHeader(input.senderName)} <${input.senderEmail}>`,
    `To: undisclosed-recipients:;`,
    `Bcc: ${input.recipients.map((recipient) => recipient.email).join(", ")}`,
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const plainText = `${input.body}\n\n— ${sender} via Bark`;
  const htmlEscape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
  const htmlBody = `<div style="margin:0;background:#f4f6f4;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#1b2b22"><div style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #e2e8e3;border-radius:14px;overflow:hidden"><div style="padding:22px 26px;background:#173b2d;color:#fff"><p style="margin:0 0 8px;color:#bce4ce;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">Bark team update</p><h1 style="margin:0;font-size:21px;line-height:1.35">${htmlEscape(input.subject)}</h1></div><div style="padding:24px 26px;font-size:14px;line-height:1.7">${htmlEscape(input.body).replace(/\r?\n/g, "<br>")}</div><div style="padding:0 26px 22px;color:#66756b;font-size:12px">Sent by ${htmlEscape(sender)} via Bark. Replies go to ${htmlEscape(input.senderEmail)}.</div></div></div>`;
  const mime = `${headers.join("\r\n")}\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrapBase64(Buffer.from(plainText, "utf8").toString("base64"))}\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrapBase64(Buffer.from(htmlBody, "utf8").toString("base64"))}\r\n--${boundary}--`;
  const raw = Buffer.from(mime, "utf8").toString("base64url");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken.token}`, "content-type": "application/json" },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(30_000),
  });
  const result = await response.json().catch(() => ({})) as { id?: string; error?: { message?: string } };
  if (!response.ok || !result.id) {
    logger.error({ status: response.status, message: result.error?.message }, "Gmail API send failed");
    throw new Error(result.error?.message || `Gmail API returned HTTP ${response.status}.`);
  }
  return { messageId: result.id };
}

export async function storeOAuthState(state: string) {
  const [existing] = await db.select({ id: teamEmailMailbox.id }).from(teamEmailMailbox).where(eq(teamEmailMailbox.id, MAILBOX_ID)).limit(1);
  const values = { oauthStateHash: createHash("sha256").update(state).digest("hex"), oauthStateExpiresAt: new Date(Date.now() + 10 * 60_000), updatedAt: new Date() };
  if (existing) await db.update(teamEmailMailbox).set(values).where(eq(teamEmailMailbox.id, MAILBOX_ID));
  else await db.insert(teamEmailMailbox).values({ id: MAILBOX_ID, ...values });
}
