/**
 * `PATCH /api/equipment/[id]/condition`
 *
 * Updates an equipment item's condition status and optional notes.
 */

import { withRole } from "@/lib/auth/api";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import { conditionUpdateSchema } from "@/lib/validation/schemas";
import { updateEquipmentCondition } from "@/lib/services/loans";

export const PATCH = withRole(["VOLUNTEER", "ADMIN"], async ({ request, session }, rawParams) => {
  try {
    const params = rawParams as { id: string };
    const body = await request.json();
    const { conditionStatus, notes } = conditionUpdateSchema.parse(body);
    const equipment = await updateEquipmentCondition(
      params.id,
      conditionStatus,
      session.sub,
      notes
    );
    return jsonOk({ equipment });
  } catch (error) {
    return handleRouteError(error);
  }
});
