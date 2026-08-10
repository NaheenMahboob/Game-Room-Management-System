/**
 * Server-side helpers for persisting signed waiver PDFs under
 * `storage/waivers/` (outside `public/`). Files are served only through
 * authenticated `GET /api/members/[id]/waiver`.
 *
 * `Member.waiverPdfUrl` stores the on-disk filename (e.g. `waiver-abc.pdf`),
 * never a public URL or base64 payload.
 *
 * @author Muhammad Naheen Mahboob
 */

import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

/** Absolute filesystem directory for private signed waiver PDFs. */
export const WAIVER_UPLOAD_DIR = path.join(
  process.cwd(),
  "storage",
  "waivers"
);

/** Hard cap on a generated waiver PDF (8 MiB). */
export const MAX_WAIVER_PDF_BYTES = 8 * 1024 * 1024;

/**
 * Builds the authenticated browser URL for a member's signed waiver PDF.
 *
 * @param memberId - Member cuid
 */
export function memberWaiverSrc(memberId: string): string {
  return `/api/members/${memberId}/waiver`;
}

/**
 * Normalizes a DB `waiverPdfUrl` value to a safe basename under the storage dir.
 *
 * @param waiverPdfUrl - Value stored on `Member.waiverPdfUrl`
 * @returns Safe filename, or `null` if unusable
 */
export function storedWaiverFilename(
  waiverPdfUrl: string | null | undefined
): string | null {
  if (!waiverPdfUrl) return null;
  const filename = path.basename(waiverPdfUrl);
  if (
    !filename ||
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    return null;
  }
  if (!/^waiver-[\w.-]+\.pdf$/i.test(filename)) return null;
  return filename;
}

/**
 * Absolute path for a stored waiver PDF filename.
 *
 * @param filename - Basename under `storage/waivers`
 */
export function absoluteWaiverPath(filename: string): string {
  return path.join(WAIVER_UPLOAD_DIR, filename);
}

/**
 * Writes signed waiver PDF bytes to private storage.
 *
 * @param buffer - PDF bytes
 * @returns On-disk filename to store in `Member.waiverPdfUrl`
 */
export async function saveMemberWaiverPdf(buffer: Buffer): Promise<string> {
  if (buffer.byteLength === 0) {
    throw new Error("Empty waiver PDF");
  }
  if (buffer.byteLength > MAX_WAIVER_PDF_BYTES) {
    throw new Error("Waiver PDF is too large");
  }

  await mkdir(WAIVER_UPLOAD_DIR, { recursive: true });

  const filename = `waiver-${nanoid(12)}.pdf`;
  await writeFile(absoluteWaiverPath(filename), buffer);
  return filename;
}

/**
 * Best-effort deletion of a previously stored waiver PDF.
 *
 * @param waiverPdfUrl - Value currently stored on `Member.waiverPdfUrl`
 */
export async function deleteMemberWaiverIfStored(
  waiverPdfUrl: string | null | undefined
): Promise<void> {
  const filename = storedWaiverFilename(waiverPdfUrl);
  if (!filename) return;

  try {
    await unlink(absoluteWaiverPath(filename));
  } catch {
    // Missing file is fine (already deleted or never written).
  }
}

/**
 * Reads a stored waiver PDF from disk for authenticated streaming.
 *
 * @param waiverPdfUrl - Value stored on `Member.waiverPdfUrl`
 */
export async function readMemberWaiverFile(
  waiverPdfUrl: string | null | undefined
): Promise<{ buffer: Buffer; filename: string } | null> {
  const filename = storedWaiverFilename(waiverPdfUrl);
  if (!filename) return null;

  try {
    const buffer = await readFile(absoluteWaiverPath(filename));
    return { buffer, filename };
  } catch {
    return null;
  }
}
