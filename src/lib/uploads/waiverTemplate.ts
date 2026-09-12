/**
 * Private storage for versioned waiver *template* PDFs (legal copy edited externally).
 * Signed member copies stay under `storage/waivers/` via memberWaiver helpers.
 *
 * @author Muhammad Naheen Mahboob
 */

import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

/** Absolute directory for waiver template PDFs. */
export const WAIVER_TEMPLATE_DIR = path.join(
  process.cwd(),
  "storage",
  "waivers",
  "templates"
);

/** Hard cap on an uploaded template PDF (12 MiB). */
export const MAX_WAIVER_TEMPLATE_BYTES = 12 * 1024 * 1024;

/**
 * Canonical basename for a given waiver version (IT can drop this file on disk).
 *
 * @param version - Waiver version number
 */
export function templateFilenameForVersion(version: number): string {
  return `template-v${version}.pdf`;
}

/**
 * Public API path that streams the active template for registration UIs.
 */
export function currentWaiverTemplateSrc(): string {
  return "/api/waivers/current/pdf";
}

/**
 * Normalizes a stored template filename to a safe basename.
 *
 * @param templatePdfUrl - Value on `Waiver.templatePdfUrl`
 */
export function storedTemplateFilename(
  templatePdfUrl: string | null | undefined
): string | null {
  if (!templatePdfUrl) return null;
  const filename = path.basename(templatePdfUrl);
  if (
    !filename ||
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    return null;
  }
  if (!/^template-v\d+(-[\w.-]+)?\.pdf$/i.test(filename)) return null;
  return filename;
}

/**
 * Absolute path for a template basename under the templates dir.
 *
 * @param filename - Safe basename
 */
export function absoluteTemplatePath(filename: string): string {
  return path.join(WAIVER_TEMPLATE_DIR, filename);
}

/**
 * Writes template PDF bytes for a version (overwrites same version filename).
 *
 * @param version - Waiver version
 * @param buffer - PDF bytes
 * @returns Filename to store on `Waiver.templatePdfUrl`
 */
export async function saveWaiverTemplatePdf(
  version: number,
  buffer: Buffer
): Promise<string> {
  if (buffer.byteLength === 0) {
    throw new Error("Empty waiver template PDF");
  }
  if (buffer.byteLength > MAX_WAIVER_TEMPLATE_BYTES) {
    throw new Error("Waiver template PDF is too large");
  }
  // Reject non-PDF magic bytes so admins cannot upload random files.
  if (buffer.subarray(0, 4).toString("utf8") !== "%PDF") {
    throw new Error("File must be a PDF");
  }

  await mkdir(WAIVER_TEMPLATE_DIR, { recursive: true });
  const filename = templateFilenameForVersion(version);
  await writeFile(absoluteTemplatePath(filename), buffer);
  return filename;
}

/**
 * Reads a template PDF from disk.
 *
 * @param templatePdfUrl - Value on `Waiver.templatePdfUrl`
 */
export async function readWaiverTemplateFile(
  templatePdfUrl: string | null | undefined
): Promise<{ buffer: Buffer; filename: string } | null> {
  const filename = storedTemplateFilename(templatePdfUrl);
  if (!filename) return null;
  try {
    const buffer = await readFile(absoluteTemplatePath(filename));
    return { buffer, filename };
  } catch {
    return null;
  }
}

/**
 * Best-effort delete of a template file.
 *
 * @param templatePdfUrl - Stored filename
 */
export async function deleteWaiverTemplateIfStored(
  templatePdfUrl: string | null | undefined
): Promise<void> {
  const filename = storedTemplateFilename(templatePdfUrl);
  if (!filename) return;
  try {
    await unlink(absoluteTemplatePath(filename));
  } catch {
    // Already gone.
  }
}
