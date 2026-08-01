import { z } from "zod";
import { withRole } from "@/lib/auth/api";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";

const createSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  targetAudience: z.enum(["GENERAL", "MEMBERS", "VOLUNTEERS"]).default("GENERAL"),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
});

export const GET = withRole(["ADMIN"], async () => {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: "desc" },
    });
    return jsonOk({ announcements });
  } catch (error) {
    return handleRouteError(error);
  }
});

export const POST = withRole(["ADMIN"], async ({ request, session }) => {
  try {
    const body = createSchema.parse(await request.json());
    const announcement = await prisma.announcement.create({
      data: {
        title: body.title,
        content: body.content,
        targetAudience: body.targetAudience,
        scheduledStart: body.scheduledStart
          ? new Date(body.scheduledStart)
          : null,
        scheduledEnd: body.scheduledEnd ? new Date(body.scheduledEnd) : null,
        createdByUserId: session.sub,
      },
    });
    await writeAuditLog({
      actionType: "ANNOUNCEMENT_CREATED",
      performedByUserId: session.sub,
      details: { id: announcement.id, title: announcement.title },
    });
    return jsonOk({ announcement }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
});

export const DELETE = withRole(["ADMIN"], async ({ request, session }) => {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return jsonError("id required", 400);
    await prisma.announcement.delete({ where: { id } });
    await writeAuditLog({
      actionType: "ANNOUNCEMENT_DELETED",
      performedByUserId: session.sub,
      details: { id },
    });
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
});
