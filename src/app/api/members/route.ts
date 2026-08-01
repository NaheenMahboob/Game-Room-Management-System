/**
 * Member search and desk registration for staff.
 * GET requires `q`; POST registers a member at the volunteer desk.
 */

import { withRole } from "@/lib/auth/api";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api/http";
import {
  memberSearchSchema,
  registerMemberSchema,
} from "@/lib/validation/schemas";
import { registerMember, searchMembers } from "@/lib/services/members";
import { deleteOrphanRegistrationPhoto } from "@/lib/uploads/memberPhoto";

/** Searches members by query string (`q` required). */
export const GET = withRole(["VOLUNTEER", "ADMIN"], async ({ request }) => {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = memberSearchSchema.parse({
      q: searchParams.get("q") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });
    if (!parsed.q) {
      return jsonError("Query parameter q is required", 400);
    }
    const members = await searchMembers(parsed.q, parsed.limit ?? 20);
    return jsonOk({ members });
  } catch (error) {
    return handleRouteError(error);
  }
});

/**
 * Desk registration. Cleans up the prior `reg-*` photo upload if create fails.
 */
export const POST = withRole(["VOLUNTEER", "ADMIN"], async ({ request, session }) => {
  let uploadedPhotoUrl: string | undefined;
  try {
    const body = await request.json();
    const input = registerMemberSchema.parse(body);
    uploadedPhotoUrl = input.photoUrl;
    const result = await registerMember(input, session.sub);
    uploadedPhotoUrl = undefined;
    return jsonOk(result, 201);
  } catch (error) {
    if (uploadedPhotoUrl) {
      await deleteOrphanRegistrationPhoto(uploadedPhotoUrl);
    }
    return handleRouteError(error);
  }
});
