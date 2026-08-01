/**
 * `POST /api/uploads/registration-photo`
 *
 * Public (rate-limited) multipart upload for member self-registration photos.
 * Returns a storage filename for the subsequent register call.
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import {
  parseMemberPhotoFormData,
  saveMemberPhotoFile,
} from "@/lib/uploads/memberPhoto";
import {
  checkRateLimit,
  recordRateLimitHit,
} from "@/lib/auth/rateLimit";

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Accepts an image from an unauthenticated registrant.
 *
 * @returns `201` with `{ photoUrl }` storage filename
 */
export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const key = `reg-photo:ip:${ip}`;
    const limit = checkRateLimit(key, 10, 15 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many uploads. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSec) },
        }
      );
    }

    const formData = await request.formData();
    const { buffer, mimeType } = await parseMemberPhotoFormData(formData);
    const photoUrl = await saveMemberPhotoFile(buffer, mimeType, "self");
    recordRateLimitHit(key, 15 * 60 * 1000);
    return jsonOk({ photoUrl }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
