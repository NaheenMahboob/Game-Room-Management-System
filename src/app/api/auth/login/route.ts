import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { setAuthCookies } from "@/lib/auth/cookies";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  portal: z.enum(["member", "dashboard"]),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid credentials payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, password, portal } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { member: { select: { id: true } } },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  if (portal === "member" && user.role !== Role.MEMBER) {
    return NextResponse.json(
      { error: "Use the volunteer/admin dashboard login for this account" },
      { status: 403 }
    );
  }

  if (
    portal === "dashboard" &&
    user.role !== Role.VOLUNTEER &&
    user.role !== Role.ADMIN
  ) {
    return NextResponse.json(
      { error: "Use the member portal login for this account" },
      { status: 403 }
    );
  }

  const sessionPayload = {
    sub: user.id,
    role: user.role,
    memberId: user.member?.id,
  };

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(sessionPayload),
    signRefreshToken(sessionPayload),
  ]);

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      memberId: user.member?.id ?? null,
    },
  });

  setAuthCookies(response, accessToken, refreshToken);
  return response;
}
