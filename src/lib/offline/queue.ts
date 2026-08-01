/**
 * IndexedDB queue for dashboard actions captured while the browser is offline.
 */

"use client";

import { get, set, del, update } from "idb-keyval";
import { nanoid } from "nanoid";

export type OfflineActionType =
  | "SIGN_IN"
  | "SIGN_OUT"
  | "BORROW"
  | "RETURN"
  | "REGISTER";

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

const QUEUE_KEY = "grms-offline-queue";
const FAILED_KEY = "grms-offline-failed";

export async function getOfflineQueue(): Promise<OfflineAction[]> {
  return (await get<OfflineAction[]>(QUEUE_KEY)) ?? [];
}

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

export async function clearOfflineQueue() {
  await del(QUEUE_KEY);
}

export async function setOfflineQueue(actions: OfflineAction[]) {
  await set(QUEUE_KEY, actions);
}

export async function removeOfflineAction(id: string) {
  await update<OfflineAction[]>(QUEUE_KEY, (current) =>
    (current ?? []).filter((a) => a.id !== id)
  );
}

export async function getFailedOfflineActions(): Promise<FailedOfflineAction[]> {
  return (await get<FailedOfflineAction[]>(FAILED_KEY)) ?? [];
}

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

export async function dismissFailedOfflineAction(id: string): Promise<void> {
  await update<FailedOfflineAction[]>(FAILED_KEY, (current) =>
    (current ?? []).filter((a) => a.id !== id)
  );
}

export async function clearFailedOfflineActions(): Promise<void> {
  await del(FAILED_KEY);
}
