/**
 * Equipment loans API for staff.
 * GET lists active loans; POST borrows equipment for a member.
 */

import { withRole } from "@/lib/auth/api";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import { borrowSchema } from "@/lib/validation/schemas";
import { borrowEquipment, listActiveLoans } from "@/lib/services/loans";

export const GET = withRole(["VOLUNTEER", "ADMIN"], async ({ request }) => {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId") ?? undefined;
    const loans = await listActiveLoans(memberId);
    return jsonOk({ loans });
  } catch (error) {
    return handleRouteError(error);
  }
});

export const POST = withRole(["VOLUNTEER", "ADMIN"], async ({ request, session }) => {
  try {
    const body = await request.json();
    const { memberId, equipmentIds } = borrowSchema.parse(body);
    const loans = await borrowEquipment(memberId, equipmentIds, session.sub);
    return jsonOk({ loans }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
});
