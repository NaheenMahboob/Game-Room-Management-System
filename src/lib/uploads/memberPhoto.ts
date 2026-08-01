/**
 * Server-side helpers for persisting member profile photos under
 * `storage/members/` (outside `public/`). Files are served only through
 * authenticated `GET /api/members/[id]/photo`.
 *
 * `Member.photoUrl` stores the on-disk filename (e.g. `reg-abc.jpg`), never a
 * public URL or base64 data URL.
 */

import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

/** Absolute filesystem directory for private member photos. */
export const MEMBER_UPLOAD_DIR = path.join(
  process.cwd(),
  "storage",
  "members"
);

/** Shared placeholder filename used by seed data. */
export const PLACEHOLDER_PHOTO_FILENAME = "placeholder.jpg";

/** Allowed MIME types mapped to file extensions kept on disk. */
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** Hard cap on uploaded photo size (2 MiB). */
export const MAX_MEMBER_PHOTO_BYTES = 2 * 1024 * 1024;

/**
 * Builds the authenticated browser URL for a member's photo.
 *
 * @param memberId - Member cuid
 * @returns API path that streams the private file when authorized
 */
export function memberPhotoSrc(memberId: string): string {
  return `/api/members/${memberId}/photo`;
}

/**
 * Replaces stored filenames with client-facing API photo URLs.
 *
 * @param member - Object that includes `id` and `photoUrl`
 * @returns Same object with `photoUrl` set to {@link memberPhotoSrc}
 */
export function withClientPhotoUrl<T extends { id: string; photoUrl: string }>(
  member: T
): T {
  return { ...member, photoUrl: memberPhotoSrc(member.id) };
}

/**
 * Resolves a file extension for a supported image MIME type.
 *
 * @param mime - Content-Type from the uploaded file
 * @returns Extension including the leading dot, or `null` if unsupported
 */
export function extensionForMime(mime: string): string | null {
  return ALLOWED_MIME[mime] ?? null;
}

/**
 * Maps a filename extension to a Content-Type for streaming responses.
 *
 * @param filename - Stored photo filename
 * @returns MIME type, defaulting to `application/octet-stream`
 */
export function mimeTypeForFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return EXT_TO_MIME[ext] ?? "application/octet-stream";
}

/**
 * Normalizes a DB `photoUrl` value to a safe basename under the storage dir.
 *
 * Accepts legacy `/uploads/members/...` paths from earlier builds.
 *
 * @param photoUrl - Value stored on `Member.photoUrl`
 * @returns Safe filename, or `null` if unusable
 */
export function storedPhotoFilename(
  photoUrl: string | null | undefined
): string | null {
  if (!photoUrl) return null;
  const filename = path.basename(photoUrl);
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return null;
  }
  return filename;
}

/**
 * Absolute path for a stored member photo filename.
 *
 * @param filename - Basename under `storage/members`
 */
export function absolutePhotoPath(filename: string): string {
  return path.join(MEMBER_UPLOAD_DIR, filename);
}

/**
 * Validates and writes a member photo buffer to private storage.
 *
 * @param buffer - Raw image bytes
 * @param mimeType - Declared MIME type (must be JPEG/PNG/WebP)
 * @param namePrefix - Filename prefix before the nanoid
 * @returns On-disk filename to store in `Member.photoUrl`
 * @throws If the MIME type is unsupported, the buffer is empty, or it exceeds the size cap
 */
export async function saveMemberPhotoFile(
  buffer: Buffer,
  mimeType: string,
  namePrefix = "photo"
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

  await mkdir(MEMBER_UPLOAD_DIR, { recursive: true });

  const filename = `${namePrefix}-${nanoid(12)}${ext}`;
  await writeFile(absolutePhotoPath(filename), buffer);
  return filename;
}

/**
 * Best-effort deletion of a previously stored member photo.
 *
 * Skips the seeded placeholder so shared defaults are never removed.
 *
 * @param photoUrl - Value currently stored on `Member.photoUrl`
 */
export async function deleteMemberPhotoIfStored(
  photoUrl: string | null | undefined
): Promise<void> {
  const filename = storedPhotoFilename(photoUrl);
  if (!filename) return;
  if (filename === PLACEHOLDER_PHOTO_FILENAME) return;

  try {
    await unlink(absolutePhotoPath(filename));
  } catch {
    // Missing file is fine (already deleted or never written).
  }
}

/**
 * Deletes a pre-registration upload (`self-*` / `reg-*`) when create-member fails.
 * Ignores other filenames so a crafted body cannot remove unrelated photos.
 *
 * @param photoUrl - Filename returned by a registration photo upload endpoint
 */
export async function deleteOrphanRegistrationPhoto(
  photoUrl: string | null | undefined
): Promise<void> {
  const filename = storedPhotoFilename(photoUrl);
  if (!filename) return;
  if (!/^(self|reg)-[\w.-]+\.(jpe?g|png|webp)$/i.test(filename)) return;
  await deleteMemberPhotoIfStored(filename);
}

/**
 * Reads a stored photo file from disk for authenticated streaming.
 *
 * @param photoUrl - Value stored on `Member.photoUrl`
 * @returns File bytes and MIME type, or `null` if missing/invalid
 */
export async function readMemberPhotoFile(
  photoUrl: string | null | undefined
): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null> {
  const filename = storedPhotoFilename(photoUrl);
  if (!filename) return null;

  try {
    const buffer = await readFile(absolutePhotoPath(filename));
    return {
      buffer,
      mimeType: mimeTypeForFilename(filename),
      filename,
    };
  } catch {
    return null;
  }
}

/**
 * Extracts and validates the `file` field from multipart form data.
 *
 * @param formData - Request form data expected to contain a `file` blob
 * @returns Image buffer plus its MIME type for {@link saveMemberPhotoFile}
 * @throws If the field is missing, the type is unsupported, or size exceeds the cap
 */
export async function parseMemberPhotoFormData(
  formData: FormData
): Promise<{ buffer: Buffer; mimeType: string }> {
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    throw new Error("Image file is required");
  }

  const mimeType = file.type || "application/octet-stream";
  if (!extensionForMime(mimeType)) {
    throw new Error("Only JPEG, PNG, or WebP images are allowed");
  }
  if (file.size > MAX_MEMBER_PHOTO_BYTES) {
    throw new Error("Image must be 2MB or smaller");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return { buffer, mimeType };
}
