/**
 * `POST /api/attendance/sign-out`
 *
 * Signs a member out; may require confirmation when equipment is still on loan.
 */

import { withRole } from "@/lib/auth/api";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import { signOutSchema } from "@/lib/validation/schemas";
import { signOutMember } from "@/lib/services/attendance";

export const POST = withRole(["VOLUNTEER", "ADMIN"], async ({ request, session }) => {
  try {
    const body = await request.json();
    const { memberId, forceReturnEquipment } = signOutSchema.parse(body);
    const result = await signOutMember(
      memberId,
      session.sub,
      forceReturnEquipment
    );
    return jsonOk(result, result.needsConfirmation ? 409 : 200);
  } catch (error) {
    return handleRouteError(error);
  }
});
