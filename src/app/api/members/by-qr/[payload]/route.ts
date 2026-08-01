/**
 * `GET /api/members/by-qr/[payload]`
 *
 * Looks up a member by QR for desk flows. Sign-in is only allowed for people
 * on the waiting list; already-inside members can still be opened for sign-out.
 */

import { withRole } from "@/lib/auth/api";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api/http";
import { getMemberByQr } from "@/lib/services/members";

/** Resolves a member record from a URL-encoded QR payload. */
export const GET = withRole(["VOLUNTEER", "ADMIN"], async (_ctx, rawParams) => {
  try {
    const params = rawParams as { payload: string };
    const member = await getMemberByQr(decodeURIComponent(params.payload));
    if (!member) return jsonError("Member not found for QR code", 404);

    const isInside = member.attendances.length > 0;
    const isWaiting = Boolean(member.checkInRequestedAt) && !isInside;

    // Not waiting and not inside → ask them to tap “I’m here” first.
    if (!isInside && !isWaiting) {
      return jsonError(
        "Member has not requested check-in yet. Ask them to tap “I’m here” in the portal.",
        400
      );
    }

    return jsonOk({ member });
  } catch (error) {
    return handleRouteError(error);
  }
});
