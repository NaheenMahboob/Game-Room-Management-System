/**
 * Server-side helpers for persisting government ID photos under
 * `storage/government-ids/` (outside `public/`). Files are served only through
 * authenticated `GET /api/members/[id]/government-id` (admins).
 *
 * `Member.governmentIdUrl` stores the on-disk filename (e.g. `gid-abc.jpg`),
 * never a public URL or base64 data URL.
 *
 * @author Muhammad Naheen Mahboob
 */

import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import {
  extensionForMime,
  mimeTypeForFilename,
  MAX_MEMBER_PHOTO_BYTES,
} from "@/lib/uploads/memberPhoto";

/** Absolute filesystem directory for private government ID photos. */
export const GOVERNMENT_ID_UPLOAD_DIR = path.join(
  process.cwd(),
  "storage",
  "government-ids"
);

/**
 * Builds the authenticated browser URL for a member's government ID image.
 *
 * @param memberId - Member cuid
 */
export function memberGovernmentIdSrc(memberId: string): string {
  return `/api/members/${memberId}/government-id`;
}

/**
 * Normalizes a DB `governmentIdUrl` value to a safe basename under storage.
 *
 * @param governmentIdUrl - Value stored on `Member.governmentIdUrl`
 */
export function storedGovernmentIdFilename(
  governmentIdUrl: string | null | undefined
): string | null {
  if (!governmentIdUrl) return null;
  const filename = path.basename(governmentIdUrl);
  if (
    !filename ||
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    return null;
  }
  if (!/^(gid|self-gid|reg-gid)-[\w.-]+\.(jpe?g|png|webp)$/i.test(filename)) {
    return null;
  }
  return filename;
}

/**
 * Absolute path for a stored government ID filename.
 *
 * @param filename - Basename under `storage/government-ids`
 */
export function absoluteGovernmentIdPath(filename: string): string {
  return path.join(GOVERNMENT_ID_UPLOAD_DIR, filename);
}

/**
 * Validates and writes a government ID photo buffer to private storage.
 *
 * @param buffer - Raw image bytes
 * @param mimeType - Declared MIME type (must be JPEG/PNG/WebP)
 * @param namePrefix - Filename prefix before the nanoid (`gid`, `reg-gid`, `self-gid`)
 * @returns On-disk filename to store in `Member.governmentIdUrl`
 */
export async function saveMemberGovernmentIdFile(
  buffer: Buffer,
  mimeType: string,
  namePrefix = "gid"
): Promise<string> {
  const ext = extensionForMime(mimeType);
  if (!ext) {
    throw new Error("Only JPEG, PNG, or WebP images are allowed");
  }
  if (buffer.byteLength === 0) {
    throw new Error("Empty image file");
  }
  if (buffer.byteLength > MAX_MEMBER_PHOTO_BYTES) {
    throw new Error("Image must be 2MB or smaller");
  }

  await mkdir(GOVERNMENT_ID_UPLOAD_DIR, { recursive: true });

  const filename = `${namePrefix}-${nanoid(12)}${ext}`;
  await writeFile(absoluteGovernmentIdPath(filename), buffer);
  return filename;
}

/**
 * Best-effort deletion of a previously stored government ID photo.
 *
 * @param governmentIdUrl - Value currently stored on `Member.governmentIdUrl`
 */
export async function deleteMemberGovernmentIdIfStored(
  governmentIdUrl: string | null | undefined
): Promise<void> {
  const filename = storedGovernmentIdFilename(governmentIdUrl);
  if (!filename) return;

  try {
    await unlink(absoluteGovernmentIdPath(filename));
  } catch {
    // Missing file is fine (already deleted or never written).
  }
}

/**
 * Deletes a pre-registration gov ID upload when create-member fails.
 *
 * @param governmentIdUrl - Filename returned by a registration upload endpoint
 */
export async function deleteOrphanRegistrationGovernmentId(
  governmentIdUrl: string | null | undefined
): Promise<void> {
  const filename = storedGovernmentIdFilename(governmentIdUrl);
  if (!filename) return;
  if (!/^(self-gid|reg-gid)-[\w.-]+\.(jpe?g|png|webp)$/i.test(filename)) return;
  await deleteMemberGovernmentIdIfStored(filename);
}

/**
 * Reads a stored government ID file from disk for authenticated streaming.
 *
 * @param governmentIdUrl - Value stored on `Member.governmentIdUrl`
 */
export async function readMemberGovernmentIdFile(
  governmentIdUrl: string | null | undefined
): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null> {
  const filename = storedGovernmentIdFilename(governmentIdUrl);
  if (!filename) return null;

  try {
    const buffer = await readFile(absoluteGovernmentIdPath(filename));
    return {
      buffer,
      mimeType: mimeTypeForFilename(filename),
      filename,
    };
  } catch {
    return null;
  }
}
