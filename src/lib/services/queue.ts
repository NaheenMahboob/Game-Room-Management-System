/**
 * Per-equipment wait queue join, list, and remove operations.
 *
 * The head of an unfulfilled queue holds a reservation once the item is free:
 * only they may borrow it. Borrowing fulfills their entry and renumbers the
 * rest; the next return reserves for the new head.
 */

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { AuditAction } from "@/lib/audit/actions";
import { withClientPhotoUrl } from "@/lib/uploads/memberPhoto";

/**
 * Adds a member to an equipment wait queue at the next position.
 *
 * @param equipmentId - Equipment being queued for
 * @param memberId - Member joining the queue
 * @param performedByUserId - Staff user recording the join
 */
export async function joinQueue(
  equipmentId: string,
  memberId: string,
  performedByUserId: string
) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
  });
  if (!equipment) throw new Error("Equipment not found");

  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) throw new Error("Member not found");

  const existing = await prisma.equipmentQueue.findFirst({
    where: { equipmentId, memberId, fulfilled: false },
  });
  if (existing) throw new Error("Member is already in this queue");

  const last = await prisma.equipmentQueue.findFirst({
    where: { equipmentId, fulfilled: false },
    orderBy: { position: "desc" },
  });
  const position = (last?.position ?? 0) + 1;

  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.equipmentQueue.create({
      data: { equipmentId, memberId, position },
      include: {
        member: { select: { id: true, fullName: true, photoUrl: true } },
        equipment: true,
      },
    });

    await writeAuditLog(
      {
        actionType: AuditAction.QUEUE_JOINED,
        performedByUserId,
        memberId,
        equipmentId,
        details: { queueId: created.id, position },
      },
      tx
    );

    return created;
  });

  return {
    ...entry,
    member: withClientPhotoUrl(entry.member),
  };
}

/**
 * Marks a queue entry fulfilled (removed) without borrowing equipment and
 * renumbers remaining positions so the next person becomes head (position 1).
 *
 * @param queueId - Open queue entry id
 * @param performedByUserId - Staff user removing the entry
 */
export async function removeFromQueue(
  queueId: string,
  performedByUserId: string
) {
  const entry = await prisma.equipmentQueue.findUnique({
    where: { id: queueId },
  });
  if (!entry || entry.fulfilled) throw new Error("Queue entry not found");

  await prisma.$transaction(async (tx) => {
    await tx.equipmentQueue.update({
      where: { id: queueId },
      data: { fulfilled: true },
    });

    // Keep positions dense after a manual remove.
    const remaining = await tx.equipmentQueue.findMany({
      where: { equipmentId: entry.equipmentId, fulfilled: false },
      orderBy: { position: "asc" },
    });
    for (let i = 0; i < remaining.length; i++) {
      const row = remaining[i]!;
      const nextPosition = i + 1;
      if (row.position !== nextPosition) {
        await tx.equipmentQueue.update({
          where: { id: row.id },
          data: { position: nextPosition },
        });
      }
    }

    await writeAuditLog(
      {
        actionType: AuditAction.QUEUE_REMOVED,
        performedByUserId,
        memberId: entry.memberId,
        equipmentId: entry.equipmentId,
        details: {
          queueId,
          remainingInQueue: remaining.length,
        },
      },
      tx
    );
  });

  return { ok: true };
}

/**
 * Lists unfulfilled queue entries, optionally filtered by equipment.
 *
 * @param equipmentId - When set, only entries for that equipment
 */
export async function listQueue(equipmentId?: string) {
  const entries = await prisma.equipmentQueue.findMany({
    where: {
      fulfilled: false,
      equipmentId,
    },
    include: {
      member: { select: { id: true, fullName: true, photoUrl: true } },
      equipment: true,
    },
    orderBy: [{ equipmentId: "asc" }, { position: "asc" }],
  });

  return entries.map((entry) => ({
    ...entry,
    member: withClientPhotoUrl(entry.member),
  }));
}
