/**
 * `GET /api/public/occupancy`
 *
 * Public headcount for members and guests currently inside.
 */

import { jsonOk, handleRouteError } from "@/lib/api/http";
import { getOccupancy } from "@/lib/services/attendance";

/** Public occupancy for the status board. */
export async function GET() {
  try {
    const occupancy = await getOccupancy();
    return jsonOk({ occupancy });
  } catch (error) {
    return handleRouteError(error);
  }
}
