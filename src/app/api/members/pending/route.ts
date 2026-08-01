/**
 * Pending member registrations — staff photo verification queue.
 * GET lists PENDING members; PATCH approves or rejects.
 */

import { z } from "zod";
import { withRole } from "@/lib/auth/api";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api/http";
import {
  approveMemberRegistration,
  listPendingMembers,
  rejectMemberRegistration,
} from "@/lib/services/members";

/** Lists members awaiting photo verification (`PENDING` status). */
export const GET = withRole(["VOLUNTEER", "ADMIN"], async () => {
  try {
    const members = await listPendingMembers();
    return jsonOk({ members });
  } catch (error) {
    return handleRouteError(error);
  }
});

const actionSchema = z.object({
  memberId: z.string().cuid(),
  action: z.enum(["approve", "reject"]),
});

/**
 * Approves or rejects a PENDING self-registration after photo review.
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
      const member = await rejectMemberRegistration(
        body.memberId,
        session.sub
      );
      return jsonOk({ member });
    } catch (error) {
      return handleRouteError(error);
    }
  }
);
