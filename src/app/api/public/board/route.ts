import { jsonOk, handleRouteError } from "@/lib/api/http";
import { getPublicBoardData } from "@/lib/services/publicBoard";

export async function GET() {
  try {
    const board = await getPublicBoardData();
    return jsonOk({ board });
  } catch (error) {
    return handleRouteError(error);
  }
}
