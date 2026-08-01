/**
 * `/api/members/[id]/photo`
 *
 * - `GET` — streams live or pending (`?variant=pending`) photo
 * - `POST` — self-service stores a pending retake (old photo kept until staff
 *   approve/reject); staff updating someone else applies immediately
 * - `PATCH` — staff `{ action: "approve" | "reject" }` for a pending retake
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, withRole } from "@/lib/auth/api";
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
import {
  approvePendingPhoto,
  rejectPendingPhoto,
} from "@/lib/services/members";
import { writeAuditLog } from "@/lib/audit/log";
import { AuditAction } from "@/lib/audit/actions";
import { prisma } from "@/lib/prisma";

/** Whether the session may read or upload photos for this member. */
function canAccessMemberPhoto(
  session: { role: string; memberId?: string },
  memberId: string
): boolean {
  return isStaffRole(session) || isMemberSelf(session, memberId);
}

/**
 * Streams the live profile photo, or the pending retake when `variant=pending`.
 */
export const GET = withAuth(async ({ request, session }, rawParams) => {
  try {
    const params = rawParams as { id: string };

    if (!canAccessMemberPhoto(session, params.id)) {
      return jsonError("Forbidden", 403);
    }

    const variant = new URL(request.url).searchParams.get("variant");
    const member = await prisma.member.findUnique({
      where: { id: params.id },
      select: { id: true, photoUrl: true, pendingPhotoUrl: true },
    });
    if (!member) return jsonError("Member not found", 404);

    const filename =
      variant === "pending" ? member.pendingPhotoUrl : member.photoUrl;
    if (!filename) {
      return jsonError(
        variant === "pending" ? "No pending photo" : "Photo not found",
        404
      );
    }

    // Only staff (or the member themselves) may view a pending retake.
    if (variant === "pending" && !canAccessMemberPhoto(session, member.id)) {
      return jsonError("Forbidden", 403);
    }

    const file = await readMemberPhotoFile(filename);
    if (!file) return jsonError("Photo not found", 404);

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Cache-Control": "private, max-age=60",
        "Content-Disposition": `inline; filename="${file.filename}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
});

/**
 * Uploads a new photo. Self-service → pending approval; staff on another
 * member → immediate replace.
 */
export const POST = withAuth(async ({ request, session }, rawParams) => {
  try {
    const params = rawParams as { id: string };

    const member = await prisma.member.findUnique({
      where: { id: params.id },
      select: { id: true, photoUrl: true, pendingPhotoUrl: true },
    });
    if (!member) return jsonError("Member not found", 404);

    if (!canAccessMemberPhoto(session, member.id)) {
      return jsonError("Forbidden", 403);
    }

    const self = isMemberSelf(session, member.id);
    const staff = isStaffRole(session);
    // Desk staff updating someone else applies live; self-service waits for review.
    const requiresApproval = self || !staff;

    const formData = await request.formData();
    const { buffer, mimeType } = await parseMemberPhotoFormData(formData);

    const photoFilename = await saveMemberPhotoFile(
      buffer,
      mimeType,
      member.id.slice(0, 8)
    );

    if (requiresApproval) {
      // Drop any previous unreviewed retake before storing the new one.
      if (member.pendingPhotoUrl) {
        await deleteMemberPhotoIfStored(member.pendingPhotoUrl);
      }

      const updated = await prisma.member.update({
        where: { id: member.id },
        data: { pendingPhotoUrl: photoFilename },
        select: {
          id: true,
          fullName: true,
          photoUrl: true,
          pendingPhotoUrl: true,
        },
      });

      await writeAuditLog({
        actionType: AuditAction.MEMBER_PHOTO_PENDING,
        performedByUserId: session.sub,
        memberId: member.id,
        details: {
          pendingPhotoUrl: photoFilename,
          livePhotoUrl: member.photoUrl,
          bySelf: self,
        },
      });

      return jsonOk({
        member: withClientPhotoUrl(updated),
        photoUrl: memberPhotoSrc(updated.id),
        pendingApproval: true,
        message:
          "Photo submitted for staff approval. Your current photo stays until it is approved.",
      });
    }

    const previous = member.photoUrl;
    const updated = await prisma.member.update({
      where: { id: member.id },
      data: {
        photoUrl: photoFilename,
        // Staff live replace clears any leftover self-service pending file.
        pendingPhotoUrl: null,
      },
      select: {
        id: true,
        fullName: true,
        photoUrl: true,
        pendingPhotoUrl: true,
      },
    });

    await deleteMemberPhotoIfStored(previous);
    if (member.pendingPhotoUrl) {
      await deleteMemberPhotoIfStored(member.pendingPhotoUrl);
    }

    await writeAuditLog({
      actionType: AuditAction.MEMBER_PHOTO_UPDATED,
      performedByUserId: session.sub,
      memberId: member.id,
      details: {
        previousPhotoUrl: previous,
        photoUrl: photoFilename,
        bySelf: false,
      },
    });

    return jsonOk({
      member: withClientPhotoUrl(updated),
      photoUrl: memberPhotoSrc(updated.id),
      pendingApproval: false,
    });
  } catch (error) {
    return handleRouteError(error);
  }
});

/** Staff review action for a pending photo retake. */
const reviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

/**
 * Staff approve (promote pending → live) or reject (delete pending, keep live).
 */
export const PATCH = withRole(
  ["VOLUNTEER", "ADMIN"],
  async ({ request, session }, rawParams) => {
    try {
      const params = rawParams as { id: string };
      const body = reviewSchema.parse(await request.json());
      if (body.action === "approve") {
        const member = await approvePendingPhoto(params.id, session.sub);
        return jsonOk({ member, action: "approve" });
      }
      const member = await rejectPendingPhoto(params.id, session.sub);
      return jsonOk({ member, action: "reject" });
    } catch (error) {
      return handleRouteError(error);
    }
  }
);
