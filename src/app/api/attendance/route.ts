import { withRole } from "@/lib/auth/api";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import {
  getOccupancy,
  listAttendance,
  listActiveSessions,
} from "@/lib/services/attendance";

export const GET = withRole(["VOLUNTEER", "ADMIN"], async ({ request }) => {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";
    if (activeOnly) {
      const sessions = await listActiveSessions();
      const occupancy = await getOccupancy();
      return jsonOk({ sessions, occupancy });
    }

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const rows = await listAttendance({
      memberId: searchParams.get("memberId") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: searchParams.get("limit")
        ? Number(searchParams.get("limit"))
        : 100,
    });
    return jsonOk({ attendance: rows });
  } catch (error) {
    return handleRouteError(error);
  }
});
