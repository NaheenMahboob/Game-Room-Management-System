/**
 * Server-side session resolution from cookies for RSC and layouts.
 */

import type { Role } from "@/generated/prisma";
import { getAccessTokenFromCookies } from "@/lib/auth/cookies";
import { verifyAccessToken, type SessionPayload } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";

/** Active server session including email (from DB, not only JWT). */
export type Session = SessionPayload & {
  email: string;
};

/**
 * Resolves the current user from the access cookie for Server Components and layouts.
 *
 * @returns Session with fresh DB fields, or `null` when unauthenticated
 */
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
 * Checks whether a session exists and its role is in the allowed list.
 *
 * @param session - Current session or `null`
 * @param roles - Roles that satisfy the check
 * @returns `true` when session is non-null and role matches
 */
export function hasRole(session: Session | null, roles: Role[]): boolean {
  if (!session) return false;
  return roles.includes(session.role);
}
