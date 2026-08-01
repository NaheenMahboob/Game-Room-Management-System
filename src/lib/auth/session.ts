import type { Role } from "@prisma/client";
import { getAccessTokenFromCookies } from "@/lib/auth/cookies";
import { verifyAccessToken, type SessionPayload } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";

export type Session = SessionPayload & {
  email: string;
};

export async function getSession(): Promise<Session | null> {
  const token = getAccessTokenFromCookies();
  if (!token) return null;

  const claims = await verifyAccessToken(token);
  if (!claims?.sub) return null;

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: {
      id: true,
      email: true,
      role: true,
      member: { select: { id: true } },
    },
  });

  if (!user) return null;

  return {
    sub: user.id,
    email: user.email,
    role: user.role,
    memberId: user.member?.id,
  };
}

export function hasRole(session: Session | null, roles: Role[]): boolean {
  if (!session) return false;
  return roles.includes(session.role);
}
