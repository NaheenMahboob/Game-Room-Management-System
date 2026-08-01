/**
 * Member search and desk registration for staff.
 * GET lists/searches the desk roster: waiting to enter + currently inside.
 * POST registers a member at the volunteer desk (auto-adds to waiting list).
 */

import { withRole } from "@/lib/auth/api";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import {
  memberSearchSchema,
  registerMemberSchema,
} from "@/lib/validation/schemas";
import { registerMember } from "@/lib/services/members";
import { listDeskRoster, searchDeskRoster } from "@/lib/services/checkIn";
import { deleteOrphanRegistrationPhoto } from "@/lib/uploads/memberPhoto";

/**
 * Desk identify: without `q`, returns waiting + inside members;
 * with `q`, searches within that roster.
 */
export const GET = withRole(["VOLUNTEER", "ADMIN"], async ({ request }) => {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = memberSearchSchema.parse({
      q: searchParams.get("q") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });
    const members = parsed.q
      ? await searchDeskRoster(parsed.q, parsed.limit ?? 20)
      : await listDeskRoster();
    return jsonOk({ members });
  } catch (error) {
    return handleRouteError(error);
  }
});

/**
 * Desk registration. Cleans up the prior `reg-*` photo upload if create fails.
 * New members are placed on the check-in waiting list automatically.
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
