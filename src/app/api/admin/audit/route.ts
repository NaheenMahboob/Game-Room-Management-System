/**
 * `GET /api/admin/audit`
 *
 * Filterable audit log feed for administrators (action, user, date range).
 */

import { withRole } from "@/lib/auth/api";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";

/** Returns filtered audit log entries for the admin UI. */
export const GET = withRole(["ADMIN"], async ({ request }) => {
  try {
    const { searchParams } = new URL(request.url);
    const actionType = searchParams.get("actionType") ?? undefined;
    const performedByUserId = searchParams.get("userId") ?? undefined;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const logs = await prisma.auditLog.findMany({
      where: {
        actionType: actionType || undefined,
        performedByUserId: performedByUserId || undefined,
        timestamp: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      include: {
        performedBy: { select: { id: true, email: true, role: true } },
        member: { select: { id: true, fullName: true } },
        equipment: { select: { id: true, label: true } },
      },
      orderBy: { timestamp: "desc" },
      take: Number(searchParams.get("limit") ?? 100),
    });

    return jsonOk({ logs });
  } catch (error) {
    return handleRouteError(error);
  }
});
