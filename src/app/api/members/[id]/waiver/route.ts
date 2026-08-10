/**
 * `GET /api/members/[id]/waiver`
 *
 * Streams the member's signed waiver PDF (private storage).
 * Staff or the member themselves may download.
 *
 * @author Muhammad Naheen Mahboob
 */

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api";
import { jsonError, handleRouteError } from "@/lib/api/http";
import { isMemberSelf, isStaffRole } from "@/lib/auth/sessionAccess";
import { readMemberWaiverFile } from "@/lib/uploads/memberWaiver";
import { prisma } from "@/lib/prisma";

/**
 * Streams `Member.waiverPdfUrl` when authorized.
 */
export const GET = withAuth(async ({ session }, rawParams) => {
  try {
    const params = rawParams as { id: string };
    const canAccess =
      isStaffRole(session) || isMemberSelf(session, params.id);
    if (!canAccess) return jsonError("Forbidden", 403);

    const member = await prisma.member.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        fullName: true,
        waiverPdfUrl: true,
        waiverVersion: true,
      },
    });
    if (!member) return jsonError("Member not found", 404);
    if (!member.waiverPdfUrl) {
      return jsonError("No signed waiver PDF on file", 404);
    }

    const file = await readMemberWaiverFile(member.waiverPdfUrl);
    if (!file) return jsonError("Waiver PDF file missing", 404);

    const safeName = member.fullName
      .replace(/[^\w.-]+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 60);
    const downloadName = `waiver-v${member.waiverVersion}-${safeName || member.id}.pdf`;

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(file.buffer.byteLength),
        "Content-Disposition": `inline; filename="${downloadName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
});
