/**
 * `POST /api/auth/register`
 *
 * Public member self-registration. Creates a PENDING account until an admin
 * verifies the government ID and signed waiver.
 * If create fails after uploads, orphan photo / gov ID files are removed.
 *
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import { selfRegisterMemberSchema } from "@/lib/validation/schemas";
import { selfRegisterMember } from "@/lib/services/members";
import { deleteOrphanRegistrationPhoto } from "@/lib/uploads/memberPhoto";
import { deleteOrphanRegistrationGovernmentId } from "@/lib/uploads/memberGovernmentId";
import {
  checkRateLimit,
  loginIpKey,
  recordRateLimitHit,
} from "@/lib/auth/rateLimit";

/**
 * Best-effort client IP from proxy headers or the socket address.
 *
 * @param request - Incoming Next.js request
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Registers a new member with chosen password; account stays PENDING.
 *
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */
export async function POST(request: NextRequest) {
  let uploadedPhotoUrl: string | undefined;
  let uploadedGovIdUrl: string | undefined;
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
    uploadedGovIdUrl = input.governmentIdUrl;

    const result = await selfRegisterMember(input);
    uploadedPhotoUrl = undefined;
    uploadedGovIdUrl = undefined;
    recordRateLimitHit(key, 60 * 60 * 1000);

    return jsonOk(
      {
        message:
          "Registration submitted. An admin will verify your government ID and waiver before you can sign in.",
        loginEmail: result.loginEmail,
        memberId: result.member.id,
      },
      201
    );
  } catch (error) {
    // Upload-then-register: remove files if the member row was never created.
    if (uploadedPhotoUrl) {
      await deleteOrphanRegistrationPhoto(uploadedPhotoUrl);
    }
    if (uploadedGovIdUrl) {
      await deleteOrphanRegistrationGovernmentId(uploadedGovIdUrl);
    }
    return handleRouteError(error);
  }
}
