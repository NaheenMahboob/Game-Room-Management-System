/**
 * Browser `fetch` wrapper for JSON API calls with consistent error handling.
 */

/**
 * Performs a JSON `fetch` to a same-origin API path and parses the body.
 *
 * Throws an `Error` with `status` and `payload` when the response is not OK
 * unless the status is listed in `allowStatuses`.
 *
 * @param path - API path (e.g. `/api/members`)
 * @param options - Standard `fetch` options plus optional allowed error statuses
 * @returns Parsed JSON body typed as `T`
 */
export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { allowStatuses?: number[] }
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  const data = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };

  const allowed = options?.allowStatuses ?? [];
  if (!response.ok && !allowed.includes(response.status)) {
    const err = new Error(data.error ?? `Request failed (${response.status})`);
    (err as Error & { status?: number; payload?: unknown }).status =
      response.status;
    (err as Error & { status?: number; payload?: unknown }).payload = data;
    throw err;
  }

  return data;
}
