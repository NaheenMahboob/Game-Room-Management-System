"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getOfflineQueue } from "@/lib/offline/queue";
import { syncOfflineQueue } from "@/lib/offline/sync";
import { useToast } from "@/components/ui/Toast";

export function ConnectionStatus() {
  const t = useTranslations("offline");
  const toast = useToast();
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshQueueCount = useCallback(async () => {
    const q = await getOfflineQueue();
    setQueued(q.length);
  }, []);

  const runSync = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      const { results, remaining } = await syncOfflineQueue();
      setQueued(remaining.length);
      const conflicts = results.filter((r) => r.conflict);
      const synced = results.filter((r) => r.ok).length;
      if (synced > 0) toast.push(t("synced"));
      if (conflicts.length > 0) {
        toast.push(
          `${t("conflict")}: ${conflicts.map((c) => c.error).join("; ")}`,
          "warn"
        );
      }
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Sync failed", "error");
    } finally {
      setSyncing(false);
      await refreshQueueCount();
    }
  }, [refreshQueueCount, t, toast]);

  useEffect(() => {
    setOnline(navigator.onLine);
    refreshQueueCount();

    const onOnline = () => {
      setOnline(true);
      runSync();
    };
    const onOffline = () => setOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const id = window.setInterval(refreshQueueCount, 5000);

    if (navigator.onLine) runSync();

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(id);
    };
  }, [refreshQueueCount, runSync]);

  const label = syncing
    ? t("syncing")
    : online
      ? t("online")
      : t("offline");

  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={`inline-flex min-h-10 items-center rounded-full px-3 font-semibold ${
          syncing
            ? "bg-sky-900/60 text-sky-200"
            : online
              ? "bg-emerald-900/50 text-emerald-300"
              : "bg-red-900/50 text-red-200"
        }`}
      >
        <span
          className={`mr-2 h-2 w-2 rounded-full ${
            syncing ? "bg-sky-400" : online ? "bg-emerald-400" : "bg-red-400"
          }`}
        />
        {label}
      </span>
      {queued > 0 ? (
        <button
          type="button"
          onClick={runSync}
          className="min-h-10 rounded-full bg-amber-900/50 px-3 font-semibold text-amber-200"
        >
          {t("queued", { count: queued })}
        </button>
      ) : null}
    </div>
  );
}
