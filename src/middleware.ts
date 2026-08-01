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
  const isDashboardLogin = pathname === "/dashboard/login";
  const isAdminRoute = pathname.startsWith("/dashboard/admin");
  const isDashboardRoute =
    pathname.startsWith("/dashboard") && !isDashboardLogin;
  const isPortalRoute = pathname.startsWith("/portal") && !isPortalLogin;

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
    return NextResponse.next();
  }

  if (isAdminRoute) {
    if (!session) {
      return NextResponse.redirect(new URL("/dashboard/login", request.url));
    }
    if (session.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
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
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/portal/:path*", "/dashboard/:path*"],
};
