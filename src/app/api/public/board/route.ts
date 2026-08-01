/**
 * `GET /api/public/board`
 *
 * Public lobby board payload (occupancy, hours, announcements, events).
 */

import { jsonOk, handleRouteError } from "@/lib/api/http";
import { getPublicBoardData } from "@/lib/services/publicBoard";

/** Returns the public lobby board payload (no auth). */
export async function GET() {
  try {
    const board = await getPublicBoardData();
    return jsonOk({ board });
  } catch (error) {
    return handleRouteError(error);
  }
}
