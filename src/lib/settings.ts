/**
 * Typed readers for `Setting` key/value rows (waiver, limits, JSON blobs).
 */

import { prisma } from "@/lib/prisma";

/** Reads a single `Setting` row value by key, or `null` if unset. */
export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

/** Parses a numeric setting, returning `fallback` when missing or invalid. */
export async function getSettingNumber(
  key: string,
  fallback: number
): Promise<number> {
  const value = await getSetting(key);
  if (value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Parses a boolean setting (`true` / `1`), returning `fallback` when missing. */
export async function getSettingBoolean(
  key: string,
  fallback: boolean
): Promise<boolean> {
  const value = await getSetting(key);
  if (value == null) return fallback;
  return value === "true" || value === "1";
}

/** Current waiver version number from settings (default `1`). */
export async function getCurrentWaiverVersion(): Promise<number> {
  return getSettingNumber("waiverVersion", 1);
}

/** Maximum play session length in minutes (default `120`). */
export async function getMaxSessionDuration(): Promise<number> {
  return getSettingNumber("maxSessionDuration", 120);
}

/** Maximum guests per host member (default `2`). */
export async function getGuestLimit(): Promise<number> {
  return getSettingNumber("guestLimit", 2);
}

/** Per-equipment time limits (minutes) parsed from a JSON setting blob. */
export async function getEquipmentTimeLimits(): Promise<Record<string, number>> {
  const raw = await getSetting("equipmentTimeLimits");
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

/** One day's open/close times as `HH:mm` strings. */
export type DayHours = { open: string; close: string };

/** Weekly schedule keyed by lowercase English day names (`monday` … `sunday`). */
export type OpeningHoursMap = Record<string, DayHours>;

/**
 * Loads and parses the `openingHours` setting JSON.
 *
 * @returns Parsed map, or `null` when unset / invalid
 */
export async function getOpeningHours(): Promise<OpeningHoursMap | null> {
  const raw = await getSetting("openingHours");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OpeningHoursMap;
  } catch {
    return null;
  }
}

/**
 * Converts `HH:mm` to minutes since midnight for comparisons.
 *
 * @param hhmm - Time string like `16:00`
 */
function timeToMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

/**
 * Derives whether the game room is open right now from the weekly schedule.
 *
 * @param hours - Weekly opening hours map (or null if not configured)
 * @param now - Instant to evaluate (defaults to current time)
 */
export function getOpenClosedStatus(
  hours: OpeningHoursMap | null,
  now: Date = new Date()
): {
  isOpen: boolean;
  /** Lowercase day key matching the settings JSON (`monday`, …). */
  dayKey: string;
  /** Today's hours if configured. */
  today: DayHours | null;
} {
  const dayKey = now
    .toLocaleDateString("en-US", { weekday: "long" })
    .toLowerCase();
  const today = hours?.[dayKey] ?? null;
  if (!today) {
    return { isOpen: false, dayKey, today: null };
  }

  const openMin = timeToMinutes(today.open);
  const closeMin = timeToMinutes(today.close);
  if (openMin == null || closeMin == null) {
    return { isOpen: false, dayKey, today };
  }

  const nowMin = now.getHours() * 60 + now.getMinutes();
  // Inclusive open, exclusive close (e.g. closes at 21:00 → closed at 21:00).
  const isOpen = nowMin >= openMin && nowMin < closeMin;
  return { isOpen, dayKey, today };
}
