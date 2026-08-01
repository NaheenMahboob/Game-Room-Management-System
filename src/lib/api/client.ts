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
