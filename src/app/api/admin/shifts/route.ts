/**
 * Volunteer shift schedule API.
 * Admins manage all shifts; volunteers see their own assignments.
 */

import { z } from "zod";
import { withRole } from "@/lib/auth/api";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";

const createSchema = z.object({
  volunteerUserId: z.string().cuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  recurring: z.boolean().default(true),
});

export const GET = withRole(["ADMIN", "VOLUNTEER"], async ({ session }) => {
  try {
    const shifts = await prisma.shift.findMany({
      where:
        session.role === "ADMIN"
          ? undefined
          : { volunteerUserId: session.sub },
      include: {
        volunteer: { select: { id: true, email: true } },
        checklists: {
          orderBy: { completedAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
    return jsonOk({ shifts });
  } catch (error) {
    return handleRouteError(error);
  }
});

export const POST = withRole(["ADMIN"], async ({ request, session }) => {
  try {
    const body = createSchema.parse(await request.json());
    const volunteer = await prisma.user.findUnique({
      where: { id: body.volunteerUserId },
    });
    if (!volunteer || (volunteer.role !== "VOLUNTEER" && volunteer.role !== "ADMIN")) {
      return jsonError("Volunteer user not found", 404);
    }

    const shift = await prisma.shift.create({
      data: body,
      include: { volunteer: { select: { id: true, email: true } } },
    });

    await writeAuditLog({
      actionType: "SHIFT_CREATED",
      performedByUserId: session.sub,
      details: body,
    });

    return jsonOk({ shift }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
});

export const DELETE = withRole(["ADMIN"], async ({ request, session }) => {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return jsonError("id required", 400);
    await prisma.shift.delete({ where: { id } });
    await writeAuditLog({
      actionType: "SHIFT_DELETED",
      performedByUserId: session.sub,
      details: { id },
    });
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
});
