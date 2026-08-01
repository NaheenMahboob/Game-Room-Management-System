import { withRole } from "@/lib/auth/api";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import { signInSchema } from "@/lib/validation/schemas";
import { signInMember } from "@/lib/services/attendance";

export const POST = withRole(["VOLUNTEER", "ADMIN"], async ({ request, session }) => {
  try {
    const body = await request.json();
    const { memberId } = signInSchema.parse(body);
    const attendance = await signInMember(memberId, session.sub);
    return jsonOk({ attendance }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
});
