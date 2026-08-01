import { jsonOk, handleRouteError } from "@/lib/api/http";
import { getAvailabilityByType } from "@/lib/services/loans";

/** Public aggregated availability for the status board. */
export async function GET() {
  try {
    const availability = await getAvailabilityByType();
    return jsonOk({ availability });
  } catch (error) {
    return handleRouteError(error);
  }
}
