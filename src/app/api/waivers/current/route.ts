/**
 * `GET /api/waivers/current`
 *
 * Public: returns the active waiver version and PDF URL for registration UIs.
 *
 * @author Muhammad Naheen Mahboob
 */

import { jsonOk, handleRouteError } from "@/lib/api/http";
import { getCurrentWaiverContent } from "@/lib/waivers/signedPdf";

/**
 * Exposes the current waiver version and template PDF path for embedding.
 */
export async function GET() {
  try {
    const waiver = await getCurrentWaiverContent();
    return jsonOk({
      version: waiver.version,
      pdfSrc: waiver.pdfSrc,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
