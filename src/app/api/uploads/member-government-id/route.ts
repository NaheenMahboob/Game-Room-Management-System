/**
 * `POST /api/uploads/member-government-id`
 *
 * Staff endpoint used during desk registration before a member row exists.
 * Accepts multipart `file`, writes under private `storage/government-ids/`,
 * and returns `{ governmentIdUrl }` as the storage filename for `POST /api/members`.
 *
 * @author Muhammad Naheen Mahboob
 */

import { withRole } from "@/lib/auth/api";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import { parseMemberPhotoFormData } from "@/lib/uploads/memberPhoto";
import { saveMemberGovernmentIdFile } from "@/lib/uploads/memberGovernmentId";

/**
 * Handles multipart government ID upload for desk registration.
 *
 * @returns `201` with `{ governmentIdUrl }` (on-disk filename) on success
 * @author Muhammad Naheen Mahboob
 */
export const POST = withRole(["VOLUNTEER", "ADMIN"], async ({ request }) => {
  try {
    const formData = await request.formData();
    const { buffer, mimeType } = await parseMemberPhotoFormData(formData);
    const governmentIdUrl = await saveMemberGovernmentIdFile(
      buffer,
      mimeType,
      "reg-gid"
    );
    return jsonOk({ governmentIdUrl }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
});
