/**
 * `POST /api/auth/register`
 *
 * Public member self-registration. Creates a PENDING account until staff
 * verifies the uploaded profile photo at the desk.
 * If create fails after the photo was uploaded, the orphan `self-*` file is removed.
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import { selfRegisterMemberSchema } from "@/lib/validation/schemas";
import { selfRegisterMember } from "@/lib/services/members";
import { deleteOrphanRegistrationPhoto } from "@/lib/uploads/memberPhoto";
import {
  checkRateLimit,
  loginIpKey,
  recordRateLimitHit,
} from "@/lib/auth/rateLimit";

/**
 * Best-effort client IP from proxy headers or the socket address.
 *
 * @param request - Incoming Next.js request
 */
function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Registers a new member with chosen password; account stays PENDING.
 */
export async function POST(request: NextRequest) {
  let uploadedPhotoUrl: string | undefined;
  try {
    const ip = clientIp(request);
    const key = loginIpKey(`reg:${ip}`);
    const limit = checkRateLimit(key, 5, 60 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many registration attempts. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSec) },
        }
      );
    }

    const body = await request.json();
    const input = selfRegisterMemberSchema.parse(body);
    uploadedPhotoUrl = input.photoUrl;

    const result = await selfRegisterMember(input);
    uploadedPhotoUrl = undefined; // owned by the new member row
    recordRateLimitHit(key, 60 * 60 * 1000);

    return jsonOk(
      {
        message:
          "Registration submitted. A volunteer will verify your photo before you can sign in.",
        loginEmail: result.loginEmail,
        memberId: result.member.id,
      },
      201
    );
  } catch (error) {
    // Upload-then-register: remove the file if the member row was never created.
    if (uploadedPhotoUrl) {
      await deleteOrphanRegistrationPhoto(uploadedPhotoUrl);
    }
    return handleRouteError(error);
  }
}
