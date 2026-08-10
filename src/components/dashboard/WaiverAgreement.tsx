"use client";

/**
 * Loads and displays the current waiver text before the signature pad.
 *
 * @author Muhammad Naheen Mahboob
 */

import { useEffect, useState } from "react";

type WaiverAgreementProps = {
  /** Optional className for the outer panel. */
  className?: string;
};

/**
 * Fetches `GET /api/waivers/current` and renders the legal copy to scroll/read.
 */
export function WaiverAgreement({ className }: WaiverAgreementProps) {
  const [version, setVersion] = useState<number | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/waivers/current");
        const data = (await res.json()) as {
          version?: number;
          text?: string;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load waiver");
        }
        if (cancelled) return;
        setVersion(data.version ?? null);
        setText(data.text ?? "");
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load waiver"
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className={
        className ??
        "space-y-2 rounded-2xl border border-slate-700 bg-slate-900/60 p-4"
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">Liability waiver *</p>
        {version != null ? (
          <span className="text-xs text-slate-400">Version {version}</span>
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : text == null ? (
        <p className="text-sm text-slate-400">Loading waiver…</p>
      ) : (
        <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-700 bg-slate-950/80 p-3 text-sm leading-relaxed text-slate-200">
          {text}
        </div>
      )}
      <p className="text-xs text-slate-400">
        By signing below, a PDF of this waiver with your signature is stored with
        your membership record.
      </p>
    </div>
  );
}
