/**
 * Admin community events API.
 * GET lists upcoming events; POST creates a new event.
 */

import { z } from "zod";
import { withRole } from "@/lib/auth/api";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";

/** Request body for creating a community event. */
const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  eventDate: z.string().min(1),
});

/** Lists events ordered by date. */
export const GET = withRole(["ADMIN"], async () => {
  try {
    const events = await prisma.event.findMany({
      orderBy: { eventDate: "asc" },
    });
    return jsonOk({ events });
  } catch (error) {
    return handleRouteError(error);
  }
});

/** Creates a new community event. */
export const POST = withRole(["ADMIN"], async ({ request, session }) => {
  try {
    const body = createSchema.parse(await request.json());
    const event = await prisma.event.create({
      data: {
        title: body.title,
        description: body.description,
        eventDate: new Date(body.eventDate),
        createdByUserId: session.sub,
      },
    });
    await writeAuditLog({
      actionType: "EVENT_CREATED",
      performedByUserId: session.sub,
      details: { id: event.id, title: event.title },
    });
    return jsonOk({ event }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
});

/** Deletes an event by `id` query param. */
export const DELETE = withRole(["ADMIN"], async ({ request, session }) => {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return jsonError("id required", 400);
    await prisma.event.delete({ where: { id } });
    await writeAuditLog({
      actionType: "EVENT_DELETED",
      performedByUserId: session.sub,
      details: { id },
    });
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
});
