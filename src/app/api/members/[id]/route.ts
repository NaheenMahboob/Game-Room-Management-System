/**
 * Single-member profile API.
 * Staff may read/update any member; linked members may read/edit self only.
 */

import { withAuth } from "@/lib/auth/api";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api/http";
import { isMemberSelf, isStaffRole } from "@/lib/auth/sessionAccess";
import { updateMemberSchema } from "@/lib/validation/schemas";
import { getMemberById, updateMember } from "@/lib/services/members";

/** Returns one member profile when the caller is staff or the linked member. */
export const GET = withAuth(async ({ session }, rawParams) => {
  try {
    const params = rawParams as { id: string };
    const member = await getMemberById(params.id);
    if (!member) return jsonError("Member not found", 404);

    // Staff may view any member; others only their own linked profile.
    if (!isStaffRole(session) && !isMemberSelf(session, member.id)) {
      return jsonError("Forbidden", 403);
    }

    return jsonOk({ member });
  } catch (error) {
    return handleRouteError(error);
  }
});

/** Updates member fields; self-edits cannot change membership status. */
export const PATCH = withAuth(async ({ request, session }, rawParams) => {
  try {
    const params = rawParams as { id: string };
    const member = await getMemberById(params.id);
    if (!member) return jsonError("Member not found", 404);

    const staff = isStaffRole(session);
    const self = isMemberSelf(session, member.id);

    if (!staff && !self) {
      return jsonError("Forbidden", 403);
    }

    const body = await request.json();
    const input = updateMemberSchema.parse(body);

    // Self-edits (including promoted staff on the portal) cannot change status.
    if (self) {
      const selfSafe = { ...input };
      delete selfSafe.membershipStatus;
      const updated = await updateMember(
        params.id,
        selfSafe,
        session.sub,
        false
      );
      return jsonOk({ member: updated });
    }

    const updated = await updateMember(
      params.id,
      input,
      session.sub,
      session.role === "ADMIN"
    );
    return jsonOk({ member: updated });
  } catch (error) {
    return handleRouteError(error);
  }
});
