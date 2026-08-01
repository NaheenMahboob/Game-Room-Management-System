/**
 * `GET /api/members/by-qr/[payload]`
 *
 * Looks up a member by QR payload for desk check-in flows.
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
    return jsonOk({ member });
  } catch (error) {
    return handleRouteError(error);
  }
});
