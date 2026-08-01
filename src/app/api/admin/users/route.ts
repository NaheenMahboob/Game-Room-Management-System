import { z } from "zod";
import { withRole } from "@/lib/auth/api";
import { jsonOk, jsonError, handleRouteError } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { writeAuditLog } from "@/lib/audit/log";
import { generateTempPassword } from "@/lib/members/ids";

const createUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(["VOLUNTEER", "ADMIN"]),
  password: z.string().min(8).optional(),
});

const updateUserSchema = z.object({
  role: z.enum(["MEMBER", "VOLUNTEER", "ADMIN"]).optional(),
  resetPassword: z.boolean().optional(),
  newPassword: z.string().min(8).optional(),
});

export const GET = withRole(["ADMIN"], async () => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        member: { select: { id: true, fullName: true } },
      },
    });
    return jsonOk({ users });
  } catch (error) {
    return handleRouteError(error);
  }
});

export const POST = withRole(["ADMIN"], async ({ request, session }) => {
  try {
    const body = createUserSchema.parse(await request.json());
    const email = body.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return jsonError("Email already in use", 409);

    const password = body.password ?? generateTempPassword();
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, role: body.role, passwordHash },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    await writeAuditLog({
      actionType: "USER_CREATED",
      performedByUserId: session.sub,
      details: { userId: user.id, email: user.email, role: user.role },
    });

    return jsonOk({ user, temporaryPassword: password }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
});

export const PATCH = withRole(["ADMIN"], async ({ request, session }) => {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return jsonError("id query param required", 400);

    const body = updateUserSchema.parse(await request.json());
    const data: { role?: "MEMBER" | "VOLUNTEER" | "ADMIN"; passwordHash?: string } =
      {};
    let temporaryPassword: string | undefined;

    if (body.role) data.role = body.role;
    if (body.resetPassword || body.newPassword) {
      temporaryPassword = body.newPassword ?? generateTempPassword();
      data.passwordHash = await hashPassword(temporaryPassword);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, role: true, createdAt: true },
    });

    await writeAuditLog({
      actionType: "USER_UPDATED",
      performedByUserId: session.sub,
      details: {
        userId: user.id,
        role: body.role ?? null,
        passwordReset: Boolean(temporaryPassword),
      },
    });

    return jsonOk({ user, temporaryPassword });
  } catch (error) {
    return handleRouteError(error);
  }
});
