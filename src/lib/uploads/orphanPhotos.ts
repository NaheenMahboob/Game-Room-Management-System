/**
 * Deletes orphaned pre-registration photos left when upload succeeded but
 * register never completed (tab closed mid-submit).
 *
 * Only considers `self-*` / `reg-*` files older than {@link DEFAULT_MAX_AGE_MS}
 * that are not referenced by any `Member.photoUrl`.
 */

import { readdir, stat } from "fs/promises";
import { prisma } from "@/lib/prisma";
import {
  MEMBER_UPLOAD_DIR,
  absolutePhotoPath,
  deleteMemberPhotoIfStored,
  storedPhotoFilename,
} from "@/lib/uploads/memberPhoto";

/** Keep recent uploads so an in-flight register is not raced. */
export const DEFAULT_ORPHAN_PHOTO_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

const ORPHAN_NAME =
  /^(self|reg)-[\w.-]+\.(jpe?g|png|webp)$/i;

/** In-process throttle so busy upload traffic does not readdir every request. */
let lastSweepAt = 0;
const SWEEP_MIN_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Scans storage for unreferenced registration uploads past the age threshold.
 *
 * @param maxAgeMs - Minimum age before a file is eligible for deletion
 * @returns Number of files deleted
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
    select: { photoUrl: true },
  });
  const referenced = new Set(
    members
      .map((m) => storedPhotoFilename(m.photoUrl))
      .filter((f): f is string => Boolean(f))
  );

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
 */
export function scheduleOrphanRegistrationPhotoSweep(): void {
  const now = Date.now();
  if (now - lastSweepAt < SWEEP_MIN_INTERVAL_MS) return;
  lastSweepAt = now;
  void sweepOrphanRegistrationPhotos().catch(() => {
    // Best-effort background cleanup.
  });
}
