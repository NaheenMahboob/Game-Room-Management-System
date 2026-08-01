import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import type { AuditActionType } from "@/lib/audit/actions";

type WriteAuditInput = {
  actionType: AuditActionType | string;
  performedByUserId: string;
  memberId?: string | null;
  equipmentId?: string | null;
  details?: Prisma.InputJsonValue;
};

/** Append-only audit log writer. Never update or delete. */
export async function writeAuditLog(
  input: WriteAuditInput,
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;
  return db.auditLog.create({
    data: {
      actionType: input.actionType,
      performedByUserId: input.performedByUserId,
      memberId: input.memberId ?? undefined,
      equipmentId: input.equipmentId ?? undefined,
      details: input.details ?? undefined,
    },
  });
}
