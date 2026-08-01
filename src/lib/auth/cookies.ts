/**
 * HttpOnly auth cookie names, set/clear helpers, and server cookie readers.
 */

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
} from "@/lib/auth/jwt";

/** Cookie name for the short-lived access JWT. */
export const ACCESS_COOKIE = "grms_access";
/** Cookie name for the refresh JWT (scoped to the refresh route). */
export const REFRESH_COOKIE = "grms_refresh";

/** Shared security flags for auth cookies. */
function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

/**
 * Attaches access and refresh tokens to the response as HttpOnly cookies.
 *
 * @param response - Outgoing response (login / refresh)
 * @param accessToken - Signed access JWT
 * @param refreshToken - Signed refresh JWT
 */
export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string
) {
  response.cookies.set(ACCESS_COOKIE, accessToken, {
    ...cookieBase(),
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  response.cookies.set(REFRESH_COOKIE, refreshToken, {
    ...cookieBase(),
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: "/api/auth/refresh",
  });
}

/**
 * Clears auth cookies (logout).
 *
 * @param response - Outgoing response
 */
export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", {
    ...cookieBase(),
    maxAge: 0,
  });
  response.cookies.set(REFRESH_COOKIE, "", {
    ...cookieBase(),
    path: "/api/auth/refresh",
    maxAge: 0,
  });
}

/**
 * Reads the access token from the current request cookies (Server Components / route handlers).
 *
 * @returns Raw JWT string, or `undefined` if absent
 */
export function getAccessTokenFromCookies(): string | undefined {
  return cookies().get(ACCESS_COOKIE)?.value;
}

/**
 * Reads the refresh token from the current request cookies.
 *
 * @returns Raw JWT string, or `undefined` if absent
 */
export function getRefreshTokenFromCookies(): string | undefined {
  return cookies().get(REFRESH_COOKIE)?.value;
}
