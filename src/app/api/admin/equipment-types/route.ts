/**
 * `GET/POST/PATCH /api/admin/equipment-types`
 *
 * Admin catalog of equipment categories used when adding inventory items.
 *
 * @author Muhammad Naheen Mahboob
 */

import { z } from "zod";
import { withRole } from "@/lib/auth/api";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import { writeAuditLog } from "@/lib/audit/log";
import {
  createEquipmentType,
  listEquipmentTypes,
  updateEquipmentType,
} from "@/lib/services/equipmentTypes";

const createSchema = z.object({
  label: z.string().trim().min(2).max(120),
  code: z.string().trim().min(1).max(64).optional(),
  sortOrder: z.number().int().optional(),
  defaultTimeLimitMinutes: z.number().int().positive().max(24 * 60).nullable().optional(),
});

const updateSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(2).max(120).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

/** Lists all equipment types (including inactive). */
export const GET = withRole(["ADMIN"], async () => {
  try {
    const types = await listEquipmentTypes({ includeInactive: true });
    return jsonOk({ types });
  } catch (error) {
    return handleRouteError(error);
  }
});

/** Creates a new equipment type (optional default loan time limit). */
export const POST = withRole(["ADMIN"], async ({ request, session }) => {
  try {
    const body = createSchema.parse(await request.json());
    const type = await createEquipmentType(body);
    await writeAuditLog({
      actionType: "EQUIPMENT_TYPE_CREATED",
      performedByUserId: session.sub,
      details: {
        code: type.code,
        label: type.label,
        defaultTimeLimitMinutes: body.defaultTimeLimitMinutes ?? null,
      },
    });
    return jsonOk({ type }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
});

/** Updates label, active flag, or sort order (code cannot change). */
export const PATCH = withRole(["ADMIN"], async ({ request, session }) => {
  try {
    const body = updateSchema.parse(await request.json());
    const { id, ...data } = body;
    const type = await updateEquipmentType(id, data);
    await writeAuditLog({
      actionType: "EQUIPMENT_TYPE_UPDATED",
      performedByUserId: session.sub,
      details: { id, code: type.code, ...data },
    });
    return jsonOk({ type });
  } catch (error) {
    return handleRouteError(error);
  }
});
