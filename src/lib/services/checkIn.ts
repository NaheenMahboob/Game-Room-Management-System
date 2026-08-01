/**
 * Member-initiated check-in requests (“I’m here”) for desk room sign-in.
 *
 * Members must request entry from the portal before staff can sign them into
 * the room. Desk registration auto-creates a request so walk-ups still appear
 * on the volunteer waiting list.
 */

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { AuditAction } from "@/lib/audit/actions";
import { withClientPhotoUrl } from "@/lib/uploads/memberPhoto";

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
      // Exclude anyone who already has an open attendance session.
      attendances: { none: { signOutTime: null } },
    },
    orderBy: { checkInRequestedAt: "asc" },
    select: {
      id: true,
      fullName: true,
      phone: true,
      photoUrl: true,
      pendingPhotoUrl: true,
      membershipStatus: true,
      qrPayload: true,
      checkInRequestedAt: true,
      userId: true,
    },
  });
  return members.map(withClientPhotoUrl);
}

/**
 * Searches only among members currently waiting for desk sign-in.
 *
 * @param q - Name or phone fragment
 * @param limit - Max rows
 */
export async function searchWaitingForCheckIn(q: string, limit = 20) {
  const members = await prisma.member.findMany({
    where: {
      membershipStatus: "ACTIVE",
      checkInRequestedAt: { not: null },
      attendances: { none: { signOutTime: null } },
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    take: limit,
    orderBy: { checkInRequestedAt: "asc" },
    select: {
      id: true,
      fullName: true,
      phone: true,
      photoUrl: true,
      pendingPhotoUrl: true,
      membershipStatus: true,
      qrPayload: true,
      checkInRequestedAt: true,
      userId: true,
    },
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
