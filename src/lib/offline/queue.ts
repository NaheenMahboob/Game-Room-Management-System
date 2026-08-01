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

const QUEUE_KEY = "grms-offline-queue";

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
