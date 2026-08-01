/**
 * Admin user management API.
 * GET supports optional `q` search. PATCH updates role or flags password reset.
 * Creating users by email alone is not supported — promote existing accounts.
 */

import { z } from "zod";
import { withRole } from "@/lib/auth/api";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { writeAuditLog } from "@/lib/audit/log";
import { generateTempPassword } from "@/lib/members/ids";
import { clearLoginRateLimitsForEmail } from "@/lib/auth/rateLimit";

/** PATCH body for role change and/or password reset. */
const updateUserSchema = z.object({
  role: z.enum(["MEMBER", "VOLUNTEER", "ADMIN"]).optional(),
  resetPassword: z.boolean().optional(),
});

/** Normalized bootstrap admin email from env (default seed address). */
function bootstrapAdminEmail(): string {
  return (process.env.ADMIN_EMAIL ?? "admin@mosque.local").toLowerCase();
}

/** True when this email is the seeded / env bootstrap admin account. */
function isBootstrapAdminEmail(email: string): boolean {
  return email.toLowerCase() === bootstrapAdminEmail();
}

/** Prisma select shape for admin user list and PATCH responses. */
const userSelect = {
  id: true,
  email: true,
  role: true,
  mustChangePassword: true,
  createdAt: true,
  member: { select: { id: true, fullName: true, membershipStatus: true } },
} as const;

/** User row shape returned from admin user list/PATCH queries. */
type UserRow = {
  id: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
  createdAt: Date;
  member: {
    id: string;
    fullName: string;
    membershipStatus: string;
  } | null;
};

/** Adds `isBootstrap` so the admin UI can disable demotion without hardcoding the email. */
function withBootstrapFlag<T extends UserRow>(user: T) {
  return {
    ...user,
    isBootstrap: isBootstrapAdminEmail(user.email),
  };
}

/**
 * Lists or searches existing users for role/password management.
 *
 * @returns `{ users }` matching optional `q` (email or member name)
 */
export const GET = withRole(["ADMIN"], async ({ request }) => {
  try {
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              {
                member: {
                  fullName: { contains: q, mode: "insensitive" },
                },
              },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: q ? 50 : 100,
      select: userSelect,
    });
    return jsonOk({ users: users.map(withBootstrapFlag) });
  } catch (error) {
    return handleRouteError(error);
  }
});

/**
 * Updates an existing user's role and/or resets their password.
 * Password reset also clears that account's email + linked device IP
 * rate-limit buckets so they can retry from attempt 1 with the temp password.
 *
 * @returns Updated user and optional `temporaryPassword` when reset
 */
export const PATCH = withRole(["ADMIN"], async ({ request, session }) => {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return jsonError("id query param required", 400);

    const body = updateUserSchema.parse(await request.json());
    const data: {
      role?: "MEMBER" | "VOLUNTEER" | "ADMIN";
      passwordHash?: string;
      mustChangePassword?: boolean;
    } = {};
    let temporaryPassword: string | undefined;

    if (body.role) data.role = body.role;

    // Flag any role for forced password change on next successful login.
    if (body.resetPassword) {
      temporaryPassword = generateTempPassword();
      data.passwordHash = await hashPassword(temporaryPassword);
      data.mustChangePassword = true;
    }

    if (!body.role && !body.resetPassword) {
      return jsonError("Nothing to update", 400);
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return jsonError("User not found", 404);

    if (body.role && body.role !== existing.role) {
      // Never change your own role (prevents locking yourself out mid-session).
      if (id === session.sub) {
        return jsonError("You cannot change your own role", 400);
      }

      // Seed / env bootstrap admin must stay ADMIN.
      if (
        isBootstrapAdminEmail(existing.email) &&
        existing.role === "ADMIN" &&
        body.role !== "ADMIN"
      ) {
        return jsonError(
          "The bootstrap admin account cannot be demoted",
          400
        );
      }

      // Keep at least one ADMIN in the system.
      if (existing.role === "ADMIN" && body.role !== "ADMIN") {
        const adminCount = await prisma.user.count({
          where: { role: "ADMIN" },
        });
        if (adminCount <= 1) {
          return jsonError("Cannot demote the last admin account", 400);
        }
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });

    // Unlock email + any IPs that failed for this account (same phone/Wi‑Fi).
    if (body.resetPassword) {
      clearLoginRateLimitsForEmail(user.email);
    }

    await writeAuditLog({
      actionType: "USER_UPDATED",
      performedByUserId: session.sub,
      details: {
        userId: user.id,
        role: body.role ?? null,
        passwordReset: Boolean(temporaryPassword),
        mustChangePassword: Boolean(body.resetPassword),
        rateLimitCleared: Boolean(body.resetPassword),
      },
    });

    return jsonOk({ user: withBootstrapFlag(user), temporaryPassword });
  } catch (error) {
    return handleRouteError(error);
  }
});
