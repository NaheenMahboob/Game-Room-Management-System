/**
 * Admin equipment catalog API.
 * CRUD for equipment items, types, condition, and active flag.
 * Deactivate / hard-delete are blocked while an item has an open loan.
 *
 * @author Muhammad Naheen Mahboob
 */

import { z } from "zod";
import { withRole } from "@/lib/auth/api";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { assertActiveEquipmentType } from "@/lib/services/equipmentTypes";

/** Equipment type code must match an active EquipmentTypeDef row. */
const equipmentTypeCode = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Z][A-Z0-9_]*$/i, "Invalid equipment type code");

/**
 * Request body for creating an equipment item.
 *
 * @author Muhammad Naheen Mahboob
 */
const createSchema = z.object({
  type: equipmentTypeCode,
  label: z.string().trim().min(2).max(120),
  conditionStatus: z
    .enum(["GOOD", "MINOR_ISSUE", "OUT_OF_ORDER"])
    .optional()
    .default("GOOD"),
});

/**
 * Request body for updating an equipment item by id.
 *
 * @author Muhammad Naheen Mahboob
 */
const updateSchema = z.object({
  id: z.string().cuid(),
  label: z.string().trim().min(2).max(120).optional(),
  conditionStatus: z.enum(["GOOD", "MINOR_ISSUE", "OUT_OF_ORDER"]).optional(),
  isActive: z.boolean().optional(),
  type: equipmentTypeCode.optional(),
});

/**
 * Lists equipment with optional active-loan context.
 *
 * @author Muhammad Naheen Mahboob
 */
export const GET = withRole(["ADMIN"], async () => {
  try {
    const equipment = await prisma.equipment.findMany({
      orderBy: [{ type: "asc" }, { label: "asc" }],
      include: {
        typeDef: { select: { code: true, label: true } },
        // One open loan is enough for the inventory UI “with …” label.
        loans: {
          where: { returnedAt: null },
          include: { member: { select: { fullName: true } } },
          take: 1,
        },
      },
    });
    return jsonOk({ equipment });
  } catch (error) {
    return handleRouteError(error);
  }
});

/**
 * Creates a new equipment catalog entry.
 *
 * @author Muhammad Naheen Mahboob
 */
export const POST = withRole(["ADMIN"], async ({ request, session }) => {
  try {
    const body = createSchema.parse(await request.json());
    const typeCode = body.type.toUpperCase();
    await assertActiveEquipmentType(typeCode);
    const equipment = await prisma.equipment.create({
      data: {
        type: typeCode,
        label: body.label,
        conditionStatus: body.conditionStatus,
      },
    });
    await writeAuditLog({
      actionType: "EQUIPMENT_CREATED",
      performedByUserId: session.sub,
      equipmentId: equipment.id,
      details: { ...body, type: typeCode },
    });
    return jsonOk({ equipment }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
});

/**
 * Updates label, type, condition, or active flag for one item.
 * Refuses to deactivate while the item is still on loan.
 *
 * @author Muhammad Naheen Mahboob
 */
export const PATCH = withRole(["ADMIN"], async ({ request, session }) => {
  try {
    const body = updateSchema.parse(await request.json());
    const { id, ...rest } = body;

    // Deactivating while loaned out would strand the borrower in the desk UI.
    if (rest.isActive === false) {
      const activeLoan = await prisma.loan.findFirst({
        where: { equipmentId: id, returnedAt: null },
      });
      if (activeLoan) {
        return jsonError(
          "Cannot deactivate equipment with an active loan",
          409
        );
      }
    }

    const data: {
      label?: string;
      conditionStatus?: "GOOD" | "MINOR_ISSUE" | "OUT_OF_ORDER";
      isActive?: boolean;
      type?: string;
    } = { ...rest };
    if (rest.type) {
      const typeCode = rest.type.toUpperCase();
      await assertActiveEquipmentType(typeCode);
      data.type = typeCode;
    }

    const equipment = await prisma.equipment.update({ where: { id }, data });
    await writeAuditLog({
      actionType: "EQUIPMENT_UPDATED",
      performedByUserId: session.sub,
      equipmentId: id,
      details: data,
    });
    return jsonOk({ equipment });
  } catch (error) {
    return handleRouteError(error);
  }
});

/**
 * Soft-deactivates or hard-deletes equipment (`hard=true` query).
 * Both paths require no open loan.
 *
 * @author Muhammad Naheen Mahboob
 */
export const DELETE = withRole(["ADMIN"], async ({ request, session }) => {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return jsonError("id query param required", 400);

    const activeLoan = await prisma.loan.findFirst({
      where: { equipmentId: id, returnedAt: null },
    });
    if (activeLoan) {
      return jsonError("Cannot delete equipment with an active loan", 409);
    }

    // Soft-delete preferred: deactivate. Hard delete if requested via hard=true.
    const hard = new URL(request.url).searchParams.get("hard") === "true";
    if (hard) {
      await prisma.equipment.delete({ where: { id } });
      await writeAuditLog({
        actionType: "EQUIPMENT_DELETED",
        performedByUserId: session.sub,
        equipmentId: id,
      });
      return jsonOk({ deleted: true });
    }

    const equipment = await prisma.equipment.update({
      where: { id },
      data: { isActive: false },
    });
    await writeAuditLog({
      actionType: "EQUIPMENT_DEACTIVATED",
      performedByUserId: session.sub,
      equipmentId: id,
    });
    return jsonOk({ equipment });
  } catch (error) {
    return handleRouteError(error);
  }
});
