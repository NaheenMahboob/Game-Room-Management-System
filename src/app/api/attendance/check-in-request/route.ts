/**
 * `GET|POST|DELETE /api/attendance/check-in-request`
 *
 * Members place themselves on the desk waiting list (“I’m here”) and can
 * cancel. Staff list waiting members via GET `/api/members?waiting=1` (or
 * this GET when role is volunteer/admin).
 */

import { withAuth } from "@/lib/auth/api";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api/http";
import {
  cancelCheckInRequest,
  listWaitingForCheckIn,
  requestCheckIn,
} from "@/lib/services/checkIn";
import { getMemberById } from "@/lib/services/members";

/**
 * Staff: list everyone waiting to be let in.
 * Member: return own check-in / inside status for the portal button.
 */
export const GET = withAuth(async ({ session }) => {
  try {
    // Staff dashboard waiting list.
    if (session.role === "VOLUNTEER" || session.role === "ADMIN") {
      const members = await listWaitingForCheckIn();
      return jsonOk({ members });
    }

    // Portal self-status.
    if (!session.memberId) {
      return jsonError("No member profile on this account", 400);
    }
    const member = await getMemberById(session.memberId);
    if (!member) return jsonError("Member not found", 404);
    const isInside = member.attendances.length > 0;
    return jsonOk({
      checkInRequestedAt: member.checkInRequestedAt,
      isInside,
      waiting: Boolean(member.checkInRequestedAt) && !isInside,
    });
  } catch (error) {
    return handleRouteError(error);
  }
});

/**
 * Portal: member requests check-in (appears on the volunteer Members tab).
 */
export const POST = withAuth(async ({ session }) => {
  try {
    if (!session.memberId) {
      return jsonError("No member profile on this account", 400);
    }
    const member = await requestCheckIn(session.memberId, session.sub);
    return jsonOk({ member }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
});

/**
 * Portal: cancel a waiting check-in request.
 */
export const DELETE = withAuth(async ({ session }) => {
  try {
    if (!session.memberId) {
      return jsonError("No member profile on this account", 400);
    }
    const member = await cancelCheckInRequest(session.memberId, session.sub);
    return jsonOk({ member });
  } catch (error) {
    return handleRouteError(error);
  }
});
