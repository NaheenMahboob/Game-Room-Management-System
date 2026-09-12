/**
 * Builds a plain-text liability PDF used as the initial / legacy waiver template
 * when no externally edited PDF has been uploaded yet.
 *
 * @author Muhammad Naheen Mahboob
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Word-wraps text to roughly `maxChars` per line for Helvetica drawing.
 */
function wrapLines(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n/g, "\n").split("\n")) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      lines.push("");
      continue;
    }
    const words = trimmed.split(/\s+/);
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length <= maxChars) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

/**
 * Renders legal copy into a multi-page PDF template (no signature block).
 *
 * @param text - Plain waiver body
 * @param version - Version number drawn in the header
 */
export async function buildWaiverTemplatePdfFromText(
  text: string,
  version: number
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  const maxWidth = pageWidth - margin * 2;
  const bodySize = 10;
  const lineHeight = 14;
  const charsPerLine = 95;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawText = (
    line: string,
    opts: { size?: number; bold?: boolean } = {}
  ) => {
    const size = opts.size ?? bodySize;
    const useFont = opts.bold ? fontBold : font;
    if (y < margin + lineHeight) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(line, {
      x: margin,
      y,
      size,
      font: useFont,
      color: rgb(0.1, 0.1, 0.12),
      maxWidth,
    });
    y -= lineHeight + (size > bodySize ? 4 : 0);
  };

  drawText("COMMUNITY GAME ROOM — LIABILITY WAIVER", {
    size: 14,
    bold: true,
  });
  y -= 6;
  drawText(`Waiver version: ${version}`, { size: 10, bold: true });
  y -= 12;

  for (const line of wrapLines(text.trim(), charsPerLine)) {
    if (line === "") {
      y -= lineHeight / 2;
      continue;
    }
    drawText(line, { size: bodySize });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
