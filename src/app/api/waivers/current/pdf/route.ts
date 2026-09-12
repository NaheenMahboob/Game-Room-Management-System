/**
 * `GET /api/waivers/current/pdf`
 *
 * Public: streams the active waiver template PDF for registration / preview.
 *
 * @author Muhammad Naheen Mahboob
 */

import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api/http";
import { getCurrentWaiverContent } from "@/lib/waivers/signedPdf";
import { readWaiverTemplateFile } from "@/lib/uploads/waiverTemplate";

/**
 * Streams the current template PDF bytes.
 */
export async function GET() {
  try {
    const waiver = await getCurrentWaiverContent();
    const file = await readWaiverTemplateFile(waiver.templateFilename);
    if (!file) {
      return NextResponse.json(
        { error: "Waiver template PDF not found on disk" },
        { status: 404 }
      );
    }

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${file.filename}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
