/**
 * `POST /api/members/[id]/photo`
 *
 * Replaces an existing member's profile photo. Allowed for volunteers/admins
 * (any member) or for a member updating their own profile. Old upload files
 * are deleted when they live under `/uploads/members/` (placeholder excluded).
 */

import { withAuth } from "@/lib/auth/api";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api/http";
import { writeAuditLog } from "@/lib/audit/log";
import { AuditAction } from "@/lib/audit/actions";
import { prisma } from "@/lib/prisma";
import {
  deleteMemberPhotoIfStored,
  parseMemberPhotoFormData,
  saveMemberPhotoFile,
} from "@/lib/uploads/memberPhoto";

/**
 * Uploads a new photo and updates `Member.photoUrl`.
 *
 * @returns `{ member: { id, fullName, photoUrl } }` on success
 */
export const POST = withAuth(async ({ request, session }, rawParams) => {
  try {
    const params = rawParams as { id: string };

    const member = await prisma.member.findUnique({
      where: { id: params.id },
      select: { id: true, photoUrl: true },
    });
    if (!member) return jsonError("Member not found", 404);

    // Staff may update anyone; members may only update themselves.
    const isStaff =
      session.role === "VOLUNTEER" || session.role === "ADMIN";
    const isSelf =
      session.role === "MEMBER" && session.memberId === member.id;

    if (!isStaff && !isSelf) {
      return jsonError("Forbidden", 403);
    }

    const formData = await request.formData();
    const { buffer, mimeType } = await parseMemberPhotoFormData(formData);

    // Prefix with a short member id fragment for easier disk inspection.
    const photoUrl = await saveMemberPhotoFile(
      buffer,
      mimeType,
      member.id.slice(0, 8)
    );

    const previous = member.photoUrl;

    const updated = await prisma.member.update({
      where: { id: member.id },
      data: { photoUrl },
      select: {
        id: true,
        fullName: true,
        photoUrl: true,
      },
    });

    // Remove the prior file only after the DB update succeeds.
    await deleteMemberPhotoIfStored(previous);

    await writeAuditLog({
      actionType: AuditAction.MEMBER_PHOTO_UPDATED,
      performedByUserId: session.sub,
      memberId: member.id,
      details: {
        previousPhotoUrl: previous,
        photoUrl,
        bySelf: isSelf,
      },
    });

    return jsonOk({ member: updated });
  } catch (error) {
    return handleRouteError(error);
  }
});
