/**
 * Equipment catalog, borrow/return flows, availability, and condition updates.
 */

import type { Prisma } from "@/generated/prisma";
import { ConditionStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { AuditAction } from "@/lib/audit/actions";
import {
  getEquipmentTimeLimits,
  getSettingBoolean,
} from "@/lib/settings";
import { minutesBetween } from "@/lib/members/rules";
import { withClientPhotoUrl } from "@/lib/uploads/memberPhoto";

/** Prisma client or an open transaction used for loan queries. */
type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Lists equipment with active loans, queue entries, availability, and time-limit alerts.
 *
 * @param options - Optional type filter and whether to include inactive items
 */
export async function listEquipment(options?: {
  type?: string;
  includeInactive?: boolean;
}) {
  const timeLimits = await getEquipmentTimeLimits();
  const equipment = await prisma.equipment.findMany({
    where: {
      type: options?.type as never,
      isActive: options?.includeInactive ? undefined : true,
    },
    include: {
      loans: {
        where: { returnedAt: null },
        include: {
          member: { select: { id: true, fullName: true, photoUrl: true } },
        },
        take: 1,
      },
      queueEntries: {
        where: { fulfilled: false },
        orderBy: { position: "asc" },
        include: {
          member: { select: { id: true, fullName: true, photoUrl: true } },
        },
      },
    },
    orderBy: [{ type: "asc" }, { label: "asc" }],
  });

  return equipment.map((item) => {
    const activeLoan = item.loans[0] ?? null;
    const limit = timeLimits[item.type];
    let loanAlert: "ok" | "warning" | "overdue" | null = null;
    let loanMinutes: number | null = null;
    if (activeLoan) {
      loanMinutes = minutesBetween(activeLoan.borrowedAt);
      if (limit != null) {
        if (loanMinutes >= limit + 15) loanAlert = "overdue";
        else if (loanMinutes >= limit) loanAlert = "warning";
        else loanAlert = "ok";
      } else {
        loanAlert = "ok";
      }
    }

    const available =
      item.isActive &&
      item.conditionStatus !== ConditionStatus.OUT_OF_ORDER &&
      !activeLoan;

    return {
      ...item,
      loans: item.loans.map((loan) => ({
        ...loan,
        member: withClientPhotoUrl(loan.member),
      })),
      queueEntries: item.queueEntries.map((entry) => ({
        ...entry,
        member: withClientPhotoUrl(entry.member),
      })),
      activeLoan: activeLoan
        ? {
            ...activeLoan,
            member: withClientPhotoUrl(activeLoan.member),
          }
        : null,
      available,
      loanMinutes,
      loanAlert,
      timeLimitMinutes: limit ?? null,
    };
  });
}

/** Aggregates equipment counts by type (available, in use, condition buckets). */
export async function getAvailabilityByType() {
  const items = await listEquipment({ includeInactive: false });
  const byType: Record<
    string,
    {
      type: string;
      total: number;
      available: number;
      inUse: number;
      good: number;
      minorIssue: number;
      outOfOrder: number;
    }
  > = {};

  for (const item of items) {
    const bucket = (byType[item.type] ??= {
      type: item.type,
      total: 0,
      available: 0,
      inUse: 0,
      good: 0,
      minorIssue: 0,
      outOfOrder: 0,
    });
    bucket.total += 1;
    if (item.conditionStatus === "GOOD") bucket.good += 1;
    if (item.conditionStatus === "MINOR_ISSUE") bucket.minorIssue += 1;
    if (item.conditionStatus === "OUT_OF_ORDER") bucket.outOfOrder += 1;
    if (item.activeLoan) bucket.inUse += 1;
    else if (item.available) bucket.available += 1;
  }

  return Object.values(byType);
}

/**
 * Checks out one or more items for a signed-in active member.
 *
 * @param memberId - Borrower member id
 * @param equipmentIds - Equipment to loan
 * @param performedByUserId - Staff user recording the borrow
 */
export async function borrowEquipment(
  memberId: string,
  equipmentIds: string[],
  performedByUserId: string
) {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) throw new Error("Member not found");
  if (member.membershipStatus !== "ACTIVE") {
    if (member.membershipStatus === "PENDING") {
      throw new Error(
        "Registration is still awaiting photo verification"
      );
    }
    throw new Error("Membership is inactive");
  }

  const signedIn = await prisma.attendance.findFirst({
    where: { memberId, signOutTime: null },
  });
  if (!signedIn) {
    throw new Error("Member must be signed in before borrowing equipment");
  }

  return prisma.$transaction(async (tx) => {
    const loans = [];
    for (const equipmentId of equipmentIds) {
      const equipment = await tx.equipment.findUnique({
        where: { id: equipmentId },
      });
      if (!equipment || !equipment.isActive) {
        throw new Error(`Equipment not found or inactive: ${equipmentId}`);
      }
      if (equipment.conditionStatus === ConditionStatus.OUT_OF_ORDER) {
        throw new Error(`${equipment.label} is out of order`);
      }

      const existing = await tx.loan.findFirst({
        where: { equipmentId, returnedAt: null },
      });
      if (existing) {
        throw new Error(`${equipment.label} is already checked out`);
      }

      const loan = await tx.loan.create({
        data: {
          memberId,
          equipmentId,
          borrowedByUserId: performedByUserId,
        },
        include: { equipment: true },
      });

      await writeAuditLog(
        {
          actionType: AuditAction.EQUIPMENT_BORROWED,
          performedByUserId,
          memberId,
          equipmentId,
          details: { loanId: loan.id, label: equipment.label },
        },
        tx
      );

      loans.push(loan);
    }
    return loans;
  });
}

/**
 * After a return, optionally marks equipment MINOR_ISSUE when notes are present
 * and the `autoMinorIssueOnNotes` setting is enabled.
 */
async function applyReturnSideEffects(
  tx: Prisma.TransactionClient,
  equipmentId: string,
  conditionNotes: string | undefined,
  performedByUserId: string
) {
  const autoMinor = await getSettingBoolean("autoMinorIssueOnNotes", true);
  if (conditionNotes && conditionNotes.trim().length > 0 && autoMinor) {
    await tx.equipment.update({
      where: { id: equipmentId },
      data: { conditionStatus: ConditionStatus.MINOR_ISSUE },
    });
    await writeAuditLog(
      {
        actionType: AuditAction.EQUIPMENT_CONDITION_UPDATED,
        performedByUserId,
        equipmentId,
        details: {
          conditionStatus: ConditionStatus.MINOR_ISSUE,
          reason: "condition notes on return",
          conditionNotes,
        },
      },
      tx
    );
  }
}

/**
 * Marks loans returned, applies return side effects, and writes audit entries.
 *
 * @param loanIds - Loans to close
 * @param performedByUserId - Staff user performing the return
 * @param conditionNotes - Optional notes shared across returned loans
 * @param txClient - When set, runs inside an existing transaction
 */
export async function returnLoans(
  loanIds: string[],
  performedByUserId: string,
  conditionNotes?: string,
  txClient?: Prisma.TransactionClient
) {
  /** Executes return logic within a transaction client. */
  const run = async (tx: Prisma.TransactionClient) => {
    const returned = [];
    for (const loanId of loanIds) {
      const loan = await tx.loan.findUnique({
        where: { id: loanId },
        include: { equipment: true },
      });
      if (!loan) throw new Error(`Loan not found: ${loanId}`);
      if (loan.returnedAt) continue;

      const updated = await tx.loan.update({
        where: { id: loanId },
        data: {
          returnedAt: new Date(),
          returnedByUserId: performedByUserId,
          conditionNotes: conditionNotes || null,
        },
        include: { equipment: true, member: true },
      });

      await applyReturnSideEffects(
        tx,
        loan.equipmentId,
        conditionNotes,
        performedByUserId
      );

      await writeAuditLog(
        {
          actionType: AuditAction.EQUIPMENT_RETURNED,
          performedByUserId,
          memberId: loan.memberId,
          equipmentId: loan.equipmentId,
          details: {
            loanId,
            conditionNotes: conditionNotes ?? null,
            label: loan.equipment.label,
          },
        },
        tx
      );

      returned.push(updated);
    }
    return returned;
  };

  if (txClient) return run(txClient);
  return prisma.$transaction(run);
}

/** Returns all outstanding loans for a member (optional shared condition notes). */
export async function returnLoansForMember(
  memberId: string,
  performedByUserId: string,
  conditionNotes?: string,
  txClient?: Prisma.TransactionClient
) {
  const db: Db = txClient ?? prisma;
  const active = await db.loan.findMany({
    where: { memberId, returnedAt: null },
    select: { id: true },
  });
  return returnLoans(
    active.map((l) => l.id),
    performedByUserId,
    conditionNotes,
    txClient
  );
}

/**
 * Updates an equipment item's condition status and logs the change.
 *
 * @param equipmentId - Target equipment
 * @param conditionStatus - New condition enum value
 * @param performedByUserId - Staff user making the update
 * @param notes - Optional free-text notes stored in audit details
 */
export async function updateEquipmentCondition(
  equipmentId: string,
  conditionStatus: ConditionStatus,
  performedByUserId: string,
  notes?: string
) {
  const equipment = await prisma.equipment.update({
    where: { id: equipmentId },
    data: { conditionStatus },
  });

  await writeAuditLog({
    actionType: AuditAction.EQUIPMENT_CONDITION_UPDATED,
    performedByUserId,
    equipmentId,
    details: { conditionStatus, notes: notes ?? null },
  });

  return equipment;
}

/**
 * Lists open loans with duration and time-limit alert state.
 *
 * @param memberId - When set, limits results to that member
 */
export async function listActiveLoans(memberId?: string) {
  const timeLimits = await getEquipmentTimeLimits();
  const loans = await prisma.loan.findMany({
    where: { returnedAt: null, memberId },
    include: {
      member: { select: { id: true, fullName: true, photoUrl: true } },
      equipment: true,
      borrowedBy: { select: { id: true, email: true } },
    },
    orderBy: { borrowedAt: "asc" },
  });

  return loans.map((loan) => {
    const minutes = minutesBetween(loan.borrowedAt);
    const limit = timeLimits[loan.equipment.type];
    let alert: "ok" | "warning" | "overdue" = "ok";
    if (limit != null) {
      if (minutes >= limit + 15) alert = "overdue";
      else if (minutes >= limit) alert = "warning";
    }
    return {
      ...loan,
      member: withClientPhotoUrl(loan.member),
      durationMinutes: minutes,
      timeLimitMinutes: limit ?? null,
      alert,
    };
  });
}
