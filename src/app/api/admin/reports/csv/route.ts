/**
 * `GET /api/admin/reports/csv`
 *
 * Exports visits, equipment usage, or member roster as CSV downloads.
 */

import { withRole } from "@/lib/auth/api";
import { handleRouteError } from "@/lib/api/http";
import { getAnalyticsSummary, toCsv } from "@/lib/services/analytics";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/** Exports CSV for `type` (visits, equipment, members, or audit). */
export const GET = withRole(["ADMIN"], async ({ request }) => {
  try {
    const type = new URL(request.url).searchParams.get("type") ?? "visits";
    let rows: Record<string, string | number>[] = [];

    if (type === "visits") {
      const analytics = await getAnalyticsSummary();
      rows = analytics.dailyVisits.map((r) => ({
        date: r.date,
        visits: r.count,
      }));
    } else if (type === "equipment") {
      const analytics = await getAnalyticsSummary();
      rows = analytics.popularEquipment.map((r) => ({
        label: r.label,
        type: r.type,
        loans: r.count,
      }));
    } else if (type === "members") {
      const members = await prisma.member.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          fullName: true,
          phone: true,
          email: true,
          membershipStatus: true,
          createdAt: true,
        },
      });
      rows = members.map((m) => ({
        fullName: m.fullName,
        phone: m.phone,
        email: m.email ?? "",
        status: m.membershipStatus,
        createdAt: m.createdAt.toISOString(),
      }));
    } else if (type === "audit") {
      const logs = await prisma.auditLog.findMany({
        orderBy: { timestamp: "desc" },
        take: 500,
        include: {
          performedBy: { select: { email: true } },
          member: { select: { fullName: true } },
          equipment: { select: { label: true } },
        },
      });
      rows = logs.map((l) => ({
        timestamp: l.timestamp.toISOString(),
        action: l.actionType,
        user: l.performedBy.email,
        member: l.member?.fullName ?? "",
        equipment: l.equipment?.label ?? "",
      }));
    } else {
      return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
    }

    const csv = toCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${type}-report.csv"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
});
