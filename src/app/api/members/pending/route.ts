/**
 * Pending queues for staff:
 * - GET: PENDING registrations + photo retakes (volunteers + admins)
 * - PATCH: approve/reject a PENDING registration — **admins only**
 *   (must review government ID + signed waiver before activation)
 *
 * @author Muhammad Naheen Mahboob
 */

import { z } from "zod";
import { withRole } from "@/lib/auth/api";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import {
  approveMemberRegistration,
  listPendingMembers,
  listPendingPhotoRetakes,
  rejectMemberRegistration,
} from "@/lib/services/members";

/** Lists registration + photo-retake queues. */
export const GET = withRole(["VOLUNTEER", "ADMIN"], async () => {
  try {
    const [members, photoRetakes] = await Promise.all([
      listPendingMembers(),
      listPendingPhotoRetakes(),
    ]);
    return jsonOk({ members, photoRetakes });
  } catch (error) {
    return handleRouteError(error);
  }
});

/** PATCH body for approving or rejecting a pending registration. */
const actionSchema = z.object({
  memberId: z.string().cuid(),
  action: z.enum(["approve", "reject"]),
});

/**
 * Approves a PENDING registration after admin review, or rejects by deleting
 * the account so they can register again.
 *
 * @author Muhammad Naheen Mahboob
 */
export const PATCH = withRole(["ADMIN"], async ({ request, session }) => {
  try {
    const body = actionSchema.parse(await request.json());
    if (body.action === "approve") {
      const member = await approveMemberRegistration(
        body.memberId,
        session.sub
      );
      return jsonOk({ member });
    }
    const result = await rejectMemberRegistration(body.memberId, session.sub);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
});
