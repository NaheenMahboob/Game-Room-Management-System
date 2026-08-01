import { withAuth } from "@/lib/auth/api";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api/http";
import { updateMemberSchema } from "@/lib/validation/schemas";
import { getMemberById, updateMember } from "@/lib/services/members";

export const GET = withAuth(async ({ session }, rawParams) => {
  try {
    const params = rawParams as { id: string };
    const member = await getMemberById(params.id);
    if (!member) return jsonError("Member not found", 404);

    if (session.role === "MEMBER" && session.memberId !== member.id) {
      return jsonError("Forbidden", 403);
    }

    return jsonOk({ member });
  } catch (error) {
    return handleRouteError(error);
  }
});

export const PATCH = withAuth(async ({ request, session }, rawParams) => {
  try {
    const params = rawParams as { id: string };
    const member = await getMemberById(params.id);
    if (!member) return jsonError("Member not found", 404);

    const isStaff =
      session.role === "VOLUNTEER" || session.role === "ADMIN";
    const isSelf =
      session.role === "MEMBER" && session.memberId === member.id;

    if (!isStaff && !isSelf) {
      return jsonError("Forbidden", 403);
    }

    const body = await request.json();
    const input = updateMemberSchema.parse(body);

    if (isSelf) {
      const { membershipStatus: _, ...selfSafe } = input;
      const updated = await updateMember(
        params.id,
        selfSafe,
        session.sub,
        false
      );
      return jsonOk({ member: updated });
    }

    const updated = await updateMember(
      params.id,
      input,
      session.sub,
      session.role === "ADMIN"
    );
    return jsonOk({ member: updated });
  } catch (error) {
    return handleRouteError(error);
  }
});
