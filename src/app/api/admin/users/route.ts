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

const updateUserSchema = z.object({
  role: z.enum(["MEMBER", "VOLUNTEER", "ADMIN"]).optional(),
  resetPassword: z.boolean().optional(),
});

const userSelect = {
  id: true,
  email: true,
  role: true,
  mustChangePassword: true,
  createdAt: true,
  member: { select: { id: true, fullName: true, membershipStatus: true } },
} as const;

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
    return jsonOk({ users });
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

    return jsonOk({ user, temporaryPassword });
  } catch (error) {
    return handleRouteError(error);
  }
});
