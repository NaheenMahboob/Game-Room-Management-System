/**
 * `POST /api/uploads/member-photo`
 *
 * Staff-only endpoint used during registration before a member row exists.
 * Accepts multipart `file`, writes it under `public/uploads/members/`, and
 * returns `{ photoUrl }` for the subsequent `POST /api/members` call.
 */

import { withRole } from "@/lib/auth/api";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import {
  parseMemberPhotoFormData,
  saveMemberPhotoFile,
} from "@/lib/uploads/memberPhoto";

/**
 * Handles multipart photo upload for new member registration.
 *
 * @returns `201` with `{ photoUrl }` on success
 */
export const POST = withRole(
  ["VOLUNTEER", "ADMIN"],
  async ({ request }) => {
    try {
      const formData = await request.formData();
      const { buffer, mimeType } = await parseMemberPhotoFormData(formData);

      // `reg` prefix distinguishes registration uploads from retakes.
      const photoUrl = await saveMemberPhotoFile(buffer, mimeType, "reg");

      return jsonOk({ photoUrl }, 201);
    } catch (error) {
      return handleRouteError(error);
    }
  }
);
