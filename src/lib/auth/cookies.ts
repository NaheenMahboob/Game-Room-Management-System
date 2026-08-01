/**
 * HttpOnly auth cookie names, set/clear helpers, and server cookie readers.
 */

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
} from "@/lib/auth/jwt";

export const ACCESS_COOKIE = "grms_access";
export const REFRESH_COOKIE = "grms_refresh";

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

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

export function getAccessTokenFromCookies(): string | undefined {
  return cookies().get(ACCESS_COOKIE)?.value;
}

export function getRefreshTokenFromCookies(): string | undefined {
  return cookies().get(REFRESH_COOKIE)?.value;
}
