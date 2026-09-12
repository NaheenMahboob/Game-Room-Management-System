"use client";

/**
 * Loads and embeds the current waiver template PDF before the signature pad.
 *
 * @author Muhammad Naheen Mahboob
 */

import { useEffect, useState } from "react";

type WaiverAgreementProps = {
  /** Optional className for the outer panel. */
  className?: string;
};

/**
 * Fetches `GET /api/waivers/current` and embeds the template PDF for reading.
 */
export function WaiverAgreement({ className }: WaiverAgreementProps) {
  const [version, setVersion] = useState<number | null>(null);
  const [pdfSrc, setPdfSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/waivers/current");
        const data = (await res.json()) as {
          version?: number;
          pdfSrc?: string;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load waiver");
        }
        if (cancelled) return;
        setVersion(data.version ?? null);
        setPdfSrc(data.pdfSrc ?? null);
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
      ) : pdfSrc == null ? (
        <p className="text-sm text-slate-400">Loading waiver…</p>
      ) : (
        <div className="space-y-2">
          <iframe
            title={`Liability waiver version ${version ?? ""}`}
            src={pdfSrc}
            className="h-72 w-full rounded-xl border border-slate-700 bg-slate-950"
          />
          <a
            href={pdfSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm font-medium text-emerald-400 hover:text-emerald-300"
          >
            Open full PDF
          </a>
        </div>
      )}
      <p className="text-xs text-slate-400">
        By signing below, a PDF of this waiver with your signature is stored with
        your membership record.
      </p>
    </div>
  );
}
