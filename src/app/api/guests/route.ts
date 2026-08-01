/**
 * `POST /api/guests`
 *
 * Issues a guest pass linked to a host member.
 */

import { withRole } from "@/lib/auth/api";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import { guestPassSchema } from "@/lib/validation/schemas";
import { issueGuestPass } from "@/lib/services/guests";

/** Issues a guest pass for a host member. */
export const POST = withRole(["VOLUNTEER", "ADMIN"], async ({ request, session }) => {
  try {
    const body = await request.json();
    const input = guestPassSchema.parse(body);
    const guestPass = await issueGuestPass(
      input.hostMemberId,
      input.guestName,
      input.guestPhone,
      session.sub
    );
    return jsonOk({ guestPass }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
});
