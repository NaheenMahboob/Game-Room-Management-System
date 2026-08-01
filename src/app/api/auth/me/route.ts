/**
 * `GET /api/auth/me`
 *
 * Returns the current session user (id, email, role, memberId).
 */

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api";

export const GET = withAuth(async ({ session }) => {
  return NextResponse.json({
    user: {
      id: session.sub,
      email: session.email,
      role: session.role,
      memberId: session.memberId ?? null,
    },
  });
});
