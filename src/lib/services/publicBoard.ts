import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { getAvailabilityByType } from "@/lib/services/loans";
import { getOccupancy } from "@/lib/services/attendance";

function isActiveAnnouncement(now: Date, start?: Date | null, end?: Date | null) {
  if (start && start > now) return false;
  if (end && end < now) return false;
  return true;
}

export async function getPublicBoardData() {
  const now = new Date();
  const [
    occupancy,
    availability,
    openingHoursRaw,
    communityRules,
    membershipInfo,
    announcements,
    events,
  ] = await Promise.all([
    getOccupancy(),
    getAvailabilityByType(),
    getSetting("openingHours"),
    getSetting("communityRules"),
    getSetting("membershipInfo"),
    prisma.announcement.findMany({
      where: { targetAudience: "GENERAL" },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.event.findMany({
      where: { eventDate: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      orderBy: { eventDate: "asc" },
      take: 8,
    }),
  ]);

  return {
    occupancy,
    availability,
    openingHours: openingHoursRaw ? JSON.parse(openingHoursRaw) : null,
    communityRules:
      communityRules ??
      "Be respectful. Take care of equipment. Sign in with a volunteer. Clean up after yourself.",
    membershipInfo:
      membershipInfo ??
      "Visit the volunteer desk to register. Bring a parent/guardian if under 18.",
    announcements: announcements.filter((a) =>
      isActiveAnnouncement(now, a.scheduledStart, a.scheduledEnd)
    ),
    events,
    refreshedAt: now.toISOString(),
  };
}

export async function getMemberAnnouncements() {
  const now = new Date();
  const announcements = await prisma.announcement.findMany({
    where: {
      OR: [{ targetAudience: "GENERAL" }, { targetAudience: "MEMBERS" }],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return announcements.filter((a) =>
    isActiveAnnouncement(now, a.scheduledStart, a.scheduledEnd)
  );
}
