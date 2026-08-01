/**
 * `POST /api/auth/logout`
 *
 * Clears access and refresh auth cookies.
 */

import { NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth/cookies";

/** Clears auth cookies and ends the session. */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
