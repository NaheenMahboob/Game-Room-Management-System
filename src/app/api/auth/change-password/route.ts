/**
 * `POST /api/auth/change-password`
 *
 * Lets any authenticated role (MEMBER / VOLUNTEER / ADMIN) set a new password
 * when `mustChangePassword` is set (or voluntarily). Clears the flag and
 * re-issues cookies without the force-change claim.
 */

import { withAuth } from "@/lib/auth/api";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api/http";
import { changePasswordSchema } from "@/lib/validation/schemas";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { setAuthCookies } from "@/lib/auth/cookies";
import { writeAuditLog } from "@/lib/audit/log";
import { NextResponse } from "next/server";

/**
 * Updates the password for the current user and refreshes auth cookies.
 */
export const POST = withAuth(async ({ request, session }) => {
  try {
    const body = changePasswordSchema.parse(await request.json());

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      include: { member: { select: { id: true } } },
    });
    if (!user) return jsonError("User not found", 404);

    const ok = await verifyPassword(body.currentPassword, user.passwordHash);
    if (!ok) return jsonError("Current password is incorrect", 401);

    if (body.newPassword === body.currentPassword) {
      return jsonError("New password must be different from the current one", 400);
    }

    const passwordHash = await hashPassword(body.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });

    await writeAuditLog({
      actionType: "PASSWORD_CHANGED",
      performedByUserId: session.sub,
      memberId: user.member?.id,
      details: { forced: user.mustChangePassword },
    });

    const sessionPayload = {
      sub: user.id,
      role: user.role,
      memberId: user.member?.id,
      mustChangePassword: false,
    };

    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(sessionPayload),
      signRefreshToken(sessionPayload),
    ]);

    const response = NextResponse.json({
      ok: true,
      redirectTo:
        user.role === "MEMBER" ? "/portal" : "/dashboard",
    });
    setAuthCookies(response, accessToken, refreshToken);
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
});
