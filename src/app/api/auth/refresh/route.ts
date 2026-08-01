/**
 * `POST /api/auth/refresh`
 *
 * Rotates access and refresh tokens from the refresh cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "@/lib/auth/jwt";
import {
  REFRESH_COOKIE,
  setAuthCookies,
  clearAuthCookies,
} from "@/lib/auth/cookies";

/**
 * Rotates access and refresh tokens using the refresh cookie.
 *
 * @param request - Incoming request carrying the refresh cookie
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  const claims = await verifyRefreshToken(refreshToken);
  if (!claims?.sub) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    include: { member: { select: { id: true } } },
  });

  if (!user) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  const sessionPayload = {
    sub: user.id,
    role: user.role,
    memberId: user.member?.id,
    // Keep forced password-change flag in sync with the database.
    mustChangePassword: user.mustChangePassword,
  };

  const [accessToken, newRefreshToken] = await Promise.all([
    signAccessToken(sessionPayload),
    signRefreshToken(sessionPayload),
  ]);

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      memberId: user.member?.id ?? null,
      mustChangePassword: user.mustChangePassword,
    },
  });

  setAuthCookies(response, accessToken, newRefreshToken);
  return response;
}
