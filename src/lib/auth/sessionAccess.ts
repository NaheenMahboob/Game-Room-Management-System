/**
 * Session helpers shared by portal and member APIs.
 * Staff who were promoted from members keep a Member row and may use the portal.
 */

import type { Role } from "@prisma/client";

type SessionLike = {
  role: Role | string;
  memberId?: string;
};

/** True when the session is volunteer or admin desk staff. */
export function isStaffRole(session: SessionLike): boolean {
  return session.role === "VOLUNTEER" || session.role === "ADMIN";
}

/**
 * True when the session is acting as this member (any role that still has a
 * linked Member profile — including promoted volunteers/admins).
 */
export function isMemberSelf(
  session: SessionLike,
  memberId: string
): boolean {
  return Boolean(session.memberId && session.memberId === memberId);
}

/** Portal access: linked member profile required (role may be staff). */
export function canUseMemberPortal(session: SessionLike): boolean {
  return Boolean(session.memberId);
}
