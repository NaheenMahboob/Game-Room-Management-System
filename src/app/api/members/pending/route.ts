/**
 * Pending queues for staff:
 * - GET: self-registrations (`PENDING` status) + photo retakes awaiting review
 * - PATCH: approve/reject a self-registration (reject deletes the account)
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

/** PATCH body for approving or rejecting a pending self-registration. */
const actionSchema = z.object({
  memberId: z.string().cuid(),
  action: z.enum(["approve", "reject"]),
});

/**
 * Approves a PENDING self-registration, or rejects by deleting it so the
 * person can register again. Closing the reject confirm leaves them pending.
 */
export const PATCH = withRole(
  ["VOLUNTEER", "ADMIN"],
  async ({ request, session }) => {
    try {
      const body = actionSchema.parse(await request.json());
      if (body.action === "approve") {
        const member = await approveMemberRegistration(
          body.memberId,
          session.sub
        );
        return jsonOk({ member });
      }
      const result = await rejectMemberRegistration(
        body.memberId,
        session.sub
      );
      return jsonOk(result);
    } catch (error) {
      return handleRouteError(error);
    }
  }
);
