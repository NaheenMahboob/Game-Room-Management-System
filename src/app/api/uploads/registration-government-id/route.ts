/**
 * `POST /api/uploads/registration-government-id`
 *
 * Public (rate-limited) multipart upload for self-registration government ID photos.
 * Returns a storage filename for the subsequent register call.
 *
 * @author Muhammad Naheen Mahboob
 */

import { NextRequest, NextResponse } from "next/server";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import { parseMemberPhotoFormData } from "@/lib/uploads/memberPhoto";
import { saveMemberGovernmentIdFile } from "@/lib/uploads/memberGovernmentId";
import {
  checkRateLimit,
  recordRateLimitHit,
} from "@/lib/auth/rateLimit";

/**
 * Best-effort client IP from proxy headers or the socket address.
 *
 * @param request - Incoming Next.js request
 * @author Muhammad Naheen Mahboob
 */
function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Accepts a government ID image from an unauthenticated registrant.
 *
 * @returns `201` with `{ governmentIdUrl }` storage filename
 * @author Muhammad Naheen Mahboob
 */
export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const key = `reg-gid:ip:${ip}`;
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
    const governmentIdUrl = await saveMemberGovernmentIdFile(
      buffer,
      mimeType,
      "self-gid"
    );
    recordRateLimitHit(key, 15 * 60 * 1000);
    return jsonOk({ governmentIdUrl }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
