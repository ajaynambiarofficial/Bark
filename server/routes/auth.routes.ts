import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { env } from "../config/env.js";
import { db } from "../db/client.js";
import { auditEvents, authenticationAttempts, passwordResetTokens, roles, sessions, users } from "../db/schema.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { employeeResponse, hashSessionToken, loadPrincipalByToken } from "../auth/session.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../lib/errors.js";
import { parseBody } from "../lib/validation.js";
import { appendAudit } from "../services/audit.service.js";

const router = Router();
const loginSchema = z.object({ email: z.string().email().transform((value) => value.trim().toLowerCase()), password: z.string().min(1).max(1024) });
const forgotPasswordSchema = z.object({ email: z.string().email().transform((value) => value.trim().toLowerCase()) });
const resetPasswordSchema = z.object({ token: z.string().min(32).max(128), password: z.string().min(14).max(1024) });
const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(160),
  contactPhone: z.string().trim().max(40).nullable(),
  profileBio: z.string().trim().max(500).nullable(),
  avatarData: z.string().max(1_500_000).regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/).nullable(),
});
const cookieOptions = { httpOnly: true, secure: env.APP_ORIGIN.startsWith("https://"), sameSite: "lax" as const, path: "/", maxAge: env.SESSION_TTL_HOURS * 60 * 60 * 1000 };

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

router.post("/forgot-password", async (request, response) => {
  const input = parseBody(request, forgotPasswordSchema);
  const ipAddress = request.ip ?? "unknown";
  const now = new Date();
  const windowStart = new Date(now.getTime() - 15 * 60_000);
  const [requests] = await db.select({ value: count() }).from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.email, input.email), eq(passwordResetTokens.ipAddress, ipAddress), gt(passwordResetTokens.createdAt, windowStart)));
  if ((requests?.value ?? 0) >= 5) throw new ApiError(429, "RESET_RATE_LIMITED", "Too many reset requests. Please wait and try again.");

  const [user] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, input.email), eq(users.accountStatus, "active"))).limit(1);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + 30 * 60_000);
  await db.insert(passwordResetTokens).values({ userId: user?.id ?? null, email: input.email, tokenHash: hashResetToken(token), ipAddress, expiresAt });
  const resetUrl = new URL("/forgot-password", env.APP_ORIGIN);
  resetUrl.searchParams.set("token", token);
  response.json({
    data: {
      message: env.allowLocalPasswordResetLinks
        ? "If an active account matches that email, use the local reset link below."
        : "If an active account matches that email, reset instructions will be sent when email delivery is configured.",
      ...(env.allowLocalPasswordResetLinks ? { localResetUrl: resetUrl.toString() } : {}),
    },
  });
});

router.post("/reset-password", async (request, response) => {
  const input = parseBody(request, resetPasswordSchema);
  const now = new Date();
  const tokenHash = hashResetToken(input.token);
  const reset = await db.transaction(async (transaction) => {
    const [consumed] = await transaction.update(passwordResetTokens)
      .set({ consumedAt: now })
      .where(and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.consumedAt), gt(passwordResetTokens.expiresAt, now)))
      .returning({ userId: passwordResetTokens.userId });
    if (!consumed?.userId) return null;

    const [user] = await transaction.select({ id: users.id, email: users.email, accountStatus: users.accountStatus }).from(users)
      .where(and(eq(users.id, consumed.userId), eq(users.accountStatus, "active"))).limit(1);
    if (!user) return null;
    const passwordHash = await hashPassword(input.password);
    await transaction.update(users).set({ passwordHash, failedLoginCount: 0, lockedUntil: null, updatedAt: now }).where(eq(users.id, user.id));
    await transaction.update(passwordResetTokens).set({ consumedAt: now }).where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.consumedAt)));
    await transaction.update(sessions).set({ revokedAt: now, revokedReason: "Password reset" }).where(and(eq(sessions.userId, user.id), isNull(sessions.revokedAt)));
    await transaction.insert(auditEvents).values({ actorId: user.id, actorRole: "self-service", action: "auth.password_reset", entityType: "user", entityId: user.id, newValue: { passwordChanged: true, sessionsRevoked: true }, requestId: request.requestId, ipAddress: request.ip ?? null });
    return { id: user.id, email: user.email };
  });
  if (!reset) throw new ApiError(400, "RESET_TOKEN_INVALID", "This password reset link is invalid or has expired.");
  response.json({ data: { message: "Your password has been reset. Sign in with your new password." } });
});

router.post("/login", async (request, response) => {
  const input = parseBody(request, loginSchema);
  const ipAddress = request.ip ?? "unknown";
  const windowStart = new Date(Date.now() - 15 * 60_000);
  const [attempts] = await db.select({ value: count() }).from(authenticationAttempts).where(and(eq(authenticationAttempts.email, input.email), eq(authenticationAttempts.ipAddress, ipAddress), eq(authenticationAttempts.succeeded, false), gt(authenticationAttempts.attemptedAt, windowStart)));
  if ((attempts?.value ?? 0) >= 8) throw new ApiError(429, "LOGIN_RATE_LIMITED", "Too many unsuccessful sign-in attempts. Try again later.");

  const [record] = await db.select({
    id: users.id, passwordHash: users.passwordHash, accountStatus: users.accountStatus, lockedUntil: users.lockedUntil,
  }).from(users).innerJoin(roles, eq(users.roleId, roles.id)).where(and(eq(users.email, input.email), eq(roles.active, true))).limit(1);

  const validPassword = record ? await verifyPassword(input.password, record.passwordHash) : (await hashPassword(input.password), false);
  const active = record?.accountStatus === "active" && (!record.lockedUntil || record.lockedUntil <= new Date());
  await db.insert(authenticationAttempts).values({ email: input.email, ipAddress, succeeded: Boolean(record && validPassword && active) });

  if (!record || !validPassword || !active) {
    if (record) {
      const lock = (attempts?.value ?? 0) >= 6 ? new Date(Date.now() + 15 * 60_000) : null;
      await db.update(users).set({ failedLoginCount: (attempts?.value ?? 0) + 1, lockedUntil: lock, updatedAt: new Date() }).where(eq(users.id, record.id));
    }
    throw new ApiError(401, "INVALID_CREDENTIALS", "The email or password is incorrect, or the account is unavailable.");
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);
  const [session] = await db.insert(sessions).values({ userId: record.id, tokenHash: hashSessionToken(token), ipAddress, userAgent: request.header("user-agent") ?? null, expiresAt }).returning({ id: sessions.id });
  if (!session) throw new ApiError(500, "SESSION_CREATE_FAILED", "The session could not be created.");
  await db.update(users).set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, record.id));

  const principal = await loadPrincipalByToken(token);
  if (!principal) throw new ApiError(500, "SESSION_CREATE_FAILED", "The session could not be loaded.");
  await appendAudit(db, { actor: principal, action: "auth.login", entityType: "session", entityId: session.id, requestId: request.requestId, ipAddress });
  response.cookie(env.SESSION_COOKIE_NAME, token, cookieOptions).status(200).json({ data: { employee: employeeResponse(principal), expiresAt } });
});

router.get("/session", requireAuth, (request, response) => {
  response.json({ data: { employee: employeeResponse(request.auth!), sessionId: request.auth!.sessionId } });
});

router.get("/profile", requireAuth, async (request, response) => {
  const actor = request.auth!;
  const [profile] = await db.select({ id: users.id, displayName: users.displayName, email: users.email, department: users.department, assignment: users.assignment, contactPhone: users.contactPhone, profileBio: users.profileBio, avatarData: users.avatarData })
    .from(users).where(eq(users.id, actor.userId)).limit(1);
  if (!profile) throw new ApiError(404, "PROFILE_NOT_FOUND", "The profile could not be found.");
  response.json({ data: profile });
});

router.get("/profile/avatar", requireAuth, async (request, response) => {
  const [profile] = await db.select({ avatarData: users.avatarData }).from(users).where(eq(users.id, request.auth!.userId)).limit(1);
  if (!profile?.avatarData) return response.sendStatus(404);
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/.exec(profile.avatarData);
  if (!match) return response.sendStatus(404);
  response.setHeader("content-type", `image/${match[1]}`);
  response.setHeader("cache-control", "private, no-store");
  response.send(Buffer.from(match[2]!, "base64"));
});

router.patch("/profile", requireAuth, async (request, response) => {
  const input = parseBody(request, profileSchema);
  const actor = request.auth!;
  const [current] = await db.select({ displayName: users.displayName, contactPhone: users.contactPhone, profileBio: users.profileBio, avatarData: users.avatarData })
    .from(users).where(eq(users.id, actor.userId)).limit(1);
  if (!current) throw new ApiError(404, "PROFILE_NOT_FOUND", "The profile could not be found.");
  const [updated] = await db.transaction(async (transaction) => {
    const records = await transaction.update(users).set({ ...input, updatedAt: new Date() }).where(eq(users.id, actor.userId))
      .returning({ id: users.id, displayName: users.displayName, email: users.email, department: users.department, assignment: users.assignment, contactPhone: users.contactPhone, profileBio: users.profileBio });
    await appendAudit(transaction, { actor, action: "profile.updated", entityType: "user", entityId: actor.userId, previousValue: { displayName: current.displayName, contactPhoneChanged: Boolean(current.contactPhone), profileBio: current.profileBio, avatarChanged: Boolean(current.avatarData) }, newValue: { displayName: input.displayName, contactPhoneChanged: Boolean(input.contactPhone), profileBio: input.profileBio, avatarChanged: Boolean(input.avatarData) }, requestId: request.requestId, ipAddress: request.ip });
    return records;
  });
  response.json({ data: { ...updated, avatarUrl: "/api/auth/profile/avatar" } });
});

router.post("/logout", requireAuth, async (request, response) => {
  const actor = request.auth!;
  await db.transaction(async (transaction) => {
    await transaction.update(sessions).set({ revokedAt: new Date(), revokedReason: "User signed out" }).where(and(eq(sessions.id, actor.sessionId), isNull(sessions.revokedAt)));
    await appendAudit(transaction, { actor, action: "auth.logout", entityType: "session", entityId: actor.sessionId, requestId: request.requestId, ipAddress: request.ip });
  });
  response.clearCookie(env.SESSION_COOKIE_NAME, { httpOnly: true, secure: env.isProduction, sameSite: "lax", path: "/" }).status(204).end();
});

router.post("/logout-all", requireAuth, async (request, response) => {
  const actor = request.auth!;
  await db.transaction(async (transaction) => {
    await transaction.update(sessions).set({ revokedAt: new Date(), revokedReason: "All sessions revoked by user" }).where(and(eq(sessions.userId, actor.userId), isNull(sessions.revokedAt)));
    await appendAudit(transaction, { actor, action: "auth.logout_all", entityType: "user", entityId: actor.userId, requestId: request.requestId, ipAddress: request.ip });
  });
  response.clearCookie(env.SESSION_COOKIE_NAME, { httpOnly: true, secure: env.isProduction, sameSite: "lax", path: "/" }).status(204).end();
});

export { router as authRouter };
