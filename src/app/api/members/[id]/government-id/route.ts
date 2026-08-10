/**
 * `GET /api/members/[id]/government-id`
 *
 * Streams the member's government ID photo (private storage).
 * Admins only — used during pending verification and later lookup.
 *
 * @author Muhammad Naheen Mahboob
 */

import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/api";
import { jsonError, handleRouteError } from "@/lib/api/http";
import { readMemberGovernmentIdFile } from "@/lib/uploads/memberGovernmentId";
import { prisma } from "@/lib/prisma";

/**
 * Streams `Member.governmentIdUrl` when the caller is an admin.
 *
 * @author Muhammad Naheen Mahboob
 */
export const GET = withRole(["ADMIN"], async (_ctx, rawParams) => {
  try {
    const params = rawParams as { id: string };
    const member = await prisma.member.findUnique({
      where: { id: params.id },
      select: { id: true, governmentIdUrl: true },
    });
    if (!member) return jsonError("Member not found", 404);
    if (!member.governmentIdUrl) {
      return jsonError("No government ID on file", 404);
    }

    const file = await readMemberGovernmentIdFile(member.governmentIdUrl);
    if (!file) return jsonError("Government ID file missing", 404);

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.buffer.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
});
