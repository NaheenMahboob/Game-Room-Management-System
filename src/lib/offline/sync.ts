/**
 * Offline-aware dashboard fetch: replays queued actions when back online.
 */

"use client";

import { apiFetch } from "@/lib/api/client";
import {
  addFailedOfflineAction,
  enqueueOfflineAction,
  getOfflineQueue,
  removeOfflineAction,
  type OfflineAction,
  type OfflineActionType,
} from "@/lib/offline/queue";

const QUEUEABLE = new Set<string>([
  "/api/attendance/sign-in",
  "/api/attendance/sign-out",
  "/api/loans",
  "/api/loans/return",
  // Desk registration is online-only (needs a real photo upload first).
]);

function inferType(path: string, method: string): OfflineActionType | null {
  if (path.startsWith("/api/attendance/sign-in")) return "SIGN_IN";
  if (path.startsWith("/api/attendance/sign-out")) return "SIGN_OUT";
  if (path === "/api/loans" && method === "POST") return "BORROW";
  if (path.startsWith("/api/loans/return")) return "RETURN";
  return null;
}

export async function dashboardFetch<T>(
  path: string,
  options?: RequestInit & { allowStatuses?: number[]; queueWhenOffline?: boolean }
): Promise<T> {
  const method = (options?.method ?? "GET").toUpperCase();
  const queueWhenOffline = options?.queueWhenOffline !== false;
  const canQueue =
    queueWhenOffline &&
    typeof navigator !== "undefined" &&
    !navigator.onLine &&
    QUEUEABLE.has(path.split("?")[0]!) &&
    ["POST", "PATCH", "DELETE"].includes(method);

  if (canQueue) {
    const type = inferType(path, method);
    if (type) {
      let body: unknown;
      if (typeof options?.body === "string") {
        try {
          body = JSON.parse(options.body);
        } catch {
          body = options.body;
        }
      }
      await enqueueOfflineAction({
        type,
        path,
        method: method as "POST" | "PATCH" | "DELETE",
        body,
      });
      return {
        queued: true,
        message: "Saved offline — will sync when connection returns",
      } as T;
    }
  }

  return apiFetch<T>(path, options);
}

export type SyncResult = {
  id: string;
  ok: boolean;
  conflict?: boolean;
  error?: string;
  data?: unknown;
};

/**
 * Replays the offline queue. Successful items are removed; failures move to the
 * failed list so staff can see the error and dismiss (instead of infinite retry).
 */
export async function syncOfflineQueue(): Promise<{
  results: SyncResult[];
  remaining: OfflineAction[];
}> {
  const queue = await getOfflineQueue();
  if (queue.length === 0) return { results: [], remaining: [] };

  const byId = new Map(queue.map((a) => [a.id, a]));

  const response = await apiFetch<{ results: SyncResult[] }>("/api/sync", {
    method: "POST",
    body: JSON.stringify({ actions: queue }),
  });

  for (const result of response.results) {
    const action = byId.get(result.id);
    if (result.ok) {
      await removeOfflineAction(result.id);
      continue;
    }
    if (action) {
      await removeOfflineAction(result.id);
      await addFailedOfflineAction(action, result.error ?? "Sync failed");
    }
  }

  const remaining = await getOfflineQueue();
  return { results: response.results, remaining };
}
