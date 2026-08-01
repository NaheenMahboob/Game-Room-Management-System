import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { Role } from "@/generated/prisma";
import { getJwtSecret } from "@/lib/env";

export const ACCESS_TOKEN_TTL = "1h";
export const REFRESH_TOKEN_TTL = "7d";
export const ACCESS_TOKEN_MAX_AGE = 60 * 60;
export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7;

export type SessionPayload = {
  sub: string;
  role: Role;
  memberId?: string;
  /** When true, user must complete change-password before using the app. */
  mustChangePassword?: boolean;
};

export type AccessTokenClaims = SessionPayload & JWTPayload & { typ: "access" };
export type RefreshTokenClaims = SessionPayload & JWTPayload & { typ: "refresh" };

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

/** Edge-safe verify for middleware (same secret encoding). */
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
