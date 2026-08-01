import { NextRequest, NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { verifyAccessToken, type SessionPayload } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";

export type AuthContext = {
  request: NextRequest;
  session: SessionPayload & { email: string };
};

type RouteHandler = (
  ctx: AuthContext,
  params?: Record<string, string>
) => Promise<NextResponse> | NextResponse;

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

export function withRole(roles: Role[], handler: RouteHandler) {
  return withAuth(async (ctx, params) => {
    if (!roles.includes(ctx.session.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handler(ctx, params);
  });
}
