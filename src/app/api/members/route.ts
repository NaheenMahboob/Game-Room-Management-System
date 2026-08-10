/**
 * Member search and desk registration for staff.
 * GET lists/searches the desk roster: waiting to enter + currently inside.
 * POST registers a PENDING member (admin must verify gov ID + waiver later).
 *
 * @author Muhammad Naheen Mahboob
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
import { deleteOrphanRegistrationGovernmentId } from "@/lib/uploads/memberGovernmentId";

/**
 * Desk identify: without `q`, returns waiting + inside members;
 * with `q`, searches within that roster.
 *
 * @author Muhammad Naheen Mahboob
 */
export const GET = withRole(["VOLUNTEER", "ADMIN"], async ({ request }) => {
  try {
    const { searchParams } = new URL(request.url);
    // Empty `?q=` from the UI must not fail Zod min(1) — treat as “list all”.
    const qRaw = searchParams.get("q")?.trim();
    const parsed = memberSearchSchema.parse({
      q: qRaw ? qRaw : undefined,
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
 * Desk registration. Cleans up prior photo / gov ID uploads if create fails.
 * New members stay PENDING until an admin verifies ID + waiver.
 *
 * @author Muhammad Naheen Mahboob
 */
export const POST = withRole(
  ["VOLUNTEER", "ADMIN"],
  async ({ request, session }) => {
    let uploadedPhotoUrl: string | undefined;
    let uploadedGovIdUrl: string | undefined;
    try {
      const body = await request.json();
      const input = registerMemberSchema.parse(body);
      uploadedPhotoUrl = input.photoUrl;
      uploadedGovIdUrl = input.governmentIdUrl;
      const result = await registerMember(input, session.sub);
      uploadedPhotoUrl = undefined;
      uploadedGovIdUrl = undefined;
      return jsonOk(result, 201);
    } catch (error) {
      if (uploadedPhotoUrl) {
        await deleteOrphanRegistrationPhoto(uploadedPhotoUrl);
      }
      if (uploadedGovIdUrl) {
        await deleteOrphanRegistrationGovernmentId(uploadedGovIdUrl);
      }
      return handleRouteError(error);
    }
  }
);
