"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  dismissFailedOfflineAction,
  getFailedOfflineActions,
  getOfflineQueue,
  type FailedOfflineAction,
} from "@/lib/offline/queue";
import { syncOfflineQueue } from "@/lib/offline/sync";
import { useToast } from "@/components/ui/Toast";

/**
 * Shows online/offline state, pending queue count, and failed sync actions
 * staff can dismiss after resolving manually at the desk.
 */
export function ConnectionStatus() {
  const t = useTranslations("offline");
  const toast = useToast();
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);
  const [failed, setFailed] = useState<FailedOfflineAction[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [showFailed, setShowFailed] = useState(false);

  const refreshCounts = useCallback(async () => {
    const [q, f] = await Promise.all([
      getOfflineQueue(),
      getFailedOfflineActions(),
    ]);
    setQueued(q.length);
    setFailed(f);
  }, []);

  const runSync = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      const { results, remaining } = await syncOfflineQueue();
      setQueued(remaining.length);
      const failedResults = results.filter((r) => !r.ok);
      const synced = results.filter((r) => r.ok).length;
      if (synced > 0) toast.push(t("synced"));
      if (failedResults.length > 0) {
        toast.push(
          `${t("syncFailed")}: ${failedResults
            .map((c) => c.error)
            .filter(Boolean)
            .join("; ")}`,
          "warn"
        );
        setShowFailed(true);
      }
      await refreshCounts();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Sync failed", "error");
    } finally {
      setSyncing(false);
      await refreshCounts();
    }
  }, [refreshCounts, t, toast]);

  useEffect(() => {
    setOnline(navigator.onLine);
    refreshCounts();

    const onOnline = () => {
      setOnline(true);
      runSync();
    };
    const onOffline = () => setOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const id = window.setInterval(refreshCounts, 5000);

    if (navigator.onLine) runSync();

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(id);
    };
  }, [refreshCounts, runSync]);

  async function dismissFailed(id: string) {
    await dismissFailedOfflineAction(id);
    await refreshCounts();
  }

  const label = syncing
    ? t("syncing")
    : online
      ? t("online")
      : t("offline");

  return (
    <div className="relative flex flex-wrap items-center gap-2 text-xs">
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
      {failed.length > 0 ? (
        <button
          type="button"
          onClick={() => setShowFailed((v) => !v)}
          className="min-h-10 rounded-full bg-red-900/50 px-3 font-semibold text-red-200"
        >
          {t("failed", { count: failed.length })}
        </button>
      ) : null}

      {showFailed && failed.length > 0 ? (
        <div className="absolute right-0 top-12 z-40 w-80 rounded-xl border border-red-800 bg-slate-950 p-3 shadow-xl">
          <p className="mb-2 font-semibold text-red-200">{t("failedTitle")}</p>
          <ul className="max-h-60 space-y-2 overflow-y-auto">
            {failed.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-slate-700 bg-slate-900/80 p-2"
              >
                <p className="font-medium text-slate-200">
                  {item.type.replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-red-300">{item.error}</p>
                <button
                  type="button"
                  onClick={() => dismissFailed(item.id)}
                  className="mt-2 min-h-9 rounded-lg bg-slate-700 px-3 font-semibold"
                >
                  {t("dismiss")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
