import { z } from "zod";
import { withRole } from "@/lib/auth/api";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import { signInMember, signOutMember } from "@/lib/services/attendance";
import { borrowEquipment, returnLoans, returnLoansForMember } from "@/lib/services/loans";
import { registerMember } from "@/lib/services/members";

const actionSchema = z.object({
  id: z.string(),
  type: z.enum(["SIGN_IN", "SIGN_OUT", "BORROW", "RETURN", "REGISTER"]),
  path: z.string(),
  method: z.enum(["POST", "PATCH", "DELETE"]),
  body: z.unknown().optional(),
  createdAt: z.string(),
});

const syncSchema = z.object({
  actions: z.array(actionSchema).max(100),
});

export const POST = withRole(["VOLUNTEER", "ADMIN"], async ({ request, session }) => {
  try {
    const { actions } = syncSchema.parse(await request.json());
    const results = [];

    for (const action of actions) {
      try {
        const body = (action.body ?? {}) as Record<string, unknown>;

        if (action.type === "SIGN_IN") {
          const memberId = String(body.memberId ?? "");
          await signInMember(memberId, session.sub);
          results.push({ id: action.id, ok: true });
          continue;
        }

        if (action.type === "SIGN_OUT") {
          const memberId = String(body.memberId ?? "");
          const force = Boolean(body.forceReturnEquipment);
          const result = await signOutMember(memberId, session.sub, force);
          if (result.needsConfirmation) {
            results.push({
              id: action.id,
              ok: false,
              conflict: true,
              error: result.message,
              data: result.outstandingLoans,
            });
          } else {
            results.push({ id: action.id, ok: true, data: result });
          }
          continue;
        }

        if (action.type === "BORROW") {
          const memberId = String(body.memberId ?? "");
          const equipmentIds = (body.equipmentIds as string[]) ?? [];
          try {
            const loans = await borrowEquipment(
              memberId,
              equipmentIds,
              session.sub
            );
            results.push({ id: action.id, ok: true, data: { loans } });
          } catch (err) {
            results.push({
              id: action.id,
              ok: false,
              conflict: true,
              error: err instanceof Error ? err.message : "Borrow conflict",
            });
          }
          continue;
        }

        if (action.type === "RETURN") {
          if (body.returnAll && body.memberId) {
            const loans = await returnLoansForMember(
              String(body.memberId),
              session.sub,
              body.conditionNotes as string | undefined
            );
            results.push({ id: action.id, ok: true, data: { loans } });
          } else {
            const ids = [
              ...(body.loanId ? [String(body.loanId)] : []),
              ...((body.loanIds as string[]) ?? []),
            ];
            const loans = await returnLoans(
              ids,
              session.sub,
              body.conditionNotes as string | undefined
            );
            results.push({ id: action.id, ok: true, data: { loans } });
          }
          continue;
        }

        if (action.type === "REGISTER") {
          const result = await registerMember(
            body as never,
            session.sub
          );
          results.push({ id: action.id, ok: true, data: result });
          continue;
        }

        results.push({
          id: action.id,
          ok: false,
          error: "Unknown action type",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sync failed";
        const conflict =
          /already|in use|checked out|not found|inactive|consent|waiver/i.test(
            message
          );
        results.push({
          id: action.id,
          ok: false,
          conflict,
          error: message,
        });
      }
    }

    return jsonOk({ results });
  } catch (error) {
    return handleRouteError(error);
  }
});
