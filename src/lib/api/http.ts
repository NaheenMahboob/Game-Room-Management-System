/**
 * Next.js route helpers: JSON responses and shared error mapping (Zod, business rules).
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Returns a JSON success response.
 *
 * @param data - Response body
 * @param status - HTTP status (default 200)
 */
export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Returns a JSON error response with optional validation or detail payload.
 *
 * @param error - Human-readable error message
 * @param status - HTTP status (default 400)
 * @param details - Optional structured details (e.g. Zod flatten output)
 */
export function jsonError(error: string, status = 400, details?: unknown) {
  return NextResponse.json(
    details === undefined ? { error } : { error, details },
    { status }
  );
}

/**
 * Maps thrown errors from route handlers to appropriate JSON responses.
 *
 * @param error - Caught exception from a route handler
 * @returns `NextResponse` with 400/404 for known errors, 500 otherwise
 */
export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return jsonError("Validation failed", 400, error.flatten());
  }
  if (error instanceof Error) {
    // Business "not found" messages map to 404 for clearer API clients.
    const notFound = /\bnot found\b/i.test(error.message);
    return jsonError(error.message, notFound ? 404 : 400);
  }
  return jsonError("Unexpected server error", 500);
}
