/**
 * Admin equipment catalog API.
 * CRUD for equipment items, types, condition, and active flag.
 */

import { z } from "zod";
import { withRole } from "@/lib/auth/api";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";

/** Allowed equipment catalog types. */
const equipmentTypeEnum = z.enum([
  "PS5_CONSOLE",
  "PS5_CONTROLLER",
  "SWITCH_CONSOLE",
  "SWITCH_CONTROLLER",
  "TABLE_TENNIS",
  "FOOSBALL",
  "POOL",
  "AIR_HOCKEY",
]);

/** Request body for creating an equipment item. */
const createSchema = z.object({
  type: equipmentTypeEnum,
  label: z.string().trim().min(2).max(120),
  conditionStatus: z
    .enum(["GOOD", "MINOR_ISSUE", "OUT_OF_ORDER"])
    .optional()
    .default("GOOD"),
});

/** Request body for updating an equipment item by id. */
const updateSchema = z.object({
  id: z.string().cuid(),
  label: z.string().trim().min(2).max(120).optional(),
  conditionStatus: z.enum(["GOOD", "MINOR_ISSUE", "OUT_OF_ORDER"]).optional(),
  isActive: z.boolean().optional(),
  type: equipmentTypeEnum.optional(),
});

/** Lists equipment with optional active-loan context. */
export const GET = withRole(["ADMIN"], async () => {
  try {
    const equipment = await prisma.equipment.findMany({
      orderBy: [{ type: "asc" }, { label: "asc" }],
      include: {
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

/** Creates a new equipment catalog entry. */
export const POST = withRole(["ADMIN"], async ({ request, session }) => {
  try {
    const body = createSchema.parse(await request.json());
    const equipment = await prisma.equipment.create({ data: body });
    await writeAuditLog({
      actionType: "EQUIPMENT_CREATED",
      performedByUserId: session.sub,
      equipmentId: equipment.id,
      details: body,
    });
    return jsonOk({ equipment }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
});

/** Updates label, type, condition, or active flag for one item. */
export const PATCH = withRole(["ADMIN"], async ({ request, session }) => {
  try {
    const body = updateSchema.parse(await request.json());
    const { id, ...data } = body;
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

/** Soft-deactivates or hard-deletes equipment (`hard=true` query). */
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

    // Soft-delete preferred: deactivate. Hard delete if requested via hard=true
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
