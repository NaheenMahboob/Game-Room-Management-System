/**
 * `GET /api/admin/analytics`
 *
 * Returns aggregated analytics summary for the admin dashboard.
 */

import { withRole } from "@/lib/auth/api";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import { getAnalyticsSummary } from "@/lib/services/analytics";

export const GET = withRole(["ADMIN"], async () => {
  try {
    const analytics = await getAnalyticsSummary();
    return jsonOk({ analytics });
  } catch (error) {
    return handleRouteError(error);
  }
});
