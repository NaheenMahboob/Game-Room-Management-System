/**
 * `POST /api/shifts/checklist`
 *
 * Submits a volunteer shift opening checklist (creates a shift slot if needed).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { withRole } from "@/lib/auth/api";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { jsonOk, handleRouteError } from "@/lib/api/http";

const checklistSchema = z.object({
  equipmentCountVerified: z.boolean(),
  damageChecked: z.boolean(),
  previousNotesReviewed: z.boolean(),
  occupancyConfirmed: z.boolean(),
  announcementsReviewed: z.boolean(),
  notes: z.string().max(2000).optional(),
});

export const POST = withRole(["VOLUNTEER", "ADMIN"], async ({ request, session }) => {
  try {
    const body = checklistSchema.parse(await request.json());

    // Attach to an ad-hoc shift slot for today if none exists.
    const dayOfWeek = new Date().getDay();
    let shift = await prisma.shift.findFirst({
      where: { volunteerUserId: session.sub, dayOfWeek },
    });

    if (!shift) {
      shift = await prisma.shift.create({
        data: {
          volunteerUserId: session.sub,
          dayOfWeek,
          startTime: "00:00",
          endTime: "23:59",
          recurring: false,
        },
      });
    }

    const checklist = await prisma.shiftChecklist.create({
      data: {
        shiftId: shift.id,
        volunteerUserId: session.sub,
        ...body,
        notes: body.notes || null,
      },
    });

    await writeAuditLog({
      actionType: "SHIFT_CHECKLIST_COMPLETED",
      performedByUserId: session.sub,
      details: body,
    });

    return jsonOk({ checklist }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
});

void NextResponse;
