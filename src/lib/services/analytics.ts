/**
 * Admin analytics aggregates (visits, loans, equipment, CSV export helpers).
 */

import { prisma } from "@/lib/prisma";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function getAnalyticsSummary() {
  const now = new Date();
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    visits30,
    visits7,
    newMembers30,
    equipmentByCondition,
    allAttendances30,
    allLoans30,
    totalMembers,
  ] = await Promise.all([
    prisma.attendance.count({ where: { signInTime: { gte: last30 } } }),
    prisma.attendance.count({ where: { signInTime: { gte: last7 } } }),
    prisma.member.count({ where: { createdAt: { gte: last30 } } }),
    prisma.equipment.groupBy({
      by: ["conditionStatus"],
      _count: { _all: true },
    }),
    prisma.attendance.findMany({
      where: { signInTime: { gte: last30 } },
      select: { signInTime: true, signOutTime: true },
    }),
    prisma.loan.findMany({
      where: { borrowedAt: { gte: last30 } },
      include: { equipment: { select: { label: true, type: true } } },
    }),
    prisma.member.count(),
  ]);

  // Daily visits (last 14 days)
  const dailyMap = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = startOfDay(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
    dailyMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of allAttendances30) {
    const key = startOfDay(row.signInTime).toISOString().slice(0, 10);
    if (dailyMap.has(key)) dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1);
  }
  const dailyVisits = Array.from(dailyMap.entries()).map(([date, count]) => ({
    date,
    count,
  }));

  // Hour-of-day + day-of-week heatmap buckets
  const hourCounts = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: 0,
  }));
  const dowCounts = Array.from({ length: 7 }, (_, day) => ({
    day,
    count: 0,
  }));
  let totalDurationMinutes = 0;
  let durationSamples = 0;

  for (const row of allAttendances30) {
    hourCounts[row.signInTime.getHours()]!.count += 1;
    dowCounts[row.signInTime.getDay()]!.count += 1;
    if (row.signOutTime) {
      totalDurationMinutes += Math.max(
        0,
        Math.floor(
          (row.signOutTime.getTime() - row.signInTime.getTime()) / 60000
        )
      );
      durationSamples += 1;
    }
  }

  const equipmentUsage = new Map<string, { label: string; type: string; count: number }>();
  for (const loan of allLoans30) {
    const key = loan.equipmentId;
    const existing = equipmentUsage.get(key);
    if (existing) existing.count += 1;
    else {
      equipmentUsage.set(key, {
        label: loan.equipment.label,
        type: loan.equipment.type,
        count: 1,
      });
    }
  }
  const popularEquipment = Array.from(equipmentUsage.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const communityHours =
    Math.round((totalDurationMinutes / 60) * 10) / 10;

  // Monthly registrations (last 6 months)
  const monthMap = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, 0);
  }
  const members = await prisma.member.findMany({
    where: {
      createdAt: {
        gte: new Date(now.getFullYear(), now.getMonth() - 5, 1),
      },
    },
    select: { createdAt: true },
  });
  for (const m of members) {
    const key = `${m.createdAt.getFullYear()}-${String(m.createdAt.getMonth() + 1).padStart(2, "0")}`;
    if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
  }

  return {
    totals: {
      visitsLast7Days: visits7,
      visitsLast30Days: visits30,
      newMembersLast30Days: newMembers30,
      totalMembers,
      averageVisitMinutes:
        durationSamples > 0
          ? Math.round(totalDurationMinutes / durationSamples)
          : 0,
      communityHoursServedLast30Days: communityHours,
    },
    dailyVisits,
    hourCounts,
    dowCounts,
    popularEquipment,
    registrationsByMonth: Array.from(monthMap.entries()).map(
      ([month, count]) => ({ month, count })
    ),
    equipmentCondition: equipmentByCondition.map((row) => ({
      status: row.conditionStatus,
      count: row._count._all,
    })),
  };
}

export function toCsv(rows: Record<string, string | number>[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: string | number) => {
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replaceAll('"', '""')}"`;
    }
    return s;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h] ?? "")).join(",")),
  ].join("\n");
}
