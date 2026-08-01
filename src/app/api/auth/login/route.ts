/**
 * `POST /api/auth/login`
 *
 * Authenticates a user for the member portal or volunteer/admin dashboard.
 * Failed attempts are rate-limited per client IP and per email.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { setAuthCookies } from "@/lib/auth/cookies";
import {
  checkRateLimit,
  clearRateLimit,
  loginEmailKey,
  loginIpKey,
  recordRateLimitHit,
} from "@/lib/auth/rateLimit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  portal: z.enum(["member", "dashboard"]),
});

/**
 * Best-effort client IP from proxy headers or the socket address.
 *
 * @param request - Incoming Next.js request
 */
function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // First hop is the original client when behind a reverse proxy.
    return forwarded.split(",")[0]!.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Logs a user in and sets HTTP-only auth cookies when credentials and portal
 * role checks succeed.
 *
 * @returns `200` with user summary, `401`/`403` on auth failure, `429` when limited
 */
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
  const normalizedEmail = email.toLowerCase();
  const ip = clientIp(request);
  const ipKey = loginIpKey(ip);
  const emailKey = loginEmailKey(normalizedEmail);

  // Block before expensive bcrypt work when either bucket is exhausted.
  const ipLimit = checkRateLimit(ipKey);
  const emailLimit = checkRateLimit(emailKey);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    const retryAfterSec = Math.max(
      ipLimit.retryAfterSec,
      emailLimit.retryAfterSec
    );
    return NextResponse.json(
      {
        error: "Too many login attempts. Try again later.",
        retryAfterSec,
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) },
      }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: { member: { select: { id: true } } },
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    recordRateLimitHit(ipKey);
    recordRateLimitHit(emailKey);
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  if (portal === "member" && user.role !== Role.MEMBER) {
    recordRateLimitHit(ipKey);
    recordRateLimitHit(emailKey);
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
    recordRateLimitHit(ipKey);
    recordRateLimitHit(emailKey);
    return NextResponse.json(
      { error: "Use the member portal login for this account" },
      { status: 403 }
    );
  }

  // Successful auth resets both buckets so occasional typos don't linger.
  clearRateLimit(ipKey);
  clearRateLimit(emailKey);

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
