/**
 * Route auth wrappers (`withAuth`, `withRole`) that resolve session from cookies.
 */

import { NextRequest, NextResponse } from "next/server";
import type { Role } from "@/generated/prisma";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { verifyAccessToken, type SessionPayload } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";

/** Request context passed to authenticated API route handlers. */
export type AuthContext = {
  request: NextRequest;
  session: SessionPayload & { email: string };
};

/** Handler invoked after session resolution succeeds. */
type RouteHandler = (
  ctx: AuthContext,
  params?: Record<string, string>
) => Promise<NextResponse> | NextResponse;

/**
 * Loads the current user from the access cookie and refreshes claims from the database.
 *
 * @param request - Incoming API request (cookie jar)
 * @returns Session with email, or `null` when unauthenticated or user missing
 */
async function resolveSession(
  request: NextRequest
): Promise<(SessionPayload & { email: string }) | null> {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifyAccessToken(token);
  if (!claims?.sub) return null;

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: {
      id: true,
      email: true,
      role: true,
      mustChangePassword: true,
      member: { select: { id: true } },
    },
  });

  if (!user) return null;

  return {
    sub: user.id,
    email: user.email,
    role: user.role,
    memberId: user.member?.id,
    mustChangePassword: user.mustChangePassword,
  };
}

/**
 * Wraps a route handler so it runs only when a valid session exists.
 *
 * @param handler - Authenticated handler receiving {@link AuthContext}
 * @returns Next.js route handler that responds with 401 when unauthenticated
 */
export function withAuth(handler: RouteHandler) {
  return async (
    request: NextRequest,
    context?: { params?: Record<string, string> | Promise<Record<string, string>> }
  ) => {
    const session = await resolveSession(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const params = context?.params
      ? await Promise.resolve(context.params)
      : undefined;
    return handler({ request, session }, params);
  };
}

/**
 * Like {@link withAuth}, but requires the session role to be one of `roles`.
 *
 * @param roles - Allowed Prisma {@link Role} values
 * @param handler - Handler run when role matches
 * @returns Wrapped route handler (403 when role is not allowed)
 */
export function withRole(roles: Role[], handler: RouteHandler) {
  return withAuth(async (ctx, params) => {
    if (!roles.includes(ctx.session.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handler(ctx, params);
  });
}
