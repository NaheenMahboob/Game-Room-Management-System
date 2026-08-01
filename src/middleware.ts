/**
 * Edge middleware for portal and dashboard route guards.
 *
 * - Portal: any authenticated user with `memberId` (members + promoted staff)
 * - Dashboard: VOLUNTEER/ADMIN; admin suite still ADMIN-only
 * - Forces password change pages when JWT `mustChangePassword` is set
 */

import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { verifyAccessTokenEdge } from "@/lib/auth/jwt";

/**
 * Encodes `JWT_SECRET` for Edge JWT verification.
 *
 * @returns Secret bytes when configured (min length 32), otherwise `null`
 */
function getSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

/**
 * Protects `/portal/*` and `/dashboard/*` routes: redirects unauthenticated or
 * unauthorized users and enforces password-change flows.
 *
 * @param request - Incoming Edge request
 * @returns `NextResponse.next()` or redirect to login / change-password
 */
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
    // Promoted volunteers/admins keep a member profile and may use the portal.
    if (!session.memberId) {
      return NextResponse.redirect(new URL("/dashboard/login", request.url));
    }
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
    if (session.mustChangePassword && !isDashboardChangePassword) {
      return NextResponse.redirect(
        new URL("/dashboard/change-password", request.url)
      );
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

/** Paths matched by this middleware (portal and dashboard trees). */
export const config = {
  matcher: ["/portal/:path*", "/dashboard/:path*"],
};
