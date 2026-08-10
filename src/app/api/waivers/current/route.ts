/**
 * `GET /api/waivers/current`
 *
 * Public: returns the active waiver version and text for registration UIs.
 *
 * @author Muhammad Naheen Mahboob
 */

import { jsonOk, handleRouteError } from "@/lib/api/http";
import { getCurrentWaiverContent } from "@/lib/waivers/signedPdf";

/**
 * Exposes the current legal waiver copy shown before signing.
 */
export async function GET() {
  try {
    const waiver = await getCurrentWaiverContent();
    return jsonOk({ version: waiver.version, text: waiver.text });
  } catch (error) {
    return handleRouteError(error);
  }
}
