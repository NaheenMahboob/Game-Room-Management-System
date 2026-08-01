import { withAuth } from "@/lib/auth/api";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";

/**
 * Member portal visit history. Allowed for any role that has a linked memberId
 * (plain members and promoted volunteers/admins).
 */
export const GET = withAuth(async ({ session }) => {
  try {
    if (!session.memberId) {
      return jsonError("No member profile linked to this account", 400);
    }

    const [attendance, loans] = await Promise.all([
      prisma.attendance.findMany({
        where: { memberId: session.memberId },
        orderBy: { signInTime: "desc" },
        take: 100,
      }),
      prisma.loan.findMany({
        where: { memberId: session.memberId },
        include: { equipment: { select: { id: true, label: true, type: true } } },
        orderBy: { borrowedAt: "desc" },
        take: 100,
      }),
    ]);

    return jsonOk({ attendance, loans });
  } catch (error) {
    return handleRouteError(error);
  }
});
