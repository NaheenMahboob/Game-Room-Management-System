import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { AuditAction } from "@/lib/audit/actions";
import { isMinor, minutesBetween } from "@/lib/members/rules";
import {
  getCurrentWaiverVersion,
  getMaxSessionDuration,
} from "@/lib/settings";
import { returnLoansForMember } from "@/lib/services/loans";

export async function getOccupancy() {
  const [activeAttendances, activeGuests] = await Promise.all([
    prisma.attendance.count({ where: { signOutTime: null } }),
    prisma.guestPass.count({
      where: { signedInAt: { not: null }, signedOutAt: null },
    }),
  ]);
  return {
    membersInside: activeAttendances,
    guestsInside: activeGuests,
    totalInside: activeAttendances + activeGuests,
  };
}

export async function signInMember(
  memberId: string,
  performedByUserId: string
) {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) throw new Error("Member not found");
  if (member.membershipStatus !== "ACTIVE") {
    throw new Error("Membership is inactive");
  }

  const waiverVersion = await getCurrentWaiverVersion();
  if (!member.waiverSigned || member.waiverVersion < waiverVersion) {
    throw new Error(
      "Member must re-sign the current waiver before signing in"
    );
  }

  if (isMinor(member.dateOfBirth) && !member.parentalConsent) {
    throw new Error(
      "Parental consent is required before this minor can sign in"
    );
  }

  const alreadyIn = await prisma.attendance.findFirst({
    where: { memberId, signOutTime: null },
  });
  if (alreadyIn) {
    throw new Error("Member is already signed in");
  }

  const attendance = await prisma.$transaction(async (tx) => {
    const record = await tx.attendance.create({
      data: {
        memberId,
        signedInByUserId: performedByUserId,
      },
      include: { member: { select: { id: true, fullName: true, photoUrl: true } } },
    });

    await writeAuditLog(
      {
        actionType: AuditAction.SIGN_IN,
        performedByUserId,
        memberId,
        details: { attendanceId: record.id },
      },
      tx
    );

    return record;
  });

  return attendance;
}

export async function signOutMember(
  memberId: string,
  performedByUserId: string,
  forceReturnEquipment: boolean
) {
  const open = await prisma.attendance.findFirst({
    where: { memberId, signOutTime: null },
    include: {
      member: {
        include: {
          loans: {
            where: { returnedAt: null },
            include: { equipment: true },
          },
        },
      },
    },
  });

  if (!open) throw new Error("Member is not currently signed in");

  const activeLoans = open.member.loans;
  if (activeLoans.length > 0 && !forceReturnEquipment) {
    return {
      needsConfirmation: true as const,
      message:
        "Member still has active equipment loans. Return equipment first or force sign-out.",
      outstandingLoans: activeLoans,
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    let returnedLoans = null;
    if (activeLoans.length > 0 && forceReturnEquipment) {
      returnedLoans = await returnLoansForMember(
        memberId,
        performedByUserId,
        undefined,
        tx
      );
    }

    const attendance = await tx.attendance.update({
      where: { id: open.id },
      data: {
        signOutTime: new Date(),
        signedOutByUserId: performedByUserId,
      },
    });

    await writeAuditLog(
      {
        actionType: forceReturnEquipment
          ? AuditAction.FORCE_SIGN_OUT
          : AuditAction.SIGN_OUT,
        performedByUserId,
        memberId,
        details: {
          attendanceId: attendance.id,
          forceReturnEquipment,
          returnedLoanIds: returnedLoans?.map((l) => l.id) ?? [],
        },
      },
      tx
    );

    return { attendance, returnedLoans };
  });

  return {
    needsConfirmation: false as const,
    ...result,
  };
}

export async function listAttendance(params: {
  memberId?: string;
  from?: Date;
  to?: Date;
  q?: string;
  limit?: number;
}) {
  const maxSession = await getMaxSessionDuration();
  const rows = await prisma.attendance.findMany({
    where: {
      memberId: params.memberId,
      signInTime: {
        gte: params.from,
        lte: params.to,
      },
      ...(params.q
        ? {
            member: {
              fullName: { contains: params.q, mode: "insensitive" as const },
            },
          }
        : {}),
    },
    include: {
      member: { select: { id: true, fullName: true, photoUrl: true } },
      signedInBy: { select: { id: true, email: true } },
      signedOutBy: { select: { id: true, email: true } },
    },
    orderBy: { signInTime: "desc" },
    take: params.limit ?? 100,
  });

  return rows.map((row) => {
    const end = row.signOutTime ?? new Date();
    const durationMinutes = minutesBetween(row.signInTime, end);
    const active = !row.signOutTime;
    let sessionAlert: "ok" | "warning" | "overdue" = "ok";
    if (active) {
      if (durationMinutes >= maxSession + 30) sessionAlert = "overdue";
      else if (durationMinutes >= maxSession) sessionAlert = "warning";
    }
    return { ...row, durationMinutes, sessionAlert, maxSessionMinutes: maxSession };
  });
}

export async function listActiveSessions() {
  return listAttendance({ limit: 200 }).then((rows) =>
    rows.filter((r) => !r.signOutTime)
  );
}
