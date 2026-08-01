/**
 * Typed readers for `Setting` key/value rows (waiver, limits, JSON blobs).
 */

import { prisma } from "@/lib/prisma";

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function getSettingNumber(
  key: string,
  fallback: number
): Promise<number> {
  const value = await getSetting(key);
  if (value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function getSettingBoolean(
  key: string,
  fallback: boolean
): Promise<boolean> {
  const value = await getSetting(key);
  if (value == null) return fallback;
  return value === "true" || value === "1";
}

export async function getCurrentWaiverVersion(): Promise<number> {
  return getSettingNumber("waiverVersion", 1);
}

export async function getMaxSessionDuration(): Promise<number> {
  return getSettingNumber("maxSessionDuration", 120);
}

export async function getGuestLimit(): Promise<number> {
  return getSettingNumber("guestLimit", 2);
}

export async function getEquipmentTimeLimits(): Promise<Record<string, number>> {
  const raw = await getSetting("equipmentTimeLimits");
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}
