/**
 * Server-side helpers for persisting member profile photos under
 * `public/uploads/members/` and exposing them as public URL paths.
 *
 * Callers should store only the returned path on `Member.photoUrl`
 * (never raw base64 data URLs).
 */

import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

/** Absolute filesystem directory where member photo files are written. */
export const MEMBER_UPLOAD_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "members"
);

/** Public URL prefix Next.js serves from `public/` for member photos. */
export const MEMBER_UPLOAD_PUBLIC_PREFIX = "/uploads/members/";

/** Allowed MIME types mapped to file extensions kept on disk. */
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/** Hard cap on uploaded photo size (2 MiB). */
export const MAX_MEMBER_PHOTO_BYTES = 2 * 1024 * 1024;

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
 * Validates and writes a member photo buffer to disk.
 *
 * @param buffer - Raw image bytes
 * @param mimeType - Declared MIME type (must be JPEG/PNG/WebP)
 * @param namePrefix - Filename prefix before the nanoid (e.g. member id slice)
 * @returns Public path such as `/uploads/members/reg-abc123.jpg`
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

  // Ensure the uploads folder exists (first write after clone / deploy).
  await mkdir(MEMBER_UPLOAD_DIR, { recursive: true });

  // Unique filename avoids collisions when the same member retakes a photo.
  const filename = `${namePrefix}-${nanoid(12)}${ext}`;
  await writeFile(path.join(MEMBER_UPLOAD_DIR, filename), buffer);

  return `${MEMBER_UPLOAD_PUBLIC_PREFIX}${filename}`;
}

/**
 * Best-effort deletion of a previously stored member photo.
 *
 * Skips non-upload URLs and the seeded `placeholder.jpg` so shared defaults
 * are never removed. Path traversal is rejected via basename checks.
 *
 * @param photoUrl - Value currently stored on `Member.photoUrl`
 */
export async function deleteMemberPhotoIfStored(
  photoUrl: string | null | undefined
): Promise<void> {
  // Only delete files we own under /uploads/members/.
  if (!photoUrl || !photoUrl.startsWith(MEMBER_UPLOAD_PUBLIC_PREFIX)) return;
  if (photoUrl.endsWith("/placeholder.jpg")) return;

  const filename = path.basename(photoUrl);
  if (!filename || filename.includes("..")) return;

  try {
    await unlink(path.join(MEMBER_UPLOAD_DIR, filename));
  } catch {
    // Missing file is fine (already deleted or never written).
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

  // Prefer the browser-declared type; fall back only for empty Content-Type.
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
