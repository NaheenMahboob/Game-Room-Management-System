/**
 * `POST /api/attendance/sign-in`
 *
 * Volunteer/admin desk sign-in. Requires `photoVerified: true` so staff
 * acknowledge the stored profile photo matches the person present.
 */

import { withRole } from "@/lib/auth/api";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import { signInSchema } from "@/lib/validation/schemas";
import { signInMember } from "@/lib/services/attendance";

/**
 * Creates an open attendance session for the given member.
 *
 * @returns `201` with `{ attendance }` on success
 */
export const POST = withRole(
  ["VOLUNTEER", "ADMIN"],
  async ({ request, session }) => {
    try {
      const body = await request.json();
      const { memberId, photoVerified } = signInSchema.parse(body);

      const attendance = await signInMember(
        memberId,
        session.sub,
        photoVerified
      );

      return jsonOk({ attendance }, 201);
    } catch (error) {
      return handleRouteError(error);
    }
  }
);
