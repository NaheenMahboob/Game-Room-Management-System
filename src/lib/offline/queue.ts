/**
 * IndexedDB queue for dashboard actions captured while the browser is offline.
 */

"use client";

import { get, set, del, update } from "idb-keyval";
import { nanoid } from "nanoid";

/** Dashboard mutations that can be stored for offline replay. */
export type OfflineActionType =
  | "SIGN_IN"
  | "SIGN_OUT"
  | "BORROW"
  | "RETURN"
  | "REGISTER";

/** One queued HTTP action persisted in IndexedDB until sync succeeds. */
export type OfflineAction = {
  id: string;
  type: OfflineActionType;
  path: string;
  method: "POST" | "PATCH" | "DELETE";
  body?: unknown;
  createdAt: string;
};

/** Queued action that failed or conflicted during sync (needs staff attention). */
export type FailedOfflineAction = OfflineAction & {
  error: string;
  failedAt: string;
};

/** IndexedDB key for the pending offline action list. */
const QUEUE_KEY = "grms-offline-queue";
/** IndexedDB key for actions that failed during sync. */
const FAILED_KEY = "grms-offline-failed";

/** Reads all pending offline actions from IndexedDB. */
export async function getOfflineQueue(): Promise<OfflineAction[]> {
  return (await get<OfflineAction[]>(QUEUE_KEY)) ?? [];
}

/**
 * Appends a new offline action with generated id and timestamp.
 *
 * @param action - Action fields excluding `id` and `createdAt`
 */
export async function enqueueOfflineAction(
  action: Omit<OfflineAction, "id" | "createdAt">
): Promise<OfflineAction> {
  const item: OfflineAction = {
    ...action,
    id: nanoid(),
    createdAt: new Date().toISOString(),
  };
  await update<OfflineAction[]>(QUEUE_KEY, (current) => [
    ...(current ?? []),
    item,
  ]);
  return item;
}

/** Removes all pending offline actions from IndexedDB. */
export async function clearOfflineQueue() {
  await del(QUEUE_KEY);
}

/** Replaces the entire pending offline queue in IndexedDB. */
export async function setOfflineQueue(actions: OfflineAction[]) {
  await set(QUEUE_KEY, actions);
}

/** Removes a single pending action by id. */
export async function removeOfflineAction(id: string) {
  await update<OfflineAction[]>(QUEUE_KEY, (current) =>
    (current ?? []).filter((a) => a.id !== id)
  );
}

/** Reads sync failures that require staff review. */
export async function getFailedOfflineActions(): Promise<FailedOfflineAction[]> {
  return (await get<FailedOfflineAction[]>(FAILED_KEY)) ?? [];
}

/**
 * Records a failed sync attempt for an action (with error message and timestamp).
 *
 * @param action - The action that failed to sync
 * @param error - Human-readable failure reason
 */
export async function addFailedOfflineAction(
  action: OfflineAction,
  error: string
): Promise<void> {
  const item: FailedOfflineAction = {
    ...action,
    error,
    failedAt: new Date().toISOString(),
  };
  await update<FailedOfflineAction[]>(FAILED_KEY, (current) => [
    ...(current ?? []),
    item,
  ]);
}

/** Removes one failed action from the failed list after staff dismisses it. */
export async function dismissFailedOfflineAction(id: string): Promise<void> {
  await update<FailedOfflineAction[]>(FAILED_KEY, (current) =>
    (current ?? []).filter((a) => a.id !== id)
  );
}

/** Clears all failed offline actions from IndexedDB. */
export async function clearFailedOfflineActions(): Promise<void> {
  await del(FAILED_KEY);
}
