/**
 * Per-equipment wait queue join, list, and remove operations.
 */

import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { AuditAction } from "@/lib/audit/actions";
import { withClientPhotoUrl } from "@/lib/uploads/memberPhoto";

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

    await writeAuditLog(
      {
        actionType: AuditAction.QUEUE_REMOVED,
        performedByUserId,
        memberId: entry.memberId,
        equipmentId: entry.equipmentId,
        details: { queueId },
      },
      tx
    );
  });

  return { ok: true };
}

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
