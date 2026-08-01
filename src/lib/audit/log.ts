/**
 * Append-only audit log writer. Never update or delete persisted rows.
 */

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import type { AuditActionType } from "@/lib/audit/actions";

/** Fields required to create an `AuditLog` row. */
type WriteAuditInput = {
  actionType: AuditActionType | string;
  performedByUserId: string;
  memberId?: string | null;
  equipmentId?: string | null;
  details?: Prisma.InputJsonValue;
};

/**
 * Inserts a single audit log entry (optionally inside a Prisma transaction).
 *
 * @param input - Action type, actor, and optional related entity ids / JSON details
 * @param tx - Optional transaction client for atomic writes with business logic
 * @returns Created audit log record
 */
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
