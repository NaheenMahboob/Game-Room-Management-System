/**
 * Admin-managed equipment type catalog (codes used on Equipment.type).
 *
 * @author Muhammad Naheen Mahboob
 */

import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";

/**
 * Builds a stable UPPER_SNAKE code from a display label.
 *
 * @param label - Human-readable type name
 * @author Muhammad Naheen Mahboob
 */
export function slugifyEquipmentTypeCode(label: string): string {
  const slug = label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  if (!slug) {
    throw new Error("Could not derive a type code from the label");
  }
  return slug.slice(0, 64);
}

/**
 * Lists equipment types, active first then by sortOrder / label.
 *
 * @param options.includeInactive - When false, only active types
 * @author Muhammad Naheen Mahboob
 */
export async function listEquipmentTypes(options?: {
  includeInactive?: boolean;
}) {
  return prisma.equipmentTypeDef.findMany({
    where: options?.includeInactive === false ? { isActive: true } : undefined,
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { label: "asc" }],
  });
}

/**
 * Ensures `code` refers to an active catalog type.
 *
 * @param code - Equipment.type slug
 * @author Muhammad Naheen Mahboob
 */
export async function assertActiveEquipmentType(code: string) {
  const row = await prisma.equipmentTypeDef.findUnique({ where: { code } });
  if (!row) {
    throw new Error("Unknown equipment type");
  }
  if (!row.isActive) {
    throw new Error("That equipment type is inactive");
  }
  return row;
}

/**
 * Merges a minute limit into the equipmentTimeLimits setting JSON.
 *
 * @param code - Type code key
 * @param minutes - Positive limit, or null to leave unchanged
 * @author Muhammad Naheen Mahboob
 */
export async function mergeEquipmentTimeLimit(
  code: string,
  minutes: number | null | undefined
) {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return;
  const raw = await getSetting("equipmentTimeLimits");
  let map: Record<string, number> = {};
  if (raw) {
    try {
      map = JSON.parse(raw) as Record<string, number>;
    } catch {
      map = {};
    }
  }
  map[code] = Math.round(minutes);
  await prisma.setting.upsert({
    where: { key: "equipmentTimeLimits" },
    update: { value: JSON.stringify(map) },
    create: {
      key: "equipmentTimeLimits",
      value: JSON.stringify(map),
    },
  });
}

/**
 * Creates a new equipment type. Code is slugified from label when omitted.
 *
 * @author Muhammad Naheen Mahboob
 */
export async function createEquipmentType(input: {
  label: string;
  code?: string;
  sortOrder?: number;
  defaultTimeLimitMinutes?: number | null;
}) {
  const label = input.label.trim();
  if (label.length < 2) {
    throw new Error("Type label is required");
  }
  const code = (input.code?.trim() || slugifyEquipmentTypeCode(label)).toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(code)) {
    throw new Error(
      "Type code must start with a letter and use only A–Z, 0–9, and underscores"
    );
  }

  const existing = await prisma.equipmentTypeDef.findUnique({ where: { code } });
  if (existing) {
    throw new Error(`Equipment type "${code}" already exists`);
  }

  const maxSort = await prisma.equipmentTypeDef.aggregate({
    _max: { sortOrder: true },
  });
  const sortOrder =
    input.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 10;

  const created = await prisma.equipmentTypeDef.create({
    data: {
      code,
      label,
      sortOrder,
      isActive: true,
    },
  });

  await mergeEquipmentTimeLimit(code, input.defaultTimeLimitMinutes);
  return created;
}

/**
 * Updates label, active flag, or sort order (code is immutable).
 *
 * @author Muhammad Naheen Mahboob
 */
export async function updateEquipmentType(
  id: string,
  input: {
    label?: string;
    isActive?: boolean;
    sortOrder?: number;
  }
) {
  const existing = await prisma.equipmentTypeDef.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Equipment type not found");
  }

  return prisma.equipmentTypeDef.update({
    where: { id },
    data: {
      label: input.label?.trim() || undefined,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    },
  });
}

/**
 * Map of type code → display label for board / availability.
 *
 * @author Muhammad Naheen Mahboob
 */
export async function getEquipmentTypeLabelMap(): Promise<
  Record<string, string>
> {
  const rows = await prisma.equipmentTypeDef.findMany({
    select: { code: true, label: true },
  });
  const map: Record<string, string> = {};
  for (const row of rows) map[row.code] = row.label;
  return map;
}
