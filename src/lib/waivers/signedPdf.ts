/**
 * Builds a signed waiver PDF: loads the versioned template PDF, appends a
 * member details + signature page, then SHA-256 for integrity.
 *
 * @author Muhammad Naheen Mahboob
 */

import { createHash } from "crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { getCurrentWaiverVersion } from "@/lib/settings";
import { saveMemberWaiverPdf } from "@/lib/uploads/memberWaiver";
import {
  currentWaiverTemplateSrc,
  readWaiverTemplateFile,
  saveWaiverTemplatePdf,
} from "@/lib/uploads/waiverTemplate";
import { buildWaiverTemplatePdfFromText } from "@/lib/waivers/templateFromText";

/** Fallback copy only used to materialize a missing template from legacy `text`. */
const FALLBACK_WAIVER_TEXT = `
COMMUNITY GAME ROOM LIABILITY WAIVER AND RELEASE

By signing this waiver, I acknowledge that I am voluntarily participating in activities
at the community game room operated in association with the mosque. I understand that use
of gaming equipment, consoles, controllers, and recreational tables involves inherent risks
of injury, property damage, and loss of personal belongings.

ASSUMPTION OF RISK AND RELEASE OF LIABILITY
I assume all risks associated with participation. To the fullest extent permitted by law,
I release and hold harmless the mosque, its officers, employees, volunteers, agents, and
affiliates from any and all claims, liabilities, damages, costs, or expenses arising from
my presence in or use of the game room and its equipment, including personal injury or
loss of personal property, except to the extent caused by gross negligence or willful
misconduct as determined by a court of competent jurisdiction.

EQUIPMENT DAMAGE AND FINANCIAL RESPONSIBILITY
I agree to follow all community rules and to treat equipment and facilities with care. I
accept full financial responsibility for the repair or replacement cost of any equipment,
furniture, or property that is lost, stolen, or damaged through my misuse, negligence, or
willful misconduct (or that of any guest I host). Payment is due as directed by game room
or mosque administration.

PARTICIPANTS UNDER 18
If the participant is under 18 years of age, a parent or legal guardian must read and sign
this waiver, provide parental consent before the minor may sign in, and agrees to pay for
any equipment or property damage caused by the minor as described above.

I have read this waiver, understand it, and sign it voluntarily. A signed PDF copy will be
retained with my membership record.
`.trim();

/** Inputs needed to stamp one registration waiver PDF. */
export type BuildSignedWaiverInput = {
  fullName: string;
  phone: string;
  email?: string | null;
  dateOfBirth?: Date | null;
  parentalConsent: boolean;
  /** Canvas `data:image/png;base64,...` or typed legal name. */
  signature: string;
  waiverVersion: number;
  /** On-disk template basename under `storage/waivers/templates/`. */
  templatePdfUrl: string;
  signedAt?: Date;
};

/**
 * Ensures the current waiver version has a readable template on disk.
 * Legacy rows with only `text` are backfilled once into a template PDF.
 *
 * @throws when no template file exists and no legacy text can be used
 */
export async function getCurrentWaiverContent(): Promise<{
  version: number;
  templateFilename: string;
  pdfSrc: string;
}> {
  const version = await getCurrentWaiverVersion();
  let row = await prisma.waiver.findUnique({ where: { version } });

  if (!row) {
    throw new Error(
      `Waiver version ${version} is not configured. Upload a template in Admin → Waivers.`
    );
  }

  let templateFilename = row.templatePdfUrl?.trim() || null;
  let file = templateFilename
    ? await readWaiverTemplateFile(templateFilename)
    : null;

  // Backfill: generate template from legacy DB text if the PDF is missing.
  if (!file) {
    const legacyText = row.text?.trim() || FALLBACK_WAIVER_TEXT;
    const buffer = await buildWaiverTemplatePdfFromText(legacyText, version);
    templateFilename = await saveWaiverTemplatePdf(version, buffer);
    row = await prisma.waiver.update({
      where: { version },
      data: { templatePdfUrl: templateFilename },
    });
    file = await readWaiverTemplateFile(templateFilename);
  }

  if (!file || !templateFilename) {
    throw new Error(
      `Waiver template PDF for version ${version} is missing on disk. Upload a PDF in Admin → Waivers or place template-v${version}.pdf under storage/waivers/templates/.`
    );
  }

  return {
    version,
    templateFilename,
    pdfSrc: currentWaiverTemplateSrc(),
  };
}

/**
 * Parses a PNG data URL into raw bytes, or `null` if not a PNG data URL.
 */
function pngBytesFromDataUrl(signature: string): Uint8Array | null {
  const match = /^data:image\/png;base64,(.+)$/i.exec(signature.trim());
  if (!match?.[1]) return null;
  return Uint8Array.from(Buffer.from(match[1], "base64"));
}

/**
 * Loads the template PDF and appends a signature / member details page.
 *
 * @returns PDF bytes ready to write to disk
 */
export async function buildSignedWaiverPdf(
  input: BuildSignedWaiverInput
): Promise<Buffer> {
  const signedAt = input.signedAt ?? new Date();
  const template = await readWaiverTemplateFile(input.templatePdfUrl);
  if (!template) {
    throw new Error(
      `Waiver template file "${input.templatePdfUrl}" was not found`
    );
  }

  const templateDoc = await PDFDocument.load(template.buffer);
  const pdfDoc = await PDFDocument.create();
  const copiedPages = await pdfDoc.copyPages(
    templateDoc,
    templateDoc.getPageIndices()
  );
  for (const page of copiedPages) {
    pdfDoc.addPage(page);
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  const maxWidth = pageWidth - margin * 2;
  const bodySize = 10;
  const lineHeight = 14;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawText = (
    text: string,
    opts: {
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      x?: number;
    } = {}
  ) => {
    const size = opts.size ?? bodySize;
    const useFont = opts.bold ? fontBold : font;
    const color = opts.color ?? rgb(0.1, 0.1, 0.12);
    const x = opts.x ?? margin;
    if (y < margin + lineHeight) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(text, {
      x,
      y,
      size,
      font: useFont,
      color,
      maxWidth,
    });
    y -= lineHeight + (size > bodySize ? 4 : 0);
  };

  drawText("SIGNATURE PAGE", { size: 14, bold: true });
  y -= 6;
  drawText(`Waiver version: ${input.waiverVersion}`, { size: 10, bold: true });
  drawText(`Signed at (UTC): ${signedAt.toISOString()}`, { size: 9 });
  y -= 8;

  drawText("Participant", { size: 11, bold: true });
  drawText(`Full name: ${input.fullName}`);
  drawText(`Phone: ${input.phone}`);
  if (input.email) drawText(`Email: ${input.email}`);
  if (input.dateOfBirth) {
    drawText(
      `Date of birth: ${input.dateOfBirth.toISOString().slice(0, 10)}`
    );
  }
  drawText(
    `Parental / guardian consent recorded: ${
      input.parentalConsent ? "Yes" : "No"
    }`
  );
  y -= 16;

  drawText("Signature", { size: 11, bold: true });
  y -= 4;

  const pngBytes = pngBytesFromDataUrl(input.signature);
  if (pngBytes) {
    const image = await pdfDoc.embedPng(pngBytes);
    const maxSigWidth = 280;
    const maxSigHeight = 90;
    const scale = Math.min(
      maxSigWidth / image.width,
      maxSigHeight / image.height,
      1
    );
    const sigWidth = image.width * scale;
    const sigHeight = image.height * scale;
    if (y - sigHeight < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawRectangle({
      x: margin,
      y: y - sigHeight - 8,
      width: sigWidth + 16,
      height: sigHeight + 16,
      borderColor: rgb(0.7, 0.7, 0.72),
      borderWidth: 1,
      color: rgb(1, 1, 1),
    });
    page.drawImage(image, {
      x: margin + 8,
      y: y - sigHeight - 0,
      width: sigWidth,
      height: sigHeight,
    });
    y -= sigHeight + 28;
  } else {
    const typed = input.signature.trim();
    if (!typed) {
      throw new Error("Waiver signature is required");
    }
    drawText(`Typed legal name: ${typed}`, { size: 12, bold: true });
    y -= 4;
  }

  drawText(
    `I acknowledge that I have read and agree to the attached waiver (version ${input.waiverVersion}).`,
    { size: 9 }
  );

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * SHA-256 hex digest of PDF bytes.
 */
export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Builds the signed PDF, writes it under `storage/waivers/`, returns filename + hash.
 */
export async function createAndStoreSignedWaiverPdf(
  input: Omit<BuildSignedWaiverInput, "waiverVersion" | "templatePdfUrl"> & {
    waiverVersion?: number;
    templatePdfUrl?: string;
  }
): Promise<{ filename: string; sha256: string; version: number }> {
  const current = await getCurrentWaiverContent();
  const version = input.waiverVersion ?? current.version;
  const templatePdfUrl = input.templatePdfUrl ?? current.templateFilename;
  const buffer = await buildSignedWaiverPdf({
    ...input,
    waiverVersion: version,
    templatePdfUrl,
  });
  const sha256 = sha256Hex(buffer);
  const filename = await saveMemberWaiverPdf(buffer);
  return { filename, sha256, version };
}
