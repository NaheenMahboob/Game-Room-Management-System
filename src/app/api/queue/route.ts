/**
 * Equipment wait-queue API for staff.
 * GET lists queue entries; POST adds a member; DELETE removes an entry.
 */

import { withRole } from "@/lib/auth/api";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api/http";
import { queueJoinSchema } from "@/lib/validation/schemas";
import { joinQueue, listQueue, removeFromQueue } from "@/lib/services/queue";

/** Lists wait-queue entries, optionally for one equipment id. */
export const GET = withRole(["VOLUNTEER", "ADMIN"], async ({ request }) => {
  try {
    const { searchParams } = new URL(request.url);
    const queue = await listQueue(searchParams.get("equipmentId") ?? undefined);
    return jsonOk({ queue });
  } catch (error) {
    return handleRouteError(error);
  }
});

/** Adds a member to the equipment wait queue. */
export const POST = withRole(["VOLUNTEER", "ADMIN"], async ({ request, session }) => {
  try {
    const body = await request.json();
    const { equipmentId, memberId } = queueJoinSchema.parse(body);
    const entry = await joinQueue(equipmentId, memberId, session.sub);
    return jsonOk({ entry }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
});

/** Removes a queue entry by `id` query param. */
export const DELETE = withRole(["VOLUNTEER", "ADMIN"], async ({ request, session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const queueId = searchParams.get("id");
    if (!queueId) {
      return jsonError("id query param required", 400);
    }
    const result = await removeFromQueue(queueId, session.sub);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
});
