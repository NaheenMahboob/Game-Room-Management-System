/**
 * Guest pass sign-in/out for staff.
 * POST signs a guest in; DELETE signs them out.
 */

import { withRole } from "@/lib/auth/api";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import { signInGuest, signOutGuest } from "@/lib/services/guests";

export const POST = withRole(["VOLUNTEER", "ADMIN"], async ({ session }, rawParams) => {
  try {
    const params = rawParams as { id: string };
    const guestPass = await signInGuest(params.id, session.sub);
    return jsonOk({ guestPass });
  } catch (error) {
    return handleRouteError(error);
  }
});

export const DELETE = withRole(["VOLUNTEER", "ADMIN"], async ({ session }, rawParams) => {
  try {
    const params = rawParams as { id: string };
    const guestPass = await signOutGuest(params.id, session.sub);
    return jsonOk({ guestPass });
  } catch (error) {
    return handleRouteError(error);
  }
});
