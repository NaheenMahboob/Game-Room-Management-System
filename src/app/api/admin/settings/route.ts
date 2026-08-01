import { z } from "zod";
import { withRole } from "@/lib/auth/api";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";

export const GET = withRole(["ADMIN"], async () => {
  try {
    const settings = await prisma.setting.findMany({ orderBy: { key: "asc" } });
    return jsonOk({ settings });
  } catch (error) {
    return handleRouteError(error);
  }
});

const upsertSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export const PUT = withRole(["ADMIN"], async ({ request, session }) => {
  try {
    const body = upsertSchema.parse(await request.json());
    const setting = await prisma.setting.upsert({
      where: { key: body.key },
      update: { value: body.value },
      create: body,
    });
    await writeAuditLog({
      actionType: "SETTING_UPDATED",
      performedByUserId: session.sub,
      details: body,
    });
    return jsonOk({ setting });
  } catch (error) {
    return handleRouteError(error);
  }
});

void jsonError;
