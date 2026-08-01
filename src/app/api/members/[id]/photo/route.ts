/**
 * `/api/members/[id]/photo`
 *
 * - `GET` — streams the private photo for staff (any member) or the member
 *   themselves. Files live under `storage/members/`, not `public/`.
 * - `POST` — multipart upload that replaces the stored photo (same auth rules).
 */

import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api/http";
import { isMemberSelf, isStaffRole } from "@/lib/auth/sessionAccess";
import {
  deleteMemberPhotoIfStored,
  memberPhotoSrc,
  parseMemberPhotoFormData,
  readMemberPhotoFile,
  saveMemberPhotoFile,
  withClientPhotoUrl,
} from "@/lib/uploads/memberPhoto";
import { writeAuditLog } from "@/lib/audit/log";
import { AuditAction } from "@/lib/audit/actions";
import { prisma } from "@/lib/prisma";

/**
 * Returns whether the session may access the given member's photo.
 */
function canAccessMemberPhoto(
  session: { role: string; memberId?: string },
  memberId: string
): boolean {
  return isStaffRole(session) || isMemberSelf(session, memberId);
}

/**
 * Streams the member's private profile photo.
 *
 * @returns Image body with `Content-Type`, or 403/404 JSON errors
 */
export const GET = withAuth(async ({ session }, rawParams) => {
  try {
    const params = rawParams as { id: string };

    if (!canAccessMemberPhoto(session, params.id)) {
      return jsonError("Forbidden", 403);
    }

    const member = await prisma.member.findUnique({
      where: { id: params.id },
      select: { id: true, photoUrl: true },
    });
    if (!member) return jsonError("Member not found", 404);

    const file = await readMemberPhotoFile(member.photoUrl);
    if (!file) return jsonError("Photo not found", 404);

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Cache-Control": "private, max-age=300",
        "Content-Disposition": `inline; filename="${file.filename}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
});

/**
 * Uploads a new photo and updates `Member.photoUrl` (storage filename).
 *
 * @returns `{ member }` with client-facing `photoUrl` API path
 */
export const POST = withAuth(async ({ request, session }, rawParams) => {
  try {
    const params = rawParams as { id: string };

    const member = await prisma.member.findUnique({
      where: { id: params.id },
      select: { id: true, photoUrl: true },
    });
    if (!member) return jsonError("Member not found", 404);

    if (!canAccessMemberPhoto(session, member.id)) {
      return jsonError("Forbidden", 403);
    }

    const isSelf = isMemberSelf(session, member.id);

    const formData = await request.formData();
    const { buffer, mimeType } = await parseMemberPhotoFormData(formData);

    // Prefix with a short member id fragment for easier disk inspection.
    const photoFilename = await saveMemberPhotoFile(
      buffer,
      mimeType,
      member.id.slice(0, 8)
    );

    const previous = member.photoUrl;

    const updated = await prisma.member.update({
      where: { id: member.id },
      data: { photoUrl: photoFilename },
      select: {
        id: true,
        fullName: true,
        photoUrl: true,
      },
    });

    await deleteMemberPhotoIfStored(previous);

    await writeAuditLog({
      actionType: AuditAction.MEMBER_PHOTO_UPDATED,
      performedByUserId: session.sub,
      memberId: member.id,
      details: {
        previousPhotoUrl: previous,
        photoUrl: photoFilename,
        bySelf: isSelf,
      },
    });

    return jsonOk({
      member: withClientPhotoUrl(updated),
      // Also expose the API path explicitly for upload helpers.
      photoUrl: memberPhotoSrc(updated.id),
    });
  } catch (error) {
    return handleRouteError(error);
  }
});
