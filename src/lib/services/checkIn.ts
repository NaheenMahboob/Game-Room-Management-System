/**
 * Member-initiated check-in requests (“I’m here”) for desk room sign-in.
 *
 * Members must request entry from the portal before staff can sign them into
 * the room. Desk registration auto-creates a request so walk-ups still appear.
 * The desk Members roster shows people waiting to enter and people already
 * inside (for borrow / return / sign-out). Sign-in itself still requires a
 * check-in request.
 */

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { AuditAction } from "@/lib/audit/actions";
import { flagMinorRegistrationAgeExpired } from "@/lib/services/members";
import { withClientPhotoUrl } from "@/lib/uploads/memberPhoto";

/** Shared select for desk roster rows (waiting + inside). */
const deskMemberSelect = {
  id: true,
  fullName: true,
  phone: true,
  photoUrl: true,
  pendingPhotoUrl: true,
  membershipStatus: true,
  qrPayload: true,
  checkInRequestedAt: true,
  userId: true,
  attendances: {
    where: { signOutTime: null },
    take: 1,
    orderBy: { signInTime: "desc" as const },
    select: { id: true, signInTime: true },
  },
} satisfies Prisma.MemberSelect;

/** Prisma filter: waiting to enter, or currently inside the room. */
const deskRosterPresence: Prisma.MemberWhereInput = {
  OR: [
    {
      checkInRequestedAt: { not: null },
      attendances: { none: { signOutTime: null } },
    },
    { attendances: { some: { signOutTime: null } } },
  ],
};

type DeskMemberRow = Prisma.MemberGetPayload<{ select: typeof deskMemberSelect }>;

/**
 * Sorts desk roster: waiting (oldest first), then inside (A–Z).
 *
 * @param members - Raw Prisma rows with open `attendances`
 */
function sortDeskRoster(members: DeskMemberRow[]): DeskMemberRow[] {
  return [...members].sort((a, b) => {
    const aInside = a.attendances.length > 0;
    const bInside = b.attendances.length > 0;
    if (aInside !== bInside) return aInside ? 1 : -1;
    if (!aInside && !bInside) {
      const aAt = a.checkInRequestedAt?.getTime() ?? 0;
      const bAt = b.checkInRequestedAt?.getTime() ?? 0;
      return aAt - bAt;
    }
    return a.fullName.localeCompare(b.fullName);
  });
}

/**
 * ACTIVE members on the desk roster: waiting to enter, or already inside.
 *
 * @returns Roster with client photo URLs
 */
export async function listDeskRoster() {
  const members = await prisma.member.findMany({
    where: {
      membershipStatus: "ACTIVE",
      AND: [deskRosterPresence],
    },
    select: deskMemberSelect,
  });
  return sortDeskRoster(members).map(withClientPhotoUrl);
}

/**
 * Searches the desk roster (waiting + currently inside) by name or phone.
 *
 * @param q - Name or phone fragment
 * @param limit - Max rows
 */
export async function searchDeskRoster(q: string, limit = 20) {
  const members = await prisma.member.findMany({
    where: {
      membershipStatus: "ACTIVE",
      AND: [
        deskRosterPresence,
        {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        },
      ],
    },
    take: limit,
    select: deskMemberSelect,
  });
  return sortDeskRoster(members).map(withClientPhotoUrl);
}

/**
 * Lists ACTIVE members waiting for staff room sign-in (not already inside).
 *
 * @returns Waiting members oldest-request-first, with client photo URLs
 */
export async function listWaitingForCheckIn() {
  const members = await prisma.member.findMany({
    where: {
      membershipStatus: "ACTIVE",
      checkInRequestedAt: { not: null },
      attendances: { none: { signOutTime: null } },
    },
    orderBy: { checkInRequestedAt: "asc" },
    select: deskMemberSelect,
  });
  return members.map(withClientPhotoUrl);
}

/**
 * Member (or equivalent session with memberId) requests to be let into the room.
 *
 * @param memberId - Member placing themselves on the waiting list
 * @param performedByUserId - User id for audit (usually the member’s user)
 */
export async function requestCheckIn(
  memberId: string,
  performedByUserId: string
) {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) throw new Error("Member not found");
  if (await flagMinorRegistrationAgeExpired(memberId)) {
    throw new Error(
      "Your minor registration has expired. Ask an admin to delete your account, then register again as an adult."
    );
  }
  if (member.membershipStatus !== "ACTIVE") {
    throw new Error("Only active members can request check-in");
  }

  // Already inside — nothing to wait for.
  const alreadyIn = await prisma.attendance.findFirst({
    where: { memberId, signOutTime: null },
  });
  if (alreadyIn) {
    throw new Error("You are already signed in to the room");
  }

  if (member.checkInRequestedAt) {
    return withClientPhotoUrl(member);
  }

  const updated = await prisma.member.update({
    where: { id: memberId },
    data: { checkInRequestedAt: new Date() },
  });

  await writeAuditLog({
    actionType: AuditAction.CHECK_IN_REQUESTED,
    performedByUserId,
    memberId,
    details: { source: "portal" },
  });

  return withClientPhotoUrl(updated);
}

/**
 * Cancels an open check-in request (member changed their mind / left).
 *
 * @param memberId - Member leaving the waiting list
 * @param performedByUserId - User id for audit
 */
export async function cancelCheckInRequest(
  memberId: string,
  performedByUserId: string
) {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) throw new Error("Member not found");
  if (!member.checkInRequestedAt) {
    throw new Error("No check-in request to cancel");
  }

  const updated = await prisma.member.update({
    where: { id: memberId },
    data: { checkInRequestedAt: null },
  });

  await writeAuditLog({
    actionType: AuditAction.CHECK_IN_CANCELLED,
    performedByUserId,
    memberId,
    details: {},
  });

  return withClientPhotoUrl(updated);
}
