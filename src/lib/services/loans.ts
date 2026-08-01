/**
 * Equipment catalog, borrow/return flows, availability, and condition updates.
 *
 * When an item has a wait queue, return does not free it for everyone: it is
 * reserved for the head of the queue until that member borrows (their entry is
 * then fulfilled and the next person becomes reserved after the next return).
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
 * `available` is true only when free and the wait queue is empty. When free but
 * queued, `reservedFor` names the only member who may borrow next.
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

    const queueEntries = item.queueEntries.map((entry) => ({
      ...entry,
      member: withClientPhotoUrl(entry.member),
    }));
    const queueHead = queueEntries[0] ?? null;

    // Physically free: not on loan and not out of order.
    const physicallyFree =
      item.isActive &&
      item.conditionStatus !== ConditionStatus.OUT_OF_ORDER &&
      !activeLoan;

    // Open to anyone only when there is no wait queue.
    const available = physicallyFree && queueEntries.length === 0;

    // After return (or free with a queue), only the head may borrow.
    const reservedFor =
      physicallyFree && queueHead
        ? {
            memberId: queueHead.member.id,
            fullName: queueHead.member.fullName,
            queueEntryId: queueHead.id,
            queueLength: queueEntries.length,
          }
        : null;

    return {
      ...item,
      loans: item.loans.map((loan) => ({
        ...loan,
        member: withClientPhotoUrl(loan.member),
      })),
      queueEntries,
      activeLoan: activeLoan
        ? {
            ...activeLoan,
            member: withClientPhotoUrl(activeLoan.member),
          }
        : null,
      available,
      reservedFor,
      physicallyFree,
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
      reserved: number;
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
      reserved: 0,
      good: 0,
      minorIssue: 0,
      outOfOrder: 0,
    });
    bucket.total += 1;
    if (item.conditionStatus === "GOOD") bucket.good += 1;
    if (item.conditionStatus === "MINOR_ISSUE") bucket.minorIssue += 1;
    if (item.conditionStatus === "OUT_OF_ORDER") bucket.outOfOrder += 1;
    if (item.activeLoan) bucket.inUse += 1;
    else if (item.reservedFor) bucket.reserved += 1;
    else if (item.available) bucket.available += 1;
  }

  return Object.values(byType);
}

/**
 * Fulfills the queue head for an equipment item and renumbers remaining entries.
 *
 * @param tx - Open transaction
 * @param equipmentId - Equipment whose queue advances
 * @param memberId - Member who must be the current head
 * @param performedByUserId - Staff user for audit
 */
async function fulfillQueueHeadOnBorrow(
  tx: Prisma.TransactionClient,
  equipmentId: string,
  memberId: string,
  performedByUserId: string
) {
  const head = await tx.equipmentQueue.findFirst({
    where: { equipmentId, fulfilled: false },
    orderBy: { position: "asc" },
  });
  if (!head) return;

  if (head.memberId !== memberId) {
    throw new Error(
      "This item is reserved for the next person in the wait queue"
    );
  }

  await tx.equipmentQueue.update({
    where: { id: head.id },
    data: { fulfilled: true },
  });

  // Compact positions so the new head is always position 1.
  const remaining = await tx.equipmentQueue.findMany({
    where: { equipmentId, fulfilled: false },
    orderBy: { position: "asc" },
  });
  for (let i = 0; i < remaining.length; i++) {
    const entry = remaining[i]!;
    const nextPosition = i + 1;
    if (entry.position !== nextPosition) {
      await tx.equipmentQueue.update({
        where: { id: entry.id },
        data: { position: nextPosition },
      });
    }
  }

  await writeAuditLog(
    {
      actionType: AuditAction.QUEUE_REMOVED,
      performedByUserId,
      memberId,
      equipmentId,
      details: {
        queueId: head.id,
        reason: "fulfilled_on_borrow",
        remainingInQueue: remaining.length,
      },
    },
    tx
  );
}

/**
 * Checks out one or more items for a signed-in active member.
 *
 * If an item has a wait queue, only the head of that queue may borrow it;
 * borrowing fulfills their entry and shortens the queue.
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

      // Enforce reservation: queue head only (no queue → anyone may borrow).
      const queueHead = await tx.equipmentQueue.findFirst({
        where: { equipmentId, fulfilled: false },
        orderBy: { position: "asc" },
        include: { member: { select: { fullName: true } } },
      });
      if (queueHead && queueHead.memberId !== memberId) {
        throw new Error(
          `${equipment.label} is reserved for ${queueHead.member.fullName} (next in queue)`
        );
      }

      const loan = await tx.loan.create({
        data: {
          memberId,
          equipmentId,
          borrowedByUserId: performedByUserId,
        },
        include: { equipment: true },
      });

      if (queueHead) {
        await fulfillQueueHeadOnBorrow(
          tx,
          equipmentId,
          memberId,
          performedByUserId
        );
      }

      await writeAuditLog(
        {
          actionType: AuditAction.EQUIPMENT_BORROWED,
          performedByUserId,
          memberId,
          equipmentId,
          details: {
            loanId: loan.id,
            label: equipment.label,
            fulfilledQueueEntryId: queueHead?.id ?? null,
          },
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
 * Does not clear the wait queue: if anyone is waiting, the item becomes
 * reserved for the current head until they borrow.
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

      // Snapshot who the item is now reserved for (queue head), if anyone.
      const nextInQueue = await tx.equipmentQueue.findFirst({
        where: { equipmentId: loan.equipmentId, fulfilled: false },
        orderBy: { position: "asc" },
        include: { member: { select: { id: true, fullName: true } } },
      });

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
            reservedForMemberId: nextInQueue?.memberId ?? null,
            reservedForName: nextInQueue?.member.fullName ?? null,
          },
        },
        tx
      );

      returned.push({
        ...updated,
        reservedFor: nextInQueue
          ? {
              memberId: nextInQueue.member.id,
              fullName: nextInQueue.member.fullName,
            }
          : null,
      });
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
