/**
 * `GET /api/auth/me`
 *
 * Returns the current session user (id, email, role, memberId).
 * Admins also get `isBootstrap` for role-management UI.
 *
 * @author Muhammad Naheen Mahboob
 */

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api";
import { isBootstrapAdminEmail } from "@/lib/auth/bootstrap";

/**
 * Returns the authenticated user from the current session.
 *
 * @author Muhammad Naheen Mahboob
 */
export const GET = withAuth(async ({ session }) => {
  return NextResponse.json({
    user: {
      id: session.sub,
      email: session.email,
      role: session.role,
      memberId: session.memberId ?? null,
      // Lets the Users page disable ADMIN role edits for non-bootstrap viewers.
      isBootstrap: isBootstrapAdminEmail(session.email),
    },
  });
});
