/**
 * `GET /api/equipment`
 *
 * Staff equipment list with optional type and inactive filters.
 */

import { withRole } from "@/lib/auth/api";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import { equipmentListSchema } from "@/lib/validation/schemas";
import { listEquipment } from "@/lib/services/loans";

export const GET = withRole(["VOLUNTEER", "ADMIN"], async ({ request }) => {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = equipmentListSchema.parse({
      type: searchParams.get("type") ?? undefined,
      includeInactive: searchParams.get("includeInactive") ?? undefined,
    });
    const equipment = await listEquipment(parsed);
    return jsonOk({ equipment });
  } catch (error) {
    return handleRouteError(error);
  }
});
