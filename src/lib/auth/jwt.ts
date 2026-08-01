/**
 * Access and refresh JWT sign/verify helpers (jose) and token TTL constants.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { Role } from "@/generated/prisma";
import { getJwtSecret } from "@/lib/env";

/** Access token lifetime passed to `jose` (`setExpirationTime`). */
export const ACCESS_TOKEN_TTL = "1h";
/** Refresh token lifetime passed to `jose` (`setExpirationTime`). */
export const REFRESH_TOKEN_TTL = "7d";
/** Access cookie `maxAge` in seconds (matches {@link ACCESS_TOKEN_TTL}). */
export const ACCESS_TOKEN_MAX_AGE = 60 * 60;
/** Refresh cookie `maxAge` in seconds (matches {@link REFRESH_TOKEN_TTL}). */
export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7;

/** Claims embedded in access and refresh tokens (subject is JWT `sub`). */
export type SessionPayload = {
  sub: string;
  role: Role;
  memberId?: string;
  /** When true, user must complete change-password before using the app. */
  mustChangePassword?: boolean;
};

/** Verified access JWT payload including standard JWT fields and `typ: "access"`. */
export type AccessTokenClaims = SessionPayload & JWTPayload & { typ: "access" };
/** Verified refresh JWT payload including standard JWT fields and `typ: "refresh"`. */
export type RefreshTokenClaims = SessionPayload & JWTPayload & { typ: "refresh" };

/**
 * Signs a new access token for the given session.
 *
 * @param payload - User id (`sub`), role, and optional member / password flags
 * @returns Compact JWT string
 */
export async function signAccessToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    role: payload.role,
    memberId: payload.memberId,
    mustChangePassword: Boolean(payload.mustChangePassword),
    typ: "access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(getJwtSecret());
}

/**
 * Signs a new refresh token for the given session.
 *
 * @param payload - User id (`sub`), role, and optional member / password flags
 * @returns Compact JWT string
 */
export async function signRefreshToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    role: payload.role,
    memberId: payload.memberId,
    mustChangePassword: Boolean(payload.mustChangePassword),
    typ: "refresh",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .sign(getJwtSecret());
}

/**
 * Validates an access JWT signature, expiry, type, and role.
 *
 * @param token - Compact JWT from the access cookie or `Authorization` header
 * @returns Parsed claims, or `null` when invalid
 */
export async function verifyAccessToken(
  token: string
): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.typ !== "access" || typeof payload.sub !== "string") {
      return null;
    }
    if (
      payload.role !== "MEMBER" &&
      payload.role !== "VOLUNTEER" &&
      payload.role !== "ADMIN"
    ) {
      return null;
    }
    return payload as AccessTokenClaims;
  } catch {
    return null;
  }
}

/**
 * Validates a refresh JWT signature, expiry, type, and role.
 *
 * @param token - Compact JWT from the refresh cookie
 * @returns Parsed claims, or `null` when invalid
 */
export async function verifyRefreshToken(
  token: string
): Promise<RefreshTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.typ !== "refresh" || typeof payload.sub !== "string") {
      return null;
    }
    if (
      payload.role !== "MEMBER" &&
      payload.role !== "VOLUNTEER" &&
      payload.role !== "ADMIN"
    ) {
      return null;
    }
    return payload as RefreshTokenClaims;
  } catch {
    return null;
  }
}

/**
 * Edge-safe verify for middleware (same secret encoding).
 *
 * @param token - Access JWT from cookies
 * @param secret - Pre-encoded `JWT_SECRET` bytes
 * @returns Parsed access claims, or `null` when invalid
 */
export async function verifyAccessTokenEdge(
  token: string,
  secret: Uint8Array
): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.typ !== "access" || typeof payload.sub !== "string") {
      return null;
    }
    if (
      payload.role !== "MEMBER" &&
      payload.role !== "VOLUNTEER" &&
      payload.role !== "ADMIN"
    ) {
      return null;
    }
    return payload as AccessTokenClaims;
  } catch {
    return null;
  }
}
