/**
 * `POST /api/loans/return`
 *
 * Returns one or more loans, or all loans for a member.
 */

import { withRole } from "@/lib/auth/api";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api/http";
import { returnLoanSchema } from "@/lib/validation/schemas";
import { returnLoans, returnLoansForMember } from "@/lib/services/loans";

/** Returns loans by id(s) or all loans for a member. */
export const POST = withRole(["VOLUNTEER", "ADMIN"], async ({ request, session }) => {
  try {
    const body = await request.json();
    const input = returnLoanSchema.parse(body);

    if (input.returnAll && input.memberId) {
      const loans = await returnLoansForMember(
        input.memberId,
        session.sub,
        input.conditionNotes
      );
      return jsonOk({ loans });
    }

    const ids = [
      ...(input.loanId ? [input.loanId] : []),
      ...(input.loanIds ?? []),
    ];
    if (ids.length === 0) {
      return jsonError("Provide loanId, loanIds, or returnAll with memberId");
    }

    const loans = await returnLoans(ids, session.sub, input.conditionNotes);
    return jsonOk({ loans });
  } catch (error) {
    return handleRouteError(error);
  }
});
