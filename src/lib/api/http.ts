import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(error: string, status = 400, details?: unknown) {
  return NextResponse.json(
    details === undefined ? { error } : { error, details },
    { status }
  );
}

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
