/**
 * Edge middleware for portal and dashboard route guards.
 *
 * - Public: `/portal/login`, `/portal/register`, `/dashboard/login`
 * - Forces password change pages when JWT `mustChangePassword` is set
 *   (members → `/portal/change-password`, staff → `/dashboard/change-password`)
 * - Enforces MEMBER vs VOLUNTEER/ADMIN vs ADMIN for respective areas
 */

import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { verifyAccessTokenEdge } from "@/lib/auth/jwt";

function getSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPortalLogin = pathname === "/portal/login";
  const isPortalRegister = pathname === "/portal/register";
  const isPortalChangePassword = pathname === "/portal/change-password";
  const isDashboardLogin = pathname === "/dashboard/login";
  const isDashboardChangePassword = pathname === "/dashboard/change-password";
  const isAdminRoute = pathname.startsWith("/dashboard/admin");
  const isDashboardRoute =
    pathname.startsWith("/dashboard") && !isDashboardLogin;
  const isPortalRoute =
    pathname.startsWith("/portal") && !isPortalLogin && !isPortalRegister;

  // Public portal register / login pages skip auth.
  if (isPortalLogin || isPortalRegister || isDashboardLogin) {
    return NextResponse.next();
  }

  if (!isPortalRoute && !isDashboardRoute) {
    return NextResponse.next();
  }

  const secret = getSecret();
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  const session = token && secret ? await verifyAccessTokenEdge(token, secret) : null;

  if (isPortalRoute) {
    if (!session) {
      return NextResponse.redirect(new URL("/portal/login", request.url));
    }
    if (session.role !== "MEMBER") {
      return NextResponse.redirect(new URL("/dashboard/login", request.url));
    }
    // Force password change for members when admin reset the flag.
    if (session.mustChangePassword && !isPortalChangePassword) {
      return NextResponse.redirect(
        new URL("/portal/change-password", request.url)
      );
    }
    return NextResponse.next();
  }

  if (isAdminRoute) {
    if (!session) {
      return NextResponse.redirect(new URL("/dashboard/login", request.url));
    }
    if (session.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (session.mustChangePassword && !isDashboardChangePassword) {
      return NextResponse.redirect(
        new URL("/dashboard/change-password", request.url)
      );
    }
    return NextResponse.next();
  }

  if (isDashboardRoute) {
    if (!session) {
      return NextResponse.redirect(new URL("/dashboard/login", request.url));
    }
    if (session.role !== "VOLUNTEER" && session.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/portal/login", request.url));
    }
    // Same forced password change for volunteers/admins.
    if (session.mustChangePassword && !isDashboardChangePassword) {
      return NextResponse.redirect(
        new URL("/dashboard/change-password", request.url)
      );
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/portal/:path*", "/dashboard/:path*"],
};
