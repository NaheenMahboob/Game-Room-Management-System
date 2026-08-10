/**
 * Single-member profile API.
 * Staff may read/update any member; linked members may read/edit self only.
 * Admins may hard-delete a member account (frees email/phone for re-registration).
 *
 * @author Muhammad Naheen Mahboob
 */

import { withAuth, withRole } from "@/lib/auth/api";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api/http";
import { isMemberSelf, isStaffRole } from "@/lib/auth/sessionAccess";
import { updateMemberSchema } from "@/lib/validation/schemas";
import {
  deleteMemberHard,
  getMemberById,
  updateMember,
} from "@/lib/services/members";

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

    // Admins get gov ID / waiver lookup links for verified or pending members.
    if (session.role === "ADMIN") {
      return jsonOk({
        member: {
          ...member,
          governmentIdSrc: member.governmentIdUrl
            ? `/api/members/${member.id}/government-id`
            : null,
          waiverPdfSrc: member.waiverPdfUrl
            ? `/api/members/${member.id}/waiver`
            : null,
        },
      });
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

/**
 * Hard-deletes the member and linked user plus stored photos / gov ID / waiver.
 * Admins only — used when a fake or mistaken account must be remade.
 *
 * @author Muhammad Naheen Mahboob
 */
export const DELETE = withRole(["ADMIN"], async ({ session }, rawParams) => {
  try {
    const params = rawParams as { id: string };
    const result = await deleteMemberHard(params.id, session.sub);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
});
