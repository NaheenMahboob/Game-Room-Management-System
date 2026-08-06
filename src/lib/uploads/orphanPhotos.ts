/**
 * Deletes orphaned pre-registration photos left when upload succeeded but
 * register never completed (tab closed mid-submit).
 *
 * Only considers `self-*` / `reg-*` files older than {@link DEFAULT_MAX_AGE_MS}
 * that are not referenced by any `Member.photoUrl`.
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */

import { readdir, stat } from "fs/promises";
import { prisma } from "@/lib/prisma";
import {
  MEMBER_UPLOAD_DIR,
  absolutePhotoPath,
  deleteMemberPhotoIfStored,
  storedPhotoFilename,
} from "@/lib/uploads/memberPhoto";

/** Keep recent uploads so an in-flight register is not raced.
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
export const DEFAULT_ORPHAN_PHOTO_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

/** Filename pattern for pre-registration uploads eligible for orphan cleanup.
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
const ORPHAN_NAME =
  /^(self|reg)-[\w.-]+\.(jpe?g|png|webp)$/i;

/** Timestamp (ms) of the last background sweep, for throttling.
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
let lastSweepAt = 0;

/** Minimum time between automatic orphan photo sweeps (5 minutes).
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
const SWEEP_MIN_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Scans storage for unreferenced registration uploads past the age threshold.
 *
 * @param maxAgeMs - Minimum age before a file is eligible for deletion
 * @returns Number of files deleted
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
export async function sweepOrphanRegistrationPhotos(
  maxAgeMs = DEFAULT_ORPHAN_PHOTO_MAX_AGE_MS
): Promise<number> {
  let names: string[];
  try {
    names = await readdir(MEMBER_UPLOAD_DIR);
  } catch {
    return 0; // Directory may not exist yet.
  }

  const candidates = names.filter((n) => ORPHAN_NAME.test(n));
  if (candidates.length === 0) return 0;

  const members = await prisma.member.findMany({
    select: { photoUrl: true, pendingPhotoUrl: true },
  });
  const referenced = new Set<string>();
  for (const m of members) {
    const live = storedPhotoFilename(m.photoUrl);
    if (live) referenced.add(live);
    const pending = storedPhotoFilename(m.pendingPhotoUrl);
    if (pending) referenced.add(pending);
  }

  const cutoff = Date.now() - maxAgeMs;
  let deleted = 0;

  for (const filename of candidates) {
    if (referenced.has(filename)) continue;
    try {
      const info = await stat(absolutePhotoPath(filename));
      if (info.mtimeMs > cutoff) continue;
      await deleteMemberPhotoIfStored(filename);
      deleted += 1;
    } catch {
      // Race with another process — ignore.
    }
  }

  return deleted;
}

/**
 * Runs {@link sweepOrphanRegistrationPhotos} at most once per
 * {@link SWEEP_MIN_INTERVAL_MS} (fire-and-forget safe from upload handlers).
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
export function scheduleOrphanRegistrationPhotoSweep(): void {
  const now = Date.now();
  if (now - lastSweepAt < SWEEP_MIN_INTERVAL_MS) return;
  lastSweepAt = now;
  void sweepOrphanRegistrationPhotos().catch(() => {
    // Best-effort background cleanup.
  });
}
